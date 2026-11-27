import Link from "next/link";
import { ShoppingBag, User, Instagram, Menu, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Bunting, Logo } from "./ui";

const NAV = [
  { href: "/o-bloco", label: "O Bloco" },
  { href: "/programacao", label: "Programação" },
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/loja", label: "Abadás" },
  { href: "/contato", label: "Contato" },
];

export async function SiteHeader() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const cartCount = user ? await db.cartItem.count({ where: { cart: { userId: user.id } } }) : 0;

  return (
    <header className="sticky top-0 z-40 border-b-4 border-ink bg-white/95 backdrop-blur">
      <div className="bg-navy text-white">
        <div className="container-page flex items-center justify-between gap-3 py-1.5 text-xs font-bold sm:text-sm">
          <span className="truncate">🍻 Kerbfest de Ipira · Santa Catarina · desde 2008</span>
          <a
            href={settings.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 hover:text-beer"
          >
            <Instagram size={15} aria-hidden /> @turmado_bairro
          </a>
        </div>
      </div>
      <div className="container-page flex items-center justify-between gap-4 py-2">
        <Link href="/" aria-label="Turma do Bairro — página inicial" className="shrink-0">
          <Logo size={86} className="h-auto w-[72px] sm:w-[86px]" />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="h-display rounded-lg px-3 py-2 text-lg tracking-wide text-navy hover:bg-cream hover:text-red"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user && isStaff(user) && (
            <Link href="/admin" className="btn btn-sm btn-blue hidden sm:inline-flex">
              Painel
            </Link>
          )}
          <Link
            href={user ? "/minha-conta" : "/entrar"}
            className="btn btn-sm btn-white"
            aria-label={user ? "Minha conta" : "Entrar"}
          >
            <User size={16} aria-hidden />
            <span className="hidden sm:inline">{user ? user.name.split(" ")[0] : "Entrar"}</span>
          </Link>
          <Link href="/sacola" className="btn btn-sm btn-red relative" aria-label={`Sacola (${cartCount} itens)`}>
            <ShoppingBag size={16} aria-hidden />
            <span className="hidden sm:inline">Sacola</span>
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-ink bg-beer px-1 text-xs font-black text-ink">
                {cartCount}
              </span>
            )}
          </Link>

          <details className="relative lg:hidden">
            <summary className="btn btn-sm btn-gold" aria-label="Abrir menu">
              <Menu size={18} aria-hidden />
            </summary>
            <nav aria-label="Menu móvel" className="card absolute right-0 mt-3 w-60 p-2">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="h-display block rounded-lg px-3 py-3 text-lg text-navy hover:bg-cream">
                  {n.label}
                </Link>
              ))}
              {user && isStaff(user) && (
                <Link href="/admin" className="h-display block rounded-lg px-3 py-3 text-lg text-blue hover:bg-cream">
                  Painel
                </Link>
              )}
            </nav>
          </details>
        </div>
      </div>
      <Bunting className="-mb-[2px]" />
    </header>
  );
}

export async function SiteFooter() {
  const settings = await getSettings();
  const wa = settings.whatsapp_contact.replace(/\D/g, "");
  return (
    <footer className="mt-24 bg-navy text-white">
      <div className="bg-rauten h-3" />
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo size={150} className="h-auto w-[140px]" />
          <p className="mt-4 text-sm text-white/75">A alma do Kerbfest de Ipira (SC). Música, chope e diversão desde 2008. Prost! 🍻</p>
          <div className="mt-4 flex gap-2">
            <a
              href={settings.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram da Turma do Bairro"
              className="grid h-10 w-10 place-items-center rounded-full border-2 border-white/60 hover:bg-white/15"
            >
              <Instagram size={18} />
            </a>
            {wa && (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp da Turma do Bairro"
                className="grid h-10 w-10 place-items-center rounded-full border-2 border-white/60 hover:bg-white/15"
              >
                <MessageCircle size={18} />
              </a>
            )}
          </div>
        </div>
        <FooterCol
          title="O bloco"
          links={[
            ["/o-bloco", "Nossa história"],
            ["/programacao", "Programação"],
            ["/como-funciona", "Como funciona"],
            ["/contato", "Fale com a gente"],
          ]}
        />
        <FooterCol
          title="Abadás"
          links={[
            ["/loja", "Comprar abadá"],
            ["/sacola", "Minha sacola"],
            ["/minha-conta", "Minha conta"],
            ["/minha-conta/pedidos", "Meus pedidos"],
          ]}
        />
        <FooterCol
          title="Privacidade (LGPD)"
          links={[
            ["/privacidade", "Política de Privacidade"],
            ["/termos", "Termos de Uso e Venda"],
            ["/cookies", "Política de Cookies"],
            ["/contato#lgpd", "Direitos do titular"],
          ]}
        />
      </div>
      <div className="border-t border-white/15 py-5 text-center text-xs text-white/65">
        <div className="container-page">
          © 2008–{new Date().getFullYear()} Turma do Bairro · Kerb de Ipira/SC. Venda e consumo de bebida alcoólica proibidos para menores de
          18 anos. Beba com moderação.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title}>
      <h3 className="h-display mb-3 text-xl text-beer">{title}</h3>
      <ul className="space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-white/85 hover:text-white hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
