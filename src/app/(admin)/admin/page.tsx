import Link from "next/link";
import { AlertTriangle, Play, Snowflake, Timer } from "lucide-react";
import { isSalesOpen } from "@/lib/settings";
import { setCountdownAction, setSalesOpenAction } from "@/app/actions/admin-content";
import { ConfirmSubmit, Countdown } from "@/components/client";
import { db } from "@/lib/db";
import { can, requireStaff } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { expireStaleOrders } from "@/lib/orders";
import { isMpConfigured, isMpSimulated } from "@/lib/mercadopago";
import { getWppStatus } from "@/lib/wpp";
import { brl, fmtDateTime, orderCode, toLocalInput } from "@/lib/format";
import { AdminTitle, Kpi, Panel, PermissionNotice } from "@/components/admin-ui";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const startOfTodayBRT = () => {
  const d = new Date();
  const s = d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return new Date(`${s}T00:00:00-03:00`);
};

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ erro?: string; msg?: string; err?: string }> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  await expireStaleOrders();
  const salesOpen = await isSalesOpen();
  const lastToggle = await db.auditLog.findFirst({ where: { action: { in: ["sales.freeze", "sales.unfreeze"] } }, orderBy: { createdAt: "desc" }, select: { actorName: true, createdAt: true } });
  const full = can(user, "orders.all");
  const event = await getCurrentEvent();
  const scope = full ? {} : { sellerId: user.id };
  const evScope = { ...scope, ...(event ? { eventId: event.id } : {}) };

  const [paidAgg, pendingCount, todayAgg, itemsPaid, recent] = await Promise.all([
    db.order.aggregate({ where: { ...evScope, status: "PAID" }, _sum: { totalCents: true }, _count: true }),
    db.order.count({ where: { ...evScope, status: "PENDING", expiresAt: { gt: new Date() } } }),
    db.order.aggregate({ where: { ...evScope, status: "PAID", paidAt: { gte: startOfTodayBRT() } }, _sum: { totalCents: true }, _count: true }),
    db.orderItem.count({ where: { order: { ...evScope, status: "PAID" }, active: true } }),
    db.order.findMany({ where: evScope, orderBy: { createdAt: "desc" }, take: 8, include: { items: { select: { id: true } } } }),
  ]);

  let extra: React.ReactNode = null;
  if (full) {
    const [products, attention, failedMsgs, openRequests, byDay, wpp] = await Promise.all([
      event ? db.product.findMany({ where: { eventId: event.id }, orderBy: { sortOrder: "asc" } }) : [],
      db.order.count({ where: { needsAttention: true } }),
      db.whatsAppMessage.count({ where: { status: { in: ["FAILED"] } } }),
      db.dataRequest.count({ where: { status: "OPEN" } }),
      db.$queryRaw<{ d: string; qty: bigint; total: bigint }[]>`
        SELECT to_char(("paidAt" AT TIME ZONE 'America/Sao_Paulo')::date, 'DD/MM') AS d, count(*) AS qty, sum("totalCents") AS total
        FROM "Order" WHERE status = 'PAID' AND "paidAt" > now() - interval '14 days'
        GROUP BY ("paidAt" AT TIME ZONE 'America/Sao_Paulo')::date ORDER BY ("paidAt" AT TIME ZONE 'America/Sao_Paulo')::date`,
      getWppStatus(),
    ]);
    const sold = await db.orderItem.groupBy({ by: ["productId"], where: { active: true, eventId: event?.id }, _count: { _all: true } });
    const soldMap = new Map(sold.map((s) => [s.productId, s._count._all]));
    const max = Math.max(1, ...byDay.map((r) => Number(r.total)));

    const mpConfigured = await isMpConfigured();
    const mpSimulated = await isMpSimulated();
    extra = (
      <>
        <div className="mb-6 space-y-2">
          {mpSimulated && <Alert tone="info">Mercado Pago em <strong>modo simulado</strong> (desenvolvimento). <Link href="/admin/configuracoes#mercado-pago" className="underline">Informe o Access Token em Configurações</Link> para cobrar de verdade.</Alert>}
          {!mpConfigured && !mpSimulated && <Alert tone="error">Mercado Pago NÃO configurado: a loja não consegue gerar pagamentos. <Link href="/admin/configuracoes#mercado-pago" className="underline">Configurar agora</Link></Alert>}
          {!wpp.connected && <Alert tone="warn">WhatsApp {wpp.configured ? "desconectado" : "não configurado"} — as confirmações ficam na fila. <Link href="/admin/whatsapp" className="underline">Abrir</Link></Alert>}
          {attention > 0 && <Alert tone="warn">{attention} pedido(s) precisam de atenção (pagamento divergente/expirado). <Link href="/admin/pedidos?atencao=1" className="underline">Ver</Link></Alert>}
          {failedMsgs > 0 && <Alert tone="warn">{failedMsgs} mensagem(ns) de WhatsApp falharam. <Link href="/admin/whatsapp" className="underline">Reenviar</Link></Alert>}
          {openRequests > 0 && <Alert tone="info">{openRequests} solicitação(ões) de titulares (LGPD) em aberto. <Link href="/admin/lgpd" className="underline">Responder</Link></Alert>}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Vendas por dia (14 dias)">
            {byDay.length === 0 ? <p className="text-sm text-muted">Ainda sem vendas pagas.</p> : (
              <ul className="space-y-1.5">
                {byDay.map((r) => (
                  <li key={r.d} className="grid grid-cols-[3rem_1fr_6rem] items-center gap-2 text-sm">
                    <span className="font-bold text-muted">{r.d}</span>
                    <span className="h-5 rounded bg-blue" style={{ width: `${Math.max(4, (Number(r.total) / max) * 100)}%` }} aria-hidden />
                    <span className="text-right font-bold">{brl(Number(r.total))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Estoque por produto">
            <ul className="space-y-3">
              {products.map((p) => {
                const s = soldMap.get(p.id) ?? 0;
                const pct = p.stock ? Math.min(100, (s / p.stock) * 100) : 0;
                return (
                  <li key={p.id}>
                    <div className="flex justify-between text-sm"><span className="font-bold">{p.name} {p.lotName ? `· ${p.lotName}` : ""}</span><span>{s}{p.stock != null ? ` / ${p.stock}` : " (ilimitado)"}</span></div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full border border-ink/30 bg-white"><div className="h-full bg-red" style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
              {!products.length && <p className="text-sm text-muted">Nenhum produto cadastrado.</p>}
            </ul>
          </Panel>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminTitle title={full ? "Visão geral" : "Minhas vendas"}>
        {event ? event.name : "Nenhum evento cadastrado"} {full ? "" : "· somente pedidos criados por você"}
      </AdminTitle>
      <PermissionNotice searchParams={sp} />
      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      {sp.err && <div role="alert" className="alert alert-error mb-4">{sp.err}</div>}

      <section className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-ink p-5 ${salesOpen ? "bg-[#e7f6ea]" : "bg-[#fde8e8]"}`}>
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-muted">
            {salesOpen ? <Play size={16} aria-hidden /> : <Snowflake size={16} aria-hidden />} Vendas de abadás
          </p>
          <p className={`h-display text-3xl ${salesOpen ? "text-[#1c8b3c]" : "text-red-dark"}`}>{salesOpen ? "Liberadas" : "Congeladas"}</p>
          <p className="mt-1 max-w-2xl text-sm">
            {salesOpen
              ? "A loja está aberta ao público e os vendedores podem fazer vendas manuais."
              : full
                ? "A loja do site está fechada e os vendedores não conseguem vender. Somente gestores podem fazer venda manual."
                : "As vendas estão congeladas pelos gestores. Você não pode criar vendas agora."}
            {lastToggle && <span className="block text-xs text-muted">Última alteração: {lastToggle.actorName ?? "sistema"} em {fmtDateTime(lastToggle.createdAt)}</span>}
          </p>
        </div>
        {can(user, "sales.freeze") && (
          <form action={setSalesOpenAction}>
            <input type="hidden" name="open" value={salesOpen ? "0" : "1"} />
            <ConfirmSubmit
              message={salesOpen ? "Congelar as vendas? A loja do site fecha e só gestores poderão fazer venda manual. Pedidos já reservados continuam podendo ser pagos." : "Liberar as vendas? A loja do site volta a vender e os vendedores poderão criar vendas manuais."}
              className={`btn ${salesOpen ? "btn-red" : "btn-gold"}`}
            >
              {salesOpen ? "Congelar vendas" : "Liberar vendas"}
            </ConfirmSubmit>
          </form>
        )}
      </section>

      {can(user, "events.manage") && (
        <section className="mb-6 rounded-2xl border-2 border-ink bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-muted"><Timer size={16} aria-hidden /> Cronômetro do Kerb</p>
              {event ? (
                <>
                  <p className="h-display text-2xl text-navy">{event.name}</p>
                  <p className="text-sm text-muted">Começa em {fmtDateTime(event.startsAt)} · termina em {fmtDateTime(event.endsAt)} (horário de Brasília)</p>
                </>
              ) : (
                <p className="text-sm">Nenhum evento cadastrado. <Link href="/admin/evento" className="font-bold text-blue underline">Criar o evento</Link></p>
              )}
            </div>
            {event && <Countdown target={event.startsAt.toISOString()} />}
          </div>
          {event && (
            <form action={setCountdownAction} className="mt-4 grid items-end gap-4 border-t-2 border-ink/10 pt-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="eventId" value={event.id} />
              <div className="field">
                <label htmlFor="cd-start">Início do Kerb (data e hora)</label>
                <input id="cd-start" name="startsAt" type="datetime-local" required defaultValue={toLocalInput(event.startsAt)} className="input" />
              </div>
              <div className="field">
                <label htmlFor="cd-end">Fim do Kerb</label>
                <input id="cd-end" name="endsAt" type="datetime-local" defaultValue={toLocalInput(event.endsAt)} className="input" />
                <p className="hint">Se limpar este campo, o evento mantém a mesma duração.</p>
              </div>
              <ConfirmSubmit message="Atualizar a data do Kerb? O cronômetro e as datas exibidas no site mudam na hora." className="btn btn-red">Salvar data</ConfirmSubmit>
              <p className="hint sm:col-span-2 lg:col-span-3">O ano do evento é atualizado junto (e no nome, se ele tiver o ano). A programação dia a dia é ajustada em <Link href="/admin/evento" className="font-bold text-blue underline">Evento e programação</Link>.</p>
            </form>
          )}
        </section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Faturamento pago" value={brl(paidAgg._sum.totalCents ?? 0)} sub={`${paidAgg._count} pedidos`} tone="green" />
        <Kpi label="Abadás vendidos" value={String(itemsPaid)} sub="com pagamento aprovado" />
        <Kpi label="Aguardando pagamento" value={String(pendingCount)} sub="reservas ativas" tone="gold" />
        <Kpi label="Hoje" value={brl(todayAgg._sum.totalCents ?? 0)} sub={`${todayAgg._count} pedidos pagos`} tone="red" />
      </div>
      {extra}
      <Panel title="Pedidos recentes" className="mt-6" action={<Link href="/admin/pedidos" className="text-sm font-bold text-blue underline">Ver todos</Link>}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Pedido</th><th>Comprador</th><th>Abadás</th><th>Total</th><th>Status</th><th>Quando</th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/pedidos/${o.id}`} className="font-extrabold text-blue underline">{orderCode(o.number)}</Link></td>
                  <td>{o.buyerName}</td><td>{o.items.length}</td><td className="font-bold">{brl(o.totalCents)}</td>
                  <td><StatusBadge status={o.status} /></td><td className="whitespace-nowrap text-muted">{fmtDateTime(o.createdAt)}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={6} className="text-center text-muted">Sem pedidos ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Alert({ tone, children }: { tone: "info" | "warn" | "error"; children: React.ReactNode }) {
  const cls = tone === "error" ? "alert-error" : tone === "warn" ? "alert-info !border-[#c9961a] !bg-[#fff8e0] !text-[#6a4a00]" : "alert-info";
  return <div role="status" className={`alert ${cls} flex items-start gap-2 text-sm`}><AlertTriangle size={16} className="mt-0.5 shrink-0" />{children}</div>;
}
