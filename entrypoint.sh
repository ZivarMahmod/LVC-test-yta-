#!/bin/sh
# ===========================================
# LVC Media Hub — Docker Entrypoint
# ===========================================
set -e
echo "🏐 LVC Media Hub startar..."
echo "   Kör databasmigrering..."
cd /app/backend
npx prisma migrate deploy
echo "   Kontrollerar admin-konto..."
node src/utils/seedAdmin.js 2>/dev/null || true
echo "   Startar server..."
exec node src/server.js
