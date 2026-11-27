import { describe, expect, it } from "vitest";
import { checkEnv } from "@/lib/env-check";
import { pickClientIp } from "@/lib/request";

const good = {
  APP_URL: "https://turmadobairro.com.br",
  DATABASE_URL: "postgresql://turma:Zx9fQ2mK7pLw@db:5432/turmadobairro",
  DATA_ENCRYPTION_KEY: "3f9a1c0be47d52a86c1e90b7d4a3f58e2b6c7d1a09e8f4b3c5d6a7e8f9012b3c",
  DATA_HASH_KEY: "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00",
  CRON_SECRET: "k8d7f6e5d4c3b2a1098765432109abcdef",
};

describe("conferência do ambiente de produção", () => {
  it("aceita uma configuração correta", () => {
    expect(checkEnv(good).errors).toEqual([]);
  });

  it("recusa http, localhost, chaves ausentes/inválidas/iguais e cron curto", () => {
    expect(checkEnv({ ...good, APP_URL: "http://turmadobairro.com.br" }).errors.join()).toMatch(/https/);
    expect(checkEnv({ ...good, APP_URL: "https://localhost:3000" }).errors.join()).toMatch(/localhost/);
    expect(checkEnv({ ...good, DATA_ENCRYPTION_KEY: "curta" }).errors.join()).toMatch(/DATA_ENCRYPTION_KEY/);
    expect(checkEnv({ ...good, DATA_HASH_KEY: good.DATA_ENCRYPTION_KEY }).errors.join()).toMatch(/iguais/);
    expect(checkEnv({ ...good, DATA_HASH_KEY: "a".repeat(64) }).errors.join()).toMatch(/repetido/);
    expect(checkEnv({ ...good, CRON_SECRET: "123" }).errors.join()).toMatch(/CRON_SECRET/);
    expect(checkEnv({ ...good, DATABASE_URL: "postgresql://turma:turma_dev_pw@db/x" }).errors.join()).toMatch(/senha de desenvolvimento/);
  });

  it("só avisa sobre Mercado Pago/WhatsApp (configuráveis no painel)", () => {
    const r = checkEnv({ ...good, WPP_BASE_URL: "http://wpp:21465", WPP_SECRET_KEY: "THISISMYSECURETOKEN" });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/MP_ACCESS_TOKEN/);
    expect(r.warnings.join()).toMatch(/WPP_SECRET_KEY/);
  });
});

describe("IP do cliente atrás de proxy", () => {
  it("não aceita IP forjado no início do X-Forwarded-For", () => {
    // visitante forja "1.1.1.1"; o proxy confiável acrescenta o IP real no FIM
    expect(pickClientIp("1.1.1.1, 200.10.20.30", null, 1)).toBe("200.10.20.30");
    expect(pickClientIp("200.10.20.30", null, 1)).toBe("200.10.20.30");
  });
  it("com 2 proxies, pula o último", () => {
    expect(pickClientIp("9.9.9.9, 200.10.20.30, 10.0.0.2", null, 2)).toBe("200.10.20.30");
  });
  it("sem proxy (0) ignora cabeçalhos; sem cabeçalho devolve unknown", () => {
    expect(pickClientIp("1.1.1.1", "2.2.2.2", 0)).toBe("unknown");
    expect(pickClientIp(null, null, 1)).toBe("unknown");
    expect(pickClientIp(null, "2.2.2.2", 1)).toBe("2.2.2.2");
  });
});
