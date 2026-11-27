import Link from "next/link";
import { ShoppingBag, User, Instagram, MessageCircle, ChevronRight, ClipboardList, LayoutDashboard } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logoutAction } from "@/app/actions/auth";
import { Bunting, Logo } from "./ui";
import { MobileDrawer } from "./drawer";
import { NavLink } from "./nav-link";

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
  const staff = !!user && isStaff(user);
  const wa = settings.whatsapp_contact.replace(/\D/g, "");
  const drawerLink = "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-extrabold text-ink hover:bg-cream";

  return (
    <>
      {/* Faixa de cima: rola junto com a página (no celular, só a barra principal fica fixa, para sobrar tela). */}
      <div className="bg-navy text-white">
        <div className="container-page flex items-center justify-between gap-3 py-1.5 text-xs font-bold sm:text-sm">
          <span className="truncate">
            🍻 Kerbfest de Ipira<span className="hidden sm:inline"> · Santa Catarina</span> · desde 2008
          </span>
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

      <header className="sticky top-0 z-40 border-b-4 border-ink bg-white/95 backdrop-blur">
        <div className="container-page flex items-center justify-between gap-3 py-1.5 sm:py-2">
          <Link href="/" aria-label="Turma do Bairro — página inicial" className="shrink-0">
            <Logo size={86} className="h-auto w-[54px] sm:w-[86px]" />
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.href}
                href={n.href}
                className="h-display rounded-lg px-3 py-2 text-lg tracking-wide text-navy hover:bg-cream hover:text-red"
                activeClassName="bg-cream !text-red"
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {staff && (
              <Link href="/admin" className="btn btn-sm btn-blue hidden sm:inline-flex">
                Painel
              </Link>
            )}
            <Link
              href={user ? "/minha-conta" : "/entrar"}
              className="btn btn-sm btn-white hidden sm:inline-flex"
              aria-label={user ? "Minha conta" : "Entrar"}
            >
              <User size={16} aria-hidden />
              <span>{user ? user.name.split(" ")[0] : "Entrar"}</span>
            </Link>
            <Link
              href="/sacola"
              className="btn btn-sm btn-red relative max-sm:h-11 max-sm:w-11 max-sm:px-0"
              aria-label={`Sacola (${cartCount} ${cartCount === 1 ? "item" : "itens"})`}
            >
              <ShoppingBag size={18} aria-hidden />
              <span className="hidden sm:inline">Sacola</span>
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-ink bg-beer px-1 text-xs font-black text-ink">
                  {cartCount}
                </span>
              )}
            </Link>

            <MobileDrawer title="Menu" side="right" triggerClassName="btn btn-sm btn-gold h-11 w-11 px-0 lg:hidden">
              <nav aria-label="Menu móvel">
                <ul className="space-y-1">
                  {NAV.map((n) => (
                    <li key={n.href}>
                      <NavLink
                        href={n.href}
                        className="h-display flex items-center justify-between rounded-xl px-4 py-3.5 text-2xl tracking-wide text-navy hover:bg-cream"
                        activeClassName="bg-cream !text-red"
                      >
                        {n.label}
                        <ChevronRight size={20} aria-hidden className="text-ink/40" />
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="my-4 border-t-2 border-ink/10" />

              {user ? (
                <div className="space-y-1">
                  <p className="px-4 pb-1 text-xs font-extrabold uppercase tracking-widest text-muted">
                    Olá, {user.name.split(" ")[0]}
                  </p>
                  <Link href="/minha-conta" className={drawerLink}>
                    <User size={18} aria-hidden /> Minha conta
                  </Link>
                  <Link href="/minha-conta/pedidos" className={drawerLink}>
                    <ClipboardList size={18} aria-hidden /> Meus pedidos
                  </Link>
                  <Link href="/sacola" className={drawerLink}>
                    <ShoppingBag size={18} aria-hidden /> Minha sacola
                    {cartCount > 0 && <span className="badge badge-yellow ml-auto">{cartCount}</span>}
                  </Link>
                  {staff && (
                    <Link href="/admin" className={`${drawerLink} !text-blue`}>
                      <LayoutDashboard size={18} aria-hidden /> Painel da equipe
                    </Link>
                  )}
                  <form action={logoutAction} className="pt-2">
                    <button className="btn btn-white w-full">Sair</button>
                  </form>
                </div>
              ) : (
                <div className="space-y-3 px-1">
                  <p className="px-3 text-sm text-muted">Entre ou crie sua conta para comprar o abadá.</p>
                  <Link href="/entrar" className="btn btn-blue w-full">
                    Entrar
                  </Link>
                  <Link href="/cadastrar" className="btn btn-white w-full">
                    Criar conta
                  </Link>
                </div>
              )}

              <div className="my-4 border-t-2 border-ink/10" />
              <div className="flex items-center gap-3 px-3 pb-2">
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram da Turma do Bairro"
                  className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink hover:bg-cream"
                >
                  <Instagram size={20} aria-hidden />
                </a>
                {wa && (
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp da Turma do Bairro"
                    className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink hover:bg-cream"
                  >
                    <MessageCircle size={20} aria-hidden />
                  </a>
                )}
                <span className="text-xs text-muted">Fale com a gente</span>
              </div>
            </MobileDrawer>
          </div>
        </div>
        <Bunting className="-mb-[2px]" />
      </header>
    </>
  );
}

export async function SiteFooter() {
  const settings = await getSettings();
  const wa = settings.whatsapp_contact.replace(/\D/g, "");
  return (
    <footer className="mt-16 bg-navy text-white md:mt-24">
      <div className="bg-rauten h-3" />
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-4 md:gap-10 md:py-12">
        <div className="col-span-2 md:col-span-1">
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
      <ul className="text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="inline-flex min-h-10 items-center text-white/85 hover:text-white hover:underline md:min-h-8">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
