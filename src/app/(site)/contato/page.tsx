import type { Metadata } from "next";
import Link from "next/link";
import { Instagram, MessageCircle, Mail } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { PageHero } from "@/components/page-shell";
import { DataRequestForm } from "@/components/data-request-form";

export const metadata: Metadata = { title: "Contato" };
export const dynamic = "force-dynamic";

export default async function ContatoPage() {
  const s = await getSettings();
  const wa = s.whatsapp_contact.replace(/\D/g, "");
  return (
    <>
      <PageHero eyebrow="Fale com a gente" title="Contato">Dúvidas sobre o bloco, o abadá ou o seu pedido? Chama a Turma!</PageHero>
      <section className="container-page grid gap-6 py-14 md:grid-cols-3">
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-4 p-6 hover:-translate-y-0.5">
            <MessageCircle size={34} className="text-[#1c8b3c]" aria-hidden />
            <div><p className="h-display text-2xl">WhatsApp</p><p className="text-sm text-muted">Atendimento sobre pedidos e abadás</p></div>
          </a>
        )}
        <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-4 p-6 hover:-translate-y-0.5">
          <Instagram size={34} className="text-red" aria-hidden />
          <div><p className="h-display text-2xl">Instagram</p><p className="text-sm text-muted">@turmado_bairro — novidades e avisos</p></div>
        </a>
        {s.contact_email && (
          <a href={`mailto:${s.contact_email}`} className="card flex items-center gap-4 p-6 hover:-translate-y-0.5">
            <Mail size={34} className="text-blue" aria-hidden />
            <div><p className="h-display text-2xl">E-mail</p><p className="text-sm text-muted">{s.contact_email}</p></div>
          </a>
        )}
      </section>

      <section id="lgpd" className="container-page grid scroll-mt-32 gap-10 pb-10 lg:grid-cols-2">
        <div className="prose-tb">
          <h2>Seus direitos como titular (LGPD)</h2>
          <p>
            Você pode pedir acesso, correção, portabilidade, anonimização ou eliminação dos seus dados, e revogar consentimentos. Quem tem conta consegue fazer boa parte disso
            sozinho em <Link href="/minha-conta/privacidade">Minha conta › Privacidade e dados</Link>.
          </p>
          <p>Para qualquer outra solicitação, use o formulário. Respondemos em até 15 dias.</p>
          <p>Leia também a <Link href="/privacidade">Política de Privacidade</Link>.</p>
        </div>
        <DataRequestForm />
      </section>
    </>
  );
}
