import Link from "next/link";
import type { ProductWithAvailability } from "@/lib/orders";
import { brl } from "@/lib/format";
import { ShirtArt } from "./shirt-art";

export { ShirtArt };

export function ProductCard({ p, compact }: { p: ProductWithAvailability; compact?: boolean }) {
  const low = p.remaining !== null && p.remaining > 0 && p.remaining <= 20;
  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="bg-rauten relative grid place-items-center border-b-2 border-ink px-6 py-6">
        {p.lotName && (
          <span className="badge badge-yellow absolute left-3 top-3 !border-ink !text-ink">{p.lotName}</span>
        )}
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.name} className="h-44 w-auto object-contain drop-shadow-lg" />
        ) : (
          <ShirtArt color={p.shirtColor} stripe={p.stripeColor} className="floaty h-44 w-auto drop-shadow-[0_8px_0_rgba(0,0,0,.25)]" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="h-display text-3xl text-navy">{p.name}</h3>
        {!compact && p.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{p.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-extrabold">
          <span className="badge badge-blue">Tamanhos {p.sizes.join(" · ")}</span>
          {p.allowBabyLook && <span className="badge badge-blue">Baby Look</span>}
          {low && <span className="badge badge-red">Últimas {p.remaining}!</span>}
        </div>
        <div className="mt-auto pt-5">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted">Valor por abadá</p>
          <p className="h-display text-4xl text-red">{brl(p.priceCents)}</p>
          {p.available ? (
            <Link href={`/loja/${p.slug}`} className="btn btn-red mt-3 w-full">
              Comprar agora
            </Link>
          ) : (
            <span className="btn btn-white mt-3 w-full" aria-disabled="true">
              {p.soldOut ? "Esgotado" : p.notStarted ? "Vendas em breve" : "Vendas encerradas"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
