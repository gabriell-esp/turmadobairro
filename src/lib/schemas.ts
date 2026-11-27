import { z } from "zod";
import {
  ageOn,
  cleanName,
  isFullName,
  isValidCpf,
  normalizePhone,
  onlyDigits,
  parseBirthDate,
  validatePassword,
} from "./validators";

export const START_YEAR = 2008;

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const fullName = z
  .string({ required_error: "Informe o nome completo." })
  .transform(cleanName)
  .refine(isFullName, "Informe o nome completo (nome e sobrenome).");

const cpf = z
  .string({ required_error: "Informe o CPF." })
  .refine(isValidCpf, "CPF inválido.")
  .transform(onlyDigits);

const birth = z
  .string({ required_error: "Informe a data de nascimento." })
  .refine((v) => parseBirthDate(v) !== null, "Data de nascimento inválida.");

const phone = z
  .string({ required_error: "Informe o WhatsApp." })
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => v !== null, "WhatsApp inválido. Use DDD + número, ex.: (49) 99999-9999.");

const memberSince = z.coerce
  .number({ invalid_type_error: "Selecione o ano." })
  .int()
  .min(START_YEAR, "Ano inválido.")
  .max(new Date().getFullYear() + 1, "Ano inválido.");

export const registerSchema = z
  .object({
    name: fullName,
    email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
    password: z.string().max(128),
    confirm: z.string(),
    cpf,
    birthDate: birth,
    phone,
    city: z.string().trim().max(80).optional().default(""),
    nickname: z.string().trim().max(40).optional().default(""),
    memberSinceYear: memberSince,
    acceptTerms: z.literal("on", { errorMap: () => ({ message: "É necessário aceitar os Termos e a Política de Privacidade." }) }),
    marketing: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const pwErr = validatePassword(v.password);
    if (pwErr) ctx.addIssue({ code: "custom", path: ["password"], message: pwErr });
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "As senhas não conferem." });
    const b = parseBirthDate(v.birthDate);
    if (b && ageOn(b) < 18) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "O cadastro é permitido apenas para maiores de 18 anos." });
  });

export const profileSchema = z.object({
  name: fullName,
  phone,
  city: z.string().trim().max(80).optional().default(""),
  nickname: z.string().trim().max(40).optional().default(""),
  memberSinceYear: memberSince,
  marketing: z.string().optional(),
});

/** Dados do dono de um abadá (sacola e venda manual). */
export const ownerSchema = z
  .object({
    productId: z.string().min(1, "Produto inválido."),
    ownerName: fullName,
    ownerCpf: cpf,
    ownerBirthDate: birth,
    size: z.string().min(1, "Escolha o tamanho."),
    babyLook: z.string().optional(),
    guardianName: z.string().trim().max(100).optional().default(""),
    guardianConfirm: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const b = parseBirthDate(v.ownerBirthDate);
    if (b && ageOn(b) < 18) {
      if (!isFullName(v.guardianName ?? ""))
        ctx.addIssue({ code: "custom", path: ["guardianName"], message: "Menor de 18 anos: informe o nome completo do responsável legal." });
      if (v.guardianConfirm !== "on")
        ctx.addIssue({ code: "custom", path: ["guardianConfirm"], message: "O responsável legal precisa autorizar a compra e o uso dos dados." });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha.").max(128),
});
