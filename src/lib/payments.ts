import { Prisma } from "@prisma/client";
import { db } from "./db";
import { createCheckout, fetchPayment, isMpConfigured, parsePayMethods, searchPaymentsByReference, type MpPayment } from "./mercadopago";
import { appendNote, markOrderPaid, releaseOrder } from "./orders";
import { orderCode } from "./format";
import { enqueueWhatsApp } from "./wpp";
import { orderConfirmationText, paymentLinkText } from "./messages";
import { getSettings } from "./settings";
import { audit } from "./audit";

const orderInclude = { items: { include: { product: true } }, event: true } as const;

/** Cria (ou recria) o link de pagamento do Mercado Pago para um pedido pendente. */
export async function ensureCheckoutUrl(orderId: string): Promise<string> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  if (order.status !== "PENDING") throw new Error("Pedido não está aguardando pagamento.");
  if (order.mpInitPoint && order.expiresAt > new Date()) return order.mpInitPoint;

  const result = await createCheckout({
    externalReference: order.id,
    items: order.items.map((it) => ({
      id: it.productId,
      title: `${it.product.name} — ${it.size}${it.babyLook ? " Baby Look" : ""}`,
      description: `Abadá ${order.event.name} (${orderCode(order.number)})`,
      quantity: 1,
      unitPriceCents: it.priceCents,
    })),
    payer: order.buyerEmail ? { name: order.buyerName, email: order.buyerEmail } : undefined,
    expiresAt: order.expiresAt,
    backPath: `/pedido/${order.id}/obrigado`,
    methods: parsePayMethods(order.payMethods),
  });
  await db.order.update({ where: { id: order.id }, data: { mpPreferenceId: result.preferenceId, mpInitPoint: result.url } });
  return result.url;
}

/** Envia a confirmação por WhatsApp. Chamada uma única vez quando o pedido vira PAID. */
export async function sendOrderConfirmation(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order?.buyerPhone) return;
  const settings = await getSettings();
  const pickup = order.event.pickupInfo?.trim() || settings.pickup_text;
  await enqueueWhatsApp({
    orderId,
    kind: "ORDER_CONFIRMATION",
    phone: order.buyerPhone,
    body: orderConfirmationText(order, pickup),
  });
}

export async function sendPaymentLinkWhatsApp(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  if (!order.buyerPhone) throw new Error("Pedido sem telefone do comprador.");
  const url = await ensureCheckoutUrl(orderId);
  await enqueueWhatsApp({ orderId, kind: "PAYMENT_LINK", phone: order.buyerPhone, body: paymentLinkText(order, url) });
}

/** Aplica o estado de um pagamento do MP ao pedido. Idempotente. */
export async function applyPayment(payment: MpPayment): Promise<{ orderId?: string; paid?: boolean }> {
  const ref = payment.externalReference;
  if (!ref || ref.startsWith("link:")) {
    await db.paymentEvent.create({
      data: { mpPaymentId: payment.id, status: payment.status, raw: payment as unknown as Prisma.InputJsonValue, note: "Sem pedido associado (link avulso)" },
    });
    return {};
  }
  const order = await db.order.findUnique({ where: { id: ref } });
  await db.paymentEvent.create({
    data: {
      mpPaymentId: payment.id,
      status: payment.status,
      orderId: order?.id,
      raw: payment as unknown as Prisma.InputJsonValue,
      note: order ? null : "external_reference não corresponde a nenhum pedido",
    },
  });
  if (!order) return {};

  switch (payment.status) {
    case "approved": {
      const res = await markOrderPaid(order.id, {
        paymentId: payment.id,
        status: payment.status,
        method: payment.type ? `${payment.type}/${payment.method}` : payment.method,
        amountCents: payment.amountCents,
      });
      if (res.changed) {
        await audit(null, "order.paid", "Order", order.id, { paymentId: payment.id, method: payment.method ?? null });
        try {
          await sendOrderConfirmation(order.id);
        } catch (e) {
          console.error("[whatsapp] falha ao enfileirar confirmação", e);
        }
      }
      return { orderId: order.id, paid: res.changed || order.status === "PAID" };
    }
    case "refunded":
    case "charged_back":
      if (order.status === "PAID") {
        await releaseOrder(order.id, "REFUNDED", `Pagamento ${payment.status} no Mercado Pago`);
        await audit(null, "order.refunded", "Order", order.id, { paymentId: payment.id, status: payment.status });
      }
      return { orderId: order.id };
    default:
      // pending / in_process / rejected / cancelled: mantém o pedido PENDING (reserva até expirar) e guarda o status
      if (order.status === "PENDING") {
        await db.order.update({
          where: { id: order.id },
          data: { mpPaymentId: payment.id, mpPaymentStatus: payment.status, notes: order.notes },
        });
      }
      return { orderId: order.id };
  }
}

export async function syncPaymentById(paymentId: string) {
  const payment = await fetchPayment(paymentId);
  return applyPayment(payment);
}

/** Concilia um pedido consultando o MP (usado na página de obrigado e no painel). */
export async function reconcileOrder(orderId: string): Promise<boolean> {
  if (!(await isMpConfigured())) return false;
  const payments = await searchPaymentsByReference(orderId);
  let paid = false;
  for (const p of payments) {
    if (p.status === "approved") {
      const r = await applyPayment(p);
      paid ||= !!r.paid;
    }
  }
  if (!paid && payments[0]) {
    await db.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { mpPaymentId: payments[0].id, mpPaymentStatus: payments[0].status },
    });
  }
  return paid;
}

export { appendNote };
