import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { brl } from "@/lib/format";
import { SIZES } from "@/lib/validators";
import { AdminTitle, Empty, Kpi, Panel } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Relatórios" };
export const dynamic = "force-dynamic";

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ pend?: string }> }) {
  await requirePermission("dashboard.full");
  const sp = await searchParams;
  const event = await getCurrentEvent();
  const includePending = sp.pend === "1";
  const statusFilter = includePending ? { in: ["PAID", "PENDING"] as ("PAID" | "PENDING")[] } : "PAID" as const;
  const items = event
    ? await db.orderItem.findMany({ where: { eventId: event.id, active: true, order: { status: statusFilter } }, include: { product: true, order: { select: { source: true, sellerId: true, status: true } } } })
    : [];

  // grade de produção: modelo × tamanho × (normal | baby look)
  const grid = new Map<string, Map<string, { n: number; b: number }>>();
  for (const i of items) {
    const m = grid.get(i.product.name) ?? new Map();
    const cell = m.get(i.size) ?? { n: 0, b: 0 };
    if (i.babyLook) cell.b++; else cell.n++;
    m.set(i.size, cell); grid.set(i.product.name, m);
  }

  const sellers = await db.user.findMany({ where: { role: { in: ["SELLER", "ORGANIZER"] } }, select: { id: true, name: true } });
  const bySeller = await db.order.groupBy({ by: ["sellerId"], where: { eventId: event?.id, status: "PAID", source: "SELLER" }, _sum: { totalCents: true }, _count: true });
  const online = await db.order.aggregate({ where: { eventId: event?.id, status: "PAID", source: "ONLINE" }, _sum: { totalCents: true }, _count: true });

  const totalBaby = items.filter((i) => i.babyLook).length;
  return (
    <>
      <AdminTitle title="Relatórios" action={
        <div className="flex flex-wrap gap-2">
          <a href="/admin/relatorios/export?tipo=producao" className="btn btn-sm btn-blue">CSV de produção</a>
          <a href="/admin/relatorios/export?tipo=completo" className="btn btn-sm btn-white" title="Inclui CPF e nascimento — uso auditado">CSV completo (com CPF)</a>
        </div>
      }>{event?.name ?? "Sem evento"} · {includePending ? "pagos + aguardando pagamento" : "somente pagos"} · <a className="font-bold text-blue underline" href={includePending ? "/admin/relatorios" : "/admin/relatorios?pend=1"}>{includePending ? "ver só pagos" : "incluir aguardando"}</a></AdminTitle>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Abadás" value={String(items.length)} />
        <Kpi label="Baby Look" value={String(totalBaby)} />
        <Kpi label="Vendas no site" value={brl(online._sum.totalCents ?? 0)} sub={`${online._count} pedidos`} tone="green" />
        <Kpi label="Vendas manuais" value={brl(bySeller.reduce((s, r) => s + (r._sum.totalCents ?? 0), 0))} sub={`${bySeller.reduce((s, r) => s + r._count, 0)} pedidos`} tone="gold" />
      </div>

      <Panel title="Grade de produção (para a confecção)" className="mb-6">
        {grid.size === 0 ? <Empty>Sem abadás ainda.</Empty> : [...grid.entries()].map(([name, m]) => {
          const sizes = SIZES.filter((s) => m.has(s));
          const tn = sizes.reduce((s, z) => s + m.get(z)!.n, 0); const tb = sizes.reduce((s, z) => s + m.get(z)!.b, 0);
          return (
            <div key={name} className="mb-5 overflow-x-auto">
              <h3 className="mb-1 font-extrabold">{name}</h3>
              <table className="table">
                <thead><tr><th></th>{sizes.map((s) => <th key={s} className="text-center">{s}</th>)}<th className="text-center">Total</th></tr></thead>
                <tbody>
                  <tr><td className="font-bold">Normal</td>{sizes.map((s) => <td key={s} className="text-center">{m.get(s)!.n || "—"}</td>)}<td className="text-center font-extrabold">{tn}</td></tr>
                  <tr><td className="font-bold">Baby Look</td>{sizes.map((s) => <td key={s} className="text-center">{m.get(s)!.b || "—"}</td>)}<td className="text-center font-extrabold">{tb}</td></tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </Panel>

      <Panel title="Vendas manuais por vendedor">
        {bySeller.length === 0 ? <Empty>Nenhuma venda manual paga.</Empty> : (
          <table className="table"><thead><tr><th>Vendedor</th><th>Pedidos pagos</th><th>Valor</th></tr></thead>
            <tbody>{bySeller.map((r) => <tr key={r.sellerId ?? "none"}><td className="font-bold">{sellers.find((s) => s.id === r.sellerId)?.name ?? "—"}</td><td>{r._count}</td><td>{brl(r._sum.totalCents ?? 0)}</td></tr>)}</tbody></table>
        )}
      </Panel>
    </>
  );
}
