FROM oven/bun:1.3.11-alpine AS base

# Install libc6-compat for turbo/next
RUN apk add --no-cache libc6-compat
RUN bun add -g turbo@^2.5.4

FROM base AS builder
# Set working directory
WORKDIR /app
COPY . .
# Debug: check if package.json is correct
RUN cat package.json
RUN turbo prune --scope=@uptimekit/status-page --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
WORKDIR /app

# First install dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile

# Build the project
COPY --from=builder /app/out/full/ .
RUN bun x turbo build --filter=@uptimekit/status-page...

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/status-page/next.config.ts ./


# Automatically leverage output traces to reduce image size
COPY --from=installer --chown=nextjs:nodejs /app/apps/status-page/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/status-page/.next/static ./apps/status-page/.next/static

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["bun", "apps/status-page/server.js"]
