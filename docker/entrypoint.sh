#!/bin/sh
# Bring the database up to date before serving, so a deploy never lands on a
# schema the code does not expect.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set." >&2
  exit 1
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "AUTH_SECRET is not set. Generate one with: openssl rand -base64 32" >&2
  exit 1
fi

echo "→ Applying database migrations"
node "${PRISMA_CLI:-/prisma-cli/node_modules/prisma/build/index.js}" migrate deploy

# Disciplines and the ISO 19650 template are setup data, not demo data, and the
# seed upserts them, so this is safe on every boot. Demo content only appears
# when SEED_DEMO=true is set explicitly.
echo "→ Seeding catalogue"
node dist/seed.mjs

echo "→ Starting Protocolo BIM"
exec "$@"
