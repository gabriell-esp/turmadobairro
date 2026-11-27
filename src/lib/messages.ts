import type { Event, Order, OrderItem, Product } from "@prisma/client";
import { brl, fmtDate, fmtDateTime, orderCode } from "./format";
import { appUrl } from "./request";

type OrderFull = Order & { items: (OrderItem & { product: Product })[]; event: Event };

export function orderConfirmationText(order: OrderFull, pickupInfo: string): string {
  const lines = order.items.map(
    (i) => `• ${i.ownerName} — ${i.product.name}, tam. ${i.size}${i.babyLook ? " (Baby Look)" : ""}`,
  );
  return [
    `🍻 *Turma do Bairro* — pagamento confirmado!`,
    ``,
    `Olá, ${order.buyerName.split(" ")[0]}! Recebemos o pagamento do pedido *${orderCode(order.number)}*.`,
    ``,
    `*Seus abadás (${order.items.length}):*`,
    ...lines,
    ``,
    `*Total pago:* ${brl(order.totalCents)}`,
    `*Evento:* ${order.event.name} (${fmtDate(order.event.startsAt)} a ${fmtDate(order.event.endsAt)})`,
    ``,
    `*Retirada:* ${pickupInfo}`,
    ``,
    `Acompanhe o pedido: ${appUrl()}/minha-conta/pedidos/${order.id}`,
    ``,
    `Prost! 🍻`,
  ].join("\n");
}

export function paymentLinkText(order: OrderFull, url: string): string {
  return [
    `🍻 *Turma do Bairro* — pedido *${orderCode(order.number)}*`,
    ``,
    `Olá, ${order.buyerName.split(" ")[0]}! Seu pedido de ${order.items.length} abadá(s) está reservado até ${fmtDateTime(order.expiresAt)}.`,
    `Total: *${brl(order.totalCents)}*`,
    ``,
    `Pague pelo link seguro do Mercado Pago (Pix ou cartão):`,
    url.startsWith("http") ? url : `${appUrl()}${url}`,
  ].join("\n");
}

/** Texto neutro (sem dados pessoais do comprador) para o vendedor mandar o link pelo próprio WhatsApp. */
export function shareLinkText(order: OrderFull, url: string): string {
  const full = url.startsWith("http") ? url : `${appUrl()}${url}`;
  return [
    `🍻 *Turma do Bairro* — ${order.items.length === 1 ? "seu abadá" : `seus ${order.items.length} abadás`} do ${order.event.name}`,
    ...order.items.map((i) => `• ${i.ownerName} — tam. ${i.size}${i.babyLook ? " (Baby Look)" : ""}`),
    ``,
    `Total: *${brl(order.totalCents)}*`,
    `Pague pelo link seguro do Mercado Pago (válido até ${fmtDateTime(order.expiresAt)}):`,
    full,
  ].join("\n");
}

export function passwordResetText(name: string, link: string): string {
  return [
    `🍻 *Turma do Bairro*`,
    ``,
    `Olá, ${name.split(" ")[0]}! Recebemos um pedido para redefinir sua senha.`,
    `Use o link abaixo (vale por 1 hora e só funciona uma vez):`,
    link,
    ``,
    `Se não foi você, ignore esta mensagem.`,
  ].join("\n");
}
