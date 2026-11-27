import { NextResponse } from "next/server";
import { getMpCreds, verifyWebhookSignature } from "@/lib/mercadopago";
import { syncPaymentById } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Webhook do Mercado Pago. Segurança:
 *  1) valida a assinatura HMAC (x-signature) com a assinatura secreta (Configurações ou MP_WEBHOOK_SECRET);
 *  2) NÃO confia no corpo: busca o pagamento direto na API do MP pelo id;
 *  3) idempotente: reprocessar a mesma notificação não duplica nada.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; action?: string; data?: { id?: string | number } };
  const dataIdParam = url.searchParams.get("data.id");
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? "";

  const valid = verifyWebhookSignature({
    signatureHeader: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId: dataIdParam ?? (body.data?.id != null ? String(body.data.id) : null),
    secret: (await getMpCreds()).webhookSecret,
  });
  if (!valid) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  const paymentId = dataIdParam ?? (body.data?.id != null ? String(body.data.id) : null);
  if (type === "payment" && paymentId && /^[\w-]+$/.test(paymentId)) {
    try {
      await syncPaymentById(paymentId);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 404) return NextResponse.json({ ok: true, ignored: "payment not found" }); // notificação de teste
      console.error("[mp-webhook] erro ao processar", paymentId, e);
      return NextResponse.json({ error: "processing failed" }, { status: 500 }); // MP tentará novamente
    }
  }
  return NextResponse.json({ ok: true });
}

// Algumas configurações antigas (IPN) usam GET
export const GET = POST;
