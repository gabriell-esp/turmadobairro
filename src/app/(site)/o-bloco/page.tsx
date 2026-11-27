import type { Metadata } from "next";
import { Logo } from "@/components/ui";
import { LinkButton } from "@/components/ui";
import { PageHero } from "@/components/page-shell";
import { ABOUT_TEXT } from "@/lib/content";

export const metadata: Metadata = { title: "O Bloco", description: "Turma do Bairro: 18 anos de tradição e alegria no Kerbfest de Ipira (SC)." };

export default function OBlocoPage() {
  const years = new Date().getFullYear() - 2008;
  return (
    <>
      <PageHero eyebrow={`${years} anos de tradição e alegria`} title="Turma do Bairro">
        A alma pulsante do Kerb de Ipira — fundada em 2008 e fazendo história desde então.
      </PageHero>

      <section className="container-page grid gap-12 py-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5 text-lg leading-relaxed text-ink/90">
          <p className="text-2xl font-bold leading-snug text-navy">{ABOUT_TEXT.lead}</p>
          {ABOUT_TEXT.paragraphs.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
          <p className="rounded-2xl border-2 border-ink bg-cream p-6 font-semibold text-navy">{ABOUT_TEXT.closing}</p>
        </div>

        <aside className="space-y-6">
          <div className="bg-rauten card p-8 text-center text-white">
            <Logo size={300} className="mx-auto h-auto w-60" />
          </div>
          <dl className="card grid grid-cols-2 gap-4 p-6 text-center">
            {[
              ["2008", "ano de fundação"],
              [`${years}`, "anos de Kerb"],
              ["+600", "membros na família"],
              ["1", "só objetivo: festa!"],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="h-display text-4xl text-red">{n}</dt>
                <dd className="text-xs font-extrabold uppercase tracking-wider text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="container-page pb-4">
        <div className="bg-rauten-red card p-10 text-center text-white">
          <h2 className="h-display outlined text-4xl sm:text-5xl">Faça parte da nossa história</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">Crie seu cadastro, garanta o abadá e venha escrever o próximo capítulo com a Turma.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LinkButton href="/cadastrar" variant="gold">Criar cadastro</LinkButton>
            <LinkButton href="/loja" variant="white">Ver abadás</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
