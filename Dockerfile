# ===========================================
# LVC Media Hub — Dockerfile
# Bygg frontend → serva statiskt (Supabase-only)
# ===========================================

# --- Steg 1: Bygg frontend ---
FROM node:20-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
COPY frontend/.env .env
RUN npm run build

# --- Steg 2: Serva statiska filer ---
FROM node:20-alpine
RUN npm install -g serve@14
WORKDIR /app
COPY --from=build /app/frontend/dist ./dist
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/ || exit 1

CMD ["serve", "dist", "-l", "3001", "-s"]
