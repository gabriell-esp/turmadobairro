import { cache } from "react";
import { db } from "./db";

export const SETTING_DEFAULTS = {
  site_name: "Turma do Bairro",
  tagline: "A alma do Kerbfest de Ipira",
  instagram_url: "https://www.instagram.com/turmado_bairro",
  whatsapp_contact: "", // número de atendimento (somente dígitos, com 55)
  contact_email: "",
  pickup_text:
    "A retirada do abadá é feita pela organização antes do Kerb. Local, dias e horários serão avisados por WhatsApp e publicados aqui no site.",
  sales_open: "true", // "false" fecha a loja inteira
  dpo_name: "Organização da Turma do Bairro",
  privacy_contact:
    "Pelo WhatsApp de atendimento ou pelo Instagram oficial @turmado_bairro (mensagem direta).",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export const getSettings = cache(async (): Promise<Record<SettingKey, string>> => {
  const rows = await db.setting.findMany();
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS && r.value !== "") out[r.key] = r.value;
  return out as Record<SettingKey, string>;
});

/** Vendas liberadas? Lê direto do banco (sem cache) para a trava valer na hora. */
export async function isSalesOpen(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: "sales_open" } });
  return row?.value !== "false";
}

export async function setSetting(key: SettingKey, value: string) {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}
