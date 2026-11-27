"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { fieldErrorsFrom, profileSchema } from "@/lib/schemas";
import { validatePassword } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { releaseOrder } from "@/lib/orders";
import { audit } from "@/lib/audit";
import type { FormState } from "./types";

export async function updateProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/minha-conta");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const d = parsed.data;
  const marketing = d.marketing === "on";
  await db.user.update({
    where: { id: user.id },
    data: { name: d.name, phone: d.phone, city: d.city || null, nickname: d.nickname || null, memberSinceYear: d.memberSinceYear, marketingOptIn: marketing },
  });
  if (marketing !== user.marketingOptIn) await recordConsent(user.id, "MARKETING", marketing);
  revalidatePath("/minha-conta");
  return { ok: true, message: "Dados atualizados." };
}

export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/minha-conta");
  const rl = await rateLimit(`chpw:${user.id}`, 6, 900);
  if (!rl.ok) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return { fieldErrors: { current: "Senha atual incorreta." } };
  const err = validatePassword(password);
  if (err) return { fieldErrors: { password: err } };
  if (password !== confirm) return { fieldErrors: { confirm: "As senhas não conferem." } };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
    db.session.deleteMany({ where: { userId: user.id } }), // derruba sessões antigas (outros aparelhos)
  ]);
  await createSession(user.id); // mantém quem trocou a senha logado
  await audit({ id: user.id, name: user.name }, "user.password_change", "User", user.id);
  return { ok: true, message: "Senha alterada com sucesso." };
}

/**
 * Exclusão de conta (LGPD art. 18, VI): anonimiza o perfil e apaga sacola/sessões.
 * Pedidos pagos permanecem pelo prazo legal (obrigação fiscal/contábil – art. 16, I), sem telefone/e-mail do comprador.
 */
export async function deleteAccountAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/minha-conta/privacidade");
  if (user.role !== "MEMBER") return { error: "Contas da equipe devem ser removidas por um organizador no painel." };
  const rl = await rateLimit(`delacct:${user.id}`, 5, 900);
  if (!rl.ok) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "EXCLUIR") return { fieldErrors: { confirm: "Digite EXCLUIR para confirmar." } };
  if (!(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) return { fieldErrors: { password: "Senha incorreta." } };

  const pending = await db.order.findMany({ where: { userId: user.id, status: "PENDING" }, select: { id: true } });
  for (const o of pending) await releaseOrder(o.id, "CANCELLED", "Conta excluída pelo titular");

  await db.$transaction([
    db.cartItem.deleteMany({ where: { cart: { userId: user.id } } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.passwordReset.deleteMany({ where: { userId: user.id } }),
    db.order.updateMany({ where: { userId: user.id }, data: { buyerEmail: null, buyerPhone: null, buyerName: "Titular removido" } }),
    db.user.update({
      where: { id: user.id },
      data: {
        name: "Usuário removido",
        email: `removido+${user.id}@invalid.local`,
        phone: null,
        cpfEnc: null,
        cpfHash: null,
        birthDate: null,
        city: null,
        nickname: null,
        memberSinceYear: null,
        marketingOptIn: false,
        active: false,
        deletedAt: new Date(),
        passwordHash: `deleted$${Date.now()}`,
      },
    }),
  ]);
  await audit(null, "user.delete_account", "User", user.id);
  await destroySession();
  redirect("/?conta=excluida");
}
