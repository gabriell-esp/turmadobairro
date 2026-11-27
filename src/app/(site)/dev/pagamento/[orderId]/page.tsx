import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isMpSimulated } from "@/lib/mercadopago";
import { brl, orderCode } from "@/lib/format";
import { simulatePaymentAction } from "@/app/actions/dev";

export const dynamic = "force-dynamic";

/** Simulador de pagamento — existe SOMENTE em desenvolvimento e sem MP_ACCESS_TOKEN. */
export default async function DevPagamento({ params }: { params: Promise<{ orderId: string }> }) {
  if (!(await isMpSimulated())) notFound();
  const { orderId } = await params;
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();
  return (
    <section className="container-page max-w-lg py-16">
      <div className="card space-y-4 p-8">
        <p className="badge badge-yellow">Ambiente de desenvolvimento</p>
        <h1 className="h-display text-4xl text-navy">Simulador de pagamento</h1>
        <p>Pedido <strong>{orderCode(order.number)}</strong> · {brl(order.totalCents)} · status: {order.status}</p>
        <p className="text-sm text-muted">Sem Access Token do Mercado Pago configurado, o checkout usa este simulador. Em produção o cliente é enviado ao Mercado Pago.</p>
        <form action={simulatePaymentAction} className="flex flex-wrap gap-3">
          <input type="hidden" name="orderId" value={order.id} />
          <button name="outcome" value="approved" className="btn btn-gold">Simular pagamento aprovado</button>
          <button name="outcome" value="rejected" className="btn btn-white">Simular recusado</button>
        </form>
      </div>
    </section>
  );
}
