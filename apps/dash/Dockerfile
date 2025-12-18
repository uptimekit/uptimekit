FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g turbo@^2.5.4

FROM base AS builder
COPY . .
RUN turbo prune --scope=@uptimekit/dash --docker

FROM base AS installer
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install
COPY --from=builder /app/out/full/ .
RUN pnpm turbo build --filter=@uptimekit/dash...

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/dash/next.config.ts ./

COPY --from=builder   --chown=nextjs:nodejs /app/packages/db ./packages/db
COPY --from=builder   --chown=nextjs:nodejs /app/packages/db/src/migrate.cjs ./migrate.cjs

COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/static ./apps/dash/.next/static

COPY --from=installer --chown=nextjs:nodejs /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "node migrate.cjs && node apps/dash/server.js"]
