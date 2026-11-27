"use client";

import { useActionState, useState } from "react";
import { addToCartAction } from "@/app/actions/cart";
import { FormMessage, MaskedInput, SubmitButton } from "./client";
import { Field } from "./form-fields";

const BABY_LOOK_SIZES = ["PP", "P", "M", "G", "GG"];

function ageFromInput(v: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const b = new Date(v + "T00:00:00Z");
  if (Number.isNaN(b.getTime())) return null;
  const n = new Date();
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

export function OwnerForm({
  product,
  canSelf,
  selfLabel,
}: {
  product: { id: string; slug: string; sizes: string[]; allowBabyLook: boolean };
  canSelf: boolean;
  selfLabel?: string;
}) {
  const [state, action] = useActionState(addToCartAction, null);
  const e = state?.fieldErrors;
  const v = state?.values;
  const [forSelf, setForSelf] = useState(v?.forSelf === "on");
  const [birth, setBirth] = useState(v?.ownerBirthDate ?? "");
  const [size, setSize] = useState(v?.size ?? "");
  const [baby, setBaby] = useState(v?.babyLook === "on");

  const minor = !forSelf && (ageFromInput(birth) ?? 99) < 18;
  const babyAllowed = product.allowBabyLook && BABY_LOOK_SIZES.includes(size);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="slug" value={product.slug} />
      <FormMessage state={state} />
      {e && !state?.error && <div role="alert" className="alert alert-error">Revise os campos destacados.</div>}

      <fieldset className="space-y-4">
        <legend className="h-display mb-1 text-2xl text-navy">Quem vai usar este abadá?</legend>

        {canSelf && (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-ink bg-cream p-3 font-bold">
            <input
              type="checkbox"
              name="forSelf"
              className="h-5 w-5 accent-red"
              checked={forSelf}
              onChange={(ev) => setForSelf(ev.target.checked)}
            />
            Este abadá é para mim{selfLabel ? ` (${selfLabel})` : ""}
          </label>
        )}

        {forSelf ? (
          <p className="alert alert-info">Usaremos o nome, CPF e data de nascimento do seu cadastro.</p>
        ) : (
          <>
            <Field label="Nome completo do dono do abadá" name="ownerName" errors={e} values={v} maxLength={100} hint="Igual ao documento. Não pode repetir nome já cadastrado neste Kerb." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CPF do dono" name="ownerCpf" errors={e} values={v}>
                <MaskedInput mask="cpf" id="f-ownerCpf" name="ownerCpf" required defaultValue={v?.ownerCpf} placeholder="000.000.000-00" className="input" aria-invalid={!!e?.ownerCpf || undefined} />
              </Field>
              <Field label="Data de nascimento" name="ownerBirthDate" errors={e}>
                <input
                  id="f-ownerBirthDate"
                  name="ownerBirthDate"
                  type="date"
                  required
                  value={birth}
                  onChange={(ev) => setBirth(ev.target.value)}
                  className="input"
                  aria-invalid={!!e?.ownerBirthDate || undefined}
                />
              </Field>
            </div>
          </>
        )}

        {minor && (
          <div className="space-y-3 rounded-xl border-2 border-red bg-red/5 p-4">
            <p className="font-extrabold text-red-dark">Dono menor de 18 anos — responsável legal obrigatório</p>
            <Field label="Nome completo do responsável legal" name="guardianName" errors={e} values={v} maxLength={100} />
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="guardianConfirm" className="mt-1 h-5 w-5 accent-red" defaultChecked={v?.guardianConfirm === "on"} />
              <span>Sou o responsável legal pelo menor e autorizo a compra do abadá e o tratamento dos dados dele, nos termos da Política de Privacidade. Estou ciente de que é proibido o consumo de bebida alcoólica por menores.</span>
            </label>
            {e?.guardianConfirm && <p className="error-text">{e.guardianConfirm}</p>}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="h-display mb-1 text-2xl text-navy">Tamanho</legend>
        <div className="field">
          <label htmlFor="f-size">Tamanho da camisa</label>
          <select
            id="f-size"
            name="size"
            required
            className="input"
            value={size}
            onChange={(ev) => {
              setSize(ev.target.value);
              if (!BABY_LOOK_SIZES.includes(ev.target.value)) setBaby(false);
            }}
            aria-invalid={!!e?.size || undefined}
          >
            <option value="">Selecione…</option>
            {product.sizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {e?.size && <p className="error-text">{e.size}</p>}
        </div>
        {product.allowBabyLook && (
          <label className={`flex items-center gap-3 rounded-xl border-2 p-3 font-bold ${babyAllowed ? "cursor-pointer border-ink" : "border-ink/20 text-muted"}`}>
            <input
              type="checkbox"
              name="babyLook"
              className="h-5 w-5 accent-red"
              checked={baby && babyAllowed}
              disabled={!babyAllowed}
              onChange={(ev) => setBaby(ev.target.checked)}
            />
            É Baby Look (corte feminino ajustado)
            {!babyAllowed && size && <span className="text-xs font-normal">— indisponível neste tamanho</span>}
          </label>
        )}
        {e?.babyLook && <p className="error-text">{e.babyLook}</p>}
      </fieldset>

      <SubmitButton pending="Adicionando…" className="btn btn-red w-full sm:w-auto">Adicionar à sacola</SubmitButton>
    </form>
  );
}
