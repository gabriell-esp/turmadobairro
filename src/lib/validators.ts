/** Utilidades de validação/normalização (sem dependências de servidor, usáveis também no client). */

export const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function formatCpf(input: string): string {
  const d = onlyDigits(input).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** 123.456.789-09 → ***.456.789-** (LGPD: exibe o mínimo necessário) */
export function maskCpf(input: string): string {
  const d = onlyDigits(input);
  if (d.length !== 11) return "***.***.***-**";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** Espaços colapsados e aparado. Mantém acentos para exibição. */
export function cleanName(name: string): string {
  return (name ?? "").replace(/\s+/g, " ").trim();
}

/** Chave de comparação: sem acentos, minúscula, sem pontuação, espaços colapsados. */
export function nameKey(name: string): string {
  return cleanName(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nome completo: ao menos 2 palavras, só letras/’-. */
export function isFullName(name: string): boolean {
  const n = cleanName(name);
  if (n.length < 5 || n.length > 100) return false;
  if (!/^[\p{L}][\p{L}'’.\- ]+$/u.test(n)) return false;
  const words = n.split(" ").filter((w) => w.replace(/[.'’-]/g, "").length >= 1);
  return words.length >= 2 && words.some((w) => w.length >= 2);
}

/** Telefone BR → 55DDXXXXXXXXX (formato aceito pelo WhatsApp). Retorna null se inválido. */
export function normalizePhone(input: string): string | null {
  let d = onlyDigits(input);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d.replace(/^0/, "");
  if (!d.startsWith("55")) return null;
  const national = d.slice(2);
  if (national.length !== 10 && national.length !== 11) return null;
  if (!/^[1-9][1-9]/.test(national)) return null; // DDD
  if (national.length === 11 && national[2] !== "9") return null; // celular começa com 9
  return d;
}

export function formatPhone(normalized: string | null | undefined): string {
  if (!normalized) return "";
  const n = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return normalized;
}

/** "YYYY-MM-DD" → Date (UTC meia-noite) ou null se inválida/futura/absurda. */
export function parseBirthDate(input: string, now = new Date()): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [y, m, d] = input.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (date.getTime() > now.getTime()) return null;
  if (ageOn(date, now) > 110) return null;
  return date;
}

export function ageOn(birth: Date, ref = new Date()): number {
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    ref.getUTCMonth() < birth.getUTCMonth() ||
    (ref.getUTCMonth() === birth.getUTCMonth() && ref.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

export const SIZES = ["PP", "P", "M", "G", "GG", "XG", "XXG"] as const;
export const BABY_LOOK_SIZES = ["PP", "P", "M", "G", "GG"] as const;

const COMMON_PASSWORDS = new Set([
  "senha12345", "senha123456", "senha@12345", "password123", "password1234", "abc1234567", "qwerty1234", "qwerty12345",
  "123456789a", "1234567890a", "a123456789", "a1234567890", "brasil1234", "brasil12345", "turmadobairro1", "turma12345",
  "mudar12345", "admin12345", "admin123456", "vendedor123", "vendedor@123", "iloveyou123", "corinthians1", "flamengo123",
]);

export const PASSWORD_HINT = "Mínimo de 8 caracteres, com letras e números.";

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "A senha precisa ter ao menos 8 caracteres.";
  if (pw.length > 128) return "A senha é longa demais.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use letras e números na senha.";
  if (/^(.)\1+$/.test(pw) || COMMON_PASSWORDS.has(pw.toLowerCase())) return "Essa senha é muito comum. Escolha outra.";
  return null;
}

/** Só aceita https e hosts oficiais (evita `mercadopago.com.evil.net`, `user@host`, etc.). */
export function isMercadoPagoUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase();
  return /^([a-z0-9-]+\.)*mercadopago\.com(\.[a-z]{2})?$/.test(h) || h === "mpago.la" || h === "mpago.li";
}

/** Interpreta preço digitado em reais ("120", "120,50", "120.50", "1.200,00") e devolve centavos (ou null). */
export function parsePriceCents(raw: unknown): number | null {
  let s = String(raw ?? "").trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); // formato brasileiro
  else if (!/^\d+(\.\d{1,2})?$/.test(s)) s = s.replace(/\./g, ""); // "1.200" = milhar
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isFinite(cents) ? cents : null;
}
