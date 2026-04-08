#!/bin/bash
# ===========================================
# Kvittra — Auto Deploy Script
# Körs av webhook eller cron: drar senaste koden och bygger om
# ===========================================
set -e

REPO_DIR="/opt/lvcmediahub"
BRANCH="${1:-claude/explore-migrate-supabase-gGM4t}"
LOG_FILE="/var/log/kvittra-deploy.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Deploy startar ==="
log "Branch: $BRANCH"

cd "$REPO_DIR"

# Hämta senaste koden
log "Drar senaste koden..."
git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
git reset --hard "origin/$BRANCH" 2>&1 | tee -a "$LOG_FILE"

# Bygg om containrar
log "Bygger om Docker-containrar..."
docker compose up -d --build 2>&1 | tee -a "$LOG_FILE"

# Vänta på health check
log "Väntar på health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    log "✅ Deploy klar — appen är live!"
    exit 0
  fi
  sleep 2
done

log "⚠️ Health check timeout — kolla loggar med: docker compose logs lvc-media-hub"
exit 1
