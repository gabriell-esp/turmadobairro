"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth";
import { createCheckout } from "@/lib/mercadopago";
import { audit } from "@/lib/audit";
import { isMercadoPagoUrl } from "@/lib/validators";
import type { FormState } from "./types";

const schema = z.object({
  title: z.string().trim().min(3, "Informe um título.").max(120),
  description: z.string().trim().max(250).optional(),
  amount: z.string().transform((v) => Number(v.replace(/\./g, "").replace(",", "."))).refine((n) => Number.isFinite(n) && n >= 1 && n <= 50000, "Valor entre R$ 1,00 e R$ 50.000,00."),
  hours: z.coerce.number().int().min(0).max(24 * 90).default(0),
});

export async function createPaymentLinkAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await assertPermission("links.manage");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { fieldErrors: fe, values: Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string> };
  }
  const d = parsed.data;
  const cents = Math.round(d.amount * 100);
  const expiresAt = d.hours > 0 ? new Date(Date.now() + d.hours * 3600_000) : undefined;

  const link = await db.paymentLink.create({ data: { title: d.title, description: d.description || null, amountCents: cents, url: "", createdById: user.id, expiresAt } });
  try {
    const res = await createCheckout({
      externalReference: `link:${link.id}`,
      items: [{ id: link.id, title: d.title, description: d.description, quantity: 1, unitPriceCents: cents }],
      expiresAt,
      backPath: "/",
    });
    // No modo simulado (dev) o link aponta para uma página fictícia
    await db.paymentLink.update({ where: { id: link.id }, data: { url: res.simulated ? `/dev/link/${link.id}` : res.url, mpPreferenceId: res.preferenceId } });
  } catch (e) {
    await db.paymentLink.delete({ where: { id: link.id } });
    console.error("[links] erro MP", e);
    return { error: "Não foi possível criar o link no Mercado Pago. Verifique as credenciais." };
  }
  await audit({ id: user.id, name: user.name }, "link.create", "PaymentLink", link.id, { cents });
  revalidatePath("/admin/links");
  return { ok: true, message: "Link criado! Copie na lista abaixo." };
}

export async function addExternalLinkAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await assertPermission("links.manage");
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "0").replace(/\./g, "").replace(",", "."));
  if (title.length < 3) return { fieldErrors: { title: "Informe um título." } };
  if (!isMercadoPagoUrl(url)) return { fieldErrors: { url: "Informe um link do Mercado Pago (mercadopago.com.br ou mpago.la)." } };
  const link = await db.paymentLink.create({ data: { title, url, amountCents: Math.round((Number.isFinite(amount) ? amount : 0) * 100), external: true, createdById: user.id } });
  await audit({ id: user.id, name: user.name }, "link.add_external", "PaymentLink", link.id);
  revalidatePath("/admin/links");
  return { ok: true, message: "Link adicionado à lista." };
}

export async function toggleLinkAction(formData: FormData) {
  const user = await assertPermission("links.manage");
  const id = String(formData.get("id"));
  const link = await db.paymentLink.findUniqueOrThrow({ where: { id } });
  await db.paymentLink.update({ where: { id }, data: { active: !link.active } });
  await audit({ id: user.id, name: user.name }, link.active ? "link.disable" : "link.enable", "PaymentLink", id);
  revalidatePath("/admin/links");
  redirect("/admin/links");
}
