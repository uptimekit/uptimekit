FROM node:20-alpine AS base
WORKDIR /app

# System deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g turbo@^2.5.4


FROM base AS builder
COPY . .
RUN turbo prune --scope=@uptimekit/worker --docker


FROM base AS installer
WORKDIR /app

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install

COPY --from=builder /app/out/full/ .
RUN pnpm turbo build --filter=@uptimekit/worker...
RUN CI=true pnpm prune --prod

FROM base AS runner
WORKDIR /app

RUN apk add --no-cache iputils
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 worker
USER worker

COPY --from=installer --chown=worker:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=installer --chown=worker:nodejs /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=installer --chown=worker:nodejs /app/node_modules ./node_modules

ENV NODE_ENV=production

CMD ["node", "apps/worker/dist/index.js"]
