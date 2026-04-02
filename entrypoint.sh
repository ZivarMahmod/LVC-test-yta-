#!/bin/sh
# ===========================================
# LVC Media Hub — Docker Entrypoint
# ===========================================
set -e
echo "🏐 LVC Media Hub startar..."
echo "   Kör databasmigrering..."
cd /app/backend
# Om databasen skapades med db push (ingen _prisma_migrations-tabell),
# markera befintliga migrationer som redan körda (baseline).
if ! npx prisma migrate deploy 2>/dev/null; then
  echo "   Baselines befintliga migrationer..."
  for dir in prisma/migrations/*/; do
    name=$(basename "$dir")
    [ "$name" = "migration_lock.toml" ] && continue
    npx prisma migrate resolve --applied "$name" 2>/dev/null || true
  done
  npx prisma migrate deploy
fi
echo "   Kontrollerar admin-konto..."
node src/utils/seedAdmin.js 2>/dev/null || true
echo "   Startar server..."
exec node src/server.js
