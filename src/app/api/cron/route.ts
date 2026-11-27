import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { expireStaleOrders } from "@/lib/orders";
import { processWhatsAppQueue } from "@/lib/wpp";
import { purgeRateLimits } from "@/lib/rate-limit";
import { reconcileOrder } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manutenção periódica. Agende a cada 5 minutos (cron do servidor, Vercel Cron, etc.):
 *   curl -X POST https://SEU-DOMINIO/api/cron -H "Authorization: Bearer $CRON_SECRET"
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 1) concilia pedidos pendentes recentes (caso algum webhook tenha se perdido)
  const pending = await db.order.findMany({
    where: { status: "PENDING", createdAt: { gt: new Date(Date.now() - 6 * 3600_000) } },
    select: { id: true },
    take: 30,
  });
  let reconciled = 0;
  for (const o of pending) {
    try {
      if (await reconcileOrder(o.id)) reconciled++;
    } catch (e) {
      console.error("[cron] reconcile", o.id, e);
    }
  }
  // 2) expira pedidos
  const expired = await expireStaleOrders();
  // 3) reenvia WhatsApp pendente
  const wa = await processWhatsAppQueue(30);
  // 4) limpeza
  await purgeRateLimits();
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.passwordReset.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400_000) } } });

  return NextResponse.json({ ok: true, reconciled, expired, whatsapp: wa, sessionsPurged: sessions.count });
}

export const POST = run;
export const GET = run;
