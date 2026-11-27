import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { PageHero } from "@/components/page-shell";

export default async function MinhaContaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/minha-conta");
  const tabs = [
    ["/minha-conta", "Meu perfil"],
    ["/minha-conta/pedidos", "Meus pedidos"],
    ["/minha-conta/privacidade", "Privacidade e dados"],
  ];
  return (
    <>
      <PageHero eyebrow="Área do integrante" title={`Olá, ${user.name.split(" ")[0]}!`} />
      <section className="container-page py-10">
        <nav aria-label="Conta" className="mb-8 flex flex-wrap items-center gap-2">
          {tabs.map(([href, label]) => (
            <Link key={href} href={href} className="btn btn-sm btn-white">{label}</Link>
          ))}
          <form action={logoutAction} className="ml-auto">
            <button className="btn btn-sm btn-ghost !text-red-dark">Sair</button>
          </form>
        </nav>
        {children}
      </section>
    </>
  );
}
