import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeNext(sp.next, user.role === "MEMBER" ? "/minha-conta" : "/admin"));
  return (
    <AuthShell title="Entrar" subtitle="Acesse sua conta da Turma">
      <LoginForm next={sp.next} resetOk={sp.reset === "ok"} />
      <p className="mt-6 border-t-2 border-ink/10 pt-4 text-center text-sm">
        Ainda não tem conta?{" "}
        <Link href={`/cadastrar${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="font-extrabold text-red underline">
          Cadastre-se
        </Link>
      </p>
    </AuthShell>
  );
}
