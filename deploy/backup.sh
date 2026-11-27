#!/bin/sh
# Backup do banco + fotos. Rode na pasta do projeto, no servidor:
#   sh deploy/backup.sh
# Agende (cron do servidor), por exemplo todo dia às 3h:
#   0 3 * * * cd /opt/turmadobairro && sh deploy/backup.sh >> deploy/backups/backup.log 2>&1
# Guarde uma cópia FORA do servidor (e do .env.production — sem as chaves os CPFs não abrem).
set -eu
cd "$(dirname "$0")/.."
DEST="deploy/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"
umask 077

echo "[$STAMP] backup do banco…"
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_dump -U turma -d turmadobairro --no-owner | gzip > "$DEST/db-$STAMP.sql.gz"

echo "[$STAMP] backup das fotos…"
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app \
  tar -C /app/storage -czf - uploads > "$DEST/uploads-$STAMP.tar.gz"

# mantém os últimos 14 dias
find "$DEST" -name 'db-*.sql.gz' -mtime +14 -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +14 -delete
echo "[$STAMP] ok → $DEST"
