"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission, can, getCurrentUser } from "@/lib/auth";
import { OrderError, appendNote, markOrderPaid, releaseOrder } from "@/lib/orders";
import { ensureCheckoutUrl, reconcileOrder, sendOrderConfirmation, sendPaymentLinkWhatsApp } from "@/lib/payments";
import { retryMessage } from "@/lib/wpp";
import { PAY_METHOD_LABEL, parsePayMethods } from "@/lib/mercadopago";
import { audit } from "@/lib/audit";
import { orderCode } from "@/lib/format";

const back = (id: string, kind: "msg" | "err", text: string): never =>
  redirect(`/admin/pedidos/${id}?${kind}=${encodeURIComponent(text)}`);

async function staffOrder(id: string): Promise<{ user: User; order: NonNullable<Awaited<ReturnType<typeof db.order.findUnique>>> }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ORGANIZER" && user.role !== "SELLER")) throw new Error("Sem permissão.");
  const order = await db.order.findUnique({ where: { id } });
  if (!order) throw new Error("Pedido não encontrado.");
  if (!can(user, "orders.all") && order.sellerId !== user.id) throw new Error("Sem permissão para este pedido.");
  return { user, order };
}

const who = (u: User) => ({ id: u.id, name: u.name });

export async function cancelOrderAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { user, order } = await staffOrder(id);
  const isOrganizer = can(user, "orders.cancel");
  if (!isOrganizer && order.status !== "PENDING") back(id, "err", "Vendedores só podem cancelar pedidos que ainda aguardam pagamento.");
  try {
    await releaseOrder(id, "CANCELLED", String(formData.get("reason") ?? "").slice(0, 200) || "Cancelado pela equipe");
  } catch (e) {
    back(id, "err", e instanceof OrderError ? e.message : "Falha ao cancelar.");
  }
  await audit(who(user), "order.cancel", "Order", id, { code: orderCode(order.number) });
  revalidatePath(`/admin/pedidos/${id}`);
  back(id, "msg", "Pedido cancelado e dados liberados.");
}

export async function refundOrderAction(formData: FormData) {
  const user = await assertPermission("orders.cancel");
  const id = String(formData.get("id"));
  const order = await db.order.findUniqueOrThrow({ where: { id } });
  if (order.status !== "PAID") back(id, "err", "Só pedidos pagos podem ser marcados como reembolsados.");
  await releaseOrder(id, "REFUNDED", String(formData.get("reason") ?? "").slice(0, 200) || "Reembolsado");
  await audit(who(user), "order.refund_mark", "Order", id);
  back(id, "msg", "Pedido marcado como reembolsado. Lembre de fazer o estorno no painel do Mercado Pago.");
}

export async function markPaidManualAction(formData: FormData) {
  const user = await assertPermission("orders.cancel"); // somente organizador
  const id = String(formData.get("id"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  if (!note) back(id, "err", "Descreva como o pagamento foi recebido (ex.: dinheiro, Pix direto).");
  const order = await db.order.findUniqueOrThrow({ where: { id } });
  const res = await markOrderPaid(id, { paymentId: `MANUAL-${Date.now()}`, status: "approved", method: "manual" });
  if (res.reason === "conflict") back(id, "err", "Os dados deste pedido já foram usados em outra compra após a expiração.");
  await db.order.update({ where: { id }, data: { notes: appendNote(order.notes, `Pagamento manual por ${user.name}: ${note}`) } });
  await audit(who(user), "order.paid_manual", "Order", id, { note });
  if (res.changed) await sendOrderConfirmation(id).catch(() => {});
  back(id, "msg", "Pagamento registrado manualmente.");
}

export async function markDeliveredAction(formData: FormData) {
  const user = await assertPermission("delivery.mark");
  const itemId = String(formData.get("itemId"));
  const deliver = formData.get("deliver") === "1";
  const rawReturn = String(formData.get("returnTo") ?? "");
  // só caminhos internos do painel (evita redirecionamento aberto)
  const returnTo = /^\/admin\/(retirada|pedidos)[\w/?=&%.\-]*$/.test(rawReturn) && !rawReturn.includes("//") ? rawReturn : "/admin/retirada";
  const item = await db.orderItem.findUnique({ where: { id: itemId }, include: { order: true } });
  if (!item || item.order.status !== "PAID") redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}err=${encodeURIComponent("Só é possível entregar abadá de pedido pago.")}`);
  if (!can(user, "orders.all") && item.order.sellerId !== user.id && returnTo.startsWith("/admin/pedidos")) throw new Error("Sem permissão.");
  await db.orderItem.update({ where: { id: itemId }, data: { deliveredAt: deliver ? new Date() : null, deliveredById: deliver ? user.id : null } });
  await audit(who(user), deliver ? "item.deliver" : "item.undeliver", "OrderItem", itemId, { owner: item.ownerName });
  revalidatePath(returnTo.split("?")[0]);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}msg=${encodeURIComponent(deliver ? `Abadá de ${item.ownerName} entregue.` : "Entrega desfeita.")}`);
}

export async function sendPaymentLinkAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { user, order } = await staffOrder(id);
  if (order.status !== "PENDING") back(id, "err", "O pedido não está aguardando pagamento.");
  if (!order.buyerPhone) back(id, "err", "O pedido não tem WhatsApp do comprador.");
  try {
    await sendPaymentLinkWhatsApp(id);
  } catch (e) {
    back(id, "err", e instanceof Error ? e.message : "Falha ao enviar.");
  }
  await audit(who(user), "order.send_link", "Order", id);
  back(id, "msg", "Link de pagamento enviado (ou na fila) por WhatsApp.");
}

export async function resendConfirmationAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { user, order } = await staffOrder(id);
  if (order.status !== "PAID") back(id, "err", "Só pedidos pagos têm confirmação.");
  await sendOrderConfirmation(id);
  await audit(who(user), "order.resend_confirmation", "Order", id);
  back(id, "msg", "Confirmação reenviada por WhatsApp.");
}

export async function reconcileOrderAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { user } = await staffOrder(id);
  const paid = await reconcileOrder(id).catch(() => false);
  await audit(who(user), "order.reconcile", "Order", id);
  back(id, "msg", paid ? "Pagamento encontrado no Mercado Pago e aplicado." : "Nenhum pagamento aprovado encontrado no Mercado Pago.");
}

export async function newCheckoutLinkAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { user, order } = await staffOrder(id);
  if (order.status !== "PENDING") back(id, "err", "O pedido não está aguardando pagamento.");
  const raw = formData.get("methods");
  const methods = raw ? parsePayMethods(raw) : parsePayMethods(order.payMethods);
  await db.order.update({ where: { id }, data: { mpInitPoint: null, mpPreferenceId: null, payMethods: methods } });
  try {
    await ensureCheckoutUrl(id);
  } catch (e) {
    back(id, "err", "Não foi possível gerar o link: " + (e instanceof Error ? e.message : ""));
  }
  await audit(who(user), "order.new_link", "Order", id, { methods });
  back(id, "msg", `Novo link gerado (${PAY_METHOD_LABEL[methods]}).`);
}

export async function resolveAttentionAction(formData: FormData) {
  const user = await assertPermission("orders.cancel");
  const id = String(formData.get("id"));
  const order = await db.order.findUniqueOrThrow({ where: { id } });
  await db.order.update({
    where: { id },
    data: { needsAttention: false, notes: appendNote(order.notes, `Pendência resolvida por ${user.name}: ${String(formData.get("note") ?? "").slice(0, 200)}`) },
  });
  await audit(who(user), "order.resolve_attention", "Order", id);
  back(id, "msg", "Pendência marcada como resolvida.");
}

export async function retryWhatsAppAction(formData: FormData) {
  const user = await assertPermission("whatsapp.manage");
  const id = String(formData.get("id"));
  const ok = await retryMessage(id);
  await audit(who(user), "whatsapp.retry", "WhatsAppMessage", id, { ok });
  revalidatePath("/admin/whatsapp");
  redirect(`/admin/whatsapp?${ok ? "msg" : "err"}=${encodeURIComponent(ok ? "Mensagem enviada." : "Falha no envio — veja o erro na lista.")}`);
}
