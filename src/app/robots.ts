import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/minha-conta", "/sacola", "/pedido", "/dev", "/entrar", "/cadastrar", "/redefinir-senha", "/esqueci-senha"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
