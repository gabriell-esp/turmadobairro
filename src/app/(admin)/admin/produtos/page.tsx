import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { brl, toLocalInput } from "@/lib/format";
import { SIZES } from "@/lib/validators";
import { deleteProductAction, saveProductAction } from "@/app/actions/admin-content";
import { ConfirmSubmit } from "@/components/client";
import { ShirtDesigner } from "@/components/shirt-designer";
import { AdminTitle, Panel } from "@/components/admin-ui";
import type { Event, Product } from "@prisma/client";

export const metadata: Metadata = { title: "Produtos" };
export const dynamic = "force-dynamic";

export default async function ProdutosAdmin({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePermission("products.manage");
  const sp = await searchParams;
  const [products, events, sold] = await Promise.all([
    db.product.findMany({ orderBy: [{ eventId: "asc" }, { sortOrder: "asc" }], include: { event: true } }),
    db.event.findMany({ orderBy: { startsAt: "desc" } }),
    db.orderItem.groupBy({ by: ["productId"], where: { active: true }, _count: { _all: true } }),
  ]);
  const soldMap = new Map(sold.map((s) => [s.productId, s._count._all]));
  return (
    <>
      <AdminTitle title="Produtos (abadás)">Modelos, lotes, preços e estoque. Alterar o preço não muda pedidos já feitos.</AdminTitle>
      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      {sp.err && <div role="alert" className="alert alert-error mb-4">{sp.err}</div>}

      <div className="space-y-4">
        {products.map((p) => (
          <details key={p.id} className="card-flat">
            <summary className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span><span className="h-display text-2xl text-navy">{p.name}</span> {p.lotName && <span className="badge badge-yellow ml-1">{p.lotName}</span>} {!p.active && <span className="badge badge-gray ml-1">inativo</span>}<span className="block text-xs text-muted">{p.event.name}</span></span>
              <span className="text-right text-sm"><strong className="h-display text-2xl text-red">{brl(p.priceCents)}</strong><br />{soldMap.get(p.id) ?? 0} vendido(s){p.stock != null ? ` / ${p.stock}` : ""}</span>
            </summary>
            <div className="border-t-2 border-ink/10 p-4">
              <ProductForm product={p} events={events} />
              <form action={deleteProductAction} className="mt-3"><input type="hidden" name="id" value={p.id} /><ConfirmSubmit message="Excluir este produto? (só é possível se não houver vendas)" className="btn btn-sm btn-ghost !text-red-dark">Excluir produto</ConfirmSubmit></form>
            </div>
          </details>
        ))}
      </div>

      <Panel title="Novo produto" className="mt-8"><ProductForm events={events} /></Panel>
    </>
  );
}

function ProductForm({ product, events }: { product?: Product; events: Event[] }) {
  const p = product;
  return (
    <form action={saveProductAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <F label="Nome" name="name" v={p?.name} required />
      <F label="Preço por abadá (R$)" name="price" v={p ? (p.priceCents / 100).toFixed(2).replace(".", ",") : ""} required />
      <F label="Lote (ex.: 1º lote)" name="lotName" v={p?.lotName ?? ""} />
      <F label="Estoque (vazio = ilimitado)" name="stock" v={p?.stock?.toString() ?? ""} />
      <F label="Máx. por compra" name="maxPerOrder" v={String(p?.maxPerOrder ?? 10)} required />
      <F label="Ordem de exibição" name="sortOrder" v={String(p?.sortOrder ?? 0)} />
      <div className="field"><label>Evento</label>
        <select name="eventId" className="input" defaultValue={p?.eventId ?? events.find((e) => e.isCurrent)?.id ?? events[0]?.id} required>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select></div>
      <F label="Início das vendas" name="saleStartsAt" type="datetime-local" v={p?.saleStartsAt ? toLocalInput(p.saleStartsAt) : ""} />
      <F label="Fim das vendas" name="saleEndsAt" type="datetime-local" v={p?.saleEndsAt ? toLocalInput(p.saleEndsAt) : ""} />
      <div className="field sm:col-span-2 lg:col-span-3"><label>Descrição</label><textarea name="description" rows={2} maxLength={600} defaultValue={p?.description ?? ""} className="input" /></div>
      <fieldset className="sm:col-span-2 lg:col-span-3">
        <legend className="label">Tamanhos disponíveis</legend>
        <div className="flex flex-wrap gap-3">
          {SIZES.map((s) => <label key={s} className="flex items-center gap-1.5 font-bold"><input type="checkbox" name={`size_${s}`} defaultChecked={p ? p.sizes.includes(s) : s !== "XXG"} className="h-4 w-4 accent-red" /> {s}</label>)}
        </div>
      </fieldset>
      <ShirtDesigner currentImageUrl={p?.imageUrl} color={p?.shirtColor} stripe={p?.stripeColor} />
      <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-3">
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="allowBabyLook" defaultChecked={p?.allowBabyLook ?? true} className="h-5 w-5 accent-red" /> Tem Baby Look</label>
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-5 w-5 accent-red" /> Ativo na loja</label>
      </div>
      <div className="sm:col-span-2 lg:col-span-3"><button className="btn btn-red">{p ? "Salvar alterações" : "Criar produto"}</button></div>
    </form>
  );
}

function F({ label, name, v, type = "text", required }: { label: string; name: string; v?: string; type?: string; required?: boolean }) {
  return <div className="field"><label>{label}</label><input name={name} type={type} defaultValue={v ?? ""} required={required} className="input" /></div>;
}
