import { Bunting } from "./ui";

export function PageHero({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="bg-rauten border-b-4 border-ink text-white">
      <div className="container-page py-12 sm:py-16">
        {eyebrow && <p className="eyebrow !text-beer !text-3xl">{eyebrow}</p>}
        <h1 className="h-display outlined text-5xl sm:text-7xl">{title}</h1>
        {children && <p className="mt-4 max-w-2xl text-lg text-white/90">{children}</p>}
      </div>
      <Bunting />
    </section>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PageHero title={title}>Versão {updated}</PageHero>
      <article className="container-page prose-tb max-w-3xl py-12">{children}</article>
    </>
  );
}
