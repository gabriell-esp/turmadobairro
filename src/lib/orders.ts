import { Prisma, type Order, type OrderStatus } from "@prisma/client";
import { db } from "./db";
import { blindIndex, encrypt } from "./crypto";
import { isSalesOpen } from "./settings";
import { BABY_LOOK_SIZES, ageOn, cleanName, isFullName, isValidCpf, nameKey, onlyDigits } from "./validators";

export const HOLD_MINUTES = Math.max(5, Number(process.env.ORDER_HOLD_MINUTES ?? 30));
export const MAX_ITEMS_PER_ORDER = 20;

export type ItemInput = {
  productId: string;
  ownerName: string;
  ownerCpf: string;
  ownerBirthDate: Date;
  size: string;
  babyLook: boolean;
  guardianName?: string | null;
  /** Somente organizador: libera homônimos (CPF continua único). */
  allowDuplicateName?: boolean;
  /** Venda manual: preço combinado (centavos) no lugar do preço de tabela. Exige allowPriceOverride + motivo. */
  priceCents?: number;
};

export type ItemErrorField = "cpf" | "name" | "size" | "product" | "babyLook" | "guardian" | "birth" | "price";
export type ItemError = { index: number; field: ItemErrorField; message: string };

export class OrderError extends Error {
  constructor(message: string, public details: ItemError[] = []) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

/** Pedidos aguardando pagamento cujo prazo venceu liberam estoque, CPF e nome. */
export async function expireStaleOrders(client: Tx | typeof db = db): Promise<number> {
  const stale = await client.order.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  if (!stale.length) return 0;
  const ids = stale.map((o) => o.id);
  await client.orderItem.updateMany({ where: { orderId: { in: ids } }, data: { active: false } });
  await client.order.updateMany({
    where: { id: { in: ids }, status: "PENDING" },
    data: { status: "EXPIRED", cancelledReason: "Prazo para pagamento expirado" },
  });
  return ids.length;
}

export type Candidate = { cpf: string; name: string; allowDuplicateName?: boolean };

/**
 * Procura conflitos de CPF/nome com abadás ATIVOS (pedidos pendentes ou pagos) do evento.
 * Retorna por índice quais campos conflitam. Nunca revela dados de terceiros.
 */
export async function findConflicts(
  client: Tx | typeof db,
  eventId: string,
  candidates: Candidate[],
  excludeOrderId?: string,
): Promise<Map<number, { cpf?: boolean; name?: boolean }>> {
  const cpfHashes = candidates.map((c) => blindIndex(onlyDigits(c.cpf)));
  const keys = candidates.map((c) => nameKey(c.name));
  const existing = await client.orderItem.findMany({
    where: {
      eventId,
      active: true,
      ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
      OR: [{ ownerCpfHash: { in: cpfHashes } }, { ownerNameKey: { in: keys } }],
    },
    select: { ownerCpfHash: true, ownerNameKey: true },
  });
  const cpfSet = new Set(existing.map((e) => e.ownerCpfHash));
  const nameSet = new Set(existing.map((e) => e.ownerNameKey).filter(Boolean) as string[]);
  const result = new Map<number, { cpf?: boolean; name?: boolean }>();
  candidates.forEach((c, i) => {
    const r: { cpf?: boolean; name?: boolean } = {};
    if (cpfSet.has(cpfHashes[i])) r.cpf = true;
    if (!c.allowDuplicateName && nameSet.has(keys[i])) r.name = true;
    if (r.cpf || r.name) result.set(i, r);
  });
  return result;
}

/** Duplicidades dentro do próprio pedido/sacola. */
export function findInternalDuplicates(candidates: Candidate[]): Map<number, { cpf?: boolean; name?: boolean }> {
  const result = new Map<number, { cpf?: boolean; name?: boolean }>();
  const seenCpf = new Map<string, number>();
  const seenName = new Map<string, number>();
  candidates.forEach((c, i) => {
    const cpf = onlyDigits(c.cpf);
    const key = nameKey(c.name);
    const r: { cpf?: boolean; name?: boolean } = {};
    if (seenCpf.has(cpf)) r.cpf = true;
    else seenCpf.set(cpf, i);
    if (!c.allowDuplicateName) {
      if (seenName.has(key)) r.name = true;
      else seenName.set(key, i);
    }
    if (r.cpf || r.name) result.set(i, r);
  });
  return result;
}

export const CONFLICT_MESSAGES = {
  cpf: "Já existe um abadá registrado para este CPF neste Kerb.",
  name: "Já existe um abadá registrado para este nome neste Kerb. Se for um homônimo, fale com a organização.",
  cpfInternal: "Este CPF já foi informado em outro abadá desta compra.",
  nameInternal: "Este nome já foi informado em outro abadá desta compra.",
};

export type ProductWithAvailability = Awaited<ReturnType<typeof getProductsWithAvailability>>[number];

export async function getProductsWithAvailability(eventId?: string) {
  await expireStaleOrders();
  const products = await db.product.findMany({
    where: { active: true, ...(eventId ? { eventId } : {}) },
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
    include: { event: true },
  });
  const sold = await db.orderItem.groupBy({
    by: ["productId"],
    where: { active: true, productId: { in: products.map((p) => p.id) } },
    _count: { _all: true },
  });
  const soldMap = new Map(sold.map((s) => [s.productId, s._count._all]));
  const now = new Date();
  return products.map((p) => {
    const soldCount = soldMap.get(p.id) ?? 0;
    const remaining = p.stock == null ? null : Math.max(0, p.stock - soldCount);
    const notStarted = !!p.saleStartsAt && p.saleStartsAt > now;
    const ended = !!p.saleEndsAt && p.saleEndsAt < now;
    const soldOut = remaining !== null && remaining <= 0;
    const available = !notStarted && !ended && !soldOut;
    return { ...p, soldCount, remaining, notStarted, ended, soldOut, available };
  });
}

type CreateOrderArgs = {
  eventId: string;
  buyer: { userId?: string | null; name: string; email?: string | null; phone?: string | null };
  sellerId?: string | null;
  source: "ONLINE" | "SELLER";
  items: ItemInput[];
  notes?: string | null;
  ignoreSaleWindow?: boolean;
  holdMinutes?: number;
  payMethods?: "ALL" | "PIX" | "CARD";
  /** Permite criar o pedido mesmo com as vendas congeladas (somente gestor, venda manual). */
  bypassFreeze?: boolean;
  /** Permite preço editado por item (somente venda manual de gestor/vendedor). */
  allowPriceOverride?: boolean;
  /** Motivo obrigatório quando algum preço difere da tabela. */
  priceReason?: string;
};

export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 10_000_000;

export async function createOrder(args: CreateOrderArgs): Promise<Order> {
  const { items } = args;
  if (!items.length) throw new OrderError("A sacola está vazia.");
  if (items.length > MAX_ITEMS_PER_ORDER) throw new OrderError(`Máximo de ${MAX_ITEMS_PER_ORDER} abadás por compra.`);
  // Trava central: com as vendas congeladas, só a venda manual de gestor passa (loja online e vendedores não).
  if (!args.bypassFreeze && !(await isSalesOpen())) throw new OrderError("As vendas estão congeladas no momento.");

  // Validações puras (sem banco)
  const errors: ItemError[] = [];
  items.forEach((it, index) => {
    if (!isFullName(it.ownerName)) errors.push({ index, field: "name", message: "Informe o nome completo." });
    if (!isValidCpf(it.ownerCpf)) errors.push({ index, field: "cpf", message: "CPF inválido." });
    if (it.priceCents != null) {
      if (!args.allowPriceOverride) errors.push({ index, field: "price", message: "Preço não pode ser alterado nesta venda." });
      else if (!Number.isInteger(it.priceCents) || it.priceCents < MIN_PRICE_CENTS || it.priceCents > MAX_PRICE_CENTS)
        errors.push({ index, field: "price", message: "Preço entre R$ 1,00 e R$ 100.000,00." });
    }
    if (ageOn(it.ownerBirthDate) < 18 && !cleanName(it.guardianName ?? "")) {
      errors.push({ index, field: "guardian", message: "Para menores de 18 anos, informe o responsável legal." });
    }
  });
  if (errors.length) throw new OrderError("Revise os dados dos abadás.", errors);

  const candidates: Candidate[] = items.map((i) => ({
    cpf: i.ownerCpf,
    name: i.ownerName,
    allowDuplicateName: i.allowDuplicateName,
  }));
  const internal = findInternalDuplicates(candidates);
  internal.forEach((v, index) => {
    if (v.cpf) errors.push({ index, field: "cpf", message: CONFLICT_MESSAGES.cpfInternal });
    if (v.name) errors.push({ index, field: "name", message: CONFLICT_MESSAGES.nameInternal });
  });
  if (errors.length) throw new OrderError("Há dados repetidos na compra.", errors);

  try {
    return await db.$transaction(
      async (tx) => {
        await expireStaleOrders(tx);

        const productIds = [...new Set(items.map((i) => i.productId))];
        // Trava as linhas dos produtos: serializa a checagem de estoque entre compradores simultâneos.
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) FOR UPDATE`;
        const products = await tx.product.findMany({ where: { id: { in: productIds } } });
        const byId = new Map(products.map((p) => [p.id, p]));
        const active = await tx.orderItem.groupBy({
          by: ["productId"],
          where: { active: true, productId: { in: productIds } },
          _count: { _all: true },
        });
        const activeMap = new Map(active.map((a) => [a.productId, a._count._all]));
        const requested = new Map<string, number>();
        const now = new Date();

        items.forEach((it, index) => {
          const p = byId.get(it.productId);
          if (!p || p.eventId !== args.eventId || !p.active) {
            errors.push({ index, field: "product", message: "Este abadá não está mais disponível." });
            return;
          }
          if (!args.ignoreSaleWindow) {
            if (p.saleStartsAt && p.saleStartsAt > now)
              errors.push({ index, field: "product", message: "As vendas deste lote ainda não começaram." });
            if (p.saleEndsAt && p.saleEndsAt < now)
              errors.push({ index, field: "product", message: "As vendas deste lote foram encerradas." });
          }
          if (!p.sizes.includes(it.size)) errors.push({ index, field: "size", message: "Tamanho indisponível." });
          if (it.babyLook) {
            if (!p.allowBabyLook) errors.push({ index, field: "babyLook", message: "Este modelo não tem Baby Look." });
            else if (!(BABY_LOOK_SIZES as readonly string[]).includes(it.size))
              errors.push({ index, field: "size", message: "Baby Look não está disponível neste tamanho." });
          }
          requested.set(p.id, (requested.get(p.id) ?? 0) + 1);
        });
        if (errors.length) throw new OrderError("Revise os itens da compra.", errors);

        for (const [pid, qty] of requested) {
          const p = byId.get(pid)!;
          if (qty > p.maxPerOrder) throw new OrderError(`Máximo de ${p.maxPerOrder} unidades de "${p.name}" por compra.`);
          if (p.stock != null) {
            const left = p.stock - (activeMap.get(pid) ?? 0);
            if (qty > left)
              throw new OrderError(
                left <= 0 ? `"${p.name}" esgotou.` : `Restam apenas ${left} unidade(s) de "${p.name}".`,
              );
          }
        }

        const conflicts = await findConflicts(tx, args.eventId, candidates);
        conflicts.forEach((v, index) => {
          if (v.cpf) errors.push({ index, field: "cpf", message: CONFLICT_MESSAGES.cpf });
          if (v.name) errors.push({ index, field: "name", message: CONFLICT_MESSAGES.name });
        });
        if (errors.length) throw new OrderError("Alguns dados já possuem abadá neste Kerb.", errors);

        const priceOf = (it: ItemInput) => it.priceCents ?? byId.get(it.productId)!.priceCents;
        const changed = items.filter((it) => it.priceCents != null && it.priceCents !== byId.get(it.productId)!.priceCents);
        const reason = (args.priceReason ?? "").trim().slice(0, 200);
        if (changed.length && reason.length < 3) throw new OrderError("Informe o motivo da alteração de preço.");
        let notes = args.notes ?? null;
        for (const it of changed) {
          notes = appendNote(notes, `Preço alterado (${cleanName(it.ownerName)}): tabela ${(byId.get(it.productId)!.priceCents / 100).toFixed(2)} → ${(it.priceCents! / 100).toFixed(2)}. Motivo: ${reason}`);
        }
        const total = items.reduce((sum, it) => sum + priceOf(it), 0);
        const holdMs = (args.holdMinutes ?? HOLD_MINUTES) * 60_000;
        return tx.order.create({
          data: {
            eventId: args.eventId,
            userId: args.buyer.userId ?? null,
            sellerId: args.sellerId ?? null,
            source: args.source,
            totalCents: total,
            buyerName: cleanName(args.buyer.name),
            buyerEmail: args.buyer.email ?? null,
            buyerPhone: args.buyer.phone ?? null,
            notes,
            payMethods: args.payMethods ?? "ALL",
            expiresAt: new Date(Date.now() + holdMs),
            items: {
              create: items.map((it) => ({
                productId: it.productId,
                eventId: args.eventId,
                priceCents: priceOf(it),
                ownerName: cleanName(it.ownerName),
                ownerNameKey: it.allowDuplicateName ? null : nameKey(it.ownerName),
                ownerCpfEnc: encrypt(onlyDigits(it.ownerCpf)),
                ownerCpfHash: blindIndex(onlyDigits(it.ownerCpf)),
                ownerBirthDate: it.ownerBirthDate,
                size: it.size,
                babyLook: it.babyLook,
                guardianName: it.guardianName ? cleanName(it.guardianName) : null,
              })),
            },
          },
        });
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Corrida: outro comprador registrou o mesmo CPF/nome entre a checagem e o insert.
      throw new OrderError("Outro comprador acabou de registrar um dos dados informados. Revise e tente de novo.");
    }
    throw e;
  }
}

/** Libera os dados do pedido (CPF/nome/estoque) e muda o status. */
export async function releaseOrder(orderId: string, status: Extract<OrderStatus, "CANCELLED" | "EXPIRED" | "REFUNDED">, reason?: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError("Pedido não encontrado.");
    if (order.status === "PAID" && status !== "REFUNDED")
      throw new OrderError("Pedido já pago: use reembolso para liberar os dados.");
    if (order.status === status) return order;
    await tx.orderItem.updateMany({ where: { orderId }, data: { active: false } });
    return tx.order.update({ where: { id: orderId }, data: { status, cancelledReason: reason ?? null } });
  });
}

export type PaymentInfo = { paymentId: string; status: string; method?: string | null; amountCents?: number | null };

/**
 * Marca como pago de forma idempotente. Retorna `changed: true` só na primeira vez
 * (quem chamar então dispara a confirmação por WhatsApp uma única vez).
 */
export async function markOrderPaid(
  orderId: string,
  info: PaymentInfo,
): Promise<{ changed: boolean; reason?: "mismatch" | "conflict" | "notfound"; order?: Order }> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { changed: false, reason: "notfound" };
  if (order.status === "PAID") return { changed: false, order };

  if (info.amountCents != null && info.amountCents < order.totalCents) {
    await db.order.update({
      where: { id: orderId },
      data: {
        needsAttention: true,
        mpPaymentId: info.paymentId,
        mpPaymentStatus: info.status,
        notes: appendNote(order.notes, `Valor pago (${info.amountCents}) menor que o total (${order.totalCents}).`),
      },
    });
    return { changed: false, reason: "mismatch", order };
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      // Reativa itens caso o pagamento tenha chegado depois da expiração
      await tx.orderItem.updateMany({ where: { orderId }, data: { active: true } });
      const res = await tx.order.updateMany({
        where: { id: orderId, status: { not: "PAID" } },
        data: {
          status: "PAID",
          paidAt: new Date(),
          mpPaymentId: info.paymentId,
          mpPaymentStatus: info.status,
          paymentMethod: info.method ?? null,
          cancelledReason: null,
        },
      });
      if (res.count === 0) return null; // outra requisição já processou
      return tx.order.findUnique({ where: { id: orderId } });
    });
    return updated ? { changed: true, order: updated } : { changed: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Pagamento aprovado depois da expiração e o CPF/nome já foi vendido a outra pessoa.
      await db.order.update({
        where: { id: orderId },
        data: {
          needsAttention: true,
          mpPaymentId: info.paymentId,
          mpPaymentStatus: info.status,
          notes: appendNote(order.notes, "PAGAMENTO APROVADO APÓS EXPIRAR e os dados já foram usados em outra compra. Reembolsar ou resolver manualmente."),
        },
      });
      return { changed: false, reason: "conflict", order };
    }
    throw e;
  }
}

export function appendNote(current: string | null | undefined, note: string) {
  // horário de Brasília (as datas do sistema são exibidas assim)
  const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date());
  return [current, `[${stamp}] ${note}`].filter(Boolean).join("\n");
}

/** Formas de pagamento de vendas lançadas por fora do sistema (fora do Mercado Pago). */
export const EXTERNAL_METHODS = {
  CASH: "Dinheiro",
  PIX: "Pix direto na conta",
  CARD: "Cartão na maquininha",
  TRANSFER: "Transferência bancária",
  OTHER: "Outro meio",
} as const;
export type ExternalMethod = keyof typeof EXTERNAL_METHODS;
export const isExternalMethod = (v: unknown): v is ExternalMethod => typeof v === "string" && v in EXTERNAL_METHODS;

/**
 * Lança uma venda feita fora do sistema (já recebida em dinheiro, Pix direto etc.).
 * Cria o pedido com todas as regras (CPF/nome únicos, estoque) e já o marca como PAGO.
 * Não gera link do Mercado Pago nem envia WhatsApp.
 */
export async function createExternalPaidOrder(
  args: CreateOrderArgs & { externalMethod: ExternalMethod; recordedBy: string },
): Promise<Order> {
  const { externalMethod, recordedBy, ...rest } = args;
  const label = EXTERNAL_METHODS[externalMethod];
  const order = await createOrder({ ...rest, holdMinutes: 30 });
  const res = await markOrderPaid(order.id, { paymentId: `EXT-${order.number}`, status: "approved", method: `${label} (por fora)` });
  if (!res.changed) {
    await releaseOrder(order.id, "CANCELLED", "Falha ao lançar venda por fora");
    throw new OrderError("Não foi possível confirmar o pagamento lançado. Tente novamente.");
  }
  const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  return db.order.update({
    where: { id: order.id },
    data: { notes: appendNote(fresh.notes, `Venda lançada por fora do sistema por ${recordedBy}: ${label}.`) },
  });
}
