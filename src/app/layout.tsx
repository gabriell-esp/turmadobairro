import type { Metadata, Viewport } from "next";
import { Anton, Lobster, Nunito_Sans } from "next/font/google";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const lobster = Lobster({ weight: "400", subsets: ["latin"], variable: "--font-lobster", display: "swap" });
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

function siteBase(): URL {
  try {
    return new URL(process.env.APP_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

// Prévia do link (WhatsApp, Instagram, Facebook, Telegram…). Imagem 1200×630, ~190 KB.
// Se trocar a foto, MUDE O NOME do arquivo (ex.: og-turma-do-bairro-2.jpg): os aplicativos guardam a prévia antiga em cache.
const SHARE_TITLE = "Turma do Bairro — Kerbfest de Ipira/SC";
const SHARE_DESCRIPTION = "Desde 2008, a alma do Kerbfest de Ipira. Garanta seu abadá e veja a programação do bloco.";
const SHARE_IMAGE = {
  url: "/og-turma-do-bairro.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Integrantes da Turma do Bairro com a camiseta azul do bloco no Kerbfest de Ipira",
};

export const metadata: Metadata = {
  metadataBase: siteBase(),
  applicationName: "Turma do Bairro",
  title: { default: SHARE_TITLE, template: "%s · Turma do Bairro" },
  description: SHARE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Turma do Bairro",
    url: "/",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
};

export const viewport: Viewport = { themeColor: "#0a5ab0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${lobster.variable} ${nunito.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
