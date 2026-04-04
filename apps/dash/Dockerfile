FROM oven/bun:1.3.11-alpine AS base
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN bun add -g turbo@^2.5.4

FROM base AS builder
COPY . .
RUN turbo prune --scope=@uptimekit/dash --docker

FROM base AS installer
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile
COPY --from=builder /app/out/full/ .
RUN bun x turbo build --filter=@uptimekit/dash...

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

COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/public ./apps/dash/public

COPY --from=installer --chown=nextjs:nodejs /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "bun migrate.cjs && bun apps/dash/server.js"]
