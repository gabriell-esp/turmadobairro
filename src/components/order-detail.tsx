import Link from "next/link";
import { decrypt } from "@/lib/crypto";
import { brl, fmtBirth, fmtDateTime, orderCode } from "@/lib/format";
import { maskCpf, onlyDigits } from "@/lib/validators";
import type { Event, Order, OrderItem, Product, WhatsAppMessage } from "@prisma/client";
import { StatusBadge } from "./ui";

export type OrderFull = Order & { items: (OrderItem & { product: Product })[]; event: Event; messages: WhatsAppMessage[] };

export function OrderDetail({ order, showPay = true, showCpf = "masked" }: { order: OrderFull; showPay?: boolean; showCpf?: "masked" | "none" }) {
  const confirm = order.messages.filter((m) => m.kind === "ORDER_CONFIRMATION").sort((a, b) => +b.createdAt - +a.createdAt)[0];
  const expired = order.expiresAt < new Date();
  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted">Pedido</p>
          <p className="h-display text-4xl text-navy">{orderCode(order.number)}</p>
          <p className="text-sm text-muted">Feito em {fmtDateTime(order.createdAt)} · {order.event.name}</p>
        </div>
        <div className="text-right">
          <StatusBadge status={order.status} />
          <p className="h-display mt-1 text-4xl text-red">{brl(order.totalCents)}</p>
        </div>
      </div>

      {order.status === "PENDING" && !expired && showPay && (
        <div className="alert alert-info flex flex-wrap items-center justify-between gap-3">
          <span>Pedido reservado até <strong>{fmtDateTime(order.expiresAt)}</strong>. Conclua o pagamento para garantir seus abadás.</span>
          {order.mpInitPoint && (
            <a href={order.mpInitPoint} className="btn btn-sm btn-red">Pagar agora</a>
          )}
        </div>
      )}
      {(order.status === "EXPIRED" || (order.status === "PENDING" && expired)) && (
        <div className="alert alert-error">
          O prazo para pagamento terminou e os abadás voltaram para a venda. <Link href="/loja" className="underline">Faça uma nova compra</Link>.
        </div>
      )}
      {order.status === "PAID" && (
        <div className="alert alert-ok">
          Pagamento aprovado{order.paidAt ? ` em ${fmtDateTime(order.paidAt)}` : ""}.{" "}
          {confirm?.status === "SENT"
            ? "A confirmação foi enviada para o seu WhatsApp. ✅"
            : confirm?.status === "FAILED"
              ? "Não conseguimos enviar o WhatsApp, mas seu pedido está confirmado. Guarde este número."
              : "Estamos enviando a confirmação para o seu WhatsApp."}
        </div>
      )}
      {order.needsAttention && order.status === "PAID" && (
        <div className="alert alert-info">Seu pedido está em análise pela organização. Se precisar, fale com a gente informando o número do pedido.</div>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Dono do abadá</th>{showCpf !== "none" && <th>CPF</th>}<th>Nasc.</th><th>Modelo</th><th>Tam.</th><th className="text-right">Valor</th></tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td className="font-bold">{i.ownerName}{i.deliveredAt && <span className="badge badge-green ml-2">Retirado</span>}</td>
                {showCpf !== "none" && <td className="whitespace-nowrap">{maskCpf(onlyDigits(decrypt(i.ownerCpfEnc)))}</td>}
                <td className="whitespace-nowrap">{fmtBirth(i.ownerBirthDate)}</td>
                <td>{i.product.name}</td>
                <td>{i.size}{i.babyLook ? " · Baby Look" : ""}</td>
                <td className="text-right font-bold">{brl(i.priceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
