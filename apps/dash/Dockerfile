FROM oven/bun:1.3.11-alpine AS base
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN bun add -g turbo@^2.5.4

FROM base AS builder
COPY . .
RUN turbo prune @uptimekit/dash --docker

FROM base AS installer
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/bun.lock ./bun.lock
RUN bun install
COPY --from=builder /app/out/full/ .
RUN bun x turbo build --filter=@uptimekit/dash...

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Install clickhouse client for migrations (needed by migrate.cjs but pruned by turbo)
RUN bun add @clickhouse/client@^1.15.0

USER nextjs

COPY --from=installer /app/apps/dash/next.config.ts ./

# Copy packages from installer (pruned) to ensure all dependencies are available
COPY --from=installer --chown=nextjs:nodejs /app/packages/db ./packages/db
COPY --from=installer --chown=nextjs:nodejs /app/packages/config ./packages/config
COPY --from=installer --chown=nextjs:nodejs /app/packages/api ./packages/api
COPY --from=installer --chown=nextjs:nodejs /app/packages/auth ./packages/auth

# Copy migrate script from installer
COPY --from=installer --chown=nextjs:nodejs /app/packages/db/src/migrate.cjs ./migrate.cjs

COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/static ./apps/dash/.next/static

COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/public ./apps/dash/public

COPY --from=installer --chown=nextjs:nodejs /app/node_modules ./node_modules

# Add turbo.json to suppress "Could not find monorepo root" warnings
COPY --from=builder --chown=nextjs:nodejs /app/turbo.json ./turbo.json

ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "bun migrate.cjs && bun apps/dash/server.js"]
