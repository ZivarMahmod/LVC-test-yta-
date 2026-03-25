#!/bin/sh
# ===========================================
# LVC Media Hub — Docker Entrypoint
# ===========================================
set -e
echo "🏐 LVC Media Hub startar..."
echo "   Kör databasmigrering..."
cd /app/backend
npx prisma db push --skip-generate
echo "   Kontrollerar admin-konto..."
node src/utils/seedAdmin.js 2>/dev/null || true
echo "   Startar server..."
exec node src/server.js
