/** Roda uma vez quando o servidor sobe. Em produção, recusa subir com configuração insegura. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.SKIP_ENV_CHECK !== "1") {
    const { assertProductionEnv } = await import("./lib/env-check");
    assertProductionEnv();
  }
}
