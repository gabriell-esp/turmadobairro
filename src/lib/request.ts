import { headers } from "next/headers";

/**
 * IP do cliente atrás de proxy reverso. NÃO confiamos no primeiro item do X-Forwarded-For
 * (o visitante pode forjá-lo para burlar o rate limit): contamos a partir do FIM da lista,
 * pulando `TRUSTED_PROXY_HOPS` proxies confiáveis (padrão 1 = um Nginx/Caddy na frente).
 * 0 = sem proxy (ignora o cabeçalho).
 */
export function pickClientIp(xff: string | null, realIp: string | null, hops: number): string {
  if (hops > 0 && xff) {
    const list = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const ip = list[Math.max(0, list.length - hops)];
    if (ip) return ip.slice(0, 64);
  }
  if (hops > 0 && realIp) return realIp.trim().slice(0, 64);
  return "unknown";
}

const proxyHops = () => {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 1;
};

export async function clientInfo(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  return {
    ip: pickClientIp(h.get("x-forwarded-for"), h.get("x-real-ip"), proxyHops()),
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
