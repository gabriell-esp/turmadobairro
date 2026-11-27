/**
 * Seed: cria (ou reativa) SOMENTE o organizador inicial, com SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Não existe nenhum dado de exemplo: evento, programação, produtos e equipe são cadastrados pelo painel.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";
import { validatePassword } from "../src/lib/validators";

const db = new PrismaClient();
const isProd = process.env.NODE_ENV === "production";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no .env");
  if (isProd) {
    const weak = validatePassword(password);
    if (weak) throw new Error(`SEED_ADMIN_PASSWORD fraca: ${weak}`);
    if (/@turmadobairro\.local$/i.test(email)) throw new Error("Use um e-mail real para o organizador em produção.");
  }

  await db.user.upsert({
    where: { email },
    update: { role: "ORGANIZER", active: true },
    create: {
      email,
      name: process.env.SEED_ADMIN_NAME ?? "Organização Turma do Bairro",
      passwordHash: await hashPassword(password),
      role: "ORGANIZER",
    },
  });
  console.log(`✔ Organizador: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
