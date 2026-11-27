"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth";
import { fromLocalInput, slugify, toLocalInput } from "@/lib/format";
import { saveImage } from "@/lib/uploads";
import { SETTING_DEFAULTS, setSetting, type SettingKey } from "@/lib/settings";
import { SIZES, normalizePhone } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { MP_KEYS, saveMpSecret, testMpConnection } from "@/lib/mercadopago";

const go = (path: string, kind: "msg" | "err", text: string): never => redirect(`${path}?${kind}=${encodeURIComponent(text)}`);
const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
const dt = (v: FormDataEntryValue | null) => (v && String(v).trim() ? fromLocalInput(String(v)) : null);

// ───────────── Produtos ─────────────
const productSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome.").max(80),
  description: z.string().trim().max(600).optional(),
  price: z.number().min(0).max(100000),
  lotName: z.string().trim().max(40).optional(),
  maxPerOrder: z.number().int().min(1).max(20),
  sortOrder: z.number().int().min(0).max(999),
  eventId: z.string().min(1, "Escolha o evento."),
});

export async function saveProductAction(formData: FormData) {
  const user = await assertPermission("products.manage");
  const id = String(formData.get("id") ?? "");
  const path = "/admin/produtos";
  const parsed = productSchema.safeParse({
    name: formData.get("name"), description: String(formData.get("description") ?? ""), price: num(formData.get("price")), lotName: String(formData.get("lotName") ?? ""),
    maxPerOrder: num(String(formData.get("maxPerOrder") || 10)), sortOrder: num(String(formData.get("sortOrder") || 0)), eventId: formData.get("eventId"),
  });
  if (!parsed.success) go(path, "err", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data!;
  const sizes = SIZES.filter((s) => formData.get(`size_${s}`) === "on");
  if (!sizes.length) go(path, "err", "Marque ao menos um tamanho.");
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? null : Math.max(0, Math.floor(num(stockRaw)));
  if (stock !== null && !Number.isFinite(stock)) go(path, "err", "Estoque inválido.");

  let imageUrl: string | null | undefined; // undefined = mantém, null = remove a foto
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    try { imageUrl = await saveImage(file, 1200); } catch (e) { go(path, "err", e instanceof Error ? e.message : "Imagem inválida."); }
  } else if (formData.get("removeImage") === "on") {
    imageUrl = null;
  }
  const hex = (k: string) => { const v = String(formData.get(k) ?? "").trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null; };
  const data = {
    name: d.name, description: d.description || null, priceCents: Math.round(d.price * 100), lotName: d.lotName || null,
    stock, sizes, allowBabyLook: formData.get("allowBabyLook") === "on", maxPerOrder: d.maxPerOrder, sortOrder: d.sortOrder,
    active: formData.get("active") === "on", saleStartsAt: dt(formData.get("saleStartsAt")), saleEndsAt: dt(formData.get("saleEndsAt")), eventId: d.eventId,
    shirtColor: hex("shirtColor"), stripeColor: hex("stripeColor"),
    ...(imageUrl !== undefined ? { imageUrl } : {}),
  };
  if (id) {
    // Alterar preço não afeta pedidos já feitos (o valor fica gravado em cada item).
    await db.product.update({ where: { id }, data });
    await audit({ id: user.id, name: user.name }, "product.update", "Product", id, { price: data.priceCents, stock });
  } else {
    let slug = slugify(d.name) || "abada";
    if (await db.product.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const p = await db.product.create({ data: { ...data, slug } });
    await audit({ id: user.id, name: user.name }, "product.create", "Product", p.id);
  }
  revalidatePath("/admin/produtos"); revalidatePath("/loja"); revalidatePath("/");
  go(path, "msg", "Produto salvo.");
}

export async function deleteProductAction(formData: FormData) {
  const user = await assertPermission("products.manage");
  const id = String(formData.get("id"));
  const used = await db.orderItem.count({ where: { productId: id } });
  if (used > 0) go("/admin/produtos", "err", "Este produto já tem vendas: desative-o em vez de excluir.");
  await db.cartItem.deleteMany({ where: { productId: id } });
  await db.product.delete({ where: { id } });
  await audit({ id: user.id, name: user.name }, "product.delete", "Product", id);
  go("/admin/produtos", "msg", "Produto excluído.");
}

// ───────────── Evento e programação ─────────────
const eventSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do evento.").max(80),
  year: z.number().int().min(2008).max(2100),
  city: z.string().trim().min(2).max(80),
  location: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  pickupInfo: z.string().trim().max(1000).optional(),
});

export async function saveEventAction(formData: FormData) {
  const user = await assertPermission("events.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = eventSchema.safeParse({
    name: formData.get("name"), year: num(formData.get("year")), city: formData.get("city"), location: String(formData.get("location") ?? ""),
    description: String(formData.get("description") ?? ""), pickupInfo: String(formData.get("pickupInfo") ?? ""),
  });
  if (!parsed.success) go("/admin/evento", "err", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const startsAt = dt(formData.get("startsAt")); const endsAt = dt(formData.get("endsAt"));
  if (!startsAt || !endsAt || endsAt < startsAt) go("/admin/evento", "err", "Datas inválidas (o fim deve ser depois do início).");
  const d = parsed.data!;
  const isCurrent = formData.get("isCurrent") === "on";
  const data = { name: d.name, year: d.year, city: d.city, location: d.location || null, description: d.description || null, pickupInfo: d.pickupInfo || null, startsAt: startsAt!, endsAt: endsAt!, published: formData.get("published") === "on", isCurrent };
  let eventId = id;
  await db.$transaction(async (tx) => {
    if (isCurrent) await tx.event.updateMany({ data: { isCurrent: false } });
    if (id) await tx.event.update({ where: { id }, data });
    else {
      let slug = slugify(`${d.name}`) || `evento-${d.year}`;
      if (await tx.event.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
      eventId = (await tx.event.create({ data: { ...data, slug } })).id;
    }
  });
  await audit({ id: user.id, name: user.name }, id ? "event.update" : "event.create", "Event", eventId);
  revalidatePath("/", "layout");
  redirect(`/admin/evento?e=${eventId}&msg=${encodeURIComponent("Evento salvo.")}`);
}

export async function saveScheduleItemAction(formData: FormData) {
  const user = await assertPermission("events.manage");
  const eventId = String(formData.get("eventId"));
  const id = String(formData.get("id") ?? "");
  const back = `/admin/evento?e=${eventId}`;
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = dt(formData.get("startsAt"));
  const endsAt = dt(formData.get("endsAt"));
  if (title.length < 3 || !startsAt) redirect(`${back}&err=${encodeURIComponent("Informe título e horário.")}`);
  const data = {
    title, startsAt: startsAt!, endsAt, location: String(formData.get("location") ?? "").trim() || null, description: String(formData.get("description") ?? "").trim() || null,
    category: String(formData.get("category") ?? "festa"), published: formData.get("published") === "on",
  };
  if (id) await db.scheduleItem.update({ where: { id }, data });
  else await db.scheduleItem.create({ data: { ...data, eventId } });
  await audit({ id: user.id, name: user.name }, id ? "schedule.update" : "schedule.create", "ScheduleItem", id || undefined, { title });
  revalidatePath("/programacao"); revalidatePath("/");
  redirect(`${back}&msg=${encodeURIComponent("Programação salva.")}`);
}

export async function deleteScheduleItemAction(formData: FormData) {
  const user = await assertPermission("events.manage");
  const id = String(formData.get("id")); const eventId = String(formData.get("eventId"));
  await db.scheduleItem.delete({ where: { id } });
  await audit({ id: user.id, name: user.name }, "schedule.delete", "ScheduleItem", id);
  revalidatePath("/programacao"); revalidatePath("/");
  redirect(`/admin/evento?e=${eventId}&msg=${encodeURIComponent("Item removido.")}`);
}

// ───────────── Galeria ─────────────
export async function uploadGalleryAction(formData: FormData) {
  const user = await assertPermission("gallery.manage");
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
  if (!files.length) go("/admin/galeria", "err", "Selecione ao menos uma imagem.");
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 140) || null;
  let ok = 0;
  for (const f of files) {
    try { const url = await saveImage(f, 1600); await db.galleryImage.create({ data: { url, caption } }); ok++; }
    catch (e) { go("/admin/galeria", "err", `${f.name}: ${e instanceof Error ? e.message : "inválida"}`); }
  }
  await audit({ id: user.id, name: user.name }, "gallery.upload", "GalleryImage", undefined, { count: ok });
  revalidatePath("/");
  go("/admin/galeria", "msg", `${ok} imagem(ns) enviada(s).`);
}

export async function galleryItemAction(formData: FormData) {
  const user = await assertPermission("gallery.manage");
  const id = String(formData.get("id")); const op = String(formData.get("op"));
  if (op === "delete") await db.galleryImage.delete({ where: { id } });
  else if (op === "toggle") { const g = await db.galleryImage.findUniqueOrThrow({ where: { id } }); await db.galleryImage.update({ where: { id }, data: { published: !g.published } }); }
  await audit({ id: user.id, name: user.name }, `gallery.${op}`, "GalleryImage", id);
  revalidatePath("/");
  go("/admin/galeria", "msg", "Galeria atualizada.");
}

// ───────────── Cronômetro / data do Kerb (atalho da Visão geral) ─────────────
export async function setCountdownAction(formData: FormData) {
  const user = await assertPermission("events.manage");
  const id = String(formData.get("eventId") ?? "");
  const event = await db.event.findUnique({ where: { id } });
  if (!event) go("/admin", "err", "Evento não encontrado.");
  const startsAt = dt(formData.get("startsAt"));
  if (!startsAt || Number.isNaN(startsAt.getTime())) go("/admin", "err", "Informe a data e a hora de início.");
  const year = Number(toLocalInput(startsAt!).slice(0, 4)); // ano no horário de Brasília
  if (year < 2008 || year > 2100) go("/admin", "err", "Ano inválido.");
  // Fim vazio = mantém a mesma duração do evento
  let endsAt = dt(formData.get("endsAt"));
  if (!endsAt) endsAt = new Date(startsAt!.getTime() + (event!.endsAt.getTime() - event!.startsAt.getTime()));
  if (endsAt < startsAt!) go("/admin", "err", "O fim deve ser depois do início.");

  // Se o nome tem o ano antigo (ex.: "Kerbfest Ipira 2027"), acompanha o novo ano.
  const name = event!.name.includes(String(event!.year)) ? event!.name.replace(String(event!.year), String(year)) : event!.name;
  await db.event.update({ where: { id }, data: { startsAt: startsAt!, endsAt, year, name } });
  await audit({ id: user.id, name: user.name }, "event.countdown", "Event", id, { startsAt: startsAt!.toISOString(), endsAt: endsAt.toISOString() });
  revalidatePath("/", "layout");
  go("/admin", "msg", "Data do Kerb atualizada! O cronômetro do site já usa a nova data.");
}

// ───────────── Liberar / congelar vendas ─────────────
export async function setSalesOpenAction(formData: FormData) {
  const user = await assertPermission("sales.freeze"); // somente gestores
  const open = formData.get("open") === "1";
  await setSetting("sales_open", open ? "true" : "false");
  await audit({ id: user.id, name: user.name }, open ? "sales.unfreeze" : "sales.freeze", "Setting", "sales_open");
  revalidatePath("/", "layout");
  go("/admin", "msg", open ? "Vendas liberadas! A loja está aberta ao público." : "Vendas congeladas. Só gestores conseguem fazer venda manual.");
}

// ───────────── Configurações ─────────────
export async function saveSettingsAction(formData: FormData) {
  const user = await assertPermission("settings.manage");
  const keys = (Object.keys(SETTING_DEFAULTS) as SettingKey[]).filter((k) => k !== "sales_open"); // liberar/congelar tem ação própria
  for (const k of keys) {
    let v = String(formData.get(k) ?? "").trim().slice(0, 1500);
    if (k === "whatsapp_contact") { const n = v ? normalizePhone(v) : ""; if (n === null) go("/admin/configuracoes", "err", "WhatsApp de atendimento inválido."); v = n ?? ""; }
    if (k === "instagram_url" && v && !/^https:\/\/(www\.)?instagram\.com\//i.test(v)) go("/admin/configuracoes", "err", "Link do Instagram inválido.");
    await setSetting(k, v);
  }
  await audit({ id: user.id, name: user.name }, "settings.update", "Setting");
  revalidatePath("/", "layout");
  go("/admin/configuracoes", "msg", "Configurações salvas.");
}

// ───────────── Mercado Pago (credenciais guardadas criptografadas) ─────────────
const goMp = (kind: "msg" | "err", text: string): never => redirect(`/admin/configuracoes?${kind}=${encodeURIComponent(text)}#mercado-pago`);
const MP_TOKEN_RE = /^[A-Za-z0-9_-]{20,300}$/;
const MP_SECRET_RE = /^[A-Za-z0-9_-]{8,200}$/;

export async function saveMercadoPagoAction(formData: FormData) {
  const user = await assertPermission("settings.manage");
  const token = String(formData.get("mp_access_token") ?? "").trim();
  const secret = String(formData.get("mp_webhook_secret") ?? "").trim();
  const clearToken = formData.get("clear_token") === "1";
  const clearSecret = formData.get("clear_webhook") === "1";
  const instRaw = String(formData.get("mp_max_installments") ?? "").trim();

  if (token && !MP_TOKEN_RE.test(token)) goMp("err", "Access Token inválido. Copie o valor completo de “Credenciais de produção” no Mercado Pago (sem espaços).");
  if (secret && !MP_SECRET_RE.test(secret)) goMp("err", "Assinatura secreta inválida. Copie o valor completo da tela de Webhooks do Mercado Pago (sem espaços).");
  const inst = Number(instRaw || 6);
  if (!Number.isInteger(inst) || inst < 1 || inst > 12) goMp("err", "O máximo de parcelas deve ser um número de 1 a 12.");

  const changed: string[] = [];
  if (token) { await saveMpSecret(MP_KEYS.token, token); changed.push("access_token"); }
  else if (clearToken) { await saveMpSecret(MP_KEYS.token, null); changed.push("access_token_removido"); }
  if (secret) { await saveMpSecret(MP_KEYS.webhook, secret); changed.push("webhook_secret"); }
  else if (clearSecret) { await saveMpSecret(MP_KEYS.webhook, null); changed.push("webhook_secret_removido"); }
  await db.setting.upsert({ where: { key: MP_KEYS.installments }, update: { value: String(inst) }, create: { key: MP_KEYS.installments, value: String(inst) } });

  // O log guarda só QUAIS itens mudaram — nunca os valores.
  await audit({ id: user.id, name: user.name }, "settings.mercadopago", "Setting", undefined, { changed, installments: inst });
  revalidatePath("/admin", "layout");
  const added = changed.some((c) => !c.endsWith("_removido"));
  goMp("msg", added ? "Credenciais do Mercado Pago salvas. Use “Testar conexão” para conferir." : changed.length ? "Credenciais removidas do painel." : "Configurações do Mercado Pago salvas.");
}

export async function testMercadoPagoAction() {
  const user = await assertPermission("settings.manage");
  const r = await testMpConnection();
  await audit({ id: user.id, name: user.name }, "settings.mercadopago_test", "Setting", undefined, { ok: r.ok });
  goMp(r.ok ? "msg" : "err", r.message);
}
