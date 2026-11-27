import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, ShieldCheck, Users, MessageCircle, Beer, Music2, Landmark } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { getProductsWithAvailability } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtTime, weekdayLong } from "@/lib/format";
import { ABOUT_TEXT, CATEGORY_LABEL, FAQ_ITEMS, STEPS } from "@/lib/content";
import { Countdown } from "@/components/client";
import { Bunting, Faq, LinkButton, Logo, SectionTitle } from "@/components/ui";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const event = await getCurrentEvent();
  const [products, schedule, gallery, settings] = await Promise.all([
    event ? getProductsWithAvailability(event.id) : Promise.resolve([]),
    event
      ? db.scheduleItem.findMany({ where: { eventId: event.id, published: true }, orderBy: { startsAt: "asc" }, take: 6 })
      : Promise.resolve([]),
    db.galleryImage.findMany({ where: { published: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 8 }),
    getSettings(),
  ]);
  const salesOpen = settings.sales_open !== "false";
  const years = new Date().getFullYear() - 2008;

  return (
    <>
      {/* HERO */}
      <section className="bg-rauten relative overflow-hidden border-b-4 border-ink text-white">
        <div className="container-page grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="eyebrow !text-beer !text-3xl">{years} anos de tradição e alegria</p>
            <h1 className="h-display outlined mt-2 text-5xl leading-[.95] sm:text-7xl">
              A alma do
              <br />
              Kerbfest de Ipira
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/90">
              O bloco mais tradicional do Kerb. Música, chope e diversão sem fim — com mais de 500 membros na rua desde 2008.
            </p>

            {event ? (
              <>
                <div className="mt-6 flex flex-wrap gap-2 text-sm font-extrabold">
                  <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-navy">
                    <CalendarDays size={16} aria-hidden /> {fmtDate(event.startsAt, { day: "2-digit", month: "long" })} a{" "}
                    {fmtDate(event.endsAt, { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-navy">
                    <MapPin size={16} aria-hidden /> {event.city}
                  </span>
                </div>
                <p className="mt-6 text-sm font-extrabold uppercase tracking-widest text-beer">Faltam para o {event.name}</p>
                <div className="mt-2">
                  <Countdown target={event.startsAt.toISOString()} />
                </div>
              </>
            ) : (
              <p className="mt-6 rounded-xl border-2 border-ink bg-white/90 p-4 font-bold text-navy">
                As datas do próximo Kerb serão divulgadas em breve. Siga @turmado_bairro!
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {salesOpen && <LinkButton href="/loja" variant="red">Garantir meu abadá</LinkButton>}
              <LinkButton href="/programacao" variant="white">Ver programação</LinkButton>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-6 rounded-full bg-beer/30 blur-3xl" aria-hidden />
            <Image
              src="/logo.png"
              alt="Logotipo da Turma do Bairro, Kerb Ipira, desde 2008"
              width={900}
              height={785}
              priority
              className="floaty relative h-auto w-full drop-shadow-[0_18px_0_rgba(0,0,0,.25)]"
            />
          </div>
        </div>
        <Bunting />
      </section>

      {/* FAIXA */}
      <section aria-label="Destaques" className="bg-red text-white">
        <ul className="container-page grid grid-cols-2 gap-3 py-5 text-center sm:grid-cols-4">
          {[
            [Landmark, "Desde 2008", "18 anos de história"],
            [Users, "+ 500 membros", "a maior família do Kerb"],
            [Music2, "Música alemã", "e muita animação"],
            [Beer, "Chope", "e diversão sem fim"],
          ].map(([Icon, t, s]) => {
            const I = Icon as typeof Users;
            return (
              <li key={t as string} className="flex flex-col items-center gap-1">
                <I size={26} aria-hidden />
                <span className="h-display text-xl">{t as string}</span>
                <span className="text-xs font-bold text-white/85">{s as string}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ABADÁS */}
      <section className="container-page pt-16" id="abadas">
        <SectionTitle eyebrow="Vista a camisa da Turma" title="Escolha o seu abadá" center>
          Compre pelo site, pague com Pix ou cartão e receba a confirmação no WhatsApp.
        </SectionTitle>
        {!salesOpen ? (
          <p className="card mx-auto max-w-xl p-6 text-center font-bold">As vendas estão temporariamente fechadas. Volte em breve!</p>
        ) : products.length ? (
          <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-8">
            {products.map((p) => (
              <div key={p.id} className="w-full sm:w-[21rem]"><ProductCard p={p} /></div>
            ))}
          </div>
        ) : (
          <p className="card mx-auto max-w-xl p-6 text-center font-bold">Os abadás deste ano serão anunciados em breve.</p>
        )}
      </section>

      {/* SOBRE */}
      <section className="container-page grid items-center gap-10 pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="bg-rauten-red card order-2 p-8 text-white lg:order-1">
          <Logo size={260} className="mx-auto h-auto w-56" />
          <p className="mt-4 text-center text-xl font-extrabold">“É parte da tradição centenária do Kerb de Ipira.”</p>
        </div>
        <div className="order-1 lg:order-2">
          <SectionTitle eyebrow="Venha para a maior festa do Kerb" title="Muito mais que um bloco" />
          <p className="text-xl font-bold leading-snug text-navy">{ABOUT_TEXT.lead}</p>
          <p className="mt-4 leading-relaxed text-ink/85">{ABOUT_TEXT.paragraphs[1]}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/o-bloco" variant="blue">Conheça nossa história</LinkButton>
            <LinkButton href="/como-funciona" variant="gold">Como funciona</LinkButton>
          </div>
        </div>
      </section>

      {/* PROGRAMAÇÃO */}
      <section className="mt-24 border-y-4 border-ink bg-navy py-16 text-white">
        <div className="container-page">
          <SectionTitle eyebrow="Fique por dentro" title="Programação do Kerb" light>
            {event ? `${event.name} — confira os horários e não perca nada.` : "A programação será publicada em breve."}
          </SectionTitle>
          {schedule.length ? (
            <div className="overflow-hidden rounded-2xl border-2 border-white/30 bg-white/5">
              <ul className="divide-y divide-white/15">
                {schedule.map((s) => (
                  <li key={s.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:gap-6">
                    <div>
                      <p className="h-display text-2xl text-beer">{fmtTime(s.startsAt)}</p>
                      <p className="text-xs font-bold capitalize text-white/75">{weekdayLong(s.startsAt)}</p>
                    </div>
                    <div>
                      <p className="text-lg font-extrabold">{s.title}</p>
                      {s.location && <p className="text-sm text-white/75">{s.location}</p>}
                    </div>
                    <span className="badge badge-yellow !border-ink !text-ink w-fit">{CATEGORY_LABEL[s.category] ?? s.category}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl border-2 border-white/30 p-6 text-center font-bold text-white/90">
              Programação em breve. Siga @turmado_bairro para ser avisado primeiro!
            </p>
          )}
          <div className="mt-8 text-center">
            <LinkButton href="/programacao" variant="gold">Programação completa</LinkButton>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="container-page pt-24">
        <SectionTitle eyebrow="Simples e seguro" title="Como funciona" center>
          Do cadastro à retirada do abadá, em poucos passos.
        </SectionTitle>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="card relative p-6 pt-8">
              <span className="h-display absolute -top-5 left-5 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-beer text-2xl text-ink">
                {s.n}
              </span>
              <h3 className="h-display text-2xl text-navy">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* POR QUE */}
      <section className="container-page pt-24">
        <SectionTitle eyebrow="Por que a Turma?" title="Tradição que você sente" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Landmark, "Desde 2008", "Quase duas décadas fazendo história no Kerb de Ipira. Somos o bloco mais tradicional da festa."],
            [Users, "Uma família de verdade", "Mais de 500 membros que se reencontram a cada ano. Aqui todo mundo é da Turma."],
            [ShieldCheck, "Compra segura", "Pagamento via Mercado Pago (Pix e cartão). Seus dados protegidos conforme a LGPD."],
            [MessageCircle, "Confirmação no WhatsApp", "Pagou? Você recebe a confirmação com todos os detalhes do pedido e da retirada."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Users;
            return (
              <div key={t as string} className="card-flat p-6">
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-beer">
                  <I size={24} aria-hidden />
                </span>
                <h3 className="h-display text-2xl text-navy">{t as string}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/80">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* GALERIA */}
      {gallery.length > 0 && (
        <section className="container-page pt-24">
          <SectionTitle eyebrow="Momentos da Turma" title="Galeria" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {gallery.map((g) => (
              <figure key={g.id} className="overflow-hidden rounded-xl border-2 border-ink">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url} alt={g.caption ?? "Foto da Turma do Bairro"} loading="lazy" className="aspect-square w-full object-cover" />
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="container-page max-w-4xl pt-24">
        <SectionTitle eyebrow="Tire suas dúvidas" title="Perguntas frequentes" center />
        <Faq items={FAQ_ITEMS.slice(0, 5)} />
        <p className="mt-6 text-center">
          <Link href="/como-funciona#faq" className="font-extrabold text-blue underline">
            Ver todas as perguntas
          </Link>
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="container-page pt-24">
        <div className="bg-rauten card overflow-hidden p-10 text-center text-white sm:p-14">
          <p className="eyebrow !text-beer !text-3xl">Prost! 🍻</p>
          <h2 className="h-display outlined mx-auto mt-2 max-w-3xl text-4xl sm:text-6xl">Junte-se à Turma do Bairro</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
            Mais um capítulo vibrante na história do Kerb de Ipira está sendo escrito. Faça parte!
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/cadastrar" variant="gold">Criar meu cadastro</LinkButton>
            <LinkButton href="/loja" variant="red">Comprar abadá</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
