import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock3, MessageCircle } from "lucide-react";
import { loadOwnOrder, reloadOrder } from "@/lib/order-access";
import { reconcileOrder, syncPaymentById } from "@/lib/payments";
import { isMpConfigured } from "@/lib/mercadopago";
import { getSettings } from "@/lib/settings";
import { AutoRefresh } from "@/components/auto-refresh";
import { OrderDetail } from "@/components/order-detail";
import { Bunting, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, fmtDateTime, orderCode } from "@/lib/format";

export const metadata: Metadata = { title: "Obrigado!", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ObrigadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_id?: string; collection_id?: string; erro?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // Venda feita por vendedor/organizador: quem paga pelo link não tem conta. O endereço (id aleatório)
  // funciona como chave de acesso e a página pública NÃO mostra dados pessoais (nem nomes nem CPF).
  const head = await db.order.findUnique({ where: { id }, select: { userId: true, source: true } });
  const publicView = !!head && head.userId === null && head.source === "SELLER";
  let order = publicView ? await reloadOrder(id) : (await loadOwnOrder(id, `/pedido/${id}/obrigado`)).order;

  // Concilia com o Mercado Pago caso o webhook ainda não tenha chegado
  if (order.status === "PENDING" && (await isMpConfigured())) {
    try {
      const pid = sp.payment_id ?? sp.collection_id;
      if (pid && /^\d+$/.test(pid)) await syncPaymentById(pid);
      else await reconcileOrder(order.id);
      order = await reloadOrder(order.id);
    } catch (e) {
      console.error("[obrigado] conciliação falhou", e);
    }
  }

  const settings = await getSettings();
  const paid = order.status === "PAID";
  const pending = order.status === "PENDING" && order.expiresAt > new Date();

  return (
    <>
      <section className={`border-b-4 border-ink text-white ${paid ? "bg-rauten" : "bg-rauten-red"}`}>
        <div className="container-page py-12 text-center sm:py-16">
          {paid ? <CheckCircle2 size={64} className="mx-auto text-beer" aria-hidden /> : <Clock3 size={64} className="mx-auto text-beer" aria-hidden />}
          <h1 className="h-display outlined mt-3 text-5xl sm:text-7xl">{paid ? "Obrigado! Prost! 🍻" : pending ? "Quase lá…" : "Pedido"}</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-white/90">
            {paid
              ? publicView
                ? "Pagamento aprovado! Os abadás estão garantidos. Guarde esta página como comprovante."
                : "Pagamento aprovado! Seus abadás estão garantidos. Você receberá a confirmação no WhatsApp."
              : pending
                ? "Estamos aguardando a confirmação do pagamento. Esta página atualiza sozinha."
                : "Confira abaixo a situação do seu pedido."}
          </p>
        </div>
        <Bunting />
      </section>

      <section className="container-page max-w-4xl space-y-6 py-12">
        {sp.erro === "pagamento" && (
          <div className="alert alert-error">Não foi possível abrir o pagamento agora. Seu pedido está reservado — tente novamente em instantes.</div>
        )}
        {pending && <AutoRefresh />}
        {publicView ? (
          <div className="card space-y-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="h-display text-3xl text-navy">Pedido {orderCode(order.number)}</p>
              <StatusBadge status={order.status} />
            </div>
            <p>{order.items.length} {order.items.length === 1 ? "abadá" : "abadás"} · {order.event.name}</p>
            <p className="text-sm text-muted">Tamanhos: {order.items.map((i) => `${i.size}${i.babyLook ? " (Baby Look)" : ""}`).join(", ")}</p>
            <p className="text-lg">Total: <strong>{brl(order.totalCents)}</strong>{order.paidAt && <span className="text-sm text-muted"> · pago em {fmtDateTime(order.paidAt)}</span>}</p>
            {order.status === "PENDING" && !pending && <p className="alert alert-error">O prazo deste pedido terminou. Fale com o vendedor para gerar um novo link.</p>}
          </div>
        ) : (
          <OrderDetail order={order} />
        )}

        {paid && (
          <div className="card flex items-start gap-4 p-6">
            <MessageCircle className="mt-1 shrink-0 text-[#1c8b3c]" aria-hidden />
            <div>
              <p className="h-display text-2xl text-navy">Retirada do abadá</p>
              <p className="mt-1 whitespace-pre-line">{order.event.pickupInfo?.trim() || settings.pickup_text}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {publicView ? <Link href="/" className="btn btn-white">Ir para o site</Link> : <Link href="/minha-conta/pedidos" className="btn btn-white">Meus pedidos</Link>}
          <Link href="/programacao" className="btn btn-gold">Ver programação</Link>
        </div>
      </section>
    </>
  );
}
