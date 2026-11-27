/** Aceita apenas caminhos internos (evita open redirect). */
export function safeNext(next: string | null | undefined, fallback = "/minha-conta"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
