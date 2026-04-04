FROM oven/bun:1.3.11-alpine AS base
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN bun add -g turbo@^2.5.4

FROM base AS builder
COPY . .
RUN turbo prune --scope=@uptimekit/scheduler --docker

FROM base AS installer
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile
COPY --from=builder /app/out/full/ .

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 scheduler
USER scheduler

COPY --from=installer --chown=scheduler:nodejs /app/packages/scheduler ./packages/scheduler
COPY --from=installer --chown=scheduler:nodejs /app/packages/db ./packages/db
COPY --from=installer --chown=scheduler:nodejs /app/packages/config ./packages/config
COPY --from=installer --chown=scheduler:nodejs /app/node_modules ./node_modules

ENV NODE_ENV=production

CMD ["bun", "packages/scheduler/src/index.ts"]
