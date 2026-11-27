"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, requestResetAction, resetPasswordAction } from "@/app/actions/auth";
import { FormMessage, MaskedInput, SubmitButton } from "./client";
import { Field } from "./form-fields";

export function MemberSinceSelect({ errors, value }: { errors?: Record<string, string>; value?: string }) {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now; y >= 2008; y--) years.push(y);
  return (
    <Field label="Participa do bloco desde" name="memberSinceYear" errors={errors} hint="Se for o seu primeiro Kerb, escolha o ano atual.">
      <select id="f-memberSinceYear" name="memberSinceYear" className="input" defaultValue={value ?? String(now)} required>
        {years.map((y) => (
          <option key={y} value={y}>
            {y === now ? `${y} — primeiro Kerb com a Turma` : `${y} — há ${now - y} ${now - y === 1 ? "ano" : "anos"}`}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(registerAction, null);
  const e = state?.fieldErrors;
  const v = state?.values;
  return (
    <form action={action} className="space-y-5" noValidate={false}>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      {e && <div role="alert" className="alert alert-error">Revise os campos destacados abaixo.</div>}

      <fieldset className="space-y-4">
        <legend className="h-display mb-2 text-2xl text-navy">Seus dados</legend>
        <Field label="Nome completo" name="name" errors={e} values={v} autoComplete="name" maxLength={100} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CPF" name="cpf" errors={e} values={v} hint="Usado para identificar seus abadás. Guardado criptografado.">
            <MaskedInput mask="cpf" id="f-cpf" name="cpf" required defaultValue={v?.cpf} placeholder="000.000.000-00" className="input" aria-invalid={!!e?.cpf || undefined} />
          </Field>
          <Field label="Data de nascimento" name="birthDate" type="date" errors={e} values={v} autoComplete="bday" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp" name="phone" errors={e} values={v} hint="Enviamos a confirmação do pedido para este número.">
            <MaskedInput mask="phone" id="f-phone" name="phone" required defaultValue={v?.phone} placeholder="(49) 99999-9999" className="input" autoComplete="tel" aria-invalid={!!e?.phone || undefined} />
          </Field>
          <Field label="Cidade" name="city" errors={e} values={v} required={false} autoComplete="address-level2" maxLength={80} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MemberSinceSelect errors={e} value={v?.memberSinceYear} />
          <Field label="Apelido na Turma" name="nickname" errors={e} values={v} required={false} maxLength={40} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="h-display mb-2 text-2xl text-navy">Acesso</legend>
        <Field label="E-mail" name="email" type="email" errors={e} values={v} autoComplete="email" maxLength={160} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Senha" name="password" type="password" errors={e} autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." />
          <Field label="Confirmar senha" name="confirm" type="password" errors={e} autoComplete="new-password" />
        </div>
      </fieldset>

      <div className="space-y-3 rounded-xl border-2 border-ink/15 bg-cream p-4 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="acceptTerms" required className="mt-1 h-5 w-5 accent-red" defaultChecked={v?.acceptTerms === "on"} />
          <span>
            Li e aceito os <Link href="/termos" target="_blank" className="font-bold text-blue underline">Termos de Uso e Venda</Link> e a{" "}
            <Link href="/privacidade" target="_blank" className="font-bold text-blue underline">Política de Privacidade</Link>, e autorizo o tratamento dos meus
            dados para as finalidades descritas.
          </span>
        </label>
        {e?.acceptTerms && <p className="error-text">{e.acceptTerms}</p>}
        <label className="flex items-start gap-3">
          <input type="checkbox" name="marketing" className="mt-1 h-5 w-5 accent-red" defaultChecked={v?.marketing === "on"} />
          <span>(Opcional) Quero receber novidades da Turma do Bairro por WhatsApp. Posso cancelar quando quiser.</span>
        </label>
      </div>

      <SubmitButton pending="Criando conta…" className="btn btn-red w-full">Criar minha conta</SubmitButton>
    </form>
  );
}

export function LoginForm({ next, resetOk }: { next?: string; resetOk?: boolean }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      {resetOk && <div role="status" className="alert alert-ok">Senha redefinida! Entre com a nova senha.</div>}
      <FormMessage state={state} />
      <Field label="E-mail" name="email" type="email" errors={state?.fieldErrors} values={state?.values} autoComplete="email" />
      <Field label="Senha" name="password" type="password" errors={state?.fieldErrors} autoComplete="current-password" />
      <SubmitButton pending="Entrando…" className="btn btn-red w-full">Entrar</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/esqueci-senha" className="font-bold text-blue underline">Esqueci minha senha</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(requestResetAction, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="E-mail da sua conta" name="email" type="email" errors={state?.fieldErrors} autoComplete="email" hint="Enviaremos o link de redefinição para o WhatsApp cadastrado." />
      <SubmitButton pending="Enviando…" className="btn btn-red w-full">Enviar link</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field label="Nova senha" name="password" type="password" errors={state?.fieldErrors} autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." />
      <Field label="Confirmar nova senha" name="confirm" type="password" errors={state?.fieldErrors} autoComplete="new-password" />
      <SubmitButton pending="Salvando…" className="btn btn-red w-full">Salvar nova senha</SubmitButton>
    </form>
  );
}
