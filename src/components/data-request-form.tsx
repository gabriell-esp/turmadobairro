"use client";

import { useActionState } from "react";
import { submitDataRequest } from "@/app/actions/public";
import { FormMessage, SubmitButton } from "./client";

export function DataRequestForm() {
  const [state, action] = useActionState(submitDataRequest, null);
  return (
    <form action={action} className="card space-y-4 p-6">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="type">O que você precisa?</label>
        <select id="type" name="type" className="input" defaultValue="ACCESS">
          <option value="ACCESS">Acessar meus dados</option>
          <option value="EXPORT">Receber uma cópia (portabilidade)</option>
          <option value="CORRECTION">Corrigir dados</option>
          <option value="DELETION">Excluir/anonimizar meus dados</option>
          <option value="OTHER">Outra solicitação sobre privacidade</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="contact">Seu e-mail ou WhatsApp para retorno</label>
        <input id="contact" name="contact" required maxLength={120} className="input" autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="message">Detalhes (opcional)</label>
        <textarea id="message" name="message" rows={4} maxLength={1500} className="input" />
        <p className="hint">Não envie CPF, senhas ou documentos por aqui. Vamos confirmar sua identidade pelo cadastro.</p>
      </div>
      <SubmitButton pending="Enviando…">Enviar solicitação</SubmitButton>
    </form>
  );
}
