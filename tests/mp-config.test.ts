import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { MP_KEYS, getMpCreds, isMpConfigured, saveMpSecret, verifyWebhookSignature } from "@/lib/mercadopago";

const TOKEN = "APP_USR-1234567890123456-012345-abcdef0123456789abcdef0123456789-123456789";
const saved = { t: process.env.MP_ACCESS_TOKEN, w: process.env.MP_WEBHOOK_SECRET, i: process.env.MP_MAX_INSTALLMENTS };

beforeEach(async () => {
  await db.setting.deleteMany();
  delete process.env.MP_ACCESS_TOKEN;
  delete process.env.MP_WEBHOOK_SECRET;
  delete process.env.MP_MAX_INSTALLMENTS;
});

afterEach(() => {
  for (const [k, v] of [["MP_ACCESS_TOKEN", saved.t], ["MP_WEBHOOK_SECRET", saved.w], ["MP_MAX_INSTALLMENTS", saved.i]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("credenciais do Mercado Pago no painel", () => {
  it("sem nada configurado, devolve vazio", async () => {
    const c = await getMpCreds();
    expect(c.accessToken).toBe("");
    expect(c.tokenSource).toBe("none");
    expect(await isMpConfigured()).toBe(false);
    expect(c.maxInstallments).toBe(6);
  });

  it("guarda o token CRIPTOGRAFADO no banco e lê de volta", async () => {
    await saveMpSecret(MP_KEYS.token, TOKEN);
    const row = await db.setting.findUniqueOrThrow({ where: { key: MP_KEYS.token } });
    expect(row.value).not.toContain(TOKEN);
    expect(row.value).not.toContain("APP_USR");
    const c = await getMpCreds();
    expect(c.accessToken).toBe(TOKEN);
    expect(c.tokenSource).toBe("panel");
    expect(await isMpConfigured()).toBe(true);
  });

  it("o painel vale mais que a variável de ambiente, e remover volta para ela", async () => {
    process.env.MP_ACCESS_TOKEN = "ENV-token-123456789012345";
    expect((await getMpCreds()).tokenSource).toBe("env");
    await saveMpSecret(MP_KEYS.token, TOKEN);
    expect(await getMpCreds()).toMatchObject({ accessToken: TOKEN, tokenSource: "panel" });
    await saveMpSecret(MP_KEYS.token, null);
    expect(await getMpCreds()).toMatchObject({ accessToken: "ENV-token-123456789012345", tokenSource: "env" });
  });

  it("segredo corrompido/ilegível é tratado como ausente (sem derrubar o site)", async () => {
    await db.setting.create({ data: { key: MP_KEYS.token, value: "v1:lixo-que-nao-decifra" } });
    const c = await getMpCreds();
    expect(c.accessToken).toBe("");
    expect(c.tokenSource).toBe("none");
  });

  it("limita as parcelas entre 1 e 12", async () => {
    await db.setting.create({ data: { key: MP_KEYS.installments, value: "99" } });
    expect((await getMpCreds()).maxInstallments).toBe(12);
    await db.setting.update({ where: { key: MP_KEYS.installments }, data: { value: "3" } });
    expect((await getMpCreds()).maxInstallments).toBe(3);
  });

  it("as credenciais não vazam pelas configurações públicas do site", async () => {
    await saveMpSecret(MP_KEYS.token, TOKEN);
    const { SETTING_DEFAULTS } = await import("@/lib/settings");
    expect(Object.keys(SETTING_DEFAULTS)).not.toContain(MP_KEYS.token);
    expect(Object.keys(SETTING_DEFAULTS)).not.toContain(MP_KEYS.webhook);
  });
});

describe("webhook com a assinatura secreta do painel", () => {
  const sign = (secret: string, id: string, reqId: string, ts: string) =>
    `ts=${ts},v1=${createHmac("sha256", secret).update(`id:${id};request-id:${reqId};ts:${ts};`).digest("hex")}`;

  it("valida com o segredo informado e recusa com outro", () => {
    const header = sign("segredo-do-painel", "55", "r1", "1700000000");
    expect(verifyWebhookSignature({ signatureHeader: header, requestId: "r1", dataId: "55", secret: "segredo-do-painel" })).toBe(true);
    expect(verifyWebhookSignature({ signatureHeader: header, requestId: "r1", dataId: "55", secret: "outro-segredo" })).toBe(false);
  });

  it("em produção, sem segredo nenhum, recusa tudo", () => {
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      expect(verifyWebhookSignature({ signatureHeader: sign("x", "1", "r", "1"), requestId: "r", dataId: "1", secret: "" })).toBe(false);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev ?? "test";
    }
  });
});
