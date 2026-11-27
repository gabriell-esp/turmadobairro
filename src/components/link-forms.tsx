"use client";

import { useActionState } from "react";
import { addExternalLinkAction, createPaymentLinkAction } from "@/app/actions/admin-links";
import { FormMessage, SubmitButton } from "./client";
import { Field } from "./form-fields";

export function CreateLinkForm() {
  const [state, action] = useActionState(createPaymentLinkAction, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Título da cobrança" name="title" errors={state?.fieldErrors} values={state?.values} maxLength={120} placeholder="Ex.: Abadá — turma da família Silva" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor (R$)" name="amount" errors={state?.fieldErrors} values={state?.values} inputMode="numeric" placeholder="120,00" />
        <div className="field">
          <label htmlFor="hours">Validade</label>
          <select id="hours" name="hours" className="input" defaultValue="0">
            <option value="0">Sem prazo</option><option value="24">24 horas</option><option value="72">3 dias</option><option value="168">7 dias</option><option value="720">30 dias</option>
          </select>
        </div>
      </div>
      <Field label="Descrição" name="description" errors={state?.fieldErrors} values={state?.values} required={false} maxLength={250} />
      <SubmitButton pending="Gerando…">Gerar link no Mercado Pago</SubmitButton>
    </form>
  );
}

export function ExternalLinkForm() {
  const [state, action] = useActionState(addExternalLinkAction, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field label="Título" name="title" errors={state?.fieldErrors} />
      <Field label="Link do Mercado Pago" name="url" errors={state?.fieldErrors} placeholder="https://mpago.la/..." />
      <Field label="Valor (R$)" name="amount" errors={state?.fieldErrors} required={false} placeholder="opcional" />
      <SubmitButton pending="Salvando…" className="btn btn-sm btn-blue">Adicionar link existente</SubmitButton>
    </form>
  );
}
