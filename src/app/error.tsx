"use client";

import Link from "next/link";

/** Erro inesperado: mensagem genérica (nunca mostra detalhes técnicos); o `digest` ajuda a achar o erro no log do servidor. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-page max-w-lg py-20 text-center" role="alert">
      <h1 className="h-display text-3xl text-navy">Algo deu errado</h1>
      <p className="mt-3 text-muted">Não conseguimos concluir esta ação. Tente novamente; se continuar, avise a organização.</p>
      {error.digest && <p className="mt-2 text-xs text-muted">Código do erro: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="btn btn-red">Tentar de novo</button>
        <Link href="/" className="btn btn-white">Início</Link>
      </div>
    </section>
  );
}
