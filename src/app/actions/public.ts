"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { clientInfo } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./types";

const schema = z.object({
  type: z.enum(["ACCESS", "EXPORT", "CORRECTION", "DELETION", "OTHER"]),
  contact: z.string().trim().min(5, "Informe um e-mail ou WhatsApp para retorno.").max(120),
  message: z.string().trim().max(1500).optional(),
});

export async function submitDataRequest(_: FormState, formData: FormData): Promise<FormState> {
  const { ip } = await clientInfo();
  const rl = await rateLimit(`datareq:${ip}`, 5, 3600);
  if (!rl.ok) return { error: "Muitas solicitações. Tente novamente mais tarde." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const user = await getCurrentUser();
  await db.dataRequest.create({
    data: { userId: user?.id, type: parsed.data.type, contact: parsed.data.contact, message: parsed.data.message || null },
  });
  return { ok: true, message: "Solicitação registrada. Responderemos em até 15 dias pelo contato informado." };
}
