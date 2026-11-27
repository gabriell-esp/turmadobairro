"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission, can } from "@/lib/auth";
import { EXTERNAL_METHODS, OrderError, createExternalPaidOrder, createOrder, isExternalMethod, type ItemInput } from "@/lib/orders";
import { ensureCheckoutUrl } from "@/lib/payments";
import { parsePayMethods } from "@/lib/mercadopago";
import { ownerSchema, fieldErrorsFrom } from "@/lib/schemas";
import { cleanName, parseBirthDate, parsePriceCents } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { isSalesOpen } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { orderCode } from "@/lib/format";
import type { FormState } from "./types";

// A venda do painel não identifica o comprador: só os donos dos abadás (quem usa o abadá).
const optionsSchema = z.object({
  holdMinutes: z.coerce.number().int().min(10).max(4320).default(120),
  notes: z.string().trim().max(300).optional(),
  priceReason: z.string().trim().max(200).optional(),
});

export async function createManualSaleAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await assertPermission("sales.create");
  const rl = await rateLimit(`manual-sale:${user.id}`, 40, 900);
  if (!rl.ok) return { error: "Muitas vendas em pouco tempo. Aguarde um instante." };

  const frozenAllowed = can(user, "sales.create_frozen");
  if (!frozenAllowed && !(await isSalesOpen())) return { error: "As vendas estão congeladas. Somente os gestores podem fazer vendas manuais agora." };

  const keep: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) keep[k] = v;

  const errors: Record<string, string> = {};
  const opts = optionsSchema.safeParse(Object.fromEntries(formData));
  if (!opts.success) Object.assign(errors, fieldErrorsFrom(opts.error));
  const payMethods = parsePayMethods(formData.get("payMethods"));

  // Modo "venda feita por fora": já foi paga em dinheiro/Pix direto etc.; só lança no sistema.
  const external = formData.get("mode") === "EXTERNAL";
  const externalMethod = formData.get("externalMethod");
  if (external) {
    if (!can(user, "sales.external")) return { error: "Você não tem permissão para lançar vendas por fora.", values: keep };
    if (!isExternalMethod(externalMethod)) errors.externalMethod = "Escolha como a venda foi paga.";
  }

  const count = Math.min(20, Math.max(0, Number(formData.get("count") ?? 0)));
  if (count < 1) return { error: "Adicione ao menos um abadá.", values: keep };

  const items: ItemInput[] = [];
  const rowIndex: number[] = [];
  const organizer = can(user, "orders.all");
  for (let i = 0; i < count; i++) {
    const g = (k: string) => formData.get(`i${i}_${k}`);
    if (g("productId") == null) continue; // linha removida
    const parsed = ownerSchema.safeParse({
      productId: g("productId"), ownerName: g("ownerName"), ownerCpf: g("ownerCpf"), ownerBirthDate: g("ownerBirthDate"),
      size: g("size"), babyLook: g("babyLook") ?? undefined, guardianName: g("guardianName") ?? "", guardianConfirm: g("guardianConfirm") ?? undefined,
    });
    if (!parsed.success) {
      for (const [k, m] of Object.entries(fieldErrorsFrom(parsed.error))) errors[`i${i}_${k}`] = m;
      continue;
    }
    const d = parsed.data;
    const priceRaw = String(g("price") ?? "").trim();
    const priceCents = priceRaw === "" ? undefined : parsePriceCents(priceRaw);
    if (priceCents === null) {
      errors[`i${i}_price`] = "Preço inválido. Ex.: 120,00";
      continue;
    }
    items.push({
      priceCents,
      productId: d.productId, ownerName: d.ownerName, ownerCpf: d.ownerCpf, ownerBirthDate: parseBirthDate(d.ownerBirthDate)!,
      size: d.size, babyLook: d.babyLook === "on", guardianName: d.guardianName || null,
      allowDuplicateName: organizer && g("allowDup") === "on",
    });
    rowIndex.push(i);
  }
  if (Object.keys(errors).length || !opts.success) return { fieldErrors: errors, values: keep, error: "Revise os campos destacados." };
  if (!items.length) return { error: "Adicione ao menos um abadá.", values: keep };

  const event = await db.product.findUnique({ where: { id: items[0].productId }, select: { eventId: true } });
  if (!event) return { error: "Produto inválido.", values: keep };

  // Referência interna do pedido: nome do primeiro dono (+ quantidade de outros). Sem telefone/e-mail.
  const first = cleanName(items[0].ownerName);
  const reference = items.length > 1 ? `${first} (+${items.length - 1})` : first;

  let orderId: string;
  try {
    const orderArgs = {
      eventId: event.eventId,
      buyer: { name: reference, phone: null, email: null },
      sellerId: user.id,
      source: "SELLER" as const,
      items,
      notes: opts.data.notes || null,
      payMethods,
      bypassFreeze: frozenAllowed,
      allowPriceOverride: true,
      priceReason: opts.data.priceReason,
      ignoreSaleWindow: can(user, "products.manage"),
      holdMinutes: organizer ? opts.data.holdMinutes : Math.min(opts.data.holdMinutes, 1440),
    };
    const order = external
      ? await createExternalPaidOrder({ ...orderArgs, externalMethod: externalMethod as keyof typeof EXTERNAL_METHODS, recordedBy: user.name })
      : await createOrder(orderArgs);
    orderId = order.id;
    await audit(
      { id: user.id, name: user.name },
      external ? "order.create_external" : "order.create_manual",
      "Order",
      order.id,
      external ? { code: orderCode(order.number), items: items.length, method: externalMethod as string, totalCents: order.totalCents } : { code: orderCode(order.number), items: items.length, payMethods },
    );
  } catch (e) {
    if (e instanceof OrderError) {
      const fe: Record<string, string> = {};
      for (const d of e.details) {
        const row = rowIndex[d.index];
        const field = { cpf: "ownerCpf", name: "ownerName", size: "size", product: "productId", babyLook: "babyLook", guardian: "guardianName", birth: "ownerBirthDate", price: "price" }[d.field];
        if (row != null) fe[`i${row}_${field}`] ??= d.message;
      }
      // erro sem item específico (ex.: falta o motivo do preço) volta para o campo do motivo
      if (!e.details.length && /motivo/i.test(e.message)) fe.priceReason = e.message;
      return { error: e.message, fieldErrors: fe, values: keep };
    }
    console.error("[manual-sale]", e);
    return { error: "Não foi possível criar a venda.", values: keep };
  }

  if (external) {
    redirect(`/admin/pedidos/${orderId}?msg=${encodeURIComponent("Venda lançada como paga! Os abadás já podem ser entregues na aba Retirada.")}`);
  }

  let msg = "Venda criada! Copie o link abaixo e envie para quem vai pagar.";
  try {
    await ensureCheckoutUrl(orderId);
  } catch (e) {
    console.error("[manual-sale] link", e);
    msg = "Venda criada, mas houve falha ao gerar o link. Use “Gerar novo link” abaixo.";
  }
  redirect(`/admin/pedidos/${orderId}?msg=${encodeURIComponent(msg)}`);
}
