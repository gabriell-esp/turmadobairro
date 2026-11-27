import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { expireStaleOrders } from "@/lib/orders";
import { brl, fmtDateTime, orderCode } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Meus pedidos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const user = await requireUser("/minha-conta/pedidos");
  await expireStaleOrders();
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true, event: true },
  });
  if (!orders.length)
    return (
      <div className="card mx-auto max-w-xl p-10 text-center">
        <p className="h-display text-3xl text-navy">Você ainda não fez pedidos</p>
        <Link href="/loja" className="btn btn-red mt-5">Ver abadás</Link>
      </div>
    );
  return (
    <ul className="space-y-4">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/minha-conta/pedidos/${o.id}`} className="card flex flex-wrap items-center justify-between gap-4 p-5 transition hover:-translate-y-0.5">
            <div>
              <p className="h-display text-3xl text-navy">{orderCode(o.number)}</p>
              <p className="text-sm text-muted">{fmtDateTime(o.createdAt)} · {o.items.length} {o.items.length === 1 ? "abadá" : "abadás"} · {o.event.name}</p>
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge status={o.status} />
              <span className="h-display text-2xl text-red">{brl(o.totalCents)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
