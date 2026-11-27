import type { Metadata } from "next";
import Link from "next/link";
import { loadOwnOrder, reloadOrder } from "@/lib/order-access";
import { reconcileOrder } from "@/lib/payments";
import { isMpConfigured } from "@/lib/mercadopago";
import { OrderDetail } from "@/components/order-detail";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let { order } = await loadOwnOrder(id, `/minha-conta/pedidos/${id}`);
  if (order.status === "PENDING" && (await isMpConfigured())) {
    try {
      await reconcileOrder(order.id);
      order = await reloadOrder(order.id);
    } catch {}
  }
  return (
    <div className="space-y-6">
      <Link href="/minha-conta/pedidos" className="text-sm font-bold text-blue underline">← Meus pedidos</Link>
      {order.status === "PENDING" && order.expiresAt > new Date() && <AutoRefresh seconds={8} maxSeconds={120} />}
      <OrderDetail order={order} />
    </div>
  );
}
