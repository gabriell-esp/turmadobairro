import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getCurrentEvent } from "@/lib/event";
import { FAQ_ITEMS, STEPS } from "@/lib/content";
import { PageHero } from "@/components/page-shell";
import { Faq, LinkButton, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Como funciona", description: "Cadastro, compra do abadá, pagamento, confirmação por WhatsApp e retirada: entenda o passo a passo." };
export const dynamic = "force-dynamic";

export default async function ComoFuncionaPage() {
  const [settings, event] = await Promise.all([getSettings(), getCurrentEvent()]);
  const pickup = event?.pickupInfo?.trim() || settings.pickup_text;
  return (
    <>
      <PageHero eyebrow="Simples e seguro" title="Como funciona">
        Tudo o que você precisa saber para fazer parte da Turma neste Kerb.
      </PageHero>

      <section className="container-page py-16">
        <SectionTitle eyebrow="Passo a passo" title="Do cadastro ao Kerb" />
        <ol className="grid gap-6 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="card flex gap-4 p-6">
              <span className="h-display grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-ink bg-beer text-3xl">{s.n}</span>
              <div>
                <h3 className="h-display text-2xl text-navy">{s.title}</h3>
                <p className="mt-1 leading-relaxed text-ink/80">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y-4 border-ink bg-cream py-16">
        <div className="container-page grid gap-8 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Regras do abadá" title="Importante saber" />
            <ul className="space-y-3 text-lg">
              {[
                "Cada abadá pertence a uma pessoa: informe nome completo, CPF, data de nascimento, tamanho e se é Baby Look.",
                "Um mesmo CPF ou nome não pode ter dois abadás no mesmo Kerb — o sistema bloqueia dados repetidos, inclusive de compras já feitas.",
                "Você pode comprar vários abadás de uma vez (família e amigos): preencha os dados do dono de cada um.",
                "Menores de 18 anos precisam de um responsável legal informado na compra.",
                "O abadá é pessoal e vinculado ao dono cadastrado. Revenda não autorizada pode ser bloqueada pela organização.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 h-3 w-3 shrink-0 rotate-45 border-2 border-ink bg-red" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-7">
            <h3 className="h-display text-3xl text-navy">Retirada do abadá</h3>
            <p className="mt-3 whitespace-pre-line text-lg leading-relaxed text-ink/85">{pickup}</p>
            <p className="mt-4 text-sm text-muted">Leve um documento com foto e o número do pedido (ex.: TB-00123).</p>
          </div>
        </div>
      </section>

      <section id="faq" className="container-page max-w-4xl scroll-mt-32 py-16">
        <SectionTitle eyebrow="Tire suas dúvidas" title="Perguntas frequentes" center />
        <Faq items={FAQ_ITEMS} />
        <div className="mt-10 text-center">
          <LinkButton href="/loja" variant="red">Comprar meu abadá</LinkButton>
        </div>
      </section>
    </>
  );
}
