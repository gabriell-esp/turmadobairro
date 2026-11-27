import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { DeleteAccountForm } from "@/components/account-forms";

export const metadata: Metadata = { title: "Privacidade e dados", robots: { index: false } };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { PRIVACY_POLICY: "Política de Privacidade", TERMS: "Termos de Uso e Venda", MARKETING: "Novidades por WhatsApp", GUARDIAN: "Autorização de responsável legal" };

export default async function PrivacidadeContaPage() {
  const user = await requireUser("/minha-conta/privacidade");
  const consents = await db.consentLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-8">
        <div className="card p-6">
          <h2 className="h-display text-3xl text-navy">Meus dados (LGPD)</h2>
          <p className="mt-2 text-sm text-ink/80">Você tem direito de acessar, corrigir, levar e excluir seus dados. Veja como tratamos tudo na <Link href="/privacidade" className="font-bold text-blue underline">Política de Privacidade</Link>.</p>
          <ul className="mt-4 space-y-3">
            <li><a href="/api/me/export" className="btn btn-blue"><Download size={16} aria-hidden /> Baixar uma cópia dos meus dados (JSON)</a></li>
            <li className="text-sm">Corrigir CPF/data de nascimento ou outro pedido: <Link href="/contato#lgpd" className="font-bold text-blue underline">formulário de direitos do titular</Link>.</li>
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="h-display text-3xl text-navy">Histórico de consentimentos</h2>
          <ul className="mt-3 divide-y divide-ink/10 text-sm">
            {consents.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-bold">{LABEL[c.type] ?? c.type}</span>
                <span className={c.granted ? "text-[#0f6a2c]" : "text-red-dark"}>{c.granted ? "Aceito" : "Não aceito/revogado"} · v{c.version} · {fmtDateTime(c.createdAt)}</span>
              </li>
            ))}
            {!consents.length && <li className="py-2 text-muted">Nenhum registro.</li>}
          </ul>
          <p className="mt-3 text-xs text-muted">Para receber (ou deixar de receber) novidades, altere a opção em <Link href="/minha-conta" className="font-bold text-blue underline">Meu perfil</Link>.</p>
        </div>
      </div>

      <div className="card h-fit border-red p-6">
        <h2 className="h-display text-3xl text-red-dark">Excluir minha conta</h2>
        {user.role !== "MEMBER" ? (
          <p className="mt-3 text-sm">Contas da equipe (organizador/vendedor) são removidas por um organizador no painel.</p>
        ) : (
          <>
            <ul className="mb-4 mt-3 list-disc space-y-1 pl-5 text-sm text-ink/85">
              <li>Seu perfil é <strong>anonimizado</strong> (nome, e-mail, CPF, telefone, nascimento) e você sai de todos os dispositivos.</li>
              <li>Pedidos em aberto são cancelados.</li>
              <li>Pedidos pagos ficam registrados por até 5 anos por obrigação fiscal/contábil (art. 16, I da LGPD), sem seu telefone e e-mail.</li>
              <li>Esta ação não pode ser desfeita.</li>
            </ul>
            <DeleteAccountForm />
          </>
        )}
      </div>
    </div>
  );
}
