# Turma do Bairro — Site, Loja de Abadás e Painel

Site oficial do bloco **Turma do Bairro** (Kerbfest de Ipira/SC, desde 2008): informações do bloco, programação,
"como funciona", loja de abadás com pagamento pelo **Mercado Pago**, confirmação por **WhatsApp (WPPConnect)** e
painel administrativo com perfis **Organizador** e **Vendedor**. Pensado para a **LGPD**.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Prisma 6 · PostgreSQL 16 · Tailwind 4.

---

## 1. Rodando localmente

Pré-requisitos: Node 20+ e Docker (para o Postgres).

```powershell
npm install
copy .env.example .env      # depois edite o .env (veja a seção 2)
npm run db:up               # sobe o PostgreSQL (porta 55432)
npx prisma migrate deploy   # cria as tabelas
npm run db:seed             # cria o organizador inicial (SEED_ADMIN_*)
npm run dev                 # http://localhost:3000
```

- O seed cria **apenas o organizador inicial**. Não há dados de exemplo: cadastre evento, programação e produtos pelo painel (*Evento e programação*, *Produtos*).
- Sem `MP_ACCESS_TOKEN`, em desenvolvimento, o checkout usa um **simulador de pagamento** (`/dev/pagamento/...`).
  Em produção esse simulador não existe (404) e o checkout exige o Mercado Pago configurado.
- Testes: `npm test` (usa o banco `turmadobairro_test`; crie-o e rode `prisma migrate deploy` apontando para ele — veja `tests/setup.ts`).

## 2. Variáveis de ambiente (`.env.example`)

| Variável | Para quê |
|---|---|
| `APP_URL` | URL pública (https em produção). Usada nos links do Mercado Pago e do WhatsApp |
| `DATABASE_URL` | PostgreSQL |
| `DATA_ENCRYPTION_KEY` / `DATA_HASH_KEY` | Chaves (64 hex) para cifrar CPF e gerar o índice cego. **Gere únicas** (`openssl rand -hex 32`) e **faça backup: sem elas os CPFs não podem ser lidos** |
| `CRON_SECRET` | Protege `POST /api/cron` |
| `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` | Mercado Pago. **Opcionais aqui:** podem ser informados em *Painel › Configurações › Mercado Pago* (ficam cifrados no banco e têm prioridade sobre estas variáveis) |
| `TRUSTED_PROXY_HOPS` | Quantos proxies confiáveis ficam na frente do app (padrão `1`; `0` = nenhum). Define de onde sai o IP real para o rate limit |
| `MP_MAX_INSTALLMENTS`, `ORDER_HOLD_MINUTES` | Parcelas máximas e tempo de reserva do pedido (padrão 30 min) |
| `WPP_BASE_URL`, `WPP_SESSION`, `WPP_SECRET_KEY` (ou `WPP_TOKEN`) | Servidor WPPConnect |
| `SEED_ADMIN_*` | Organizador inicial criado pelo seed |

## 3. Mercado Pago

1. Em *Suas integrações* crie uma aplicação (Checkout Pro) e copie o **Access Token** → `MP_ACCESS_TOKEN`.
2. Em *Webhooks* cadastre `https://SEU-DOMINIO/api/webhooks/mercadopago`, marque **Pagamentos** e copie a **assinatura secreta** → `MP_WEBHOOK_SECRET`.
3. Teste primeiro com credenciais de teste/usuários de teste do Mercado Pago.

Como funciona: ao finalizar, criamos um **pedido reservado** e uma *preferência* (link de checkout) com expiração igual à da reserva. O cliente paga no Mercado Pago
(Pix/cartão; boleto desativado) e volta para `/pedido/{id}/obrigado`. A aprovação chega por **webhook** — que é validado por **assinatura HMAC**, nunca confia no corpo
(busca o pagamento direto na API) e é **idempotente**. Há ainda conciliação ao abrir a página do pedido e no `cron`.
Pagamento com valor menor que o total **não** confirma o pedido e marca "atenção".

**Links de pagamento (painel › Links de pagamento):** cria cobranças avulsas (título/valor/validade) via API; lista os links de pedidos pendentes (cobrança por pedido, inclusive de
vários abadás de uma vez, criada em *Nova venda*); lista os checkouts já existentes na conta (API de busca de preferências) e permite **colar links criados manualmente no app**,
pois o Mercado Pago não expõe esses "Links de pagamento" do app pela API pública.

## 4. WhatsApp (WPPConnect)

Suba o [wppconnect-server](https://github.com/wppconnect-team/wppconnect-server) (`docker compose --profile whatsapp up -d wppconnect` ou em outro host), configure `WPP_BASE_URL`, `WPP_SESSION` e
`WPP_SECRET_KEY` (a *secretKey* do servidor) e, em **Painel › WhatsApp**, clique em *Iniciar sessão* e escaneie o QR Code com o número da Turma.

- Quando o pagamento é aprovado, a confirmação (abadás, total, retirada, link do pedido) é enfileirada e enviada. Falhas ficam na fila com **retentativa progressiva** (cron) e botão *Reenviar*.
- A recuperação de senha também é enviada por WhatsApp (link de uso único, 1 hora).
- ⚠ O cliente segue a API documentada do WPPConnect (`generate-token`, `start-session`, `status-session`, `send-message`), validado aqui contra um servidor simulado; **teste com o seu servidor real** antes do lançamento.
- Boa prática: use um número dedicado e só envie mensagens relacionadas à compra (o sistema não faz envio em massa).

## 5. Tarefa agendada (cron)

Chame a cada 5 minutos: `curl -X POST https://SEU-DOMINIO/api/cron -H "Authorization: Bearer $CRON_SECRET"`.
Faz: conciliar pedidos pendentes com o Mercado Pago, expirar reservas, reenviar WhatsApp pendente e limpar sessões/limites vencidos.

## 6. Perfis e permissões

| Área | Organizador | Vendedor |
|---|:-:|:-:|
| Visão geral / faturamento completo | ✅ | só as próprias vendas |
| Pedidos | todos | só os que criou |
| Nova venda (gera link do Mercado Pago, envia por WhatsApp) | ✅ | ✅ |
| Cancelar pedido | qualquer | só os pendentes que criou |
| Reembolso/pagamento manual, revelar CPF (auditado) | ✅ | — |
| Retirada de abadás / Consulta de CPF-nome (sem dados sensíveis) | ✅ | ✅ |
| Links de pagamento, Produtos, Evento/Programação, Galeria, Relatórios, Membros, Equipe, WhatsApp, Configurações, LGPD, Auditoria | ✅ | — |

As permissões são verificadas **no servidor** em cada tela e ação (a matriz está em `src/lib/auth.ts`).

## 7. Regras do abadá (anti-duplicidade)

Cada abadá exige **nome completo, CPF, data de nascimento, tamanho e Baby Look**. Um **CPF** e um **nome** só podem ter **um abadá ativo por Kerb** — vale para a sacola, para compras
anteriores (pagas ou ainda reservadas) e para vendas manuais. Garantia em três camadas: validação na sacola, validação transacional no checkout e **índices únicos parciais no PostgreSQL**
(testado com compras simultâneas). Pedidos cancelados/expirados liberam os dados. O organizador pode liberar **homônimos** numa venda manual (o CPF continua único).
O estoque é reservado com trava de linha, então não há venda acima do estoque mesmo com muita gente comprando junto.

## 8. LGPD — o que está implementado

- **Minimização e transparência:** coleta só o necessário; Política de Privacidade (bases legais, compartilhamento, retenção, direitos), Termos e Política de Cookies; aviso de cookies (só cookies essenciais, sem rastreadores).
- **Consentimento registrado** (versão, data, IP, navegador) para Termos/Privacidade, novidades (opcional, separado) e autorização de **responsável legal para menores** (art. 14). Cadastro só para maiores de 18.
- **Segurança:** CPF **cifrado em repouso (AES-256-GCM)** + índice cego HMAC para checar duplicidade; CPF **mascarado** em todas as telas (revelar exige organizador e gera auditoria); senhas com scrypt; sessões revogáveis com cookie HttpOnly/SameSite/Secure;
  rate limit (login, cadastro, recuperação, checkout) e bloqueio temporário de conta; cabeçalhos de segurança (CSP, HSTS, anti-clickjacking); upload de imagem reprocessado (remove EXIF); exportações CSV protegidas contra injeção de fórmulas; **trilha de auditoria** das ações no painel.
- **Direitos do titular:** em *Minha conta › Privacidade e dados* — baixar cópia dos dados (JSON), histórico de consentimentos, **excluir a conta** (anonimiza o perfil; pedidos pagos ficam até 5 anos por obrigação fiscal, sem telefone/e-mail) — e formulário em *Contato* para outros pedidos, com fila de atendimento no painel (*LGPD / titulares*).
- **Pendências suas (não são código):** revisão jurídica dos textos em `/privacidade` e `/termos`; definir o encarregado/canal real em *Configurações*; plano de resposta a incidentes; política de backup/retention; contrato/DPA com a hospedagem; autorização de uso de imagem para fotos da galeria.

## 9. Produção

Guia completo, passo a passo (Docker + HTTPS automático + backup + cron): **[DEPLOY.md](DEPLOY.md)**.

Resumo do que o repositório já traz para produção:

- `docker-compose.prod.yml` (app + PostgreSQL + Caddy com HTTPS + tarefa agendada), `deploy/Caddyfile`, `deploy/backup.sh`, `deploy/gen-secrets.mjs` e `.env.production.example`.
- Em produção o servidor **recusa subir** com configuração insegura (`src/lib/env-check.ts`): `APP_URL` sem https, chaves ausentes/iguais/de teste, `CRON_SECRET` curto, senha de desenvolvimento do banco. (Só para testar localmente em modo produção: `SKIP_ENV_CHECK=1`.)
- Senhas: mínimo de 8 caracteres, com letras e números, e bloqueio de senhas comuns. O seed recusa senha fraca em produção.
- O IP do visitante (rate limit) é lido do fim do `X-Forwarded-For`, descontando `TRUSTED_PROXY_HOPS`, então não pode ser forjado.
- Páginas de erro/404 genéricas, `robots.txt`/`sitemap.xml`, áreas logadas sem cache.

## 10. Estrutura

```
src/app/(site)/      site público, loja, sacola, conta do integrante, páginas legais
src/app/(admin)/     painel (Organizador/Vendedor)
src/app/actions/     server actions (auth, carrinho/checkout, painel)
src/app/api/         webhook do Mercado Pago, cron, health, export LGPD
src/lib/             regras de negócio (orders, payments, mercadopago, wpp, crypto, auth…)
prisma/              schema, migrations (com índices únicos parciais) e seed
tests/               testes (vitest): validadores, criptografia, assinatura do webhook, concorrência de pedidos
```
