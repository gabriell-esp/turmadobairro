import { notFound } from "next/navigation";
import { db } from "./db";
import { requireUser } from "./auth";

const include = { items: { include: { product: true }, orderBy: { createdAt: "asc" as const } }, event: true, messages: true };

/** Carrega um pedido do próprio usuário (ou de qualquer um, se organizador). */
export async function loadOwnOrder(id: string, nextPath: string) {
  const user = await requireUser(nextPath);
  const order = await db.order.findUnique({ where: { id }, include });
  if (!order) notFound();
  if (order.userId !== user.id && user.role !== "ORGANIZER") notFound();
  return { user, order };
}

export const reloadOrder = (id: string) => db.order.findUniqueOrThrow({ where: { id }, include });
