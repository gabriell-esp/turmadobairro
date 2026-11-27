import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Criar cadastro" };

export default async function CadastrarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(sp.next, "/minha-conta"));
  return (
    <AuthShell title="Cadastro da Turma" subtitle="Faça parte da família do Turma do Bairro" wide>
      <RegisterForm next={sp.next} />
      <p className="mt-6 border-t-2 border-ink/10 pt-4 text-center text-sm">
        Já tem conta? <Link href="/entrar" className="font-extrabold text-red underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
