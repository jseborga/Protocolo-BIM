# syntax=docker/dockerfile:1

# Protocolo BIM — production image.
#
# Built for a single container that migrates its own database and can render
# PDFs, which is what a one-click panel such as Easypanel or Coolify expects.
# Debian rather than Alpine: Prisma's default query engine is glibc, and the
# PDF export needs a real Chromium.

ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
# The schema is in place before install so Prisma's postinstall generates the
# client here; the browser download is skipped because the image uses the
# Chromium that Debian ships.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build \
    && npx esbuild prisma/seed.ts \
        --bundle --platform=node --format=esm --packages=external \
        --outfile=dist/seed.mjs

# ---------------------------------------------------------------------------
# The migration CLI, installed on its own so its whole dependency closure comes
# along. Cherry-picking node_modules/prisma out of the build leaves transitive
# dependencies behind and the container dies on first boot.
FROM base AS prisma-cli
WORKDIR /prisma-cli
RUN npm init -y > /dev/null \
    && npm install --omit=dev --no-audit --no-fund "prisma@6.19.3"

# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium from the distribution instead of a Playwright download: it comes
# with its own dependency closure and is patched by Debian security updates.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        fonts-liberation \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# The standalone bundle already carries the server and the traced runtime
# dependencies, including the Prisma client and its engine.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Configuration comes from the environment the platform injects. A dotenv file
# that reached the build context must never end up inside the image.
RUN rm -f /app/.env /app/.env.*

# Migrations and catalogue seeding run at startup, so the schema, the bundled
# seed and the migration CLI have to travel with the image.
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/dist/seed.mjs ./dist/seed.mjs
COPY --from=prisma-cli --chown=node:node /prisma-cli /prisma-cli

COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/es/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
