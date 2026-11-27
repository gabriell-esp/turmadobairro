export const DEFAULT_SHIRT = "#1478d6";
export const DEFAULT_STRIPE = "#e11d2a";

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/** Escurece uma cor (#rrggbb) misturando com preto. factor 0..1 (1 = cor original). */
function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * factor).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** Ilustração do abadá. As cores vêm do cadastro do produto (cai no azul/vermelho do bloco). */
export function ShirtArt({ className = "", color, stripe }: { className?: string; color?: string | null; stripe?: string | null }) {
  const main = isHexColor(color) ? color : DEFAULT_SHIRT;
  const band = isHexColor(stripe) ? stripe : DEFAULT_STRIPE;
  const gid = `shirt-${main.slice(1)}`; // mesmo id só quando a cor é igual (definição idêntica)
  return (
    <svg viewBox="0 0 220 200" role="img" aria-label="Abadá da Turma do Bairro" className={className}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={main} />
          <stop offset="1" stopColor={darken(main, 0.45)} />
        </linearGradient>
      </defs>
      <path
        d="M72 14 22 44l16 46 24-10v104h96V80l24 10 16-46-50-30c-10 18-24 26-38 26S82 32 72 14Z"
        fill={`url(#${gid})`}
        stroke="#101a2b"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M62 80h96v18H62z" fill={band} opacity=".95" />
      <image href="/logo-sm.png" x="70" y="104" width="80" height="70" />
    </svg>
  );
}
