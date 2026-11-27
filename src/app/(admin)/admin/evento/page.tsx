import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { fmtTime, toLocalInput, weekdayLong } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/content";
import { deleteScheduleItemAction, saveEventAction, saveScheduleItemAction } from "@/app/actions/admin-content";
import { ConfirmSubmit } from "@/components/client";
import { AdminTitle, Panel } from "@/components/admin-ui";
import type { Event, ScheduleItem } from "@prisma/client";

export const metadata: Metadata = { title: "Evento e programação" };
export const dynamic = "force-dynamic";

export default async function EventoAdmin({ searchParams }: { searchParams: Promise<{ e?: string; msg?: string; err?: string; novo?: string }> }) {
  await requirePermission("events.manage");
  const sp = await searchParams;
  const events = await db.event.findMany({ orderBy: { startsAt: "desc" } });
  const selected = sp.novo ? null : events.find((e) => e.id === sp.e) ?? events.find((e) => e.isCurrent) ?? events[0] ?? null;
  const items = selected ? await db.scheduleItem.findMany({ where: { eventId: selected.id }, orderBy: { startsAt: "asc" } }) : [];

  return (
    <>
      <AdminTitle title="Evento e programação" action={<Link href="/admin/evento?novo=1" className="btn btn-sm btn-red">+ Novo evento</Link>}>
        Datas do Kerb (usadas na contagem regressiva), retirada do abadá e a programação exibida no site.
      </AdminTitle>
      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      {sp.err && <div role="alert" className="alert alert-error mb-4">{sp.err}</div>}

      <nav aria-label="Eventos" className="mb-5 flex flex-wrap gap-2">
        {events.map((e) => <Link key={e.id} href={`/admin/evento?e=${e.id}`} className={`btn btn-sm ${selected?.id === e.id ? "btn-blue" : "btn-white"}`}>{e.name}{e.isCurrent ? " ★" : ""}</Link>)}
      </nav>

      <Panel title={selected ? "Dados do evento" : "Novo evento"} className="mb-6"><EventForm event={selected} /></Panel>

      {selected && (
        <Panel title="Programação">
          <ul className="mb-6 space-y-3">
            {items.map((s) => (
              <li key={s.id}>
                <details className="rounded-xl border-2 border-ink/15 bg-white">
                  <summary className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <span><strong>{fmtTime(s.startsAt)}</strong> <span className="capitalize text-muted">· {weekdayLong(s.startsAt)}</span> — {s.title}</span>
                    <span className="flex gap-2"><span className="badge badge-blue">{CATEGORY_LABEL[s.category] ?? s.category}</span>{!s.published && <span className="badge badge-gray">rascunho</span>}</span>
                  </summary>
                  <div className="border-t-2 border-ink/10 p-3">
                    <ScheduleForm eventId={selected.id} item={s} />
                    <form action={deleteScheduleItemAction} className="mt-2"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="eventId" value={selected.id} /><ConfirmSubmit message="Remover este item da programação?" className="btn btn-sm btn-ghost !text-red-dark">Remover</ConfirmSubmit></form>
                  </div>
                </details>
              </li>
            ))}
            {!items.length && <li className="text-sm text-muted">Nenhum item cadastrado.</li>}
          </ul>
          <h3 className="h-display mb-2 text-xl text-navy">Adicionar item</h3>
          <ScheduleForm eventId={selected.id} />
        </Panel>
      )}
    </>
  );
}

function EventForm({ event }: { event: Event | null }) {
  const e = event;
  return (
    <form action={saveEventAction} className="grid gap-4 sm:grid-cols-2">
      {e && <input type="hidden" name="id" value={e.id} />}
      <F label="Nome do evento" name="name" v={e?.name ?? `Kerbfest Ipira ${new Date().getFullYear() + 1}`} />
      <F label="Ano" name="year" v={String(e?.year ?? new Date().getFullYear() + 1)} />
      <F label="Início (horário de Brasília)" name="startsAt" type="datetime-local" v={e ? toLocalInput(e.startsAt) : ""} />
      <F label="Fim" name="endsAt" type="datetime-local" v={e ? toLocalInput(e.endsAt) : ""} />
      <F label="Cidade" name="city" v={e?.city ?? "Ipira - SC"} />
      <F label="Local" name="location" v={e?.location ?? ""} req={false} />
      <div className="field sm:col-span-2"><label>Descrição (opcional)</label><textarea name="description" rows={2} className="input" defaultValue={e?.description ?? ""} /></div>
      <div className="field sm:col-span-2"><label>Retirada do abadá (local, dias, horários)</label><textarea name="pickupInfo" rows={3} className="input" defaultValue={e?.pickupInfo ?? ""} placeholder="Aparece na confirmação por WhatsApp e no site." /></div>
      <div className="flex flex-wrap gap-6 sm:col-span-2">
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="published" defaultChecked={e?.published ?? true} className="h-5 w-5 accent-red" /> Publicado</label>
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="isCurrent" defaultChecked={e?.isCurrent ?? true} className="h-5 w-5 accent-red" /> Evento atual (vende e mostra no site)</label>
      </div>
      <div className="sm:col-span-2"><button className="btn btn-red">Salvar evento</button></div>
    </form>
  );
}

function ScheduleForm({ eventId, item }: { eventId: string; item?: ScheduleItem }) {
  return (
    <form action={saveScheduleItemAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="eventId" value={eventId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="lg:col-span-2"><F label="Título" name="title" v={item?.title ?? ""} /></div>
      <F label="Início" name="startsAt" type="datetime-local" v={item ? toLocalInput(item.startsAt) : ""} />
      <F label="Fim (opcional)" name="endsAt" type="datetime-local" v={item?.endsAt ? toLocalInput(item.endsAt) : ""} req={false} />
      <F label="Local" name="location" v={item?.location ?? ""} req={false} />
      <div className="field"><label>Categoria</label>
        <select name="category" className="input" defaultValue={item?.category ?? "festa"}>{Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="lg:col-span-2"><F label="Descrição" name="description" v={item?.description ?? ""} req={false} /></div>
      <label className="flex items-center gap-2 self-end font-bold"><input type="checkbox" name="published" defaultChecked={item?.published ?? true} className="h-5 w-5 accent-red" /> Publicado</label>
      <div className="self-end"><button className="btn btn-sm btn-blue">{item ? "Salvar item" : "Adicionar"}</button></div>
    </form>
  );
}

function F({ label, name, v, type = "text", req = true }: { label: string; name: string; v?: string; type?: string; req?: boolean }) {
  return <div className="field"><label>{label}</label><input name={name} type={type} defaultValue={v ?? ""} required={req} className="input" /></div>;
}
