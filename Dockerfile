# Imagem de produção do site Turma do Bairro
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# (o build baixa as fontes do Google Fonts: precisa de internet)
RUN npx prisma generate && npx next build

FROM base AS run
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
RUN mkdir -p storage/uploads && chown -R node:node /app/storage /app/.next
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# aplica migrations pendentes e sobe o servidor (exec: o Node recebe os sinais de parada)
CMD ["sh", "-c", "npx prisma migrate deploy && exec node node_modules/next/dist/bin/next start -p 3000"]
