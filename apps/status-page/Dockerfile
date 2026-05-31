FROM node:22-alpine AS base

# Install libc6-compat for turbo/next
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN pnpm add -g turbo@^2.5.4

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune @uptimekit/status-page --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
WORKDIR /app

# First install dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=builder /app/out/full/ .
RUN pnpm exec turbo build --filter=@uptimekit/status-page...

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/status-page/next.config.ts ./

# Copy packages from installer to ensure all dependencies are available
COPY --from=installer --chown=nextjs:nodejs /app/packages/db ./packages/db
COPY --from=installer --chown=nextjs:nodejs /app/packages/config ./packages/config
COPY --from=installer --chown=nextjs:nodejs /app/packages/api ./packages/api
COPY --from=installer --chown=nextjs:nodejs /app/packages/auth ./packages/auth

# Automatically leverage output traces to reduce image size
COPY --from=installer --chown=nextjs:nodejs /app/apps/status-page/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/status-page/.next/static ./apps/status-page/.next/static

COPY --from=installer --chown=nextjs:nodejs /app/node_modules ./node_modules

# Add turbo.json to suppress "Could not find monorepo root" warnings
COPY --from=builder --chown=nextjs:nodejs /app/turbo.json ./turbo.json

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
EXPOSE 3001
CMD ["node", "apps/status-page/server.js"]
