FROM docker.io/node:26-alpine AS base
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10.33.0
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
# Bundle the migration runner into a single file so the runtime image needs
# neither tsx nor the workspace's node_modules.
RUN pnpm --filter @uptimekit/db run build:migrate

# The runtime image only ships Next's traced standalone output plus the
# bundled migrator; no package manager, build tooling or dev dependencies.
FROM docker.io/node:26-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/static ./apps/dash/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/public ./apps/dash/public
COPY --from=installer --chown=nextjs:nodejs /app/packages/db/dist/migrate.mjs ./migrate/migrate.mjs
COPY --from=installer --chown=nextjs:nodejs /app/packages/db/dist/migrations ./migrate/migrations
# Lets the env loader find the repository root instead of logging a warning.
COPY --from=builder --chown=nextjs:nodejs /app/turbo.json ./turbo.json

USER nextjs

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "node migrate/migrate.mjs && node apps/dash/server.js"]
