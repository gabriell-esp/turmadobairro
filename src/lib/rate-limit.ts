import { Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * Rate limit persistido no Postgres (funciona com várias instâncias).
 * Janela fixa: `limit` tentativas a cada `windowSec` segundos por chave.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>(Prisma.sql`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + (${windowSec} * interval '1 second'))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN now() + (${windowSec} * interval '1 second') ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `);
  const row = rows[0];
  const retryAfterSec = Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000));
  return { ok: row.count <= limit, retryAfterSec };
}

export async function purgeRateLimits() {
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
}
