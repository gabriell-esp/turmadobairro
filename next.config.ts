import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// CSP: o Mercado Pago é aberto por redirecionamento (Checkout Pro), então não precisamos liberar scripts de terceiros.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.mercadopago.com.br https://www.mercadopago.com https://sandbox.mercadopago.com.br",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

// Host público (para a checagem de origem das server actions atrás de proxy)
const publicHost = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).host : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    serverActions: {
      // fotos do abadá/galeria chegam por server action (6 MB por imagem em src/lib/uploads.ts, até 4 por envio)
      bodySizeLimit: "26mb",
      ...(publicHost ? { allowedOrigins: [publicHost] } : {}),
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
      // Áreas logadas nunca devem ficar em cache (navegador, proxy ou CDN)
      ...["/admin/:path*", "/minha-conta/:path*", "/entrar", "/cadastrar", "/redefinir-senha/:path*", "/api/me/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      })),
    ];
  },
};

export default nextConfig;
