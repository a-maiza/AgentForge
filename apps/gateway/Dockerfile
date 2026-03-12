# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/gateway/package.json ./apps/gateway/package.json

RUN pnpm install --filter @agentforge/gateway... --ignore-scripts

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/apps/gateway/node_modules ./apps/gateway/node_modules

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/gateway ./apps/gateway

RUN pnpm --filter @agentforge/shared build
RUN pnpm --filter @agentforge/gateway build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /repo/apps/gateway/dist ./dist
COPY --from=builder /repo/apps/gateway/node_modules ./node_modules
COPY --from=builder /repo/apps/gateway/package.json ./package.json

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 gateway \
  && chown -R gateway:nodejs /app
USER gateway

EXPOSE 3002
CMD ["node", "dist/index.js"]
