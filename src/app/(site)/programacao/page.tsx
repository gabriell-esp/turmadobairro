import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Clock, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { fmtDate, fmtTime, weekdayLong } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/content";
import { PageHero } from "@/components/page-shell";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Programação", description: "Horários e atrações do Kerbfest de Ipira com a Turma do Bairro." };
export const dynamic = "force-dynamic";

const dayKey = (d: Date) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export default async function ProgramacaoPage() {
  const event = await getCurrentEvent();
  const items = event
    ? await db.scheduleItem.findMany({ where: { eventId: event.id, published: true }, orderBy: { startsAt: "asc" } })
    : [];

  const days = new Map<string, typeof items>();
  for (const it of items) {
    const k = dayKey(it.startsAt);
    days.set(k, [...(days.get(k) ?? []), it]);
  }

  return (
    <>
      <PageHero eyebrow="Fique por dentro" title="Programação">
        {event
          ? `${event.name} · ${fmtDate(event.startsAt, { day: "2-digit", month: "long" })} a ${fmtDate(event.endsAt, { day: "2-digit", month: "long", year: "numeric" })} · ${event.city}`
          : "A programação do próximo Kerb será divulgada em breve."}
      </PageHero>

      <section className="container-page py-14">
        {event && items.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Dias" className="flex flex-wrap gap-2">
              {[...days.keys()].map((k) => (
                <a key={k} href={`#dia-${k}`} className="btn btn-sm btn-white capitalize">
                  {fmtDate(days.get(k)![0].startsAt, { weekday: "short", day: "2-digit", month: "2-digit" })}
                </a>
              ))}
            </nav>
            <a href="/programacao/calendario.ics" className="btn btn-sm btn-blue">
              <CalendarPlus size={16} aria-hidden /> Adicionar ao calendário
            </a>
          </div>
        )}

        {!items.length ? (
          <div className="card mx-auto max-w-xl p-8 text-center">
            <p className="h-display text-3xl text-navy">Programação em breve</p>
            <p className="mt-2 text-muted">Assim que a organização publicar os horários, eles aparecem aqui. Siga @turmado_bairro no Instagram!</p>
          </div>
        ) : (
          <div className="space-y-10">
            {[...days.entries()].map(([k, list]) => (
              <div key={k} id={`dia-${k}`} className="scroll-mt-40">
                <h2 className="h-display mb-3 text-3xl capitalize text-red sm:text-4xl">{weekdayLong(list[0].startsAt)}</h2>
                <ol className="card divide-y-2 divide-ink/10 overflow-hidden">
                  {list.map((s) => (
                    <li key={s.id} className="grid gap-2 p-5 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-6">
                      <p className="h-display flex items-center gap-2 text-3xl text-navy">
                        <Clock size={20} aria-hidden className="text-red" />
                        {fmtTime(s.startsAt)}
                      </p>
                      <div>
                        <p className="text-xl font-extrabold text-navy">{s.title}</p>
                        {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
                        {s.location && (
                          <p className="mt-1 flex items-center gap-1 text-sm font-bold text-ink/70">
                            <MapPin size={14} aria-hidden /> {s.location}
                          </p>
                        )}
                      </div>
                      <span className="badge badge-blue w-fit">{CATEGORY_LABEL[s.category] ?? s.category}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-muted">
          Horários e locais podem sofrer ajustes — acompanhe nossos avisos no WhatsApp e no Instagram.
        </p>
        <div className="mt-6 text-center">
          <LinkButton href="/loja" variant="red">Garantir meu abadá</LinkButton>{" "}
          <Link href="/como-funciona" className="ml-3 font-extrabold text-blue underline">Como funciona</Link>
        </div>
      </section>
    </>
  );
}
