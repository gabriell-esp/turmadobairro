import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProductsWithAvailability } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { brl, fmtDateTime } from "@/lib/format";
import { maskCpf } from "@/lib/validators";
import { decrypt } from "@/lib/crypto";
import { OwnerForm } from "@/components/owner-form";
import { ShirtArt } from "@/components/product-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Abadá — ${slug.replace(/-/g, " ")}` };
}

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [all, user, settings] = await Promise.all([getProductsWithAvailability(), getCurrentUser(), getSettings()]);
  const p = all.find((x) => x.slug === slug);
  if (!p) notFound();
  const open = settings.sales_open !== "false";
  const canBuy = open && p.available;
  const canSelf = !!(user?.cpfEnc && user.birthDate);

  return (
    <section className="container-page py-10">
      <nav aria-label="Trilha" className="mb-6 text-sm font-bold">
        <Link href="/loja" className="text-blue underline">Abadás</Link> <span aria-hidden>›</span> {p.name}
      </nav>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="card h-fit overflow-hidden lg:sticky lg:top-40">
          <div className="bg-rauten grid place-items-center border-b-2 border-ink p-8">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={p.name} className="h-64 w-auto object-contain" />
            ) : (
              <ShirtArt color={p.shirtColor} stripe={p.stripeColor} className="h-64 w-auto drop-shadow-[0_10px_0_rgba(0,0,0,.25)]" />
            )}
          </div>
          <div className="p-6">
            {p.lotName && <span className="badge badge-yellow mb-2">{p.lotName}</span>}
            <h1 className="h-display text-4xl text-navy">{p.name}</h1>
            {p.description && <p className="mt-2 text-ink/80">{p.description}</p>}
            <p className="h-display mt-4 text-5xl text-red">{brl(p.priceCents)}</p>
            <p className="text-xs font-bold text-muted">por abadá · Pix ou cartão em até {process.env.MP_MAX_INSTALLMENTS ?? 6}x</p>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="font-bold">Tamanhos</dt><dd>{p.sizes.join(", ")}</dd></div>
              <div className="flex justify-between"><dt className="font-bold">Baby Look</dt><dd>{p.allowBabyLook ? "Disponível (PP a GG)" : "Não"}</dd></div>
              {p.remaining !== null && <div className="flex justify-between"><dt className="font-bold">Restam</dt><dd>{p.remaining}</dd></div>}
              {p.saleEndsAt && <div className="flex justify-between"><dt className="font-bold">Vendas até</dt><dd>{fmtDateTime(p.saleEndsAt)}</dd></div>}
            </dl>
          </div>
        </div>

        <div className="card p-6 sm:p-8">
          {!canBuy ? (
            <div className="alert alert-info">
              {!open ? "As vendas estão temporariamente fechadas." : p.soldOut ? "Este abadá esgotou." : p.notStarted ? "As vendas deste lote ainda não começaram." : "As vendas deste lote foram encerradas."}
            </div>
          ) : !user ? (
            <div className="space-y-4 text-center">
              <h2 className="h-display text-3xl text-navy">Entre para comprar</h2>
              <p className="text-ink/80">Para comprar você precisa de um cadastro — ele guarda seus pedidos e agiliza as próximas compras.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href={`/entrar?next=${encodeURIComponent(`/loja/${p.slug}`)}`} className="btn btn-red">Entrar</Link>
                <Link href={`/cadastrar?next=${encodeURIComponent(`/loja/${p.slug}`)}`} className="btn btn-gold">Criar cadastro</Link>
              </div>
            </div>
          ) : (
            <>
              <h2 className="h-display mb-1 text-3xl text-navy">Dados do abadá</h2>
              <p className="mb-5 text-sm text-muted">
                Cada abadá precisa de um dono. Para comprar mais de um, adicione um por vez à sacola — cada um com os seus dados.
              </p>
              <OwnerForm
                product={{ id: p.id, slug: p.slug, sizes: p.sizes, allowBabyLook: p.allowBabyLook }}
                canSelf={canSelf}
                selfLabel={canSelf ? `${user.name.split(" ")[0]} · CPF ${maskCpf(decrypt(user.cpfEnc!))}` : undefined}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
