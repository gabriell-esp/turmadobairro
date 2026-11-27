"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createManualSaleAction } from "@/app/actions/admin-sales";
import { ageOn, parseBirthDate, parsePriceCents, BABY_LOOK_SIZES } from "@/lib/validators";
import { FormMessage, SubmitButton, applyMask } from "./client";
import { ShirtArt } from "./shirt-art";

export type SaleProduct = {
  id: string;
  name: string;
  lotName: string | null;
  description: string | null;
  priceCents: number;
  sizes: string[];
  allowBabyLook: boolean;
  remaining: number | null;
  maxPerOrder: number;
  imageUrl: string | null;
  shirtColor: string | null;
  stripeColor: string | null;
};

type Line = {
  key: number;
  productId: string;
  price: string; // "" = preço de tabela
  editPrice: boolean;
  ownerName: string;
  ownerCpf: string;
  ownerBirthDate: string;
  size: string;
  babyLook: boolean;
  guardianName: string;
  guardianConfirm: boolean;
  allowDup: boolean;
};

const MAX_LINES = 20;
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const EXTERNAL_OPTIONS = [
  { v: "CASH", t: "Dinheiro", d: "Recebido em mãos" },
  { v: "PIX", t: "Pix direto", d: "Direto na conta da turma" },
  { v: "CARD", t: "Cartão na maquininha", d: "Crédito ou débito" },
  { v: "TRANSFER", t: "Transferência", d: "TED / DOC" },
  { v: "OTHER", t: "Outro meio", d: "Descreva na observação" },
] as const;

export function ManualSaleForm({ products, organizer, canExternal, initialMode }: { products: SaleProduct[]; organizer: boolean; canExternal: boolean; initialMode?: "LINK" | "EXTERNAL" }) {
  const [state, action] = useActionState(createManualSaleAction, null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [lines, setLines] = useState<Line[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const [mode, setMode] = useState<"LINK" | "EXTERNAL">(canExternal && initialMode === "EXTERNAL" ? "EXTERNAL" : "LINK");
  const [extMethod, setExtMethod] = useState("");
  const [payMethods, setPayMethods] = useState("ALL");
  const [hold, setHold] = useState("120");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [stepError, setStepError] = useState("");
  const e = state?.fieldErrors ?? {};
  const isExt = mode === "EXTERNAL";
  const steps = ["Escolher abadás", "Dados dos donos", isExt ? "Pagamento recebido" : "Pagamento"];

  const productOf = (id: string) => products.find((p) => p.id === id)!;
  const effectiveCents = (l: Line) => parsePriceCents(l.price) ?? productOf(l.productId).priceCents;
  const priceChanged = (l: Line) => {
    const c = parsePriceCents(l.price);
    return c !== null && c !== productOf(l.productId).priceCents;
  };
  const anyChanged = lines.some(priceChanged);
  const total = lines.reduce((s, l) => s + effectiveCents(l), 0);
  const countOf = (pid: string) => lines.filter((l) => l.productId === pid).length;
  const limitOf = (p: SaleProduct) => Math.min(p.maxPerOrder, p.remaining ?? Infinity);

  // Erros vindos do servidor levam a pessoa de volta ao passo certo
  useEffect(() => {
    if (!state?.fieldErrors && !state?.error) return;
    const keys = Object.keys(state.fieldErrors ?? {});
    setShowErrors(true);
    setStepError("");
    if (keys.some((k) => /^i\d+_/.test(k))) setStep(2);
    else if (keys.length || state.error) setStep(3);
  }, [state]);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function addLine(p: SaleProduct) {
    if (lines.length >= MAX_LINES || countOf(p.id) >= limitOf(p)) return;
    setLines((ls) => [
      ...ls,
      { key: nextKey, productId: p.id, price: "", editPrice: false, ownerName: "", ownerCpf: "", ownerBirthDate: "", size: "", babyLook: false, guardianName: "", guardianConfirm: false, allowDup: false },
    ]);
    setNextKey((k) => k + 1);
    setStepError("");
  }
  function removeLastOf(pid: string) {
    setLines((ls) => {
      const idx = [...ls].map((l) => l.productId).lastIndexOf(pid);
      return idx < 0 ? ls : ls.filter((_, i) => i !== idx);
    });
  }

  // ───── validação de cada passo (no navegador; o servidor valida tudo de novo) ─────
  const lineProblems = useMemo(() => {
    const out: Record<number, Record<string, string>> = {};
    const seenCpf = new Map<string, number>();
    lines.forEach((l, idx) => {
      const p: Record<string, string> = {};
      const digits = l.ownerCpf.replace(/\D/g, "");
      if (l.ownerName.trim().split(/\s+/).filter(Boolean).length < 2) p.ownerName = "Informe nome e sobrenome.";
      if (digits.length !== 11) p.ownerCpf = "Informe o CPF completo (11 números).";
      else if (seenCpf.has(digits)) p.ownerCpf = `Este CPF já está no abadá ${seenCpf.get(digits)! + 1} desta venda.`;
      else seenCpf.set(digits, idx);
      const birth = parseBirthDate(l.ownerBirthDate);
      if (!birth) p.ownerBirthDate = "Informe uma data de nascimento válida.";
      if (!l.size) p.size = "Escolha o tamanho.";
      if (birth && ageOn(birth) < 18) {
        if (l.guardianName.trim().split(/\s+/).filter(Boolean).length < 2) p.guardianName = "Menor de 18 anos: informe o nome completo do responsável.";
        if (!l.guardianConfirm) p.guardianConfirm = "O responsável precisa autorizar a compra e o uso dos dados.";
      }
      if (l.price.trim() !== "" && parsePriceCents(l.price) === null) p.price = "Preço inválido. Ex.: 120,00";
      else if (l.price.trim() !== "" && (parsePriceCents(l.price)! < 100)) p.price = "O preço mínimo é R$ 1,00.";
      out[l.key] = p;
    });
    return out;
  }, [lines]);

  function goTo(target: 1 | 2 | 3) {
    setStepError("");
    if (target >= 2 && lines.length === 0) return setStepError("Adicione ao menos um abadá para continuar.");
    if (target >= 2 && lines.some((l) => lineProblems[l.key]?.price)) return setStepError("Corrija o preço informado.");
    if (target === 3 && lines.some((l) => Object.keys(lineProblems[l.key] ?? {}).length)) {
      setShowErrors(true);
      return setStepError("Preencha os dados de todos os abadás para continuar.");
    }
    setStep(target);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const reasonMissing = anyChanged && reason.trim().length < 3;

  return (
    <form
      action={action}
      noValidate
      onSubmit={(ev) => {
        if (lines.length === 0 || reasonMissing || (isExt && !extMethod)) {
          ev.preventDefault();
          setShowErrors(true);
          setTriedSubmit(true);
          setStepError(lines.length === 0 ? "Adicione ao menos um abadá." : isExt && !extMethod ? "Escolha como a venda foi paga." : "Informe o motivo da alteração de preço.");
        }
      }}
      className="space-y-6"
    >
      <input type="hidden" name="count" value={nextKey} />
      <input type="hidden" name="payMethods" value={payMethods} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="externalMethod" value={extMethod} />

      {canExternal && (
        <div role="radiogroup" aria-label="Tipo de venda" className="grid gap-3 sm:grid-cols-2">
          {[
            { v: "LINK" as const, t: "Gerar link de pagamento", d: "A pessoa paga online (Pix ou cartão) pelo link que você envia." },
            { v: "EXTERNAL" as const, t: "Lançar venda já paga (por fora)", d: "Já recebeu em dinheiro, Pix direto, maquininha… Só registra no sistema." },
          ].map((o) => (
            <label key={o.v} className={`cursor-pointer rounded-xl border-2 p-3 ${mode === o.v ? "border-ink bg-[#fff4d6] shadow-[0_3px_0_var(--color-ink)]" : "border-ink/25 bg-white"}`}>
              <input type="radio" className="sr-only" aria-label={o.t} checked={mode === o.v} onChange={() => { setMode(o.v); setStepError(""); }} />
              <span className="block font-extrabold">{o.t}</span>
              <span className="block text-xs text-muted">{o.d}</span>
            </label>
          ))}
        </div>
      )}

      {/* passo a passo */}
      <ol className="flex flex-wrap gap-2" aria-label="Etapas da venda">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = step > n;
          const current = step === n;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={n > step}
                onClick={() => n < step && goTo(n)}
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-extrabold ${current ? "border-ink bg-navy text-white" : done ? "border-[#1c8b3c] bg-[#e7f6ea] text-[#0f5a25]" : "border-ink/20 bg-white text-muted"}`}
              >
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${current ? "bg-gold text-ink" : done ? "bg-[#1c8b3c] text-white" : "bg-ink/10"}`}>{done ? "✓" : n}</span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      <FormMessage state={state} />
      {stepError && <div role="alert" className="alert alert-error">{stepError}</div>}

      {/* ───────── PASSO 1: escolher produtos ───────── */}
      <div hidden={step !== 1}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-labelledby="s1-title">
            <h2 id="s1-title" className="h-display text-3xl text-navy">1. O que vai ser vendido?</h2>
            <p className="mb-4 text-sm text-muted">Toque em <strong>Adicionar</strong> para cada abadá. Cada abadá é de uma pessoa — os dados dos donos vêm no próximo passo.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {products.map((p) => {
                const qty = countOf(p.id);
                const max = limitOf(p);
                const full = qty >= max || lines.length >= MAX_LINES;
                return (
                  <article key={p.id} className={`card-flat flex flex-col overflow-hidden ${qty ? "!border-2 !border-[#1c8b3c]" : ""}`}>
                    <div className="bg-rauten relative grid h-36 place-items-center border-b border-ink/20">
                      {p.lotName && <span className="badge badge-yellow absolute left-2 top-2 !border-ink !text-ink">{p.lotName}</span>}
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} className="h-28 w-auto object-contain" />
                      ) : (
                        <ShirtArt color={p.shirtColor} stripe={p.stripeColor} className="h-28 w-auto" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="h-display text-2xl text-navy">{p.name}</h3>
                      {p.description && <p className="line-clamp-2 text-xs text-muted">{p.description}</p>}
                      <p className="text-xs font-bold text-muted">Tamanhos {p.sizes.join(" · ")}{p.allowBabyLook ? " · Baby Look" : ""}{p.remaining !== null ? ` · restam ${p.remaining}` : ""}</p>
                      <p className="h-display text-3xl text-red">{brl(p.priceCents)}</p>
                      <div className="mt-auto flex items-center gap-2">
                        {qty === 0 ? (
                          <button type="button" className="btn btn-red w-full" onClick={() => addLine(p)} disabled={full}>+ Adicionar</button>
                        ) : (
                          <div className="flex w-full items-center justify-between rounded-xl border-2 border-ink bg-white p-1">
                            <button type="button" aria-label={`Tirar um ${p.name}`} className="btn btn-sm btn-white !min-h-9 !w-10 !px-0" onClick={() => removeLastOf(p.id)}>−</button>
                            <span className="h-display text-2xl" aria-live="polite">{qty}</span>
                            <button type="button" aria-label={`Adicionar mais um ${p.name}`} className="btn btn-sm btn-red !min-h-9 !w-10 !px-0" onClick={() => addLine(p)} disabled={full}>+</button>
                          </div>
                        )}
                      </div>
                      {full && qty > 0 && <p className="text-xs font-bold text-red-dark">Limite atingido ({max}).</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* carrinho */}
          <aside className="h-fit lg:sticky lg:top-24">
            <div className="card space-y-3 p-5">
              <h2 className="h-display text-2xl text-navy">Resumo da venda</h2>
              {lines.length === 0 ? (
                <p className="rounded-lg bg-cream p-3 text-sm text-muted">Nenhum abadá ainda. Escolha ao lado.</p>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {lines.map((l, idx) => {
                    const p = productOf(l.productId);
                    const changed = priceChanged(l);
                    const perr = lineProblems[l.key]?.price;
                    return (
                      <li key={l.key} className="space-y-1.5 py-3 first:pt-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-extrabold">Abadá {idx + 1} · {p.name}</p>
                            {l.editPrice ? null : (
                              <p className="text-sm">
                                {changed && <span className="mr-1 text-muted line-through">{brl(p.priceCents)}</span>}
                                <strong className={changed ? "text-[#a35f00]" : ""}>{brl(effectiveCents(l))}</strong>
                                {changed && <span className="badge badge-yellow ml-2">preço alterado</span>}
                              </p>
                            )}
                          </div>
                          <button type="button" className="text-sm font-bold text-red-dark underline" aria-label={`Remover abadá ${idx + 1}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>Remover</button>
                        </div>
                        {l.editPrice ? (
                          <div className="rounded-lg bg-cream p-2.5">
                            <label className="label" htmlFor={`pr-${l.key}`}>Preço deste abadá (R$)</label>
                            <div className="flex items-center gap-2">
                              <input
                                id={`pr-${l.key}`}
                                inputMode="decimal"
                                autoFocus
                                onFocus={(ev) => ev.target.select()}
                                className="input !min-h-9 max-w-32"
                                placeholder={(p.priceCents / 100).toFixed(2).replace(".", ",")}
                                value={l.price}
                                onChange={(ev) => update(l.key, { price: ev.target.value.replace(/[^\d.,]/g, "") })}
                                aria-invalid={!!perr || undefined}
                              />
                              <button type="button" className="text-sm font-bold text-blue underline" onClick={() => update(l.key, { price: "", editPrice: false })}>Voltar ao preço de tabela</button>
                            </div>
                            {perr && <p className="error-text">{perr}</p>}
                            <button type="button" className="btn btn-sm btn-white mt-2" onClick={() => update(l.key, { editPrice: false })} disabled={!!perr}>OK</button>
                          </div>
                        ) : (
                          <button type="button" className="text-sm font-bold text-blue underline" onClick={() => update(l.key, { editPrice: true, price: l.price || (p.priceCents / 100).toFixed(2).replace(".", ",") })}>✎ Editar preço</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex items-end justify-between border-t-2 border-ink/10 pt-3">
                <span className="font-extrabold">Total</span>
                <span className="h-display text-4xl text-red">{brl(total)}</span>
              </div>
              <button type="button" className="btn btn-red w-full" onClick={() => goTo(2)} disabled={lines.length === 0}>Continuar → Dados dos donos</button>
            </div>
          </aside>
        </div>
      </div>

      {/* ───────── PASSO 2: dados dos donos ───────── */}
      <div hidden={step !== 2} className="space-y-4">
        <div>
          <h2 className="h-display text-3xl text-navy">2. Quem vai usar cada abadá?</h2>
          <p className="text-sm text-muted">Preencha os dados do <strong>dono</strong> de cada abadá. Não é preciso cadastrar quem vai pagar.</p>
        </div>
        {lines.map((l, idx) => {
          const p = productOf(l.productId);
          const lp = lineProblems[l.key] ?? {};
          const err = (k: string) => e[`i${l.key}_${k}`] ?? (showErrors ? lp[k] : undefined);
          const birth = parseBirthDate(l.ownerBirthDate);
          const minor = !!birth && ageOn(birth) < 18;
          const blOk = p.allowBabyLook && (BABY_LOOK_SIZES as readonly string[]).includes(l.size);
          const k = l.key;
          return (
            <section key={k} className={`card-flat space-y-4 p-5 ${Object.keys(e).some((x) => x.startsWith(`i${k}_`)) ? "!border-2 !border-red" : ""}`}>
              <input type="hidden" name={`i${k}_productId`} value={l.productId} />
              <input type="hidden" name={`i${k}_price`} value={l.price} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="h-display text-2xl text-navy">Abadá {idx + 1} <span className="text-base text-muted">· {p.name}</span></h3>
                <span className="font-extrabold text-red">{brl(effectiveCents(l))}{priceChanged(l) && <span className="badge badge-yellow ml-2">preço alterado</span>}</span>
              </div>
              {err("productId") && <p className="error-text">{err("productId")}</p>}
              {err("price") && <p className="error-text">{err("price")}</p>}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`n${k}`} label="Nome completo do dono" error={err("ownerName")}>
                  <input id={`n${k}`} name={`i${k}_ownerName`} className="input" autoComplete="off" value={l.ownerName} onChange={(ev) => update(k, { ownerName: ev.target.value })} aria-invalid={!!err("ownerName") || undefined} />
                </Field>
                <Field id={`c${k}`} label="CPF do dono" error={err("ownerCpf")}>
                  <input id={`c${k}`} name={`i${k}_ownerCpf`} className="input" inputMode="numeric" placeholder="000.000.000-00" autoComplete="off" value={l.ownerCpf} onChange={(ev) => update(k, { ownerCpf: applyMask("cpf", ev.target.value) })} aria-invalid={!!err("ownerCpf") || undefined} />
                </Field>
                <Field id={`b${k}`} label="Data de nascimento" error={err("ownerBirthDate")}>
                  <input id={`b${k}`} name={`i${k}_ownerBirthDate`} type="date" className="input" value={l.ownerBirthDate} onChange={(ev) => update(k, { ownerBirthDate: ev.target.value })} aria-invalid={!!err("ownerBirthDate") || undefined} />
                </Field>
                <div>
                  <p className="label" id={`sz${k}`}>Tamanho</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`sz${k}`}>
                    {p.sizes.map((s) => (
                      <label key={s} className={`cursor-pointer rounded-lg border-2 px-3 py-1.5 text-sm font-extrabold ${l.size === s ? "border-ink bg-navy text-white" : "border-ink/30 bg-white"}`}>
                        <input type="radio" className="sr-only" name={`i${k}_size`} value={s} checked={l.size === s} onChange={() => update(k, { size: s, babyLook: l.babyLook && (BABY_LOOK_SIZES as readonly string[]).includes(s) })} />
                        {s}
                      </label>
                    ))}
                  </div>
                  {err("size") && <p className="error-text">{err("size")}</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className={`flex items-center gap-2 font-bold ${blOk ? "" : "text-muted"}`}>
                  <input type="checkbox" name={`i${k}_babyLook`} disabled={!blOk} checked={l.babyLook && blOk} onChange={(ev) => update(k, { babyLook: ev.target.checked })} className="h-5 w-5 accent-red" />
                  Baby Look {!p.allowBabyLook ? "(não disponível neste modelo)" : !blOk ? "(escolha um tamanho PP a GG)" : ""}
                </label>
                {organizer && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={`i${k}_allowDup`} checked={l.allowDup} onChange={(ev) => update(k, { allowDup: ev.target.checked })} className="h-4 w-4 accent-red" />
                    Liberar nome repetido (homônimo)
                  </label>
                )}
              </div>
              {err("babyLook") && <p className="error-text">{err("babyLook")}</p>}

              {minor && (
                <div className="space-y-3 rounded-lg border-2 border-[#c9961a] bg-[#fff8e0] p-3 text-sm">
                  <p className="font-extrabold">Dono menor de 18 anos — responsável legal</p>
                  <Field id={`g${k}`} label="Nome completo do responsável" error={err("guardianName")}>
                    <input id={`g${k}`} name={`i${k}_guardianName`} className="input" value={l.guardianName} onChange={(ev) => update(k, { guardianName: ev.target.value })} />
                  </Field>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" name={`i${k}_guardianConfirm`} checked={l.guardianConfirm} onChange={(ev) => update(k, { guardianConfirm: ev.target.checked })} className="mt-1 h-5 w-5 accent-red" />
                    O responsável legal autorizou a compra e o uso dos dados do menor.
                  </label>
                  {err("guardianConfirm") && <p className="error-text">{err("guardianConfirm")}</p>}
                </div>
              )}
            </section>
          );
        })}
        <div className="flex flex-wrap justify-between gap-3">
          <button type="button" className="btn btn-white" onClick={() => goTo(1)}>← Voltar</button>
          <button type="button" className="btn btn-red" onClick={() => goTo(3)}>Continuar → Pagamento</button>
        </div>
      </div>

      {/* ───────── PASSO 3: pagamento e revisão ───────── */}
      <div hidden={step !== 3} className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="space-y-5">
          {isExt ? (
            <>
              <div>
                <h2 className="h-display text-3xl text-navy">3. Como esta venda foi paga?</h2>
                <p className="text-sm text-muted">A venda será lançada <strong>já como paga</strong> e os abadás ficam prontos para entrega. Nenhum link é gerado.</p>
              </div>
              <fieldset>
                <legend className="sr-only">Como foi pago</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {EXTERNAL_OPTIONS.map((o) => (
                    <label key={o.v} className={`cursor-pointer rounded-xl border-2 p-3 ${extMethod === o.v ? "border-ink bg-[#fff4d6] shadow-[0_3px_0_var(--color-ink)]" : "border-ink/25 bg-white"}`}>
                      <input type="radio" className="sr-only" aria-label={o.t} checked={extMethod === o.v} onChange={() => setExtMethod(o.v)} />
                      <span className="block font-extrabold">{o.t}</span>
                      <span className="block text-xs text-muted">{o.d}</span>
                    </label>
                  ))}
                </div>
                {(e.externalMethod || (triedSubmit && !extMethod)) && <p className="error-text">{e.externalMethod ?? "Escolha como a venda foi paga."}</p>}
              </fieldset>
              <div className="field">
                <label htmlFor="notes">Observação (opcional)</label>
                <input id="notes" name="notes" className="input" maxLength={300} placeholder="Ex.: recebido por Fulano em 25/11; comprovante enviado" value={notes} onChange={(ev) => setNotes(ev.target.value)} />
              </div>
              <input type="hidden" name="holdMinutes" value="30" />
            </>
          ) : (
            <>
          <div>
            <h2 className="h-display text-3xl text-navy">3. Como a pessoa vai pagar?</h2>
            <p className="text-sm text-muted">Vamos gerar um link do Mercado Pago. Você copia e envia para quem vai pagar.</p>
          </div>

          <fieldset>
            <legend className="sr-only">Forma de pagamento</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { v: "ALL", t: "Pix ou cartão", d: "A pessoa escolhe na hora" },
                { v: "PIX", t: "Somente Pix", d: "Aprovação imediata" },
                { v: "CARD", t: "Somente cartão", d: "Crédito ou débito" },
              ].map((o) => (
                <label key={o.v} className={`cursor-pointer rounded-xl border-2 p-3 ${payMethods === o.v ? "border-ink bg-[#fff4d6] shadow-[0_3px_0_var(--color-ink)]" : "border-ink/25 bg-white"}`}>
                  <input type="radio" className="sr-only" aria-label={o.t} checked={payMethods === o.v} onChange={() => setPayMethods(o.v)} />
                  <span className="block font-extrabold">{o.t}</span>
                  <span className="block text-xs text-muted">{o.d}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="holdMinutes">Reservar os abadás por</label>
              <select id="holdMinutes" name="holdMinutes" className="input" value={hold} onChange={(ev) => setHold(ev.target.value)}>
                <option value="30">30 minutos</option>
                <option value="120">2 horas</option>
                <option value="1440">24 horas</option>
                {organizer && <option value="4320">3 dias</option>}
              </select>
              <p className="hint">Sem pagamento nesse prazo, o pedido expira e os dados são liberados.</p>
            </div>
            <div className="field">
              <label htmlFor="notes">Observação interna (opcional)</label>
              <input id="notes" name="notes" className="input" maxLength={300} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
            </div>
          </div>

            </>
          )}

          {anyChanged && (
            <div className={`rounded-xl border-2 p-4 ${reasonMissing && triedSubmit ? "border-red bg-[#fff1f1]" : "border-[#c9961a] bg-[#fff8e0]"}`}>
              <p className="font-extrabold">Você alterou o preço de {lines.filter(priceChanged).length} abadá(s)</p>
              <div className="field mt-2">
                <label htmlFor="priceReason">Motivo da alteração (obrigatório)</label>
                <input id="priceReason" name="priceReason" className="input" maxLength={200} placeholder="Ex.: desconto combinado com a organização" value={reason} onChange={(ev) => setReason(ev.target.value)} aria-invalid={(reasonMissing && triedSubmit) || !!e.priceReason || undefined} />
                {(e.priceReason || (reasonMissing && triedSubmit)) && <p className="error-text">{e.priceReason ?? "Informe o motivo da alteração de preço."}</p>}
                <p className="hint">Fica registrado no pedido e na auditoria.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="h-fit lg:sticky lg:top-24">
          <div className="card space-y-3 p-5">
            <h2 className="h-display text-2xl text-navy">Confira a venda</h2>
            <ul className="divide-y divide-ink/10 text-sm">
              {lines.map((l, idx) => (
                <li key={l.key} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                  <span><strong>{l.ownerName || `Abadá ${idx + 1}`}</strong><br /><span className="text-muted">{productOf(l.productId).name} · tam. {l.size || "—"}{l.babyLook ? " · Baby Look" : ""}</span></span>
                  <span className="whitespace-nowrap font-bold">{brl(effectiveCents(l))}{priceChanged(l) && <span className="block text-xs font-normal text-muted line-through">{brl(productOf(l.productId).priceCents)}</span>}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-end justify-between border-t-2 border-ink/10 pt-3">
              <span className="font-extrabold">Total</span>
              <span className="h-display text-4xl text-red">{brl(total)}</span>
            </div>
            <p className="text-xs text-muted">O sistema bloqueia CPF e nome repetidos, inclusive de compras já feitas.</p>
            {isExt && extMethod && <p className="rounded-lg bg-[#e7f6ea] p-2 text-xs font-bold text-[#0f5a25]">Será lançada como paga em: {EXTERNAL_OPTIONS.find((o) => o.v === extMethod)?.t}.</p>}
            <SubmitButton pending={isExt ? "Lançando venda…" : "Gerando link…"} className="btn btn-red w-full">{isExt ? "Lançar venda como paga" : "Gerar link de pagamento"}</SubmitButton>
            <button type="button" className="btn btn-white w-full" onClick={() => goTo(2)}>← Voltar e revisar os donos</button>
          </div>
        </aside>
      </div>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}
