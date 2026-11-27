import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { AdminTitle, Empty, Pagination } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";
const PAGE = 50;

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);
  const q = (sp.q ?? "").trim();
  const where = q ? { OR: [{ action: { contains: q, mode: "insensitive" as const } }, { actorName: { contains: q, mode: "insensitive" as const } }, { entityId: q }] } : {};
  const [total, logs] = await Promise.all([db.auditLog.count({ where }), db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE })]);
  return (
    <>
      <AdminTitle title="Auditoria">Registro de quem fez o quê no sistema (sem dados sensíveis).</AdminTitle>
      <form role="search" className="card-flat mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-64 flex-1"><label htmlFor="q" className="label">Filtrar</label><input id="q" name="q" defaultValue={q} placeholder="Ação (ex.: order.cancel), pessoa ou id" className="input" /></div>
        <button className="btn btn-sm btn-blue">Filtrar</button>
      </form>
      {logs.length === 0 ? <Empty>Nada registrado.</Empty> : (
        <div className="card-flat overflow-x-auto">
          <table className="table">
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Alvo</th><th>Detalhes</th><th>IP</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(l.createdAt)}</td><td>{l.actorName ?? "sistema"}</td>
                  <td><code className="text-xs font-bold">{l.action}</code></td><td className="text-xs">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}</td>
                  <td className="max-w-xs truncate text-xs text-muted" title={l.meta ? JSON.stringify(l.meta) : ""}>{l.meta ? JSON.stringify(l.meta) : ""}</td>
                  <td className="text-xs text-muted">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base="/admin/auditoria" params={{ q }} />
    </>
  );
}
