import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { isMpConfigured, listRemotePreferences } from "@/lib/mercadopago";
import { expireStaleOrders } from "@/lib/orders";
import { appUrl } from "@/lib/request";
import { brl, fmtDateTime, orderCode } from "@/lib/format";
import { toggleLinkAction } from "@/app/actions/admin-links";
import { sendPaymentLinkAction } from "@/app/actions/admin-orders";
import { CopyButton } from "@/components/client";
import { CreateLinkForm, ExternalLinkForm } from "@/components/link-forms";
import { AdminTitle, Empty, Panel } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Links de pagamento" };
export const dynamic = "force-dynamic";

const abs = (u: string) => (u.startsWith("http") ? u : `${appUrl()}${u}`);

export default async function LinksPage() {
  await requirePermission("links.manage");
  await expireStaleOrders();
  const [links, pending, remote] = await Promise.all([
    db.paymentLink.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.order.findMany({ where: { status: "PENDING", mpInitPoint: { not: null }, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 100, include: { items: { select: { id: true } } } }),
    listRemotePreferences(60),
  ]);

  // pagamentos aprovados por link avulso
  const paid = await Promise.all(
    links.filter((l) => !l.external).map(async (l) => {
      const ev = await db.paymentEvent.findMany({ where: { status: "approved", raw: { path: ["externalReference"], equals: `link:${l.id}` } }, select: { raw: true } });
      return [l.id, { count: ev.length, total: ev.reduce((s, e) => s + Number((e.raw as { amountCents?: number }).amountCents ?? 0), 0) }] as const;
    }),
  );
  const paidMap = new Map(paid);
  const known = new Set(links.map((l) => l.url));

  return (
    <>
      <AdminTitle title="Links de pagamento">Gere cobranças avulsas ou unificadas pelo Mercado Pago e reaproveite os links que já existem na conta.</AdminTitle>
      {!(await isMpConfigured()) && <div className="alert alert-info mb-4">Mercado Pago não configurado: em desenvolvimento os links são simulados. <a href="/admin/configuracoes#mercado-pago" className="underline">Configurar agora</a></div>}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Gerar novo link de cobrança"><CreateLinkForm /></Panel>
        <Panel title="Adicionar link que já existe"><p className="mb-3 text-sm text-muted">Colou um link criado direto no app do Mercado Pago? Guarde aqui para a equipe usar.</p><ExternalLinkForm /></Panel>
      </div>

      <Panel title="Links criados" className="mb-6">
        {links.length === 0 ? <Empty>Nenhum link criado ainda.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Título</th><th>Valor</th><th>Pagamentos</th><th>Criado</th><th>Ações</th></tr></thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className={l.active ? "" : "opacity-50"}>
                    <td><span className="font-bold">{l.title}</span>{l.external && <span className="badge badge-gray ml-2">externo</span>}{!l.active && <span className="badge badge-red ml-2">desativado</span>}{l.expiresAt && <span className="block text-xs text-muted">expira {fmtDateTime(l.expiresAt)}</span>}</td>
                    <td>{l.amountCents ? brl(l.amountCents) : "—"}</td>
                    <td>{paidMap.get(l.id) ? `${paidMap.get(l.id)!.count} · ${brl(paidMap.get(l.id)!.total)}` : "—"}</td>
                    <td className="whitespace-nowrap text-muted">{fmtDateTime(l.createdAt)}</td>
                    <td className="flex flex-wrap gap-2">
                      <CopyButton text={abs(l.url)} />
                      <form action={toggleLinkAction}><input type="hidden" name="id" value={l.id} /><button className="btn btn-sm btn-ghost">{l.active ? "Desativar" : "Ativar"}</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Cobranças de pedidos aguardando pagamento" className="mb-6">
        {pending.length === 0 ? <Empty>Nenhum pedido aguardando pagamento.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Pedido</th><th>Comprador</th><th>Total</th><th>Reservado até</th><th>Ações</th></tr></thead>
              <tbody>
                {pending.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="font-extrabold text-blue underline" href={`/admin/pedidos/${o.id}`}>{orderCode(o.number)}</Link> <span className="text-xs text-muted">({o.items.length} abadá{o.items.length > 1 ? "s" : ""})</span></td>
                    <td>{o.buyerName}</td><td className="font-bold">{brl(o.totalCents)}</td><td className="whitespace-nowrap">{fmtDateTime(o.expiresAt)}</td>
                    <td className="flex flex-wrap gap-2">
                      <CopyButton text={abs(o.mpInitPoint!)} />
                      <form action={sendPaymentLinkAction}><input type="hidden" name="id" value={o.id} /><button className="btn btn-sm btn-gold">WhatsApp</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Links já existentes na conta do Mercado Pago" action={<span className="text-xs text-muted">últimos 60 (checkouts criados via API)</span>}>
        {!remote.ok ? <p className="text-sm text-muted">{remote.error}</p> : remote.items.length === 0 ? <Empty>Nenhum link encontrado.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Título</th><th>Valor</th><th>Referência</th><th>Criado</th><th>Ações</th></tr></thead>
              <tbody>
                {remote.items.filter((r) => !known.has(r.url)).map((r) => (
                  <tr key={r.id}>
                    <td className="font-bold">{r.title}</td><td>{brl(r.amountCents)}</td>
                    <td className="text-xs text-muted">{r.externalReference ?? "—"}</td>
                    <td className="whitespace-nowrap text-muted">{r.createdAt ? fmtDateTime(r.createdAt) : "—"}</td>
                    <td><CopyButton text={r.url} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Observação: o Mercado Pago só expõe via API os checkouts criados por integração. “Links de pagamento” criados manualmente no app podem ser colados em “Adicionar link que já existe”.</p>
      </Panel>
    </>
  );
}
