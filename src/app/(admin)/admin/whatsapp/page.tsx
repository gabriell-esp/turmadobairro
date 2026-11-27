import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getWppStatus } from "@/lib/wpp";
import { fmtDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/validators";
import { retryWhatsAppAction } from "@/app/actions/admin-orders";
import { wppLogoutAction, wppStartAction, wppTestAction } from "@/app/actions/admin-system";
import { ConfirmSubmit } from "@/components/client";
import { AdminTitle, Panel } from "@/components/admin-ui";
import { StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePermission("whatsapp.manage");
  const sp = await searchParams;
  const [status, messages, counts] = await Promise.all([
    getWppStatus(),
    db.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.whatsAppMessage.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count._all]));
  return (
    <>
      <AdminTitle title="WhatsApp (WPPConnect)">Conexão do número que envia as confirmações de pedido e links de pagamento.</AdminTitle>
      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      {sp.err && <div role="alert" className="alert alert-error mb-4">{sp.err}</div>}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Conexão">
          <p className="mb-3 flex items-center gap-2">Estado: <span className={`badge ${status.connected ? "badge-green" : status.configured ? "badge-yellow" : "badge-red"}`}>{status.configured ? status.state : "NÃO CONFIGURADO"}</span></p>
          {!status.configured && <p className="text-sm text-muted">Defina WPP_BASE_URL, WPP_SESSION e WPP_SECRET_KEY no .env.production do servidor (passo a passo no DEPLOY.md, seção WhatsApp) e reinicie o app.</p>}
          {status.error && <p className="alert alert-error mb-3 text-sm">{status.error}</p>}
          {status.qrcode && !status.connected && (
            <div className="mb-3">
              <p className="mb-2 text-sm font-bold">Escaneie com o WhatsApp do número da Turma (Aparelhos conectados):</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={status.qrcode.startsWith("data:") ? status.qrcode : `data:image/png;base64,${status.qrcode}`} alt="QR Code do WhatsApp" className="h-56 w-56 rounded-lg border-2 border-ink bg-white p-2" />
            </div>
          )}
          {status.configured && (
            <div className="flex flex-wrap gap-2">
              {!status.connected && <form action={wppStartAction}><button className="btn btn-sm btn-gold">Iniciar sessão / gerar QR</button></form>}
              <a href="/admin/whatsapp" className="btn btn-sm btn-white">Atualizar</a>
              {status.connected && <form action={wppLogoutAction}><ConfirmSubmit message="Desconectar o WhatsApp?" className="btn btn-sm btn-white">Desconectar</ConfirmSubmit></form>}
            </div>
          )}
        </Panel>
        <Panel title="Enviar mensagem de teste">
          <form action={wppTestAction} className="flex flex-wrap items-end gap-3">
            <div className="field min-w-52 flex-1"><label htmlFor="phone">Número</label><input id="phone" name="phone" required placeholder="(49) 99999-9999" className="input" /></div>
            <button className="btn btn-blue" disabled={!status.connected}>Enviar teste</button>
          </form>
          <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div><dt className="text-xs font-bold text-muted">Enviadas</dt><dd className="h-display text-3xl text-[#0f6a2c]">{c.SENT ?? 0}</dd></div>
            <div><dt className="text-xs font-bold text-muted">Na fila</dt><dd className="h-display text-3xl text-[#8a5a00]">{c.QUEUED ?? 0}</dd></div>
            <div><dt className="text-xs font-bold text-muted">Falharam</dt><dd className="h-display text-3xl text-red">{c.FAILED ?? 0}</dd></div>
          </dl>
        </Panel>
      </div>

      <Panel title="Últimas mensagens">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Quando</th><th>Tipo</th><th>Para</th><th>Status</th><th>Tentativas</th><th></th></tr></thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(m.createdAt)}</td><td>{m.kind}</td><td className="whitespace-nowrap">{formatPhone(m.phone)}</td>
                  <td><StatusBadge status={m.status} />{m.lastError && <span className="block max-w-xs truncate text-xs text-red-dark" title={m.lastError}>{m.lastError}</span>}</td>
                  <td>{m.attempts}</td>
                  <td>{m.status !== "SENT" && <form action={retryWhatsAppAction}><input type="hidden" name="id" value={m.id} /><button className="btn btn-sm btn-white">Reenviar</button></form>}</td>
                </tr>
              ))}
              {!messages.length && <tr><td colSpan={6} className="text-center text-muted">Nenhuma mensagem.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
