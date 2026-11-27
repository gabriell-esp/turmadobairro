import type { ConsentType } from "@prisma/client";
import { db } from "./db";
import { clientInfo } from "./request";

/** Altere a versão quando o texto das políticas mudar — o aceite anterior fica registrado. */
export const POLICY_VERSION = "2026-11";

export async function recordConsent(userId: string | null, type: ConsentType, granted: boolean, version = POLICY_VERSION) {
  const { ip, userAgent } = await clientInfo();
  await db.consentLog.create({ data: { userId, type, granted, version, ip, userAgent } });
}
