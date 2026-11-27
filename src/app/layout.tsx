import type { Metadata, Viewport } from "next";
import { Anton, Lobster, Nunito_Sans } from "next/font/google";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const lobster = Lobster({ weight: "400", subsets: ["latin"], variable: "--font-lobster", display: "swap" });
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

const siteUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Turma do Bairro — Kerb de Ipira/SC desde 2008", template: "%s · Turma do Bairro" },
  description:
    "O bloco mais tradicional do Kerbfest de Ipira (SC). 18 anos de música, chope e alegria. Veja a programação, saiba como funciona e garanta seu abadá.",
  openGraph: {
    title: "Turma do Bairro — Kerb de Ipira/SC",
    description: "A alma do Kerbfest de Ipira. Garanta seu abadá e confira a programação do bloco.",
    images: ["/logo.png"],
    locale: "pt_BR",
    type: "website",
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
