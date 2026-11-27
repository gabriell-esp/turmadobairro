import Image from "next/image";
import Link from "next/link";

export function Logo({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Turma do Bairro — Kerb Ipira, desde 2008"
      width={size}
      height={Math.round(size * 0.872)}
      priority
      className={className}
    />
  );
}

export const Bunting = ({ className = "" }: { className?: string }) => (
  <div aria-hidden className={`bunting w-full ${className}`} />
);

export function SectionTitle({
  eyebrow,
  title,
  light,
  center,
  children,
}: {
  eyebrow?: string;
  title: string;
  light?: boolean;
  center?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`mb-8 ${center ? "text-center" : ""}`}>
      {eyebrow && <p className={`eyebrow ${light ? "!text-beer" : ""}`}>{eyebrow}</p>}
      <h2 className={`h-display text-3xl sm:text-5xl ${light ? "text-white" : "text-navy"}`}>{title}</h2>
      {children && <p className={`mt-3 max-w-2xl text-lg ${center ? "mx-auto" : ""} ${light ? "text-white/85" : "text-muted"}`}>{children}</p>}
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className="divide-y-2 divide-ink/10 overflow-hidden rounded-2xl border-2 border-ink bg-white">
      {items.map((it) => (
        <details key={it.q} className="group">
          <summary className="flex items-center justify-between gap-4 px-5 py-4 text-left text-lg font-extrabold text-navy hover:bg-cream">
            {it.q}
            <svg className="chev h-5 w-5 shrink-0 transition" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="px-5 pb-5 text-[1.02rem] leading-relaxed text-ink/85">{it.a}</div>
        </details>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    PENDING: ["badge-yellow", "Aguardando pagamento"],
    PAID: ["badge-green", "Pago"],
    CANCELLED: ["badge-gray", "Cancelado"],
    EXPIRED: ["badge-gray", "Expirado"],
    REFUNDED: ["badge-red", "Reembolsado"],
    QUEUED: ["badge-yellow", "Na fila"],
    SENT: ["badge-green", "Enviada"],
    FAILED: ["badge-red", "Falhou"],
  };
  const [cls, label] = map[status] ?? ["badge-gray", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function LinkButton({
  href,
  children,
  variant = "red",
  className = "",
  small,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "red" | "gold" | "white" | "blue" | "ghost";
  className?: string;
  small?: boolean;
}) {
  return (
    <Link href={href} className={`btn btn-${variant} ${small ? "btn-sm" : ""} ${className}`}>
      {children}
    </Link>
  );
}
