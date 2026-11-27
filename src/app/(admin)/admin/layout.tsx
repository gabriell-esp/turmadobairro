import Link from "next/link";
import type { Metadata } from "next";
import {
  BarChart3, Boxes, CalendarDays, ClipboardList, Image as ImageIcon, Link2, MessageCircle, PackageCheck,
  PlusCircle, ScrollText, Search, Settings, ShieldCheck, Shirt, UserCog, Users, Menu, ExternalLink,
} from "lucide-react";
import { can, requireStaff, type Permission } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel Turma do Bairro" }, robots: { index: false, follow: false } };

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; perm: Permission };
const NAV: { title: string; items: Item[] }[] = [
  {
    title: "Operação",
    items: [
      { href: "/admin", label: "Visão geral", icon: BarChart3, perm: "orders.own" },
      { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, perm: "orders.own" },
      { href: "/admin/vendas/nova", label: "Nova venda", icon: PlusCircle, perm: "sales.create" },
      { href: "/admin/retirada", label: "Retirada de abadás", icon: PackageCheck, perm: "delivery.mark" },
      { href: "/admin/consulta", label: "Consultar CPF/nome", icon: Search, perm: "buyers.lookup" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/admin/links", label: "Links de pagamento", icon: Link2, perm: "links.manage" },
      { href: "/admin/produtos", label: "Produtos (abadás)", icon: Shirt, perm: "products.manage" },
      { href: "/admin/evento", label: "Evento e programação", icon: CalendarDays, perm: "events.manage" },
      { href: "/admin/galeria", label: "Galeria", icon: ImageIcon, perm: "gallery.manage" },
      { href: "/admin/relatorios", label: "Relatórios", icon: Boxes, perm: "dashboard.full" },
      { href: "/admin/membros", label: "Membros", icon: Users, perm: "members.view" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/equipe", label: "Equipe e permissões", icon: UserCog, perm: "users.manage" },
      { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle, perm: "whatsapp.manage" },
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings, perm: "settings.manage" },
      { href: "/admin/lgpd", label: "LGPD / titulares", icon: ShieldCheck, perm: "lgpd.manage" },
      { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText, perm: "audit.view" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(user, i.perm)) })).filter((g) => g.items.length);

  const nav = (
    <nav aria-label="Painel" className="space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1 px-3 text-[.7rem] font-extrabold uppercase tracking-widest text-white/50">{g.title}</p>
          <ul>
            {g.items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-white/90 hover:bg-white/10">
                  <i.icon size={17} /> {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f3efe2] lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden bg-navy p-4 text-white lg:block">
        <div className="sticky top-4 space-y-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo size={56} className="h-auto w-14" />
            <span className="h-display text-xl leading-none">Painel<br />da Turma</span>
          </Link>
          {nav}
          <Link href="/" className="flex items-center gap-2 px-3 text-xs font-bold text-white/70 hover:text-white"><ExternalLink size={14} /> Ver o site</Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b-2 border-ink bg-white px-4 py-2.5">
          <details className="relative lg:hidden">
            <summary className="btn btn-sm btn-gold" aria-label="Menu do painel"><Menu size={18} /></summary>
            <div className="absolute left-0 mt-2 w-64 rounded-xl border-2 border-ink bg-navy p-3 shadow-xl">{nav}</div>
          </details>
          <p className="hidden text-sm text-muted lg:block">Painel administrativo</p>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-right leading-tight">
              <span className="block font-extrabold">{user.name}</span>
              <span className={`badge ${user.role === "ORGANIZER" ? "badge-blue" : "badge-yellow"}`}>{user.role === "ORGANIZER" ? "Organizador" : "Vendedor"}</span>
            </span>
            <form action={logoutAction}><button className="btn btn-sm btn-white">Sair</button></form>
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
