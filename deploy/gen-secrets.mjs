// Gera as senhas/chaves do .env.production (nada é enviado para fora; só imprime na tela).
//   node deploy/gen-secrets.mjs
import { randomBytes } from "node:crypto";

const hex = (n) => randomBytes(n).toString("hex");
const alnum = (n) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = randomBytes(n);
  return Array.from(buf, (b) => chars[b % chars.length]).join("");
};

console.log(`# Cole estas linhas no seu .env.production (e guarde uma cópia segura!)
POSTGRES_PASSWORD=${alnum(28)}
DATA_ENCRYPTION_KEY=${hex(32)}
DATA_HASH_KEY=${hex(32)}
CRON_SECRET=${hex(24)}
WPP_SECRET_KEY=${hex(16)}

# Senha sugerida para o organizador inicial (troque depois no painel se quiser):
# SEED_ADMIN_PASSWORD=${alnum(14)}${Math.floor(10 + Math.random() * 89)}
`);
