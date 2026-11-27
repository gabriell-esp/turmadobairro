import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { blindIndex, decrypt, encrypt, hashPassword, verifyPassword } from "@/lib/crypto";
import { isMercadoPagoUrl, ageOn, formatCpf, isFullName, isValidCpf, maskCpf, nameKey, normalizePhone, parseBirthDate, validatePassword } from "@/lib/validators";
import { parsePriceCents } from "@/lib/validators";
import { isHexColor } from "@/components/shirt-art";
import { excludedPaymentTypes, parsePayMethods, verifyWebhookSignature } from "@/lib/mercadopago";
import { csvCell } from "@/lib/csv";
import { findInternalDuplicates } from "@/lib/orders";
import { safeNext } from "@/lib/auth-pure";

describe("CPF", () => {
  it("valida CPFs reais e rejeita inválidos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("formata e mascara", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
  });
});

describe("nome / telefone / datas", () => {
  it("exige nome completo", () => {
    expect(isFullName("João")).toBe(false);
    expect(isFullName("João da Silva")).toBe(true);
    expect(isFullName("J0ão Silva")).toBe(false);
  });
  it("nameKey ignora acento, caixa e espaços", () => {
    expect(nameKey("  JOÃO   da  Silva ")).toBe(nameKey("joao da silva"));
  });
  it("normaliza telefone BR", () => {
    expect(normalizePhone("(49) 99999-1234")).toBe("5549999991234");
    expect(normalizePhone("+55 49 3333-1234")).toBe("554933331234");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("(49) 89999-1234")).toBeNull();
  });
  it("valida data de nascimento e idade", () => {
    expect(parseBirthDate("2000-02-30")).toBeNull();
    expect(parseBirthDate("2999-01-01")).toBeNull();
    const b = parseBirthDate("2000-06-15")!;
    expect(ageOn(b, new Date("2026-06-14T12:00:00Z"))).toBe(25);
    expect(ageOn(b, new Date("2026-06-15T12:00:00Z"))).toBe(26);
  });
  it("política de senha", () => {
    expect(validatePassword("abc")).not.toBeNull();
    expect(validatePassword("Senha12")).not.toBeNull(); // 7 caracteres
    expect(validatePassword("Senha123")).toBeNull(); // 8 caracteres
    expect(validatePassword("somenteletras")).not.toBeNull();
    expect(validatePassword("Senha12345")).not.toBeNull(); // senha comum
    expect(validatePassword("Bloco2027Kerb")).toBeNull();
  });
});

describe("criptografia", () => {
  it("cifra/decifra e não repete o texto cifrado", () => {
    const a = encrypt("52998224725"), b = encrypt("52998224725");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("52998224725");
    expect(a).not.toContain("52998224725");
  });
  it("detecta adulteração (GCM)", () => {
    const a = encrypt("segredo");
    const raw = Buffer.from(a.slice(3), "base64"); raw[raw.length - 1] ^= 1;
    expect(() => decrypt("v1:" + raw.toString("base64"))).toThrow();
  });
  it("índice cego é determinístico", () => {
    expect(blindIndex("123")).toBe(blindIndex("123"));
    expect(blindIndex("123")).not.toBe(blindIndex("124"));
  });
  it("hash de senha verifica", async () => {
    const h = await hashPassword("Senha1234");
    expect(await verifyPassword("Senha1234", h)).toBe(true);
    expect(await verifyPassword("senha1234", h)).toBe(false);
  });
});

describe("webhook Mercado Pago", () => {
  const sign = (id: string, reqId: string, ts: string) =>
    `ts=${ts},v1=${createHmac("sha256", "segredo-de-teste").update(`id:${id};request-id:${reqId};ts:${ts};`).digest("hex")}`;
  it("aceita assinatura válida e rejeita adulterada", () => {
    expect(verifyWebhookSignature({ signatureHeader: sign("123", "req-1", "1700000000"), requestId: "req-1", dataId: "123" })).toBe(true);
    expect(verifyWebhookSignature({ signatureHeader: sign("123", "req-1", "1700000000"), requestId: "req-1", dataId: "124" })).toBe(false);
    expect(verifyWebhookSignature({ signatureHeader: "ts=1,v1=abc", requestId: "r", dataId: "1" })).toBe(false);
    expect(verifyWebhookSignature({ signatureHeader: null, requestId: null, dataId: "1" })).toBe(false);
  });
});

describe("CSV / redirect seguros", () => {
  it("neutraliza fórmulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+55")).toBe("'+55");
    expect(csvCell("normal")).toBe("normal");
  });
  it("safeNext bloqueia open redirect", () => {
    expect(safeNext("/loja")).toBe("/loja");
    expect(safeNext("//evil.com")).toBe("/minha-conta");
    expect(safeNext("https://evil.com")).toBe("/minha-conta");
    expect(safeNext(String.raw`/\evil.com`)).toBe("/minha-conta");
  });
});

describe("duplicidade interna da sacola", () => {
  it("acusa CPF e nome repetidos", () => {
    const r = findInternalDuplicates([
      { cpf: "529.982.247-25", name: "João Silva" },
      { cpf: "52998224725", name: "Maria Souza" },
      { cpf: "11144477735", name: "joao  SILVA" },
    ]);
    expect(r.get(1)?.cpf).toBe(true);
    expect(r.get(2)?.name).toBe(true);
    expect(r.has(0)).toBe(false);
  });
});

describe("links externos do Mercado Pago", () => {
  it("aceita só hosts oficiais em https", () => {
    expect(isMercadoPagoUrl("https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1")).toBe(true);
    expect(isMercadoPagoUrl("https://mpago.la/2abc")).toBe(true);
    expect(isMercadoPagoUrl("https://mercadopago.com.evil.net/x")).toBe(false);
    expect(isMercadoPagoUrl("https://mercadopago.com@evil.net/")).toBe(false);
    expect(isMercadoPagoUrl("http://www.mercadopago.com.br/x")).toBe(false);
    expect(isMercadoPagoUrl("javascript:alert(1)")).toBe(false);
    expect(isMercadoPagoUrl("https://evilmercadopago.com/")).toBe(false);
  });
});

describe("formas de pagamento do link", () => {
  const ids = (m: Parameters<typeof excludedPaymentTypes>[0]) => excludedPaymentTypes(m).map((x) => x.id);
  it("Pix e cartão: só tira boleto", () => {
    expect(ids("ALL")).toEqual(["ticket"]);
  });
  it("somente Pix: tira cartões e boleto, mas mantém bank_transfer (Pix)", () => {
    expect(ids("PIX")).toContain("credit_card");
    expect(ids("PIX")).toContain("debit_card");
    expect(ids("PIX")).not.toContain("bank_transfer");
  });
  it("somente cartão: tira Pix e boleto, mas mantém os cartões", () => {
    expect(ids("CARD")).toContain("bank_transfer");
    expect(ids("CARD")).not.toContain("credit_card");
    expect(ids("CARD")).not.toContain("debit_card");
  });
  it("valor desconhecido vira ALL", () => {
    expect(parsePayMethods("xyz")).toBe("ALL");
    expect(parsePayMethods(undefined)).toBe("ALL");
    expect(parsePayMethods("PIX")).toBe("PIX");
  });
});

describe("cor da ilustração do abadá", () => {
  it("só aceita #rrggbb", () => {
    expect(isHexColor("#1478d6")).toBe(true);
    expect(isHexColor("#FFF")).toBe(false);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#12345g")).toBe(false);
    expect(isHexColor('" onload="x')).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});

describe("preço digitado", () => {
  it("entende os formatos brasileiros", () => {
    expect(parsePriceCents("120")).toBe(12000);
    expect(parsePriceCents("120,5")).toBe(12050);
    expect(parsePriceCents("120,50")).toBe(12050);
    expect(parsePriceCents("120.50")).toBe(12050);
    expect(parsePriceCents("1.200,00")).toBe(120000);
    expect(parsePriceCents("1.200")).toBe(120000);
    expect(parsePriceCents("R$ 99,90")).toBe(9990);
  });
  it("rejeita lixo e vazio", () => {
    expect(parsePriceCents("")).toBeNull();
    expect(parsePriceCents("abc")).toBeNull();
    expect(parsePriceCents("12,345")).toBeNull();
    expect(parsePriceCents("-5")).toBeNull();
  });
});
