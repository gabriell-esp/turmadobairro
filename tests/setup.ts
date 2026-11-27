process.env.DATA_ENCRYPTION_KEY = "a".repeat(64);
process.env.DATA_HASH_KEY = "b".repeat(64);
process.env.DATABASE_URL = "postgresql://turma:turma_dev_pw@localhost:55432/turmadobairro_test?schema=public";
process.env.MP_WEBHOOK_SECRET = "segredo-de-teste";
(process.env as Record<string, string>).NODE_ENV = "test";
