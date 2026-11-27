import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default async function RedefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell title="Nova senha">
      <ResetForm token={token} />
    </AuthShell>
  );
}
