"use client";

import Link from "next/link";
import { useActionState } from "react";
import { checkoutAction, removeCartItemAction } from "@/app/actions/cart";
import { MaskedInput, SubmitButton } from "./client";

export type CartLine = {
  id: string;
  productName: string;
  priceLabel: string;
  ownerName: string;
  cpfMasked: string;
  birth: string;
  size: string;
  babyLook: boolean;
  minor: boolean;
};

export function CartView({ lines, totalLabel, holdMinutes, phone }: { lines: CartLine[]; totalLabel: string; holdMinutes: number; phone: string }) {
  const [state, action] = useActionState(checkoutAction, null);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <ul className="space-y-4">
        {lines.map((l, i) => {
          const errs = state?.itemErrors?.[l.id];
          return (
            <li key={l.id} className={`card p-4 sm:p-5 ${errs ? "!border-red" : ""}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-muted">Abadá {i + 1}</p>
                  <p className="h-display text-2xl text-navy">{l.productName}</p>
                  <p className="mt-1 text-lg font-extrabold">{l.ownerName}</p>
                  <p className="text-sm text-muted">
                    CPF {l.cpfMasked} · Nasc. {l.birth}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="badge badge-blue">Tam. {l.size}</span>
                    {l.babyLook && <span className="badge badge-blue">Baby Look</span>}
                    {l.minor && <span className="badge badge-yellow">Menor de idade</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t-2 border-ink/10 pt-3 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                  <p className="h-display text-2xl text-red">{l.priceLabel}</p>
                  <form action={removeCartItemAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="inline-flex min-h-11 items-center px-1 text-sm font-bold text-red-dark underline sm:mt-1 sm:min-h-0" aria-label={`Remover abadá de ${l.ownerName}`}>
                      Remover
                    </button>
                  </form>
                </div>
              </div>
              {errs && (
                <ul role="alert" className="mt-3 space-y-1 rounded-lg bg-red/10 p-3 text-sm font-bold text-red-dark">
                  {errs.map((m) => (
                    <li key={m}>• {m}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        <li>
          <Link href="/loja" className="btn btn-white">+ Adicionar outro abadá</Link>
        </li>
      </ul>

      <aside className="h-fit lg:sticky lg:top-36">
        <form action={action} className="card space-y-4 p-5 sm:p-6">
          <h2 className="h-display text-3xl text-navy">Resumo</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>{lines.length} {lines.length === 1 ? "abadá" : "abadás"}</dt><dd className="font-bold">{totalLabel}</dd></div>
            <div className="flex justify-between border-t-2 border-ink/10 pt-2 text-lg"><dt className="font-extrabold">Total</dt><dd className="h-display text-3xl text-red">{totalLabel}</dd></div>
          </dl>

          {state?.error && <div role="alert" className="alert alert-error">{state.error}</div>}

          <div className="field">
            <label htmlFor="checkout-phone">WhatsApp para receber a confirmação</label>
            <MaskedInput
              mask="phone"
              id="checkout-phone"
              name="phone"
              type="tel"
              required
              defaultValue={phone}
              placeholder="(49) 99999-9999"
              autoComplete="tel"
              aria-invalid={!!state?.fieldErrors?.phone || undefined}
              aria-describedby="checkout-phone-hint"
              className="input"
            />
            {state?.fieldErrors?.phone && <p role="alert" className="error-text">{state.fieldErrors.phone}</p>}
            <p id="checkout-phone-hint" className="mt-1 text-xs text-muted">
              {phone ? "Usamos o WhatsApp do seu cadastro. Pode trocar só para este pedido." : "Vamos guardar no seu cadastro para as próximas compras."}
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="accept" required className="mt-1 h-5 w-5 shrink-0 accent-red" />
            <span>
              Li e aceito os <Link href="/termos" target="_blank" className="font-bold text-blue underline">Termos de Venda</Link> e declaro ter autorização das
              pessoas informadas para usar seus dados neste pedido, conforme a{" "}
              <Link href="/privacidade" target="_blank" className="font-bold text-blue underline">Política de Privacidade</Link>.
            </span>
          </label>

          <SubmitButton pending="Criando pedido…" className="btn btn-red w-full">Finalizar e pagar</SubmitButton>
          <p className="text-center text-xs text-muted">
            Pagamento seguro pelo Mercado Pago (Pix ou cartão). Os itens ficam reservados por {holdMinutes} minutos.
          </p>
        </form>
      </aside>
    </div>
  );
}
