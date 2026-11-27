"use client";

import { useActionState } from "react";
import { changePasswordAction, deleteAccountAction, updateProfileAction } from "@/app/actions/account";
import { FormMessage, MaskedInput, SubmitButton } from "./client";
import { Field } from "./form-fields";
import { MemberSinceSelect } from "./auth-forms";

export function ProfileForm({
  user,
}: {
  user: { name: string; phone: string; city: string; nickname: string; memberSinceYear: number | null; marketing: boolean };
}) {
  const [state, action] = useActionState(updateProfileAction, null);
  const e = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Nome completo" name="name" errors={e} defaultValue={user.name} maxLength={100} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="WhatsApp" name="phone" errors={e} hint="A confirmação dos pedidos é enviada para este número.">
          <MaskedInput mask="phone" id="f-phone" name="phone" required defaultValue={user.phone} className="input" aria-invalid={!!e?.phone || undefined} />
        </Field>
        <Field label="Cidade" name="city" errors={e} defaultValue={user.city} required={false} maxLength={80} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MemberSinceSelect errors={e} value={user.memberSinceYear ? String(user.memberSinceYear) : undefined} />
        <Field label="Apelido na Turma" name="nickname" errors={e} defaultValue={user.nickname} required={false} maxLength={40} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="marketing" defaultChecked={user.marketing} className="mt-1 h-5 w-5 accent-red" />
        <span>Quero receber novidades da Turma do Bairro por WhatsApp (você pode mudar isso quando quiser).</span>
      </label>
      <SubmitButton pending="Salvando…">Salvar alterações</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  const e = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Senha atual" name="current" type="password" errors={e} autoComplete="current-password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nova senha" name="password" type="password" errors={e} autoComplete="new-password" />
        <Field label="Confirmar nova senha" name="confirm" type="password" errors={e} autoComplete="new-password" />
      </div>
      <SubmitButton pending="Salvando…" className="btn btn-blue">Alterar senha</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, null);
  const e = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Digite EXCLUIR para confirmar" name="confirm" errors={e} />
      <Field label="Sua senha" name="password" type="password" errors={e} autoComplete="current-password" />
      <SubmitButton pending="Excluindo…" className="btn btn-white !border-red-dark !text-red-dark">Excluir minha conta</SubmitButton>
    </form>
  );
}
