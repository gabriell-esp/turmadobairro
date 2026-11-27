import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { createStaffAction, resetStaffPasswordAction, setRoleAction, toggleStaffActiveAction } from "@/app/actions/admin-system";
import { ConfirmSubmit } from "@/components/client";
import { AdminTitle, Panel } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Equipe e permissões" };
export const dynamic = "force-dynamic";

export default async function EquipePage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const me = await requirePermission("users.manage");
  const sp = await searchParams;
  const staff = await db.user.findMany({ where: { role: { in: ["ORGANIZER", "SELLER"] }, deletedAt: null }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return (
    <>
      <AdminTitle title="Equipe e permissões">
        <strong>Organizador</strong>: acesso total. <strong>Vendedor</strong>: só cria vendas, vê os próprios pedidos, consulta CPF/nome e marca retiradas.
      </AdminTitle>
      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      {sp.err && <div role="alert" className="alert alert-error mb-4">{sp.err}</div>}

      <Panel title="Equipe atual" className="mb-6">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Último acesso</th><th>Ações</th></tr></thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                  <td className="font-bold">{u.name}{u.id === me.id && <span className="badge badge-blue ml-2">você</span>}{!u.active && <span className="badge badge-red ml-2">desativado</span>}</td>
                  <td>{u.email}</td>
                  <td><span className={`badge ${u.role === "ORGANIZER" ? "badge-blue" : "badge-yellow"}`}>{u.role === "ORGANIZER" ? "Organizador" : "Vendedor"}</span></td>
                  <td className="whitespace-nowrap text-muted">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "—"}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      {u.id !== me.id && (
                        <form action={toggleStaffActiveAction}><input type="hidden" name="id" value={u.id} /><ConfirmSubmit message={u.active ? "Desativar esta conta?" : "Reativar esta conta?"} className="btn btn-sm btn-white">{u.active ? "Desativar" : "Reativar"}</ConfirmSubmit></form>
                      )}
                      <details className="relative">
                        <summary className="btn btn-sm btn-ghost">Nova senha</summary>
                        <form action={resetStaffPasswordAction} className="absolute right-0 z-10 mt-2 flex w-64 gap-2 rounded-xl border-2 border-ink bg-white p-2 shadow-lg">
                          <input type="hidden" name="id" value={u.id} />
                          <input name="password" type="password" required minLength={8} placeholder="Nova senha" autoComplete="new-password" className="input !min-h-9" />
                          <button className="btn btn-sm btn-blue">OK</button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Criar conta da equipe">
          <form action={createStaffAction} className="space-y-3">
            <Fld label="Nome completo" name="name" /><Fld label="E-mail" name="email" type="email" />
            <Fld label="WhatsApp (opcional)" name="phone" req={false} />
            <Fld label="Senha provisória" name="password" type="password" />
            <div className="field"><label>Perfil</label><select name="role" className="input" defaultValue="SELLER"><option value="SELLER">Vendedor</option><option value="ORGANIZER">Organizador</option></select></div>
            <button className="btn btn-red">Criar conta</button>
          </form>
        </Panel>
        <Panel title="Alterar permissão de uma conta existente">
          <p className="mb-3 text-sm text-muted">Para um integrante que já tem cadastro no site: informe o e-mail e escolha o perfil. Ele precisará entrar novamente.</p>
          <form action={setRoleAction} className="space-y-3">
            <Fld label="E-mail da conta" name="email" type="email" />
            <div className="field"><label>Perfil</label><select name="role" className="input" defaultValue="SELLER"><option value="MEMBER">Integrante (sem acesso ao painel)</option><option value="SELLER">Vendedor</option><option value="ORGANIZER">Organizador</option></select></div>
            <ConfirmSubmit message="Alterar o perfil desta conta?" className="btn btn-blue">Alterar perfil</ConfirmSubmit>
          </form>
        </Panel>
      </div>
    </>
  );
}

function Fld({ label, name, type = "text", req = true }: { label: string; name: string; type?: string; req?: boolean }) {
  return <div className="field"><label>{label}</label><input name={name} type={type} required={req} className="input" autoComplete="off" /></div>;
}
