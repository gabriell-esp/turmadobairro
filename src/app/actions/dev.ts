"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isMpSimulated } from "@/lib/mercadopago";
import { applyPayment } from "@/lib/payments";

export async function simulatePaymentAction(formData: FormData) {
  if (!(await isMpSimulated())) throw new Error("Simulador desabilitado.");
  const orderId = String(formData.get("orderId") ?? "");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const approved = formData.get("outcome") === "approved";
  await applyPayment({
    id: `SIM-${Date.now()}`,
    status: approved ? "approved" : "rejected",
    amountCents: order.totalCents,
    externalReference: order.id,
    method: "pix",
    type: "bank_transfer",
  });
  redirect(`/pedido/${order.id}/obrigado`);
}
