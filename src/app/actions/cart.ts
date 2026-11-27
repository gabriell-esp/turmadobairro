"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { blindIndex, decrypt, encrypt } from "@/lib/crypto";
import { requireUser } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { rateLimit } from "@/lib/rate-limit";
import { fieldErrorsFrom, ownerSchema } from "@/lib/schemas";
import {
  CONFLICT_MESSAGES,
  MAX_ITEMS_PER_ORDER,
  OrderError,
  createOrder,
  expireStaleOrders,
  findConflicts,
  type ItemInput,
} from "@/lib/orders";
import { BABY_LOOK_SIZES, cleanName, nameKey, onlyDigits, parseBirthDate, resolveBuyerPhone } from "@/lib/validators";
import { ageOn } from "@/lib/validators";
import { ensureCheckoutUrl } from "@/lib/payments";
import { recordConsent } from "@/lib/consent";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import type { FormState } from "./types";

const keep = (fd: FormData) => {
  const v: Record<string, string> = {};
  for (const [k, val] of fd.entries()) if (typeof val === "string" && !k.startsWith("$ACTION")) v[k] = val;
  return v;
};

export async function addToCartAction(_: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const user = await requireUser(`/loja/${slug}`);

  const rl = await rateLimit(`cart-add:${user.id}`, 60, 900);
  if (!rl.ok) return { error: "Muitas ações em pouco tempo. Aguarde um instante." };

  const raw: Record<string, FormDataEntryValue> = Object.fromEntries(formData);
  if (raw.forSelf === "on") {
    if (!user.cpfEnc || !user.birthDate) return { error: "Complete seu cadastro (CPF e data de nascimento) para comprar para você mesmo." };
    raw.ownerName = user.name;
    raw.ownerCpf = decrypt(user.cpfEnc);
    raw.ownerBirthDate = user.birthDate.toISOString().slice(0, 10);
  }

  const parsed = ownerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values: keep(formData) };
  const d = parsed.data;

  await expireStaleOrders();
  const [product, event, settings] = await Promise.all([
    db.product.findUnique({ where: { id: d.productId } }),
    getCurrentEvent(),
    getSettings(),
  ]);
  if (settings.sales_open === "false") return { error: "As vendas estão temporariamente fechadas." };
  if (!product || !product.active || !event || product.eventId !== event.id) return { error: "Este abadá não está mais disponível." };
  const now = new Date();
  if (product.saleStartsAt && product.saleStartsAt > now) return { error: "As vendas deste lote ainda não começaram." };
  if (product.saleEndsAt && product.saleEndsAt < now) return { error: "As vendas deste lote foram encerradas." };

  const errors: Record<string, string> = {};
  if (!product.sizes.includes(d.size)) errors.size = "Tamanho indisponível.";
  const babyLook = d.babyLook === "on";
  if (babyLook) {
    if (!product.allowBabyLook) errors.babyLook = "Este modelo não tem Baby Look.";
    else if (!(BABY_LOOK_SIZES as readonly string[]).includes(d.size)) errors.size = "Baby Look não está disponível neste tamanho.";
  }
  if (Object.keys(errors).length) return { fieldErrors: errors, values: keep(formData) };

  const cpfHash = blindIndex(d.ownerCpf);
  const key = nameKey(d.ownerName);

  // 1) repetição dentro da própria sacola
  const cart = await db.cart.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  const inCart = await db.cartItem.findMany({ where: { cartId: cart.id }, select: { ownerCpfHash: true, ownerNameKey: true } });
  if (inCart.length >= MAX_ITEMS_PER_ORDER) return { error: `Máximo de ${MAX_ITEMS_PER_ORDER} abadás por compra.` };
  if (inCart.some((i) => i.ownerCpfHash === cpfHash)) return { fieldErrors: { ownerCpf: CONFLICT_MESSAGES.cpfInternal }, values: keep(formData) };
  if (inCart.some((i) => i.ownerNameKey === key)) return { fieldErrors: { ownerName: CONFLICT_MESSAGES.nameInternal }, values: keep(formData) };

  // 2) já existe abadá (pendente/pago) para esse CPF/nome neste Kerb?
  const conflicts = await findConflicts(db, event.id, [{ cpf: d.ownerCpf, name: d.ownerName }]);
  const c = conflicts.get(0);
  if (c?.cpf) return { fieldErrors: { ownerCpf: CONFLICT_MESSAGES.cpf }, values: keep(formData) };
  if (c?.name) return { fieldErrors: { ownerName: CONFLICT_MESSAGES.name }, values: keep(formData) };

  const birth = parseBirthDate(d.ownerBirthDate)!;
  try {
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        ownerName: cleanName(d.ownerName),
        ownerNameKey: key,
        ownerCpfEnc: encrypt(d.ownerCpf),
        ownerCpfHash: cpfHash,
        ownerBirthDate: birth,
        size: d.size,
        babyLook,
        guardianName: ageOn(birth) < 18 ? cleanName(d.guardianName) : null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: "Esses dados já estão na sua sacola." };
    throw e;
  }
  if (ageOn(birth) < 18) await recordConsent(user.id, "GUARDIAN", true);
  revalidatePath("/sacola");
  redirect("/sacola?adicionado=1");
}

export async function removeCartItemAction(formData: FormData) {
  const user = await requireUser("/sacola");
  const id = String(formData.get("id") ?? "");
  await db.cartItem.deleteMany({ where: { id, cart: { userId: user.id } } });
  revalidatePath("/sacola");
}

export type CheckoutState = {
  error?: string;
  /** erro do campo de WhatsApp da finalização */
  fieldErrors?: { phone?: string };
  /** erros por item da sacola (id do CartItem → mensagens) */
  itemErrors?: Record<string, string[]>;
} | null;

export async function checkoutAction(_: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await requireUser("/sacola");
  const rl = await rateLimit(`checkout:${user.id}`, 12, 900);
  if (!rl.ok) return { error: "Muitas tentativas de finalizar. Aguarde alguns minutos." };

  if (formData.get("accept") !== "on")
    return { error: "Confirme que leu os Termos e que tem autorização para informar os dados dos donos dos abadás." };

  // WhatsApp: usa o digitado na sacola; em branco, o da conta. Sem nenhum dos dois, pede ali mesmo.
  const buyerPhone = resolveBuyerPhone(String(formData.get("phone") ?? ""), user.phone);
  if (!buyerPhone.phone) return { fieldErrors: { phone: buyerPhone.error } };
  const phone = buyerPhone.phone;
  // Conta ainda sem WhatsApp (ex.: conta criada pela equipe): guarda para as próximas compras
  if (!user.phone) await db.user.update({ where: { id: user.id }, data: { phone } });

  const settings = await getSettings();
  if (settings.sales_open === "false") return { error: "As vendas estão temporariamente fechadas." };

  const cart = await db.cart.findUnique({ where: { userId: user.id }, include: { items: { orderBy: { createdAt: "asc" }, include: { product: true } } } });
  if (!cart || cart.items.length === 0) return { error: "Sua sacola está vazia." };

  const events = new Set(cart.items.map((i) => i.product.eventId));
  if (events.size !== 1) return { error: "A sacola tem abadás de eventos diferentes. Remova os itens antigos." };
  const eventId = [...events][0];

  const items: ItemInput[] = cart.items.map((i) => ({
    productId: i.productId,
    ownerName: i.ownerName,
    ownerCpf: decrypt(i.ownerCpfEnc),
    ownerBirthDate: i.ownerBirthDate,
    size: i.size,
    babyLook: i.babyLook,
    guardianName: i.guardianName,
  }));

  let orderId: string;
  try {
    const order = await createOrder({
      eventId,
      buyer: { userId: user.id, name: user.name, email: user.email, phone },
      source: "ONLINE",
      items,
    });
    orderId = order.id;
  } catch (e) {
    if (e instanceof OrderError) {
      const itemErrors: Record<string, string[]> = {};
      for (const d of e.details) {
        const id = cart.items[d.index]?.id;
        if (id) (itemErrors[id] ??= []).push(d.message);
      }
      return { error: e.message, itemErrors };
    }
    console.error("[checkout]", e);
    return { error: "Não foi possível criar o pedido. Tente novamente." };
  }

  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  await audit({ id: user.id, name: user.name }, "order.create", "Order", orderId, { items: items.length, source: "ONLINE" });

  let url: string;
  try {
    url = await ensureCheckoutUrl(orderId);
  } catch (e) {
    console.error("[checkout] falha ao criar link do Mercado Pago", e);
    redirect(`/pedido/${orderId}/obrigado?erro=pagamento`);
  }
  redirect(url);
}
