"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pending: pendingLabel = "Aguarde…",
  className = "btn btn-red",
  disabled,
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ConfirmSubmit({
  children,
  message,
  className = "btn btn-sm btn-white",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function FormMessage({ state }: { state?: { ok?: boolean; error?: string; message?: string } | null }) {
  if (!state) return null;
  if (state.error)
    return (
      <div role="alert" className="alert alert-error">
        {state.error}
      </div>
    );
  if (state.ok && state.message)
    return (
      <div role="status" className="alert alert-ok">
        {state.message}
      </div>
    );
  return null;
}

export function FieldError({ errors, name }: { errors?: Record<string, string>; name: string }) {
  const msg = errors?.[name];
  return msg ? (
    <p className="error-text" role="alert">
      {msg}
    </p>
  ) : null;
}

export function Countdown({ target, light = true }: { target: string; light?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = now == null ? null : Math.max(0, new Date(target).getTime() - now);
  const parts =
    diff == null
      ? ["--", "--", "--", "--"]
      : [
          Math.floor(diff / 86400000),
          Math.floor((diff / 3600000) % 24),
          Math.floor((diff / 60000) % 60),
          Math.floor((diff / 1000) % 60),
        ].map((n) => String(n).padStart(2, "0"));
  const labels = ["dias", "horas", "min", "seg"];
  return (
    <div className="flex gap-2 sm:gap-3" role="timer" aria-label="Contagem regressiva para o Kerb">
      {parts.map((p, i) => (
        <div
          key={labels[i]}
          className={`min-w-[4.2rem] rounded-xl border-2 border-ink px-2 py-2 text-center shadow-[0_4px_0_var(--color-ink)] sm:min-w-[5.4rem] ${light ? "bg-white text-navy" : "bg-navy text-white"}`}
        >
          <div className="h-display text-3xl tabular-nums sm:text-5xl">{p}</div>
          <div className="text-[.65rem] font-extrabold uppercase tracking-widest text-red">{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}

export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("tb_cookie_ack")) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  return (
    <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="card mx-auto flex max-w-3xl flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <p className="text-sm leading-snug text-ink/90">
          Usamos apenas <strong>cookies essenciais</strong> (para manter você conectado e a sacola funcionando). Não usamos
          cookies de publicidade nem rastreamento. Saiba mais na{" "}
          <a className="font-bold text-blue underline" href="/cookies">
            Política de Cookies
          </a>
          .
        </p>
        <button
          className="btn btn-sm btn-gold shrink-0"
          onClick={() => {
            try {
              localStorage.setItem("tb_cookie_ack", "1");
            } catch {}
            setShow(false);
          }}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

/** Máscaras simples para inputs (CPF e telefone). */
export function MaskedInput({
  mask,
  defaultValue = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & { mask: "cpf" | "phone" }) {
  const [value, setValue] = useState(() => apply(mask, defaultValue as string));
  return (
    <input
      {...props}
      className={props.className ?? "input"}
      value={value}
      inputMode="numeric"
      onChange={(e) => setValue(apply(mask, e.target.value))}
    />
  );
}

export function applyMask(mask: "cpf" | "phone", v: string) {
  return apply(mask, v);
}

function apply(mask: "cpf" | "phone", v: string) {
  const d = v.replace(/\D/g, "");
  if (mask === "cpf") {
    return d
      .slice(0, 11)
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  const n = d.slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

export function CopyButton({ text, label = "Copiar link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm btn-white"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copie o link:", text);
        }
      }}
    >
      {done ? "Copiado ✔" : label}
    </button>
  );
}
