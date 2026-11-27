import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { blindIndex, decrypt } from "@/lib/crypto";
import { fmtBirth, fmtDate } from "@/lib/format";
import { formatPhone, isValidCpf, maskCpf, onlyDigits } from "@/lib/validators";
import { AdminTitle, Empty, Pagination } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Membros" };
export const dynamic = "force-dynamic";
const PAGE = 30;

export default async function MembrosPage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  await requirePermission("members.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);
  const q = (sp.q ?? "").trim();
  const where: Prisma.UserWhereInput = { deletedAt: null, role: "MEMBER" };
  if (q) {
    const d = onlyDigits(q);
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      ...(d.length >= 8 ? [{ phone: { contains: d } }] : []),
      ...(d.length === 11 && isValidCpf(d) ? [{ cpfHash: blindIndex(d) }] : []),
    ];
  }
  const [total, users, withMarketing] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { _count: { select: { orders: { where: { status: "PAID" } } } } } }),
    db.user.count({ where: { deletedAt: null, role: "MEMBER", marketingOptIn: true } }),
  ]);
  return (
    <>
      <AdminTitle title="Membros" action={<a href="/admin/relatorios/export?tipo=membros" className="btn btn-sm btn-blue">Exportar CSV</a>}>
        Integrantes cadastrados no site ({total}). {withMarketing} aceitam receber novidades. CPF sempre mascarado.
      </AdminTitle>
      <form role="search" className="card-flat mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-64 flex-1"><label htmlFor="q" className="label">Buscar</label><input id="q" name="q" defaultValue={q} placeholder="Nome, e-mail, WhatsApp ou CPF" className="input" /></div>
        <button className="btn btn-sm btn-blue">Buscar</button>
      </form>
      {users.length === 0 ? <Empty>Nenhum membro encontrado.</Empty> : (
        <div className="card-flat overflow-x-auto">
          <table className="table">
            <thead><tr><th>Nome</th><th>Contato</th><th>CPF</th><th>Nasc.</th><th>Desde</th><th>Cidade</th><th>Compras</th><th>Cadastro</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-bold">{u.name}{u.nickname && <span className="block text-xs font-normal text-muted">“{u.nickname}”</span>}</td>
                  <td className="text-sm">{u.email}<br /><span className="text-muted">{formatPhone(u.phone)}</span></td>
                  <td className="whitespace-nowrap">{u.cpfEnc ? maskCpf(decrypt(u.cpfEnc)) : "—"}</td>
                  <td className="whitespace-nowrap">{u.birthDate ? fmtBirth(u.birthDate) : "—"}</td>
                  <td>{u.memberSinceYear ?? "—"}</td><td>{u.city ?? "—"}</td><td>{u._count.orders}</td>
                  <td className="whitespace-nowrap text-muted">{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base="/admin/membros" params={{ q }} />
    </>
  );
}
