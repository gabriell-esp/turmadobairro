import Link from "next/link";

export function AdminTitle({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h-display text-4xl text-navy">{title}</h1>
        {children && <p className="mt-1 text-sm text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kpi({ label, value, sub, tone = "navy" }: { label: string; value: string; sub?: string; tone?: "navy" | "red" | "green" | "gold" }) {
  const color = { navy: "text-navy", red: "text-red", green: "text-[#0f6a2c]", gold: "text-[#8a5a00]" }[tone];
  return (
    <div className="card-flat p-4">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{label}</p>
      <p className={`h-display mt-1 text-4xl ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Panel({ title, children, className = "", action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`card-flat p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="h-display text-2xl text-navy">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Pagination({ page, pages, params, base }: { page: number; pages: number; params: Record<string, string | undefined>; base: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("p", String(p));
    return `${base}?${q}`;
  };
  return (
    <nav aria-label="Paginação" className="mt-4 flex items-center justify-center gap-3 text-sm font-bold">
      {page > 1 && <Link className="btn btn-sm btn-white" href={href(page - 1)}>← Anterior</Link>}
      <span>Página {page} de {pages}</span>
      {page < pages && <Link className="btn btn-sm btn-white" href={href(page + 1)}>Próxima →</Link>}
    </nav>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border-2 border-dashed border-ink/20 p-8 text-center text-muted">{children}</p>;
}

export function PermissionNotice({ searchParams }: { searchParams: { erro?: string } }) {
  return searchParams.erro === "permissao" ? (
    <div role="alert" className="alert alert-error mb-4">Você não tem permissão para acessar essa área.</div>
  ) : null;
}
