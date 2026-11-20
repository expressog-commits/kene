FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/kene

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

FROM base AS builder
COPY --from=deps /srv/kene/node_modules ./node_modules
COPY . .
RUN cp prisma/schema.postgres.prisma prisma/schema.prisma
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_ENABLE_HOSPITALS=false
ENV NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true
RUN ./node_modules/.bin/prisma generate && npm run build
RUN node -e "const fs=require('fs'); const p=fs.readFileSync('.next/server/app/page.js','utf8'); if (!p.includes('action:\"/app\"') || !p.includes('name:\"q\"')) { console.error('ERROR: root / did NOT compile LandingPage!', p.slice(0,1200)); process.exit(1); }"

FROM base AS runner
LABEL org.opencontainers.image.source="https://github.com/expressog-commits/kene"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /srv/kene/package.json ./package.json
COPY --from=builder /srv/kene/next.config.mjs ./next.config.mjs
COPY --from=builder /srv/kene/public ./public
COPY --from=builder /srv/kene/.next ./.next
COPY --from=builder /srv/kene/node_modules ./node_modules
COPY --from=builder /srv/kene/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && ./node_modules/.bin/next start --hostname 0.0.0.0 --port ${PORT:-3000}"]
