import type { Prisma } from "@prisma/client";
import { blindIndex } from "./crypto";
import { isValidCpf, normalizePhone, onlyDigits } from "./validators";

/** Interpreta a busca do painel: código do pedido, CPF, telefone ou nome. */
export function orderSearchWhere(q: string): Prisma.OrderWhereInput | null {
  const term = q.trim();
  if (!term) return null;
  const code = term.match(/^(?:tb-?)?0*(\d{1,9})$/i);
  const digits = onlyDigits(term);
  const or: Prisma.OrderWhereInput[] = [];
  if (code && term.length <= 9 && !(digits.length === 11)) or.push({ number: Number(code[1]) });
  if (digits.length === 11 && isValidCpf(digits)) or.push({ items: { some: { ownerCpfHash: blindIndex(digits) } } });
  const phone = digits.length >= 10 ? normalizePhone(term) : null;
  if (phone) or.push({ buyerPhone: phone });
  if (/\p{L}/u.test(term)) {
    or.push({ buyerName: { contains: term, mode: "insensitive" } });
    or.push({ items: { some: { ownerName: { contains: term, mode: "insensitive" } } } });
    or.push({ buyerEmail: { contains: term, mode: "insensitive" } });
  }
  return or.length ? { OR: or } : { id: "__none__" };
}
