import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { can, requirePermission } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { orderSearchWhere } from "@/lib/admin-search";
import { fmtDateTime, orderCode } from "@/lib/format";
import { maskCpf } from "@/lib/validators";
import { decrypt } from "@/lib/crypto";
import { markDeliveredAction } from "@/app/actions/admin-orders";
import { AdminTitle, Empty, Kpi, Pagination } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Retirada de abadás" };
export const dynamic = "force-dynamic";

const PER_PAGE = 50;
type Filter = "pendentes" | "entregues" | "todos";
const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
/** Primeira letra sem acento, para separar a lista (Á → A). */
const letterOf = (name: string) => (name.trim().normalize("NFD").replace(/[̀-ͯ]/g, "")[0] ?? "#").toUpperCase();

export default async function Retirada({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; p?: string; msg?: string; err?: string }> }) {
  const user = await requirePermission("delivery.mark");
  const sp = await searchParams;
  const filter: Filter = sp.f === "entregues" || sp.f === "todos" ? sp.f : "pendentes";
  const page = Math.max(1, Number(sp.p) || 1);
  const event = await getCurrentEvent();
  const base = { eventId: event?.id, active: true, order: { status: "PAID" as const } };

  const [total, delivered] = await Promise.all([
    db.orderItem.count({ where: base }),
    db.orderItem.count({ where: { ...base, deliveredAt: { not: null } } }),
  ]);
  const pending = total - delivered;

  const search = sp.q ? orderSearchWhere(sp.q) : null;
  const all = await db.orderItem.findMany({
    where: {
      ...base,
      ...(filter === "pendentes" ? { deliveredAt: null } : filter === "entregues" ? { deliveredAt: { not: null } } : {}),
      ...(search ? { order: { status: "PAID" as const, AND: [search] } } : {}),
    },
    include: { order: true, product: true },
  });
  // Ordem alfabética (pt-BR, ignora acentos e maiúsculas); desempate pelo código do pedido
  all.sort((a, b) => collator.compare(a.ownerName, b.ownerName) || a.order.number - b.order.number);

  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const current = Math.min(page, pages);
  const items = all.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const qs = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = { q: sp.q, f: filter === "pendentes" ? undefined : filter, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return `/admin/retirada${s ? `?${s}` : ""}`;
  };
  const returnTo = qs({ p: current > 1 ? String(current) : undefined });

  const tabs: { f: Filter; label: string; n: number }[] = [
    { f: "pendentes", label: "A entregar", n: pending },
    { f: "entregues", label: "Entregues", n: delivered },
    { f: "todos", label: "Todos", n: total },
  ];

  return (
    <>
      <AdminTitle
        title="Retirada de abadás"
        action={can(user, "sales.external") ? <Link href="/admin/vendas/nova?modo=externa" className="btn btn-sm btn-gold">+ Lançar venda feita por fora</Link> : undefined}
      >
        Lista de abadás pagos em ordem alfabética. Marque a entrega de quem retirar. Pagou em dinheiro ou por fora? Use “Lançar venda feita por fora”.
      </AdminTitle>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Kpi label="Abadás pagos" value={String(total)} />
        <Kpi label="Entregues" value={String(delivered)} tone="green" />
        <Kpi label="A entregar" value={String(pending)} tone="gold" />
      </div>
      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      {sp.err && <div role="alert" className="alert alert-error mb-4">{sp.err}</div>}

      <nav aria-label="Filtro da lista" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.f}
            href={`/admin/retirada${(() => { const q = new URLSearchParams(); if (sp.q) q.set("q", sp.q); if (t.f !== "pendentes") q.set("f", t.f); const s = q.toString(); return s ? `?${s}` : ""; })()}`}
            aria-current={filter === t.f ? "page" : undefined}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-extrabold ${filter === t.f ? "border-ink bg-navy text-white" : "border-ink/25 bg-white"}`}
          >
            {t.label} <span className={filter === t.f ? "text-gold" : "text-muted"}>({t.n})</span>
          </Link>
        ))}
      </nav>

      <form role="search" className="card-flat mb-6 flex flex-wrap items-end gap-3 p-4">
        {filter !== "pendentes" && <input type="hidden" name="f" value={filter} />}
        <div className="min-w-64 flex-1">
          <label htmlFor="q" className="label">Procurar na lista</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Nome, CPF, TB-00012 ou WhatsApp" className="input" />
        </div>
        <button className="btn btn-blue">Buscar</button>
        {sp.q && <Link href={qs({ q: undefined })} className="btn btn-white">Limpar</Link>}
      </form>

      {all.length === 0 ? (
        <Empty>
          {sp.q
            ? `Nenhum abadá encontrado para “${sp.q}” neste filtro.`
            : filter === "pendentes"
              ? total === 0 ? "Ainda não há abadás pagos." : "Tudo entregue! Não há abadás pendentes."
              : "Nenhum abadá nesta lista."}
        </Empty>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">
            {all.length} {all.length === 1 ? "abadá" : "abadás"} · ordem alfabética · mostrando {(current - 1) * PER_PAGE + 1}–{(current - 1) * PER_PAGE + items.length}
          </p>
          <div className="card-flat overflow-x-auto">
            <table className="table">
              <thead><tr><th>Dono do abadá</th><th>CPF</th><th>Modelo / tamanho</th><th>Pedido</th><th>Entrega</th></tr></thead>
              <tbody>
                {items.map((i, idx) => {
                  const letter = letterOf(i.ownerName);
                  const newLetter = idx === 0 || letterOf(items[idx - 1].ownerName) !== letter;
                  return [
                    newLetter && (
                      <tr key={`l-${i.id}`} className="bg-cream">
                        <td colSpan={5} className="h-display !py-1 text-xl text-navy" id={`letra-${letter}-${current}`}>{letter}</td>
                      </tr>
                    ),
                    <tr key={i.id} className={i.deliveredAt ? "bg-[#f3fbf4]" : ""}>
                      <td className="font-bold">{i.ownerName}</td>
                      <td className="whitespace-nowrap">{maskCpf(decrypt(i.ownerCpfEnc))}</td>
                      <td>{i.product.name} · <strong>{i.size}</strong>{i.babyLook ? " · Baby Look" : ""}</td>
                      <td>
                        <Link href={`/admin/pedidos/${i.orderId}`} className="font-bold text-blue underline">{orderCode(i.order.number)}</Link>
                        {i.order.paymentMethod?.includes("por fora") && <span className="badge badge-yellow ml-1">por fora</span>}
                      </td>
                      <td>
                        <form action={markDeliveredAction}>
                          <input type="hidden" name="itemId" value={i.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <input type="hidden" name="deliver" value={i.deliveredAt ? "0" : "1"} />
                          {i.deliveredAt
                            ? <button className="badge badge-green" title="Desfazer entrega">Entregue {fmtDateTime(i.deliveredAt)} ✕</button>
                            : <button className="btn btn-sm btn-gold">Entregar</button>}
                        </form>
                      </td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={current} pages={pages} params={{ q: sp.q, f: filter === "pendentes" ? undefined : filter }} base="/admin/retirada" />
        </>
      )}
      <p className="mt-3 text-xs text-muted">Confira um documento com foto antes de entregar.</p>
    </>
  );
}
