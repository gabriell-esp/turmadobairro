import type { Metadata } from "next";
import { requirePermission, can } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { isSalesOpen } from "@/lib/settings";
import { getProductsWithAvailability } from "@/lib/orders";
import { AdminTitle, Empty } from "@/components/admin-ui";
import { ManualSaleForm } from "@/components/manual-sale-form";

export const metadata: Metadata = { title: "Nova venda" };
export const dynamic = "force-dynamic";

export default async function NovaVenda({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const sp = await searchParams;
  const user = await requirePermission("sales.create");
  if (!can(user, "sales.create_frozen") && !(await isSalesOpen())) {
    return (
      <>
        <AdminTitle title="Nova venda">Geração de links de pagamento.</AdminTitle>
        <div role="alert" className="alert alert-error text-base">
          <strong>Vendas congeladas.</strong> Os gestores pausaram as vendas de abadás. Somente eles conseguem fazer vendas manuais agora — fale com um organizador para liberar.
        </div>
      </>
    );
  }
  const event = await getCurrentEvent();
  const products = event ? (await getProductsWithAvailability(event.id)).filter((p) => !p.soldOut) : [];
  return (
    <>
      <AdminTitle title="Nova venda">Escolha os abadás, informe quem vai usar cada um e gere o link de pagamento — ou lance uma venda que já foi paga por fora.</AdminTitle>
      {products.length === 0 ? <Empty>Nenhum produto disponível para venda.</Empty> : (
        <ManualSaleForm
          organizer={can(user, "orders.all")}
          canExternal={can(user, "sales.external")}
          initialMode={sp.modo === "externa" ? "EXTERNAL" : "LINK"}
          products={products.map((p) => ({ id: p.id, name: p.name, lotName: p.lotName, description: p.description, priceCents: p.priceCents, sizes: p.sizes, allowBabyLook: p.allowBabyLook, remaining: p.remaining, maxPerOrder: p.maxPerOrder, imageUrl: p.imageUrl, shirtColor: p.shirtColor, stripeColor: p.stripeColor }))}
        />
      )}
    </>
  );
}
