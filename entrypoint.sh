#!/bin/sh
# ===========================================
# LVC Media Hub — Docker Entrypoint
# PostgreSQL + Prisma
# ===========================================
set -e
echo "🏐 LVC Media Hub startar..."
cd /app/backend

# Vänta på att PostgreSQL är redo (backup om docker healthcheck inte räcker)
echo "   Väntar på databasanslutning..."
MAX_RETRIES=30
RETRY_COUNT=0
until npx prisma migrate deploy 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "   ❌ Kunde inte ansluta/migrera databasen efter $MAX_RETRIES försök"
    exit 1
  fi
  echo "   Väntar på PostgreSQL... (försök $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "   ✅ Databasmigrering klar"

echo "   Kontrollerar admin-konto..."
node src/utils/seedAdmin.js 2>/dev/null || true

# Skapa storage-mappar om de inte finns
mkdir -p /storage/documents
mkdir -p /app/backend/thumbnails

echo "   Startar server..."
exec node src/server.js
