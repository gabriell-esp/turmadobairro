# Colocando o site no ar (passo a passo)

Este guia sobe tudo num servidor Linux (VPS) com **Docker**: site, banco PostgreSQL, **HTTPS automático** e a tarefa
agendada. Tempo estimado: 30–60 minutos.

## O que você precisa

1. Um servidor Linux (Ubuntu 22.04/24.04), com **2 GB de RAM** ou mais, e acesso por SSH.
2. Um **domínio** (ex.: `turmadobairro.com.br`) com o registro **A** apontando para o IP do servidor.
3. Docker instalado no servidor (`curl -fsSL https://get.docker.com | sh`).
4. Portas **80** e **443** liberadas no firewall do servidor (e só elas + SSH).
5. Conta no Mercado Pago (Access Token e assinatura secreta do webhook) — pode ser feito depois, pelo painel.

## 1. Enviar os arquivos

Envie a pasta do projeto **sem** `node_modules`, `.next` e `.env` (por exemplo, `scp`/WinSCP ou Git privado):

```powershell
# no seu computador (Windows), dentro da pasta do projeto:
tar --exclude=node_modules --exclude=.next --exclude=.env --exclude=".env.*" --exclude=storage/uploads -czf turmadobairro.tar.gz .
scp turmadobairro.tar.gz usuario@IP-DO-SERVIDOR:/opt/
```

```sh
# no servidor:
sudo mkdir -p /opt/turmadobairro && cd /opt/turmadobairro
sudo tar -xzf ../turmadobairro.tar.gz
```

## 2. Criar o `.env.production`

```sh
cp .env.production.example .env.production
node deploy/gen-secrets.mjs        # (precisa do Node; ou rode no seu computador) — gera senhas e chaves
nano .env.production               # cole os valores e preencha DOMAIN, APP_URL, SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD
chmod 600 .env.production
```

⚠ **Faça uma cópia do `.env.production` em lugar seguro, fora do servidor** (gerenciador de senhas/pendrive).
Sem `DATA_ENCRYPTION_KEY` os CPFs gravados não podem ser lidos nunca mais.

O servidor **recusa subir** se algo importante estiver errado (HTTPS ausente, chave inválida, senha de
desenvolvimento do banco…) e diz no log o que corrigir: `docker compose --env-file .env.production -f docker-compose.prod.yml logs app`.

## 3. Subir

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps        # todos "running/healthy"
```

Na primeira vez as tabelas são criadas sozinhas. Depois crie o organizador inicial (usa `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`):

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npx tsx prisma/seed.ts
```

Agora **apague a linha `SEED_ADMIN_PASSWORD`** do `.env.production` e rode o `up -d` de novo. Abra `https://SEU-DOMINIO/entrar`.

## 3b. Publicando atrás de um nginx (ou outro proxy) externo

Por padrão o app responde na porta **3400** deste servidor (`APP_PORT` no `.env.production`; confira antes se está livre com `sudo ss -tulpn`)
e o **Caddy não sobe**. Seu nginx encaminha o domínio para `http://IP-DO-SERVIDOR:3400`. O HTTPS fica no nginx.

- `APP_URL=https://seudominio.com.br` (o endereço que o visitante digita).
- `APP_BIND=0.0.0.0` se o nginx está em **outra máquina**; `APP_BIND=127.0.0.1` se está **neste** servidor.
- **Firewall:** deixe a 3400 acessível **só para o IP do nginx** (`sudo ufw allow from IP-DO-NGINX to any port 3400 proto tcp`).
  Quem acessar a 3400 direto consegue forjar o IP e burlar o limite de tentativas de login.

Trecho do nginx (ajuste o IP e os certificados):

```nginx
server {
    listen 80;
    server_name seudominio.com.br;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name seudominio.com.br;
    # ssl_certificate / ssl_certificate_key ...

    client_max_body_size 30m;          # fotos de até 4 x 6 MB

    location / {
        proxy_pass http://IP-DO-SERVIDOR:3400;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 90s;
    }
}
```

Se houver **Cloudflare** na frente do nginx, ponha `TRUSTED_PROXY_HOPS=2` no `.env.production`.
Para usar o Caddy no lugar do nginx (HTTPS automático, portas 80/443 livres): `docker compose --profile caddy up -d --build`.

## 4. Configurar pelo painel

1. **Configurações › Mercado Pago:** cole o Access Token e a assinatura secreta; clique em **Testar conexão**.
   No Mercado Pago (*Suas integrações › Webhooks*) cadastre `https://SEU-DOMINIO/api/webhooks/mercadopago` com o evento **Pagamentos**.
2. **Evento e programação:** datas reais do Kerb, local e texto de retirada. **Produtos:** preços, lotes, estoque, foto/cor do abadá.
3. **Configurações:** nome, WhatsApp e e-mail de atendimento, encarregado de dados (LGPD).
4. **Equipe:** crie uma conta para cada vendedor (senha de 8+ caracteres). Não compartilhe a conta do organizador.
5. **WhatsApp:** veja a seção 4b abaixo (servidor WPPConnect + QR Code).
6. Faça **uma compra de teste real de valor baixo** (ex.: R$ 1,00 num produto de teste que você apaga depois), confira o pagamento, a confirmação e a retirada.
7. Só então **libere as vendas** na Visão geral (o sistema pode ficar congelado até lá).

## 4b. WhatsApp (WPPConnect)

O WPPConnect é o programa que "liga" um número de WhatsApp ao site (confirmações de pedido, link de pagamento, recuperação de senha).
Use um **chip/número dedicado da Turma**. Ele fica só na rede interna do Docker (sem porta aberta para a internet).

1. No `.env.production` preencha (a chave você inventa; `node deploy/gen-secrets.mjs` gera uma):
   ```
   WPP_BASE_URL=http://wppconnect:21465
   WPP_SESSION=turmadobairro
   WPP_SECRET_KEY=uma-chave-longa-e-aleatoria
   ```
2. Suba o servidor do WhatsApp e reinicie o app:
   ```
   docker compose --profile whatsapp up -d
   docker compose up -d app
   ```
3. No painel, **WhatsApp › Iniciar sessão / gerar QR**. No celular do número: WhatsApp › Aparelhos conectados › Conectar um aparelho › escaneie o QR.
4. Quando o estado ficar **CONNECTED**, envie uma **mensagem de teste** para o seu número.

Se o estado ficar em erro: `docker compose logs --tail 50 wppconnect`. Se o QR não aparecer, clique em *Atualizar* após alguns segundos.

## 5. Rotina

| Tarefa | Como |
|---|---|
| Ver logs | `docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app` |
| Atualizar o site | envie os arquivos novos e rode o `up -d --build` (as migrations rodam sozinhas) |
| **Backup** (banco + fotos) | `sh deploy/backup.sh` — agende no `crontab -e`: `0 3 * * * cd /opt/turmadobairro && sh deploy/backup.sh >> deploy/backups/backup.log 2>&1`. **Copie os arquivos de `deploy/backups` para fora do servidor.** |
| Restaurar o banco | `gunzip -c deploy/backups/db-AAAAMMDD-HHMMSS.sql.gz \| docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db psql -U turma -d turmadobairro` (em banco vazio) |
| Monitorar | `https://SEU-DOMINIO/api/health` deve responder `{"ok":true}` (use UptimeRobot ou similar) |
| Parar tudo | `docker compose --env-file .env.production -f docker-compose.prod.yml down` (**sem** `-v`, que apagaria o banco!) |

## Segurança — o que já está feito e o que é com você

**Já está no sistema:** HTTPS obrigatório com HSTS; cabeçalhos de segurança (CSP, anti-clickjacking, nosniff); cookie de sessão
`__Host-`/HttpOnly/Secure/SameSite; CPF cifrado (AES-256-GCM); senhas com scrypt; bloqueio por tentativas e rate limit (IP real,
não forjável); validação da assinatura do webhook; credenciais do Mercado Pago cifradas no banco; uploads reprocessados;
permissões conferidas no servidor; auditoria; o servidor se recusa a subir com configuração insegura; banco e app **sem portas
expostas** (só o Caddy fala com a internet).

**Dependências (`npm audit`):** restam avisos que **não afetam este sistema**: `postcss` dentro do Next e `prisma`/`effect`/`deepmerge-ts`
só rodam na hora do *build*/migração (não processam dados de visitantes); `uuid` no SDK do Mercado Pago só é problema nas
funções v3/v5/v6 com buffer (o SDK usa v4); `zod` só é afetado ao validar listas enormes (o sistema valida só campos de texto).
Corrigi-los exigiria saltos de versão grandes (Next 16, Prisma 7, Zod 4) — faça isso numa atualização planejada, não às vésperas do evento.

**Com você:**

- Mantenha o servidor atualizado (`sudo apt update && sudo apt upgrade`) e use **login SSH por chave** (desative senha) ou, no mínimo, `fail2ban`.
- Firewall: libere só 22 (SSH), 80 e 443.
- **Backups fora do servidor** e teste uma restauração antes do evento.
- Contas individuais para cada pessoa da equipe; desative quem sair (Painel › Equipe).
- Revisão jurídica de `/privacidade` e `/termos`, contrato com a hospedagem e plano de resposta a incidentes (LGPD).
- Se colocar **Cloudflare** na frente: em `.env.production` use `TRUSTED_PROXY_HOPS=2` (Cloudflare + Caddy) — veja o comentário no `docker-compose.prod.yml`.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `app` reinicia sem parar e o log fala em "Configuração insegura" | Corrija o que o log lista no `.env.production` |
| Site sem HTTPS / "conexão não segura" | DNS ainda não aponta para o servidor, ou portas 80/443 bloqueadas; veja `logs caddy` |
| Login não funciona | `APP_URL` sem `https://` ou acessando por IP/outro domínio |
| Pagamento aprovado mas pedido continua "pendente" | Webhook não cadastrado ou assinatura secreta errada (Configurações › Mercado Pago). O cron concilia em até 5 min |
| "Muitas tentativas" para todo mundo | `TRUSTED_PROXY_HOPS` errado (o sistema enxerga o IP do proxy como se fosse de todos) |
| Upload de foto falha | Imagem > 6 MB ou formato não suportado (use JPG/PNG/WebP) |
