import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { resolveDataRequestAction } from "@/app/actions/admin-system";
import { AdminTitle, Empty, Panel } from "@/components/admin-ui";

export const metadata: Metadata = { title: "LGPD / titulares" };
export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = { ACCESS: "Acesso aos dados", EXPORT: "Cópia / portabilidade", CORRECTION: "Correção", DELETION: "Exclusão / anonimização", OTHER: "Outra" };

export default async function LgpdAdmin({ searchParams }: { searchParams: Promise<{ msg?: string; all?: string }> }) {
  await requirePermission("lgpd.manage");
  const sp = await searchParams;
  const requests = await db.dataRequest.findMany({ where: sp.all ? {} : { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true, email: true } } } });
  return (
    <>
      <AdminTitle title="LGPD / direitos dos titulares">Prazo recomendado de resposta: 15 dias. Pedidos de exclusão feitos pela conta do próprio titular já são atendidos automaticamente em “Minha conta”.</AdminTitle>
      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      <p className="mb-4 text-sm"><a className="font-bold text-blue underline" href={sp.all ? "/admin/lgpd" : "/admin/lgpd?all=1"}>{sp.all ? "Ver só abertas" : "Ver todas"}</a></p>
      {requests.length === 0 ? <Empty>Nenhuma solicitação {sp.all ? "" : "em aberto"}.</Empty> : (
        <ul className="space-y-4">
          {requests.map((r) => (
            <li key={r.id}>
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{TYPE[r.type]} <span className={`badge ml-2 ${r.status === "OPEN" ? "badge-yellow" : r.status === "DONE" ? "badge-green" : "badge-gray"}`}>{r.status === "OPEN" ? "Aberta" : r.status === "DONE" ? "Atendida" : "Recusada"}</span></p>
                    <p className="text-sm text-muted">{fmtDateTime(r.createdAt)} · contato: {r.contact ?? "—"}{r.user ? ` · conta: ${r.user.email}` : ""}</p>
                    {r.message && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-cream p-3 text-sm">{r.message}</p>}
                    {r.response && <p className="mt-2 text-sm"><strong>Resposta:</strong> {r.response}</p>}
                  </div>
                  {r.status === "OPEN" && (
                    <form action={resolveDataRequestAction} className="flex w-full flex-col gap-2 sm:w-80">
                      <input type="hidden" name="id" value={r.id} />
                      <textarea name="response" rows={2} placeholder="Resposta/observação para registro" className="input" />
                      <div className="flex gap-2"><button name="status" value="DONE" className="btn btn-sm btn-gold">Marcar atendida</button><button name="status" value="REJECTED" className="btn btn-sm btn-white">Recusar</button></div>
                    </form>
                  )}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
