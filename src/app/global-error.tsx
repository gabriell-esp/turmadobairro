"use client";

/** Último recurso: erro no próprio layout raiz (precisa do próprio <html>). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1>Algo deu errado</h1>
        <p>O site encontrou um problema temporário. Tente novamente em instantes.</p>
        <button onClick={reset} style={{ padding: "0.6rem 1.2rem", fontSize: "1rem", cursor: "pointer" }}>Tentar de novo</button>
      </body>
    </html>
  );
}
