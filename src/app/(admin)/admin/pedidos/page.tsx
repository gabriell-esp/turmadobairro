import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { can, requireStaff } from "@/lib/auth";
import { expireStaleOrders } from "@/lib/orders";
import { orderSearchWhere } from "@/lib/admin-search";
import { brl, fmtDateTime, orderCode } from "@/lib/format";
import { AdminTitle, Empty, Pagination } from "@/components/admin-ui";
import { StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Pedidos" };
export const dynamic = "force-dynamic";
const PAGE = 25;

type SP = { q?: string; status?: string; source?: string; seller?: string; atencao?: string; p?: string };

export default async function PedidosAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  await expireStaleOrders();
  const full = can(user, "orders.all");
  const page = Math.max(1, Number(sp.p) || 1);

  const where: Prisma.OrderWhereInput = { AND: [] };
  const and = where.AND as Prisma.OrderWhereInput[];
  if (!full) and.push({ sellerId: user.id });
  if (sp.status && ["PENDING", "PAID", "CANCELLED", "EXPIRED", "REFUNDED"].includes(sp.status)) and.push({ status: sp.status as never });
  if (sp.source === "ONLINE" || sp.source === "SELLER") and.push({ source: sp.source });
  if (full && sp.seller) and.push({ sellerId: sp.seller });
  if (full && sp.atencao) and.push({ needsAttention: true });
  const search = sp.q ? orderSearchWhere(sp.q) : null;
  if (search) and.push(search);

  const [total, orders, sellers] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { items: { select: { id: true } }, seller: { select: { name: true } } } }),
    full ? db.user.findMany({ where: { role: { in: ["SELLER", "ORGANIZER"] } }, select: { id: true, name: true } }) : [],
  ]);

  return (
    <>
      <AdminTitle title="Pedidos" action={can(user, "sales.create") ? <Link href="/admin/vendas/nova" className="btn btn-sm btn-red">+ Nova venda</Link> : null}>
        {full ? "Todos os pedidos do site e das vendas manuais." : "Pedidos criados por você."}
      </AdminTitle>

      <form className="card-flat mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="label">Buscar</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Código, nome, CPF, WhatsApp ou e-mail" className="input" />
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">Todos</option><option value="PENDING">Aguardando</option><option value="PAID">Pago</option>
            <option value="EXPIRED">Expirado</option><option value="CANCELLED">Cancelado</option><option value="REFUNDED">Reembolsado</option>
          </select>
        </div>
        <div>
          <label htmlFor="source" className="label">Origem</label>
          <select id="source" name="source" defaultValue={sp.source ?? ""} className="input">
            <option value="">Todas</option><option value="ONLINE">Site</option><option value="SELLER">Venda manual</option>
          </select>
        </div>
        {full && (
          <div>
            <label htmlFor="seller" className="label">Vendedor</label>
            <select id="seller" name="seller" defaultValue={sp.seller ?? ""} className="input">
              <option value="">Todos</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-end gap-2 lg:col-span-5">
          <button className="btn btn-sm btn-blue">Filtrar</button>
          <Link href="/admin/pedidos" className="btn btn-sm btn-white">Limpar</Link>
          {sp.atencao && <span className="badge badge-red">Somente pendências</span>}
        </div>
      </form>

      {orders.length === 0 ? <Empty>Nenhum pedido encontrado.</Empty> : (
        <div className="card-flat overflow-x-auto">
          <table className="table">
            <thead><tr><th>Pedido</th><th>Comprador</th><th>Abadás</th><th>Total</th><th>Status</th><th>Origem</th><th>Criado em</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/pedidos/${o.id}`} className="font-extrabold text-blue underline">{orderCode(o.number)}</Link>
                    {o.needsAttention && <span className="badge badge-red ml-2">Atenção</span>}
                  </td>
                  <td>{o.buyerName}</td>
                  <td>{o.items.length}</td>
                  <td className="font-bold">{brl(o.totalCents)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-xs">{o.source === "SELLER" ? `Manual${o.seller ? ` · ${o.seller.name.split(" ")[0]}` : ""}` : "Site"}</td>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">{total} pedido(s)</p>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base="/admin/pedidos" params={{ q: sp.q, status: sp.status, source: sp.source, seller: sp.seller, atencao: sp.atencao }} />
    </>
  );
}
