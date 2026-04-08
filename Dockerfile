# ===========================================
# LVC Media Hub — Dockerfile
# Multi-stage build: bygg frontend → kör backend
# PostgreSQL via extern container (docker-compose)
# ===========================================

# --- Steg 1: Bygg frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Steg 2: Produktionsimage ---
FROM node:20-alpine AS production
WORKDIR /app

# Installera build-verktyg för bcrypt (kompilerar nativ kod)
RUN apk add --no-cache python3 make g++ openssl openssl-dev

# Kopiera backend
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Ta bort build-verktyg efter installation (mindre image)
RUN apk del python3 make g++

# Kopiera backend-källkod
COPY backend/src/ ./src/
COPY backend/prisma/ ./prisma/
COPY backend/scripts/ ./scripts/

# Generera Prisma-klient
RUN npx prisma generate

# Kopiera färdigbyggd frontend från steg 1
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Skapa mappar för loggar, storage och thumbnails
RUN mkdir -p /app/backend/logs /app/backend/thumbnails /storage

# Kopiera entrypoint
COPY CHANGELOG.md /app/CHANGELOG.md
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Exponera port
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Starta via entrypoint (vänta på DB + migrering + seed + server)
ENTRYPOINT ["/app/entrypoint.sh"]
