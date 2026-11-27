import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function EsqueciSenhaPage() {
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviamos o link pelo WhatsApp do seu cadastro">
      <ForgotForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/entrar" className="font-bold text-blue underline">Voltar para o login</Link>
      </p>
    </AuthShell>
  );
}
