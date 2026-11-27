import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can, requireStaff } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/request";
import { brl, fmtBirth, fmtDateTime, orderCode } from "@/lib/format";
import { formatCpf, formatPhone, maskCpf } from "@/lib/validators";
import {
  cancelOrderAction, markDeliveredAction, markPaidManualAction, newCheckoutLinkAction, reconcileOrderAction,
  refundOrderAction, resendConfirmationAction, resolveAttentionAction, sendPaymentLinkAction,
} from "@/app/actions/admin-orders";
import { PAY_METHOD_LABEL, parsePayMethods } from "@/lib/mercadopago";
import { shareLinkText } from "@/lib/messages";
import { ConfirmSubmit, CopyButton } from "@/components/client";
import { AdminTitle, Panel } from "@/components/admin-ui";
import { StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Pedido" };
export const dynamic = "force-dynamic";

export default async function PedidoAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string; cpf?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true }, orderBy: { createdAt: "asc" } },
      event: true,
      seller: { select: { name: true } },
      user: { select: { id: true, email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 10 },
      events: { orderBy: { createdAt: "desc" }, take: 10 },
      links: true,
    },
  });
  if (!order) notFound();
  const full = can(user, "orders.all");
  if (!full && order.sellerId !== user.id) notFound();

  const revealCpf = full && sp.cpf === "1";
  if (revealCpf) await audit({ id: user.id, name: user.name }, "order.reveal_cpf", "Order", order.id);

  const canCancel = order.status === "PENDING" || (full && order.status === "PAID");
  const payUrl = order.mpInitPoint ? (order.mpInitPoint.startsWith("http") ? order.mpInitPoint : `${appUrl()}${order.mpInitPoint}`) : null;
  const shareText = payUrl ? shareLinkText(order, payUrl) : "";

  return (
    <>
      <AdminTitle title={`Pedido ${orderCode(order.number)}`} action={<Link href="/admin/pedidos" className="btn btn-sm btn-white">← Pedidos</Link>}>
        {order.event.name} · criado em {fmtDateTime(order.createdAt)} · {order.source === "SELLER" ? `venda manual${order.seller ? ` por ${order.seller.name}` : ""}` : "compra pelo site"}
      </AdminTitle>

      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      {sp.err && <div role="alert" className="alert alert-error mb-4">{sp.err}</div>}
      {order.needsAttention && (
        <div role="alert" className="alert alert-error mb-4">
          <strong>Pedido exige atenção.</strong> Veja as observações abaixo.
          {full && (
            <form action={resolveAttentionAction} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={order.id} />
              <input name="note" required placeholder="O que foi feito?" className="input !min-h-9 max-w-xs" />
              <button className="btn btn-sm btn-white">Marcar como resolvido</button>
            </form>
          )}
        </div>
      )}

      {order.status === "PENDING" && (
        <div className="mb-6">
          <Panel title="Link de pagamento">
            {payUrl ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Envie este link para quem vai pagar — <strong>{PAY_METHOD_LABEL[parsePayMethods(order.payMethods)]}</strong> · {brl(order.totalCents)} · vale até {fmtDateTime(order.expiresAt)}.
                </p>
                <input id="payurl" readOnly value={payUrl} aria-label="Link de pagamento" className="input !min-h-10 text-sm" />
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={payUrl} label="Copiar link" />
                  <CopyButton text={shareText} label="Copiar mensagem pronta" />
                  <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-gold">Enviar pelo WhatsApp</a>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-dark">O link ainda não foi gerado. Use um dos botões abaixo.</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-ink/10 pt-3">
              <span className="text-sm font-bold text-muted">Gerar novo link:</span>
              <Act action={newCheckoutLinkAction} id={order.id} label="Pix ou cartão" extra={{ methods: "ALL" }} />
              <Act action={newCheckoutLinkAction} id={order.id} label="Somente Pix" extra={{ methods: "PIX" }} />
              <Act action={newCheckoutLinkAction} id={order.id} label="Somente cartão" extra={{ methods: "CARD" }} />
            </div>
          </Panel>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Abadás" action={full && (revealCpf ? <Link href={`/admin/pedidos/${order.id}`} className="text-sm font-bold text-blue underline">Ocultar CPF</Link> : <Link href={`/admin/pedidos/${order.id}?cpf=1`} className="text-sm font-bold text-blue underline">Revelar CPF (auditado)</Link>)}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Dono</th><th>CPF</th><th>Nasc.</th><th>Tam.</th><th>Valor</th><th>Entrega</th></tr></thead>
                <tbody>
                  {order.items.map((i) => {
                    const cpf = decrypt(i.ownerCpfEnc);
                    return (
                      <tr key={i.id}>
                        <td><span className="font-bold">{i.ownerName}</span><br /><span className="text-xs text-muted">{i.product.name}{i.guardianName ? ` · resp.: ${i.guardianName}` : ""}{i.ownerNameKey === null ? " · homônimo liberado" : ""}</span></td>
                        <td className="whitespace-nowrap">{revealCpf ? formatCpf(cpf) : maskCpf(cpf)}</td>
                        <td className="whitespace-nowrap">{fmtBirth(i.ownerBirthDate)}</td>
                        <td>{i.size}{i.babyLook ? " · BL" : ""}</td>
                        <td className="whitespace-nowrap font-bold">{brl(i.priceCents)}</td>
                        <td>
                          {order.status === "PAID" ? (
                            <form action={markDeliveredAction}>
                              <input type="hidden" name="itemId" value={i.id} />
                              <input type="hidden" name="returnTo" value={`/admin/pedidos/${order.id}`} />
                              <input type="hidden" name="deliver" value={i.deliveredAt ? "0" : "1"} />
                              {i.deliveredAt ? <button className="badge badge-green" title="Desfazer">Entregue {fmtDateTime(i.deliveredAt)} ✕</button> : <button className="btn btn-sm btn-gold">Entregar</button>}
                            </form>
                          ) : <span className="text-muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-right text-xl">Total <span className="h-display text-3xl text-red">{brl(order.totalCents)}</span></p>
          </Panel>

          <Panel title="Mensagens de WhatsApp">
            {order.messages.length === 0 ? <p className="text-sm text-muted">Nenhuma mensagem enviada.</p> : (
              <ul className="divide-y divide-ink/10 text-sm">
                {order.messages.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><strong>{m.kind}</strong> · {formatPhone(m.phone)} · {fmtDateTime(m.createdAt)}{m.lastError && <span className="block text-xs text-red-dark">{m.lastError}</span>}</span>
                    <StatusBadge status={m.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {full && (
            <Panel title="Eventos de pagamento">
              {order.events.length === 0 ? <p className="text-sm text-muted">Sem eventos.</p> : (
                <ul className="divide-y divide-ink/10 text-sm">
                  {order.events.map((e) => <li key={e.id} className="flex justify-between py-1.5"><span>MP #{e.mpPaymentId} · {e.status}{e.note ? ` · ${e.note}` : ""}</span><span className="text-muted">{fmtDateTime(e.createdAt)}</span></li>)}
                </ul>
              )}
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Situação">
            <div className="flex items-center justify-between"><StatusBadge status={order.status} /><span className="h-display text-3xl text-red">{brl(order.totalCents)}</span></div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row k={order.source === "SELLER" ? "Referência" : "Comprador"} v={order.buyerName} />
              {(order.source !== "SELLER" || order.buyerPhone) && <Row k="WhatsApp" v={formatPhone(order.buyerPhone) || "—"} />}
              {(order.source !== "SELLER" || order.buyerEmail) && <Row k="E-mail" v={order.buyerEmail ?? "—"} />}
              {order.status === "PENDING" && <Row k="Forma de pagamento" v={PAY_METHOD_LABEL[parsePayMethods(order.payMethods)]} />}
              {order.status === "PENDING" && <Row k="Reservado até" v={fmtDateTime(order.expiresAt)} />}
              {order.paidAt && <Row k="Pago em" v={fmtDateTime(order.paidAt)} />}
              {order.paymentMethod && <Row k="Meio" v={order.paymentMethod} />}
              {full && order.mpPaymentId && !order.mpPaymentId.startsWith("EXT-") && <Row k="Pagamento MP" v={`#${order.mpPaymentId} (${order.mpPaymentStatus})`} />}
              {order.mpPaymentId?.startsWith("EXT-") && <Row k="Origem" v="Lançada por fora do sistema" />}
              {order.cancelledReason && <Row k="Motivo" v={order.cancelledReason} />}
            </dl>
            {order.notes && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-cream p-3 text-xs">{order.notes}</pre>}
          </Panel>

          <Panel title="Ações">
            <div className="space-y-3">
              {order.status === "PENDING" && (
                <div className="flex flex-wrap gap-2">
                  {order.buyerPhone && <Act action={sendPaymentLinkAction} id={order.id} label="Enviar link pelo sistema (WhatsApp)" variant="btn-gold" />}
                  <Act action={reconcileOrderAction} id={order.id} label="Verificar pagamento" />
                </div>
              )}
              {order.status === "PAID" && order.buyerPhone && <Act action={resendConfirmationAction} id={order.id} label="Reenviar confirmação (WhatsApp)" variant="btn-gold" />}
              {order.status !== "PAID" && order.status !== "PENDING" && <Act action={reconcileOrderAction} id={order.id} label="Verificar pagamento no MP" />}

              {canCancel && (
                <form action={order.status === "PAID" ? refundOrderAction : cancelOrderAction} className="space-y-2 border-t-2 border-ink/10 pt-3">
                  <input type="hidden" name="id" value={order.id} />
                  <input name="reason" placeholder="Motivo (opcional)" className="input !min-h-9" maxLength={200} />
                  <ConfirmSubmit message={order.status === "PAID" ? "Marcar como REEMBOLSADO e liberar CPF/nome? (o estorno em si é feito no Mercado Pago)" : "Cancelar este pedido e liberar CPF/nome/estoque?"} className="btn btn-sm btn-white !border-red-dark !text-red-dark">
                    {order.status === "PAID" ? "Marcar como reembolsado" : "Cancelar pedido"}
                  </ConfirmSubmit>
                </form>
              )}

              {full && order.status !== "PAID" && (order.status === "PENDING" || order.status === "EXPIRED" || order.status === "CANCELLED") && (
                <form action={markPaidManualAction} className="space-y-2 border-t-2 border-ink/10 pt-3">
                  <input type="hidden" name="id" value={order.id} />
                  <label className="label" htmlFor="note">Recebeu por fora (dinheiro/Pix direto)?</label>
                  <input id="note" name="note" required placeholder="Como foi recebido?" className="input !min-h-9" maxLength={200} />
                  <ConfirmSubmit message="Confirmar que o pagamento foi recebido fora do Mercado Pago? Isso confirma o pedido e envia o WhatsApp." className="btn btn-sm btn-blue">Registrar pagamento manual</ConfirmSubmit>
                </form>
              )}
            </div>
          </Panel>

          {order.user && full && <Panel><p className="text-sm">Conta do comprador: <span className="font-bold">{order.user.email}</span></p></Panel>}
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 border-b border-ink/10 pb-1"><dt className="font-bold text-muted">{k}</dt><dd className="text-right">{v}</dd></div>;
}

function Act({ action, id, label, variant = "btn-white", extra }: { action: (fd: FormData) => Promise<void>; id: string; label: string; variant?: string; extra?: Record<string, string> }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={`btn btn-sm ${variant}`}>{label}</button>
    </form>
  );
}
