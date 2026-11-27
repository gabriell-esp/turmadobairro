import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { blindIndex } from "@/lib/crypto";
import { nameKey, isValidCpf, onlyDigits } from "@/lib/validators";
import { orderCode } from "@/lib/format";
import { audit } from "@/lib/audit";
import { AdminTitle } from "@/components/admin-ui";
import { StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Consultar CPF/nome" };
export const dynamic = "force-dynamic";

/** Consulta mínima (sem CPF/telefone): evita vender abadá repetido. Disponível para vendedores. */
export default async function Consulta({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePermission("buyers.lookup");
  const sp = await searchParams;
  const event = await getCurrentEvent();
  const q = (sp.q ?? "").trim();
  let rows: { id: string; name: string; status: string; code: string; size: string }[] = [];
  let kind = "";
  if (q && event) {
    const digits = onlyDigits(q);
    const where = digits.length === 11
      ? (kind = "CPF", isValidCpf(digits) ? { ownerCpfHash: blindIndex(digits) } : { id: "__none__" })
      : (kind = "nome", { ownerNameKey: { contains: nameKey(q) } });
    const items = await db.orderItem.findMany({ where: { eventId: event.id, active: true, ...where }, include: { order: true }, take: 20 });
    rows = items.map((i) => ({ id: i.id, name: i.ownerName, status: i.order.status, code: orderCode(i.order.number), size: i.size }));
    await audit({ id: user.id, name: user.name }, "lookup", "OrderItem", undefined, { kind });
  }
  return (
    <>
      <AdminTitle title="Consultar CPF / nome">Veja rapidamente se uma pessoa já tem abadá neste Kerb antes de vender.</AdminTitle>
      <form role="search" className="card-flat mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-64 flex-1">
          <label htmlFor="q" className="label">CPF ou nome</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="000.000.000-00 ou nome" />
        </div>
        <button className="btn btn-blue">Consultar</button>
      </form>
      {q && (rows.length ? (
        <div className="alert alert-error mb-4">⚠ Já existe abadá {kind === "CPF" ? "para este CPF" : "com esse nome"} neste Kerb.</div>
      ) : (
        <div className="alert alert-ok mb-4">✔ Nenhum abadá ativo encontrado — pode vender.</div>
      ))}
      {rows.length > 0 && (
        <div className="card-flat overflow-x-auto">
          <table className="table">
            <thead><tr><th>Nome</th><th>Tam.</th><th>Pedido</th><th>Status</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}><td className="font-bold">{r.name}</td><td>{r.size}</td><td>{r.code}</td><td><StatusBadge status={r.status} /></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
