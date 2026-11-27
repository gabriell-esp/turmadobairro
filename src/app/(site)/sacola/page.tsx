import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { brl, fmtBirth } from "@/lib/format";
import { ageOn, formatPhone, maskCpf, onlyDigits } from "@/lib/validators";
import { HOLD_MINUTES } from "@/lib/orders";
import { PageHero } from "@/components/page-shell";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = { title: "Minha sacola", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SacolaPage({ searchParams }: { searchParams: Promise<{ adicionado?: string }> }) {
  const user = await requireUser("/sacola");
  const sp = await searchParams;
  const cart = await db.cart.findUnique({
    where: { userId: user.id },
    include: { items: { orderBy: { createdAt: "asc" }, include: { product: true } } },
  });
  const items = cart?.items ?? [];
  const total = items.reduce((s, i) => s + i.product.priceCents, 0);

  return (
    <>
      <PageHero title="Minha sacola" />
      <section className="container-page py-12">
        {sp.adicionado && items.length > 0 && <div role="status" className="alert alert-ok mb-6">Abadá adicionado à sacola! Adicione outros ou finalize a compra.</div>}
        {items.length === 0 ? (
          <div className="card mx-auto max-w-xl p-10 text-center">
            <p className="h-display text-4xl text-navy">Sua sacola está vazia</p>
            <p className="mt-2 text-muted">Escolha um abadá e informe o dono para começar.</p>
            <Link href="/loja" className="btn btn-red mt-6">Ver abadás</Link>
          </div>
        ) : (
          <CartView
            holdMinutes={HOLD_MINUTES}
            phone={formatPhone(user.phone)}
            totalLabel={brl(total)}
            lines={items.map((i) => ({
              id: i.id,
              productName: i.product.name,
              priceLabel: brl(i.product.priceCents),
              ownerName: i.ownerName,
              cpfMasked: maskCpf(onlyDigits(decrypt(i.ownerCpfEnc))),
              birth: fmtBirth(i.ownerBirthDate),
              size: i.size,
              babyLook: i.babyLook,
              minor: ageOn(i.ownerBirthDate) < 18,
            }))}
          />
        )}
      </section>
    </>
  );
}
