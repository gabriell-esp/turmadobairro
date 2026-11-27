"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { blindIndex, encrypt, hashPassword, newToken, sha256, verifyPassword } from "@/lib/crypto";
import { createSession, destroySession, safeNext } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { clientInfo, appUrl } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { fieldErrorsFrom, loginSchema, registerSchema } from "@/lib/schemas";
import { parseBirthDate, validatePassword } from "@/lib/validators";
import { enqueueWhatsApp } from "@/lib/wpp";
import { passwordResetText } from "@/lib/messages";
import { audit } from "@/lib/audit";
import type { FormState } from "./types";

const SECRET_FIELDS = new Set(["password", "confirm", "cpf"]);
function keepValues(formData: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, val] of formData.entries()) if (typeof val === "string" && !SECRET_FIELDS.has(k) && !k.startsWith("$ACTION")) v[k] = val;
  return v;
}

export async function registerAction(_: FormState, formData: FormData): Promise<FormState> {
  const { ip } = await clientInfo();
  const rl = await rateLimit(`register:${ip}`, 8, 3600);
  if (!rl.ok) return { error: "Muitas tentativas de cadastro. Tente novamente em alguns minutos." };

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values: { ...keepValues(formData), cpf: String(formData.get("cpf") ?? "") } };
  const d = parsed.data;

  try {
    const user = await db.user.create({
      data: {
        email: d.email,
        name: d.name,
        passwordHash: await hashPassword(d.password),
        phone: d.phone,
        cpfEnc: encrypt(d.cpf),
        cpfHash: blindIndex(d.cpf),
        birthDate: parseBirthDate(d.birthDate)!,
        city: d.city || null,
        nickname: d.nickname || null,
        memberSinceYear: d.memberSinceYear,
        marketingOptIn: d.marketing === "on",
        lastLoginAt: new Date(),
      },
    });
    await recordConsent(user.id, "PRIVACY_POLICY", true);
    await recordConsent(user.id, "TERMS", true);
    await recordConsent(user.id, "MARKETING", d.marketing === "on");
    await createSession(user.id);
    await audit({ id: user.id, name: user.name }, "user.register", "User", user.id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      if (target.includes("email")) return { fieldErrors: { email: "Este e-mail já está cadastrado. Tente entrar ou recuperar a senha." }, values: keepValues(formData) };
      if (target.includes("cpf")) return { fieldErrors: { cpf: "Este CPF já possui cadastro. Tente entrar ou recuperar a senha." }, values: keepValues(formData) };
    }
    throw e;
  }
  redirect(safeNext(String(formData.get("next") ?? ""), "/loja"));
}

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const { ip } = await clientInfo();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values: keepValues(formData) };
  const { email, password } = parsed.data;

  const rlIp = await rateLimit(`login-ip:${ip}`, 30, 900);
  const rlEmail = await rateLimit(`login-email:${email}`, 10, 900);
  if (!rlIp.ok || !rlEmail.ok) return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo.", values: keepValues(formData) };

  const generic = { error: "E-mail ou senha incorretos.", values: keepValues(formData) };
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || !user.active) {
    await hashPassword(password); // equaliza o tempo de resposta
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Conta temporariamente bloqueada por excesso de tentativas. Tente mais tarde ou redefina a senha.", values: keepValues(formData) };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const fails = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: fails, ...(fails >= 10 ? { lockedUntil: new Date(Date.now() + 15 * 60_000), failedLogins: 0 } : {}) },
    });
    return generic;
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit({ id: user.id, name: user.name }, "user.login", "User", user.id);

  const fallback = user.role === "MEMBER" ? "/minha-conta" : "/admin";
  redirect(safeNext(String(formData.get("next") ?? ""), fallback));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

const GENERIC_RESET = { ok: true, message: "Se o e-mail estiver cadastrado, enviamos um link para o WhatsApp do cadastro. O link vale por 1 hora." } as const;

export async function requestResetAction(_: FormState, formData: FormData): Promise<FormState> {
  const { ip } = await clientInfo();
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { fieldErrors: { email: "E-mail inválido." } };

  const rl1 = await rateLimit(`reset-ip:${ip}`, 6, 3600);
  const rl2 = await rateLimit(`reset-email:${email.data}`, 3, 3600);
  if (!rl1.ok || !rl2.ok) return { ...GENERIC_RESET };

  const user = await db.user.findUnique({ where: { email: email.data } });
  if (user && user.active && !user.deletedAt && user.phone) {
    const { token, hash } = newToken();
    await db.passwordReset.create({ data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 3600_000) } });
    const link = `${appUrl()}/redefinir-senha/${token}`;
    if (process.env.NODE_ENV !== "production") console.log(`[dev] link de redefinição para ${user.email}: ${link}`);
    await enqueueWhatsApp({ kind: "PASSWORD_RESET", phone: user.phone, body: passwordResetText(user.name, link) }).catch(() => {});
  }
  return { ...GENERIC_RESET };
}

export async function resetPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const pwErr = validatePassword(password);
  if (pwErr) return { fieldErrors: { password: pwErr } };
  if (password !== confirm) return { fieldErrors: { confirm: "As senhas não conferem." } };

  const { ip } = await clientInfo();
  const rl = await rateLimit(`reset-use:${ip}`, 10, 3600);
  if (!rl.ok) return { error: "Muitas tentativas. Tente mais tarde." };

  const reset = await db.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return { error: "Link inválido ou expirado. Peça um novo." };

  const passwordHash = await hashPassword(password);
  const used = await db.$transaction(async (tx) => {
    // consumo atômico: se duas requisições usarem o mesmo link, só uma passa
    const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) return false;
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } });
    await tx.session.deleteMany({ where: { userId: reset.userId } }); // encerra todas as sessões
    return true;
  });
  if (!used) return { error: "Link inválido ou expirado. Peça um novo." };
  await audit(null, "user.password_reset", "User", reset.userId);
  redirect("/entrar?reset=ok");
}
