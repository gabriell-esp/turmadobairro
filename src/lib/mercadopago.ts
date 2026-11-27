import { createHmac } from "node:crypto";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { db } from "./db";
import { decrypt, encrypt, safeEqual } from "./crypto";
import { appUrl } from "./request";

/** Chaves (na tabela Setting) das credenciais salvas pelo painel. Os segredos ficam criptografados. */
export const MP_KEYS = { token: "mp_access_token", webhook: "mp_webhook_secret", installments: "mp_max_installments" } as const;

export type MpSource = "panel" | "env" | "none";
export type MpCreds = {
  accessToken: string;
  webhookSecret: string;
  maxInstallments: number;
  tokenSource: MpSource;
  webhookSource: MpSource;
};

/**
 * Credenciais do Mercado Pago: o que foi salvo no painel (Configurações) vale mais que as
 * variáveis de ambiente (MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET), que continuam como alternativa.
 */
export async function getMpCreds(): Promise<MpCreds> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.values(MP_KEYS) } } });
  const row = (k: string) => rows.find((r) => r.key === k)?.value ?? "";
  const open = (k: string): string => {
    const v = row(k);
    if (!v) return "";
    try {
      return decrypt(v);
    } catch {
      console.error(`[mp] não foi possível ler "${k}" (chave de criptografia mudou?). Salve novamente em Configurações.`);
      return "";
    }
  };
  const pick = (panel: string, env: string | undefined): { v: string; src: MpSource } => {
    if (panel) return { v: panel, src: "panel" };
    const e = env?.trim() ?? "";
    return e ? { v: e, src: "env" } : { v: "", src: "none" };
  };
  const t = pick(open(MP_KEYS.token), process.env.MP_ACCESS_TOKEN);
  const w = pick(open(MP_KEYS.webhook), process.env.MP_WEBHOOK_SECRET);
  const inst = Number(row(MP_KEYS.installments) || process.env.MP_MAX_INSTALLMENTS || 6);
  return {
    accessToken: t.v,
    webhookSecret: w.v,
    maxInstallments: Math.max(1, Math.min(12, Number.isFinite(inst) ? Math.trunc(inst) : 6)),
    tokenSource: t.src,
    webhookSource: w.src,
  };
}

/** Guarda (criptografado) ou remove um segredo do Mercado Pago. */
export async function saveMpSecret(key: typeof MP_KEYS.token | typeof MP_KEYS.webhook, value: string | null) {
  if (value === null) {
    await db.setting.deleteMany({ where: { key } });
    return;
  }
  const enc = encrypt(value);
  await db.setting.upsert({ where: { key }, update: { value: enc }, create: { key, value: enc } });
}

/** Em desenvolvimento, sem credenciais, o checkout usa um simulador interno. Nunca em produção. */
export const isMpSimulated = async () => !(await getMpCreds()).accessToken && process.env.NODE_ENV !== "production";
export const isMpConfigured = async () => !!(await getMpCreds()).accessToken;

async function client() {
  const { accessToken } = await getMpCreds();
  if (!accessToken) throw new Error("Mercado Pago não configurado (Access Token ausente).");
  return new MercadoPagoConfig({ accessToken, options: { timeout: 15000 } });
}

/** Confere o Access Token na API do Mercado Pago (usado no botão "Testar conexão"). */
export async function testMpConnection(): Promise<{ ok: boolean; message: string }> {
  const { accessToken } = await getMpCreds();
  if (!accessToken) return { ok: false, message: "Nenhum Access Token configurado." };
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { ok: false, message: "O Mercado Pago recusou o Access Token (inválido ou revogado)." };
    if (!res.ok) return { ok: false, message: `O Mercado Pago respondeu ${res.status}. Tente de novo em instantes.` };
    const me = (await res.json()) as { nickname?: string; site_id?: string };
    return { ok: true, message: `Conexão OK. Conta: ${me.nickname ?? "sem apelido"}${me.site_id ? ` (${me.site_id})` : ""}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? `Não foi possível falar com o Mercado Pago: ${e.message}` : "Falha de rede ao falar com o Mercado Pago." };
  }
}

export type CheckoutItem = { id: string; title: string; description?: string; quantity: number; unitPriceCents: number };

export type CheckoutInput = {
  externalReference: string; // id do pedido (ou prefixo "link:" para links avulsos)
  items: CheckoutItem[];
  payer?: { name?: string; email?: string };
  expiresAt?: Date;
  /** Para onde voltar após o pagamento */
  backPath: string;
  statementDescriptor?: string;
  excludeBoleto?: boolean;
  /** Formas de pagamento oferecidas: Pix e cartão (padrão), só Pix ou só cartão */
  methods?: PayMethods;
};

export type PayMethods = "ALL" | "PIX" | "CARD";
export const parsePayMethods = (v: unknown): PayMethods => (v === "PIX" || v === "CARD" ? v : "ALL");
export const PAY_METHOD_LABEL: Record<PayMethods, string> = { ALL: "Pix ou cartão", PIX: "Somente Pix", CARD: "Somente cartão" };

/** Tipos de pagamento do Mercado Pago que ficam de fora de cada opção (boleto sempre fora). */
export function excludedPaymentTypes(methods: PayMethods | undefined): { id: string }[] {
  const ids =
    methods === "PIX"
      ? ["ticket", "atm", "credit_card", "debit_card", "prepaid_card", "account_money"]
      : methods === "CARD"
        ? ["ticket", "atm", "bank_transfer", "account_money"] // bank_transfer = Pix
        : ["ticket"];
  return ids.map((id) => ({ id }));
}

export type CheckoutResult = { preferenceId: string; url: string; simulated?: boolean };

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (await isMpSimulated()) {
    return { preferenceId: `SIM-${input.externalReference}`, url: `/dev/pagamento/${input.externalReference}`, simulated: true };
  }
  const base = appUrl();
  const back = `${base}${input.backPath}`;
  const isHttps = base.startsWith("https://");
  const { maxInstallments } = await getMpCreds();

  const pref = await new Preference(await client()).create({
    body: {
      items: input.items.map((i) => ({
        id: i.id,
        title: i.title.slice(0, 250),
        description: i.description?.slice(0, 250),
        quantity: i.quantity,
        unit_price: Number((i.unitPriceCents / 100).toFixed(2)),
        currency_id: "BRL",
      })),
      payer: input.payer?.email ? { name: input.payer.name, email: input.payer.email } : undefined,
      external_reference: input.externalReference,
      // MP exige URLs públicas https; em localhost ficam omitidas (o retorno é manual).
      ...(isHttps
        ? {
            back_urls: { success: back, pending: back, failure: back },
            auto_return: "approved" as const,
            notification_url: `${base}/api/webhooks/mercadopago`,
          }
        : {}),
      statement_descriptor: (input.statementDescriptor ?? "TURMADOBAIRRO").slice(0, 22),
      ...(input.expiresAt
        ? { expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: input.expiresAt.toISOString() }
        : {}),
      payment_methods: {
        installments: maxInstallments,
        excluded_payment_types: input.excludeBoleto === false ? [] : excludedPaymentTypes(input.methods),
      },
    },
  });
  if (!pref.id || !pref.init_point) throw new Error("Resposta inesperada do Mercado Pago ao criar a preferência.");
  return { preferenceId: pref.id, url: pref.init_point };
}

export type MpPayment = {
  id: string;
  status: string;
  statusDetail?: string;
  amountCents: number;
  externalReference?: string;
  method?: string;
  type?: string;
};

export async function fetchPayment(id: string): Promise<MpPayment> {
  const p = await new Payment(await client()).get({ id });
  return {
    id: String(p.id),
    status: p.status ?? "unknown",
    statusDetail: p.status_detail ?? undefined,
    amountCents: Math.round(Number(p.transaction_amount ?? 0) * 100),
    externalReference: p.external_reference ?? undefined,
    method: p.payment_method_id ?? undefined,
    type: p.payment_type_id ?? undefined,
  };
}

/** Busca pagamentos de uma referência externa (usado para conciliar quando o webhook atrasa). */
export async function searchPaymentsByReference(ref: string): Promise<MpPayment[]> {
  const res = await new Payment(await client()).search({ options: { external_reference: ref, sort: "date_created", criteria: "desc" } });
  return (res.results ?? []).map((p) => ({
    id: String(p.id),
    status: p.status ?? "unknown",
    statusDetail: p.status_detail ?? undefined,
    amountCents: Math.round(Number(p.transaction_amount ?? 0) * 100),
    externalReference: p.external_reference ?? undefined,
    method: p.payment_method_id ?? undefined,
    type: p.payment_type_id ?? undefined,
  }));
}

export type RemotePreference = {
  id: string;
  url: string;
  title: string;
  amountCents: number;
  createdAt: string;
  externalReference?: string;
  expires?: boolean;
  expirationDateTo?: string;
};

/** Lista as preferências (links de checkout) já criadas na conta. Falha de forma branda. */
export async function listRemotePreferences(limit = 50): Promise<{ ok: boolean; items: RemotePreference[]; error?: string }> {
  const { accessToken } = await getMpCreds();
  if (!accessToken) return { ok: false, items: [], error: "Mercado Pago não configurado." };
  try {
    const res = await fetch(
      `https://api.mercadopago.com/checkout/preferences/search?sort=date_created&order=desc&limit=${limit}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000), cache: "no-store" },
    );
    if (!res.ok) return { ok: false, items: [], error: `Mercado Pago respondeu ${res.status}.` };
    const data = (await res.json()) as { elements?: Array<Record<string, any>> };
    const items = (data.elements ?? []).map((e) => ({
      id: String(e.id),
      url: String(e.init_point ?? ""),
      title: String(e.items?.[0]?.title ?? "—"),
      amountCents: Math.round(
        (e.items ?? []).reduce((s: number, i: any) => s + Number(i.unit_price ?? 0) * Number(i.quantity ?? 1), 0) * 100,
      ),
      createdAt: String(e.date_created ?? ""),
      externalReference: e.external_reference ? String(e.external_reference) : undefined,
      expires: Boolean(e.expires),
      expirationDateTo: e.expiration_date_to ? String(e.expiration_date_to) : undefined,
    }));
    return { ok: true, items: items.filter((i) => i.url) };
  } catch (e) {
    return { ok: false, items: [], error: e instanceof Error ? e.message : "Falha ao consultar o Mercado Pago." };
  }
}

/**
 * Valida a assinatura `x-signature` do webhook (https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks).
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 */
export function verifyWebhookSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  /** Segredo vindo do painel/banco; se omitido, usa MP_WEBHOOK_SECRET do ambiente. */
  secret?: string;
}): boolean {
  const secret = (opts.secret ?? process.env.MP_WEBHOOK_SECRET)?.trim();
  if (!secret) return process.env.NODE_ENV !== "production"; // em produção, exige segredo configurado
  if (!opts.signatureHeader || !opts.dataId) return false;
  const parts = Object.fromEntries(
    opts.signatureHeader.split(",").map((kv) => {
      const [k, ...v] = kv.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;
  const id = /^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId;
  const manifest = `id:${id};request-id:${opts.requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqual(expected, v1);
}
