FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cp prisma/schema.postgres.prisma prisma/schema.prisma
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_ENABLE_HOSPITALS=false
ENV NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true
RUN ./node_modules/.bin/prisma generate && npm run build

FROM base AS runner
LABEL org.opencontainers.image.source="https://github.com/expressog-commits/kene"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && ./node_modules/.bin/next start --hostname 0.0.0.0 --port ${PORT:-3000}"]
