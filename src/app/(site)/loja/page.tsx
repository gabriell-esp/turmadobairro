import type { Metadata } from "next";
import { getCurrentEvent } from "@/lib/event";
import { getProductsWithAvailability } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { PageHero } from "@/components/page-shell";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = { title: "Abadás", description: "Compre o abadá oficial da Turma do Bairro para o Kerb de Ipira." };
export const dynamic = "force-dynamic";

export default async function LojaPage() {
  const [event, settings] = await Promise.all([getCurrentEvent(), getSettings()]);
  const products = event ? await getProductsWithAvailability(event.id) : [];
  const open = settings.sales_open !== "false";
  return (
    <>
      <PageHero eyebrow="Loja oficial" title="Abadás">
        {event ? `${event.name} — escolha o modelo, informe o dono de cada abadá e pague com Pix ou cartão.` : "Os abadás do próximo Kerb serão anunciados em breve."}
      </PageHero>
      <section className="container-page py-14">
        {!open ? (
          <p className="card mx-auto max-w-xl p-8 text-center text-lg font-bold">As vendas estão temporariamente fechadas. Volte em breve!</p>
        ) : products.length === 0 ? (
          <p className="card mx-auto max-w-xl p-8 text-center text-lg font-bold">Nenhum abadá disponível no momento.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-8">
            {products.map((p) => (
              <div key={p.id} className="w-full sm:w-[21rem]"><ProductCard p={p} /></div>
            ))}
          </div>
        )}
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border-2 border-ink bg-cream p-6 text-sm leading-relaxed">
          <p className="h-display mb-1 text-2xl text-navy">Antes de comprar</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Você pode comprar vários abadás, informando os dados do dono de cada um.</li>
            <li>Não é possível repetir CPF ou nome já usado neste Kerb.</li>
            <li>Após finalizar, o pedido fica reservado por alguns minutos para você pagar.</li>
            <li>A confirmação chega por WhatsApp quando o pagamento é aprovado.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
