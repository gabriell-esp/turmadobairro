/**
 * Conferência das variáveis de ambiente na subida do servidor (produção).
 * Problemas GRAVES derrubam a subida (melhor não abrir do que abrir inseguro);
 * os demais viram avisos no log. Lógica pura: fácil de testar.
 */
export type EnvReport = { errors: string[]; warnings: string[] };

const HEX64 = /^[0-9a-fA-F]{64}$/;
const WEAK_WPP = new Set(["THISISMYSECURETOKEN", "changeme", "secret", ""]);

export function checkEnv(env: Record<string, string | undefined>): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const get = (k: string) => env[k]?.trim() ?? "";

  // ── Graves ──
  const app = get("APP_URL");
  if (!app) errors.push("APP_URL não definida (use o endereço público com https://).");
  else if (!/^https:\/\/[^/\s]+/i.test(app)) errors.push(`APP_URL precisa começar com https:// (valor atual: ${app}). O cookie de sessão seguro não funciona sem HTTPS.`);
  else if (/localhost|127\.0\.0\.1/i.test(app)) errors.push("APP_URL aponta para localhost. Use o domínio público.");

  if (!get("DATABASE_URL")) errors.push("DATABASE_URL não definida.");
  else if (/turma_dev_pw/.test(get("DATABASE_URL"))) errors.push("DATABASE_URL usa a senha de desenvolvimento (turma_dev_pw). Defina uma senha forte.");

  if (!HEX64.test(get("DATA_ENCRYPTION_KEY"))) errors.push("DATA_ENCRYPTION_KEY ausente ou inválida (64 caracteres hexadecimais; gere com `openssl rand -hex 32`).");
  if (!HEX64.test(get("DATA_HASH_KEY"))) errors.push("DATA_HASH_KEY ausente ou inválida (64 caracteres hexadecimais; gere com `openssl rand -hex 32`).");
  if (HEX64.test(get("DATA_ENCRYPTION_KEY")) && get("DATA_ENCRYPTION_KEY").toLowerCase() === get("DATA_HASH_KEY").toLowerCase()) {
    errors.push("DATA_ENCRYPTION_KEY e DATA_HASH_KEY não podem ser iguais.");
  }
  for (const k of ["DATA_ENCRYPTION_KEY", "DATA_HASH_KEY"]) {
    if (/^(.)\1{63}$/.test(get(k))) errors.push(`${k} é um valor repetido (parece chave de teste). Gere uma chave aleatória.`);
  }

  const cron = get("CRON_SECRET");
  if (cron.length < 24) errors.push("CRON_SECRET ausente ou curto demais (mínimo 24 caracteres; gere com `openssl rand -hex 24`).");


  // ── Avisos ──
  if (!get("MP_ACCESS_TOKEN")) warnings.push("MP_ACCESS_TOKEN não definido: tudo bem se você informar o Access Token em Painel › Configurações › Mercado Pago. Sem ele a loja não cobra.");
  if (!get("MP_WEBHOOK_SECRET")) warnings.push("MP_WEBHOOK_SECRET não definido: informe a assinatura secreta em Painel › Configurações › Mercado Pago, senão o webhook será recusado.");
  if (get("WPP_BASE_URL") && WEAK_WPP.has(get("WPP_SECRET_KEY"))) warnings.push("WPP_SECRET_KEY está no valor padrão/fraco. Troque no servidor WPPConnect e aqui.");
  if (!get("WPP_BASE_URL")) warnings.push("WPP_BASE_URL não definido: as confirmações por WhatsApp não serão enviadas.");
  const hops = get("TRUSTED_PROXY_HOPS");
  if (hops && !/^[0-3]$/.test(hops)) warnings.push("TRUSTED_PROXY_HOPS deve ser 0, 1, 2 ou 3 (padrão 1).");
  if (get("SEED_ADMIN_PASSWORD")) warnings.push("SEED_ADMIN_PASSWORD continua no ambiente. Depois do primeiro acesso, remova-a do .env do servidor.");

  return { errors, warnings };
}

/** Chamado na subida do servidor: só em produção. */
export function assertProductionEnv(env: Record<string, string | undefined> = process.env) {
  const { errors, warnings } = checkEnv(env);
  for (const w of warnings) console.warn(`[config] aviso: ${w}`);
  if (errors.length) {
    const msg = ["Configuração insegura/incompleta — o servidor NÃO vai subir:", ...errors.map((e) => `  • ${e}`)].join("\n");
    console.error(msg);
    throw new Error(msg);
  }
}
