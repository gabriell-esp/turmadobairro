import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { newToken, sha256 } from "./crypto";
import { clientInfo } from "./request";

const isProd = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = isProd ? "__Host-tb_session" : "tb_session";
const SESSION_DAYS = 14;

export async function createSession(userId: string) {
  const { token, hash } = newToken();
  const { ip, userAgent } = await clientInfo();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: { userId, tokenHash: hash, expiresAt, ip, userAgent } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.active || session.user.deletedAt) return null;
  return session.user;
});

export async function requireUser(next = "/minha-conta"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

export const isStaff = (u: { role: Role } | null | undefined) => !!u && (u.role === "ORGANIZER" || u.role === "SELLER");
export const isOrganizer = (u: { role: Role } | null | undefined) => !!u && u.role === "ORGANIZER";

export async function requireStaff(): Promise<User> {
  const user = await requireUser("/admin");
  if (!isStaff(user)) redirect("/minha-conta");
  return user;
}

export async function requireOrganizer(): Promise<User> {
  const user = await requireUser("/admin");
  if (!isStaff(user)) redirect("/minha-conta");
  if (!isOrganizer(user)) redirect("/admin?erro=permissao");
  return user;
}

/** Matriz de permissões do painel. ORGANIZER pode tudo; VENDEDOR apenas o operacional. */
export type Permission =
  | "dashboard.full"
  | "orders.all"
  | "orders.own"
  | "orders.cancel"
  | "sales.create"
  | "sales.external" // lançar venda feita por fora (dinheiro, Pix direto…)
  | "sales.freeze" // liberar/congelar as vendas (somente gestores)
  | "sales.create_frozen" // fazer venda manual com as vendas congeladas (somente gestores)
  | "delivery.mark"
  | "buyers.lookup"
  | "links.manage"
  | "products.manage"
  | "events.manage"
  | "members.view"
  | "users.manage"
  | "settings.manage"
  | "whatsapp.manage"
  | "gallery.manage"
  | "audit.view"
  | "lgpd.manage";

const SELLER_PERMS: Permission[] = ["orders.own", "sales.create", "sales.external", "delivery.mark", "buyers.lookup"];

export function can(user: { role: Role } | null | undefined, perm: Permission): boolean {
  if (!user) return false;
  if (user.role === "ORGANIZER") return true;
  if (user.role === "SELLER") return SELLER_PERMS.includes(perm);
  return false;
}

export async function requirePermission(perm: Permission): Promise<User> {
  const user = await requireStaff();
  if (!can(user, perm)) redirect("/admin?erro=permissao");
  return user;
}

/** Usado dentro de server actions: lança erro em vez de redirecionar. */
export async function assertPermission(perm: Permission): Promise<User> {
  const user = await getCurrentUser();
  if (!user || !can(user, perm)) throw new Error("Sem permissão para esta ação.");
  return user;
}

export { safeNext } from "./auth-pure";
