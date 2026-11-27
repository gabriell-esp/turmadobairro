import { db } from "./db";

/**
 * Cliente do WPPConnect Server (https://github.com/wppconnect-team/wppconnect-server).
 * Endpoints usados: generate-token, start-session, status-session, check-connection-session, send-message, logout-session.
 */

const base = () => (process.env.WPP_BASE_URL ?? "").replace(/\/$/, "");
const session = () => process.env.WPP_SESSION ?? "turmadobairro";
export const isWppConfigured = () => !!base();

let cachedToken: { value: string; at: number } | null = null;

async function getToken(force = false): Promise<string> {
  if (process.env.WPP_TOKEN) return process.env.WPP_TOKEN;
  if (!force && cachedToken && Date.now() - cachedToken.at < 6 * 3600_000) return cachedToken.value;
  const secret = process.env.WPP_SECRET_KEY;
  if (!secret) throw new Error("WPP_SECRET_KEY/WPP_TOKEN não configurado.");
  const res = await fetch(`${base()}/api/${session()}/${secret}/generate-token`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string };
  if (!res.ok || !data.token) throw new Error(`WPPConnect: não foi possível gerar token (${res.status}).`);
  cachedToken = { value: data.token, at: Date.now() };
  return data.token;
}

async function wpp<T = any>(path: string, init: RequestInit = {}, retry = true): Promise<{ status: number; data: T }> {
  if (!isWppConfigured()) throw new Error("WhatsApp não configurado (WPP_BASE_URL).");
  const token = await getToken();
  const res = await fetch(`${base()}/api/${session()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (res.status === 401 && retry && !process.env.WPP_TOKEN) {
    await getToken(true);
    return wpp<T>(path, init, false);
  }
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

export type WppStatus = {
  configured: boolean;
  connected: boolean;
  state: string; // CONNECTED | QRCODE | CLOSED | ERROR...
  qrcode?: string;
  error?: string;
};

export async function getWppStatus(): Promise<WppStatus> {
  if (!isWppConfigured()) return { configured: false, connected: false, state: "NOT_CONFIGURED" };
  try {
    const { data } = await wpp<{ status?: string; qrcode?: string }>("/status-session");
    const state = String(data.status ?? "CLOSED").toUpperCase();
    return { configured: true, connected: state === "CONNECTED" || state === "INCHAT", state, qrcode: data.qrcode };
  } catch (e) {
    return { configured: true, connected: false, state: "ERROR", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function startWppSession(): Promise<WppStatus> {
  try {
    const { data } = await wpp<{ status?: string; qrcode?: string }>("/start-session", {
      method: "POST",
      body: JSON.stringify({ waitQrCode: true }),
    });
    const state = String(data.status ?? "CLOSED").toUpperCase();
    return { configured: true, connected: state === "CONNECTED" || state === "INCHAT", state, qrcode: data.qrcode };
  } catch (e) {
    return { configured: true, connected: false, state: "ERROR", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function logoutWppSession() {
  await wpp("/logout-session", { method: "POST" });
}

export async function sendWhatsAppText(phone: string, message: string): Promise<void> {
  const { status, data } = await wpp<{ status?: string; message?: string }>("/send-message", {
    method: "POST",
    body: JSON.stringify({ phone, message, isGroup: false, isNewsletter: false }),
  });
  if (status >= 400 || (data as any)?.status === "error") {
    throw new Error(`WPPConnect ${status}: ${(data as any)?.message ?? "erro ao enviar"}`);
  }
}

// ───────────────────────── Fila com retentativa ─────────────────────────

const MAX_ATTEMPTS = 6;
const backoffMin = (attempt: number) => [1, 5, 15, 60, 180, 360][Math.min(attempt, 5)];

export async function enqueueWhatsApp(args: { orderId?: string | null; kind: string; phone: string; body: string }) {
  const msg = await db.whatsAppMessage.create({
    data: { orderId: args.orderId ?? null, kind: args.kind, phone: args.phone, body: args.body },
  });
  await attemptSend(msg.id); // tentativa imediata; se falhar, o cron reenvia
  return msg.id;
}

export async function attemptSend(id: string): Promise<boolean> {
  // "claim" otimista para evitar envio duplicado em execuções concorrentes
  const claimed = await db.whatsAppMessage.updateMany({
    where: { id, status: { in: ["QUEUED", "FAILED"] }, nextAttemptAt: { lte: new Date() } },
    data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 2 * 60_000) },
  });
  if (claimed.count === 0) return false;
  const msg = await db.whatsAppMessage.findUniqueOrThrow({ where: { id } });
  try {
    await sendWhatsAppText(msg.phone, msg.body);
    await db.whatsAppMessage.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
    return true;
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await db.whatsAppMessage.update({
      where: { id },
      data: {
        status: msg.attempts >= MAX_ATTEMPTS ? "FAILED" : "QUEUED",
        lastError: error,
        nextAttemptAt: new Date(Date.now() + backoffMin(msg.attempts) * 60_000),
      },
    });
    return false;
  }
}

export async function processWhatsAppQueue(limit = 20) {
  const due = await db.whatsAppMessage.findMany({
    where: { status: "QUEUED", nextAttemptAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  for (const m of due) if (await attemptSend(m.id)) sent++;
  return { processed: due.length, sent };
}

/** Reenvio manual pelo painel. */
export async function retryMessage(id: string) {
  await db.whatsAppMessage.updateMany({
    where: { id, status: { not: "SENT" } },
    data: { status: "QUEUED", attempts: 0, nextAttemptAt: new Date() },
  });
  return attemptSend(id);
}
