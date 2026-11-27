"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * Gaveta (menu) para celular: abre por cima da página, com fundo escurecido.
 * Fecha ao tocar no fundo, em "X", com Esc, ao tocar num link e ao mudar de página.
 * Trava a rolagem da página por trás e mantém o foco do teclado dentro dela.
 * O conteúdo (children) vem do servidor, então pode ter links, formulários e ícones à vontade.
 */
export function MobileDrawer({
  label = "Abrir menu",
  title,
  side = "right",
  tone = "light",
  triggerClassName = "btn btn-sm btn-gold h-11 w-11 px-0",
  children,
}: {
  label?: string;
  title: string;
  side?: "left" | "right";
  tone?: "light" | "dark";
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const id = useId();
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(
        (el) => el.offsetParent !== null,
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Se a tela virar "grande" (celular girado / janela redimensionada), o menu lateral some.
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && setOpen(false);

    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      trigger?.focus();
    };
  }, [open]);

  const dark = tone === "dark";
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(true)}
      >
        <Menu size={22} aria-hidden />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[70]">
            <div className="drawer-backdrop absolute inset-0 bg-ink/60" onClick={close} aria-hidden />
            <div
              ref={panelRef}
              id={id}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className={`drawer-panel drawer-${side} absolute inset-y-0 flex w-[min(88vw,22rem)] flex-col border-ink ${
                side === "right" ? "right-0 border-l-4" : "left-0 border-r-4"
              } ${dark ? "bg-navy text-white" : "bg-foam text-ink"}`}
            >
              <div className={`flex items-center justify-between gap-3 border-b-2 px-4 py-2.5 ${dark ? "border-white/15" : "border-ink/10"}`}>
                <span className="h-display text-2xl">{title}</span>
                <button
                  type="button"
                  data-autofocus
                  onClick={close}
                  aria-label="Fechar menu"
                  className={`grid h-11 w-11 place-items-center rounded-lg border-2 ${dark ? "border-white/40 hover:bg-white/10" : "border-ink hover:bg-cream"}`}
                >
                  <X size={22} aria-hidden />
                </button>
              </div>
              <div
                className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"
                style={{ paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a[href]")) close();
                }}
              >
                {children}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
