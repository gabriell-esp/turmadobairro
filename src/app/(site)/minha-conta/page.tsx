import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { maskCpf } from "@/lib/validators";
import { fmtBirth, fmtDate } from "@/lib/format";
import { formatPhone } from "@/lib/validators";
import { ProfileForm, PasswordForm } from "@/components/account-forms";

export const metadata: Metadata = { title: "Meu perfil", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MinhaContaPage() {
  const user = await requireUser("/minha-conta");
  const years = user.memberSinceYear ? new Date().getFullYear() - user.memberSinceYear : null;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <aside className="space-y-6">
        <div className="card p-6">
          <h2 className="h-display text-3xl text-navy">Cadastro</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="E-mail" v={user.email} />
            <Row k="CPF" v={user.cpfEnc ? maskCpf(decrypt(user.cpfEnc)) : "—"} />
            <Row k="Nascimento" v={user.birthDate ? fmtBirth(user.birthDate) : "—"} />
            <Row k="Membro desde" v={user.memberSinceYear ? `${user.memberSinceYear}${years ? ` (${years} ${years === 1 ? "ano" : "anos"})` : ""}` : "—"} />
            <Row k="Conta criada" v={fmtDate(user.createdAt)} />
            <Row k="Perfil" v={user.role === "ORGANIZER" ? "Organizador" : user.role === "SELLER" ? "Vendedor" : "Integrante"} />
          </dl>
          <p className="mt-4 text-xs text-muted">
            CPF e data de nascimento só podem ser alterados pela organização. Para corrigir, use o <a className="font-bold text-blue underline" href="/contato#lgpd">formulário de direitos do titular</a>.
          </p>
        </div>
      </aside>
      <div className="space-y-8">
        <div className="card p-6">
          <h2 className="h-display mb-4 text-3xl text-navy">Meus dados</h2>
          <ProfileForm
            user={{
              name: user.name,
              phone: formatPhone(user.phone),
              city: user.city ?? "",
              nickname: user.nickname ?? "",
              memberSinceYear: user.memberSinceYear,
              marketing: user.marketingOptIn,
            }}
          />
        </div>
        <div className="card p-6">
          <h2 className="h-display mb-4 text-3xl text-navy">Alterar senha</h2>
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink/10 pb-1.5">
      <dt className="font-bold text-muted">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}
