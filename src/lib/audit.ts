import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { clientInfo } from "./request";

type Actor = { id: string; name: string } | null;

/** Registro de auditoria. NUNCA inclua CPF completo, senhas ou tokens em `meta`. */
export async function audit(
  actor: Actor,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Prisma.InputJsonValue,
) {
  try {
    let ip: string | undefined;
    try {
      ip = (await clientInfo()).ip;
    } catch {
      /* fora de contexto de request (ex.: seed/webhook) */
    }
    await db.auditLog.create({
      data: { actorId: actor?.id, actorName: actor?.name, action, entity, entityId, meta, ip },
    });
  } catch (e) {
    console.error("[audit] falha ao registrar", action, e);
  }
}
