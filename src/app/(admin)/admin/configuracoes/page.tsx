import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getMpCreds, isMpSimulated, type MpSource } from "@/lib/mercadopago";
import { isWppConfigured } from "@/lib/wpp";
import { appUrl } from "@/lib/request";
import { formatPhone } from "@/lib/validators";
import { saveMercadoPagoAction, saveSettingsAction, testMercadoPagoAction } from "@/app/actions/admin-content";
import { AdminTitle, Panel } from "@/components/admin-ui";
import { CopyButton } from "@/components/client";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePermission("settings.manage");
  const sp = await searchParams;
  const s = await getSettings();
  const webhook = `${appUrl()}/api/webhooks/mercadopago`;
  const mp = await getMpCreds();
  const simulated = await isMpSimulated();
  const checks: [string, boolean, string][] = [
    ["Mercado Pago (Access Token)", !!mp.accessToken, simulated ? "simulado em desenvolvimento" : "obrigatório em produção"],
    ["Assinatura do webhook", !!mp.webhookSecret, "obrigatório em produção"],
    ["WhatsApp (WPP_BASE_URL)", isWppConfigured(), "confirmações e recuperação de senha"],
    ["Segredo do cron (CRON_SECRET)", !!process.env.CRON_SECRET, "reenvio e expiração automáticos"],
    ["APP_URL em HTTPS", appUrl().startsWith("https://"), "necessário para o Mercado Pago voltar ao site"],
  ];
  return (
    <>
      <AdminTitle title="Configurações">Textos e contatos usados no site, e estado das integrações.</AdminTitle>
      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      {sp.err && <div role="alert" className="alert alert-error mb-4">{sp.err}</div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
        <Panel title="Site e loja">
          <form action={saveSettingsAction} className="space-y-4">
            <p className="rounded-xl border-2 border-ink bg-cream p-3 text-sm font-bold">
              Vendas: <span className={s.sales_open === "false" ? "text-red-dark" : "text-[#1c8b3c]"}>{s.sales_open === "false" ? "CONGELADAS" : "liberadas"}</span> — para liberar ou congelar, use o botão na <a href="/admin" className="text-blue underline">Visão geral</a>.
            </p>
            <T label="Nome do site" name="site_name" v={s.site_name} />
            <T label="Chamada (tagline)" name="tagline" v={s.tagline} />
            <T label="Instagram (URL)" name="instagram_url" v={s.instagram_url} />
            <T label="WhatsApp de atendimento (com DDD)" name="whatsapp_contact" v={formatPhone(s.whatsapp_contact)} />
            <T label="E-mail de contato" name="contact_email" v={s.contact_email} />
            <div className="field"><label>Texto padrão de retirada do abadá</label><textarea name="pickup_text" rows={3} className="input" defaultValue={s.pickup_text} /></div>
            <h3 className="h-display pt-2 text-xl text-navy">LGPD</h3>
            <T label="Responsável/encarregado de dados" name="dpo_name" v={s.dpo_name} />
            <div className="field"><label>Como o titular fala com vocês</label><textarea name="privacy_contact" rows={2} className="input" defaultValue={s.privacy_contact} /></div>
            <button className="btn btn-red">Salvar configurações</button>
          </form>
        </Panel>
        <div id="mercado-pago" className="scroll-mt-20">
          <Panel title="Mercado Pago (pagamentos)">
            <form action={saveMercadoPagoAction} className="space-y-4" autoComplete="off">
              <p className="text-sm text-muted">
                Cole aqui as credenciais da sua conta. Em <em>Mercado Pago › Suas integrações › sua aplicação › Credenciais de produção</em> fica o <strong>Access Token</strong>; em <em>Webhooks</em> fica a <strong>assinatura secreta</strong>. Os valores são guardados <strong>criptografados</strong> e nunca aparecem de novo na tela.
              </p>
              {simulated && <p className="alert alert-info">Sem Access Token, a loja usa o <strong>simulador de pagamento</strong> (só em desenvolvimento). Em produção é obrigatório.</p>}
              <Secret
                label="Access Token"
                name="mp_access_token"
                clearName="clear_token"
                value={mp.accessToken}
                source={mp.tokenSource}
                placeholder="APP_USR-…"
              />
              <Secret
                label="Assinatura secreta do webhook"
                name="mp_webhook_secret"
                clearName="clear_webhook"
                value={mp.webhookSecret}
                source={mp.webhookSource}
                placeholder="cole a assinatura secreta"
              />
              <div className="field">
                <label htmlFor="mp_max_installments">Máximo de parcelas no cartão</label>
                <input id="mp_max_installments" name="mp_max_installments" type="number" min={1} max={12} defaultValue={mp.maxInstallments} className="input max-w-32" />
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-red">Salvar Mercado Pago</button>
              </div>
            </form>
            <form action={testMercadoPagoAction} className="mt-3 border-t-2 border-ink/10 pt-3">
              <button className="btn btn-sm btn-white" disabled={!mp.accessToken}>Testar conexão</button>
              <span className="ml-2 text-xs text-muted">Confere o Access Token salvo direto no Mercado Pago.</span>
            </form>
            <div className="mt-4 border-t-2 border-ink/10 pt-3">
              <p className="mb-2 text-sm">Endereço do webhook — cadastre em <em>Webhooks</em> e marque o evento <strong>Pagamentos</strong>:</p>
              <input readOnly value={webhook} className="input text-xs" /> <div className="mt-2"><CopyButton text={webhook} label="Copiar URL" /></div>
              {!appUrl().startsWith("https://") && <p className="mt-2 text-xs text-red-dark">O site ainda não está em HTTPS (APP_URL): o Mercado Pago só avisa pagamentos para endereços https públicos.</p>}
            </div>
          </Panel>
        </div>
        </div>
        <div className="space-y-6">
          <Panel title="Integrações">
            <ul className="space-y-2 text-sm">
              {checks.map(([l, ok, hint]) => <li key={l} className="flex items-start gap-2"><span className={`badge ${ok ? "badge-green" : "badge-red"}`}>{ok ? "OK" : "Falta"}</span><span><strong>{l}</strong><br /><span className="text-muted">{hint}</span></span></li>)}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

const SOURCE_LABEL: Record<MpSource, string> = { panel: "Salvo no painel", env: "Vem do servidor (variável de ambiente)", none: "Não configurado" };

/** Campo de segredo: nunca mostra o valor, só os 4 últimos caracteres. Em branco = manter o atual. */
function Secret({ label, name, clearName, value, source, placeholder }: { label: string; name: string; clearName: string; value: string; source: MpSource; placeholder: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}{" "}
        <span className={`badge ${source === "none" ? "badge-red" : "badge-green"}`}>{SOURCE_LABEL[source]}</span>
      </label>
      <input id={name} name={name} type="password" autoComplete="new-password" spellCheck={false} placeholder={value ? `atual: ••••${value.slice(-4)} — deixe em branco para manter` : placeholder} className="input font-mono text-xs" />
      {source === "panel" && (
        <label className="mt-1 flex items-center gap-2 text-xs font-normal text-muted">
          <input type="checkbox" name={clearName} value="1" /> Remover o valor salvo no painel
        </label>
      )}
    </div>
  );
}

function T({ label, name, v }: { label: string; name: string; v: string }) {
  return <div className="field"><label>{label}</label><input name={name} defaultValue={v} className="input" /></div>;
}
