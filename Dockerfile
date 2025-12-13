FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies (including build tools for better-sqlite3)
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner

ENV NODE_ENV=production

# Setup: wget for healthcheck, user, data folder
# Install dependencies for better-sqlite3 runtime
RUN apk add --no-cache wget libstdc++ su-exec \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nuxtjs \
    && mkdir -p ./data \
    && chown nuxtjs:nodejs ./data

COPY --from=builder --chown=nuxtjs:nodejs /app/.output ./.output
COPY --chmod=755 entrypoint.sh ./entrypoint.sh

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
