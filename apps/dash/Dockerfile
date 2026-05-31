FROM docker.io/node:22-alpine AS base
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN pnpm add -g turbo@^2.5.4

FROM base AS builder
COPY . .
RUN turbo prune @uptimekit/dash --docker

FROM base AS installer
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=builder /app/out/full/ .
RUN pnpm exec turbo build --filter=@uptimekit/dash...

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

USER nextjs

COPY --from=installer /app/apps/dash/next.config.ts ./

# Copy packages from installer (pruned) to ensure all dependencies are available
COPY --from=installer --chown=nextjs:nodejs /app/packages/db ./packages/db
COPY --from=installer --chown=nextjs:nodejs /app/packages/config ./packages/config
COPY --from=installer --chown=nextjs:nodejs /app/packages/api ./packages/api
COPY --from=installer --chown=nextjs:nodejs /app/packages/auth ./packages/auth

COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/static ./apps/dash/.next/static

COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/public ./apps/dash/public

COPY --from=installer --chown=nextjs:nodejs /app/node_modules ./node_modules

# Add turbo.json to suppress "Could not find monorepo root" warnings
COPY --from=builder --chown=nextjs:nodejs /app/turbo.json ./turbo.json

ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/tsx packages/db/src/migrate.ts && node apps/dash/server.js"]
