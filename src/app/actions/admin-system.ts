"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { isFullName, normalizePhone, validatePassword, cleanName } from "@/lib/validators";
import { logoutWppSession, sendWhatsAppText, startWppSession } from "@/lib/wpp";
import { audit } from "@/lib/audit";

const go = (path: string, kind: "msg" | "err", text: string): never => redirect(`${path}?${kind}=${encodeURIComponent(text)}`);

async function organizersLeft(excludeId: string) {
  return db.user.count({ where: { role: "ORGANIZER", active: true, deletedAt: null, id: { not: excludeId } } });
}

export async function createStaffAction(formData: FormData) {
  const admin = await assertPermission("users.manage");
  const P = "/admin/equipe";
  const parsed = z.object({
    name: z.string().transform(cleanName).refine(isFullName, "Informe nome e sobrenome."),
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    role: z.enum(["SELLER", "ORGANIZER"]),
    password: z.string(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) go(P, "err", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data!;
  const pw = validatePassword(d.password);
  if (pw) go(P, "err", pw);
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) go(P, "err", "WhatsApp inválido.");
  if (await db.user.findUnique({ where: { email: d.email } })) go(P, "err", "Já existe uma conta com este e-mail. Use “Alterar permissão” abaixo.");
  const u = await db.user.create({ data: { name: d.name, email: d.email, role: d.role, phone, passwordHash: await hashPassword(d.password) } });
  await audit({ id: admin.id, name: admin.name }, "staff.create", "User", u.id, { role: d.role });
  go(P, "msg", `Conta criada para ${d.name}. Informe a senha provisória pessoalmente e peça para trocar no primeiro acesso.`);
}

export async function setRoleAction(formData: FormData) {
  const admin = await assertPermission("users.manage");
  const P = "/admin/equipe";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = z.enum(["MEMBER", "SELLER", "ORGANIZER"]).safeParse(formData.get("role"));
  if (!role.success) go(P, "err", "Perfil inválido.");
  const target = await db.user.findUnique({ where: { email } });
  if (!target || target.deletedAt) go(P, "err", "Nenhuma conta encontrada com esse e-mail.");
  if (target!.id === admin.id && role.data !== "ORGANIZER") go(P, "err", "Você não pode rebaixar a si mesmo.");
  if (target!.role === "ORGANIZER" && role.data !== "ORGANIZER" && (await organizersLeft(target!.id)) === 0) go(P, "err", "É preciso manter ao menos um organizador ativo.");
  await db.user.update({ where: { id: target!.id }, data: { role: role.data } });
  if (target!.id !== admin.id) await db.session.deleteMany({ where: { userId: target!.id } }); // força novo login com o novo perfil
  await audit({ id: admin.id, name: admin.name }, "staff.set_role", "User", target!.id, { from: target!.role, to: role.data });
  revalidatePath(P);
  go(P, "msg", `Perfil de ${target!.name} alterado para ${role.data}.`);
}

export async function toggleStaffActiveAction(formData: FormData) {
  const admin = await assertPermission("users.manage");
  const id = String(formData.get("id"));
  const target = await db.user.findUniqueOrThrow({ where: { id } });
  if (target.id === admin.id) go("/admin/equipe", "err", "Você não pode desativar a própria conta.");
  if (target.active && target.role === "ORGANIZER" && (await organizersLeft(id)) === 0) go("/admin/equipe", "err", "É preciso manter ao menos um organizador ativo.");
  await db.user.update({ where: { id }, data: { active: !target.active } });
  if (target.active) await db.session.deleteMany({ where: { userId: id } });
  await audit({ id: admin.id, name: admin.name }, target.active ? "staff.deactivate" : "staff.activate", "User", id);
  go("/admin/equipe", "msg", target.active ? "Conta desativada." : "Conta reativada.");
}

export async function resetStaffPasswordAction(formData: FormData) {
  const admin = await assertPermission("users.manage");
  const id = String(formData.get("id"));
  const pw = String(formData.get("password") ?? "");
  const err = validatePassword(pw);
  if (err) go("/admin/equipe", "err", err);
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw), failedLogins: 0, lockedUntil: null } });
  await db.session.deleteMany({ where: { userId: id } });
  await audit({ id: admin.id, name: admin.name }, "staff.reset_password", "User", id);
  go("/admin/equipe", "msg", "Senha redefinida e sessões encerradas.");
}

// ───────────── LGPD ─────────────
export async function resolveDataRequestAction(formData: FormData) {
  const admin = await assertPermission("lgpd.manage");
  const id = String(formData.get("id"));
  const status = z.enum(["DONE", "REJECTED"]).parse(formData.get("status"));
  await db.dataRequest.update({ where: { id }, data: { status, response: String(formData.get("response") ?? "").slice(0, 1000) || null, resolvedAt: new Date() } });
  await audit({ id: admin.id, name: admin.name }, "lgpd.resolve", "DataRequest", id, { status });
  go("/admin/lgpd", "msg", "Solicitação atualizada.");
}

// ───────────── WhatsApp ─────────────
export async function wppStartAction() {
  const admin = await assertPermission("whatsapp.manage");
  await startWppSession();
  await audit({ id: admin.id, name: admin.name }, "whatsapp.start_session");
  redirect("/admin/whatsapp");
}

export async function wppLogoutAction() {
  const admin = await assertPermission("whatsapp.manage");
  try { await logoutWppSession(); } catch (e) { go("/admin/whatsapp", "err", e instanceof Error ? e.message : "Falha ao desconectar."); }
  await audit({ id: admin.id, name: admin.name }, "whatsapp.logout");
  go("/admin/whatsapp", "msg", "Sessão do WhatsApp encerrada.");
}

export async function wppTestAction(formData: FormData) {
  const admin = await assertPermission("whatsapp.manage");
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) go("/admin/whatsapp", "err", "Número inválido.");
  try {
    await sendWhatsAppText(phone!, "🍻 Teste do sistema da Turma do Bairro: o WhatsApp está funcionando!");
  } catch (e) {
    go("/admin/whatsapp", "err", e instanceof Error ? e.message : "Falha no envio.");
  }
  await audit({ id: admin.id, name: admin.name }, "whatsapp.test");
  go("/admin/whatsapp", "msg", "Mensagem de teste enviada.");
}
