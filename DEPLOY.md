# Deploy Guide — LVC Media Hub (Kvikta)

Steg-för-steg för att sätta upp plattformen på en ny server.

## Förutsättningar

- Ubuntu 22.04+ (eller annan Linux-distro)
- Docker + Docker Compose installerat
- Minst 2 GB RAM, 20 GB disk
- (Valfritt) Domännamn med DNS (Cloudflare rekommenderas)
- (Valfritt) NAS för videolagring

## 1. Klona repot

```bash
git clone https://github.com/ZivarMahmod/LVC-test-yta-.git /opt/lvcmediahub
cd /opt/lvcmediahub
git checkout claude/explore-migrate-supabase-gGM4t  # eller main efter merge
```

## 2. Skapa .env-filer

### Root .env (PostgreSQL + Caddy)

```bash
cp .env.example .env
nano .env
```

Generera Supabase-nycklar:
```bash
node scripts/generate-supabase-keys.js
```

Fyll i `.env` med output + lösenord:
```env
POSTGRES_USER=lvc
POSTGRES_PASSWORD=<starkt lösenord>
POSTGRES_DB=lvcmediahub
SITE_ADDRESS=:80              # Bara HTTP
# SITE_ADDRESS=dindomän.se    # Auto-HTTPS via Let's Encrypt

# Kopiera från generate-supabase-keys.js:
SUPABASE_JWT_SECRET=<från scriptet>
SUPABASE_ANON_KEY=<från scriptet>
SUPABASE_SERVICE_ROLE_KEY=<från scriptet>
FRONTEND_URL=http://<din-ip>:3001
```

### Backend .env

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

**Generera secrets:**
```bash
# JWT secrets (kör varje rad separat, kopiera resultatet)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Fyll i:
```env
NODE_ENV=production
PORT=3001
USE_HTTPS=false          # true om du kör bakom SSL

FRONTEND_URL=http://din-ip:3001
BACKEND_URL=http://din-ip:3001

JWT_ACCESS_SECRET=<64-tecken hex>
JWT_REFRESH_SECRET=<annan 64-tecken hex>
CSRF_SECRET=<32-tecken hex>

STORAGE_PATH=/storage
ADMIN_EMAIL=admin@dindomän.se
ADMIN_PASSWORD=<starkt lösenord — skriv ner det!>
ADMIN_NAME=Admin
ADMIN_USERNAME=admin
```

## 3. Bygg och starta

```bash
cd /opt/lvcmediahub
docker compose up -d --build
```

Vänta ~2 minuter, kolla sedan:
```bash
docker compose ps              # Alla ska vara "healthy" eller "running"
docker compose logs lvc-media-hub --tail 20  # Kolla loggar
curl http://localhost:3001/api/health         # Ska svara {"status":"ok"}
```

## 4. Öppna i webbläsaren

- **App:** `http://<din-ip>:3001` → Login-sidan
- **Supabase Studio:** `http://<din-ip>:3040` → Databas-dashboard
- Logga in med admin-kontot du satte i .env

## 5. (Valfritt) Domän med HTTPS

### Alt A: Cloudflare Tunnel (rekommenderat)

```bash
# Installera cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Logga in (följ länken som visas)
cloudflared tunnel login

# Skapa tunnel
cloudflared tunnel create kvikta

# Konfigurera (~/.cloudflared/config.yml)
tunnel: <tunnel-id>
credentials-file: /home/<user>/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: dindomän.se
    service: http://localhost:3001
  - service: http_status:404

# DNS + starta
cloudflared tunnel route dns kvikta dindomän.se
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### Alt B: Caddy med direkt port 80/443

Sätt `SITE_ADDRESS=dindomän.se` i root `.env`.
Kräver att port 80/443 är öppna och pekar mot servern.

## 6. (Valfritt) NAS-lagring

Om du har en NAS för videofiler, montera den och ändra docker-compose:

```yaml
# I docker-compose.yml, byt:
volumes:
  - lvc-storage:/storage
# Till:
volumes:
  - /mnt/nas-matcher:/storage
```

Skapa mount-punkten:
```bash
sudo mkdir -p /mnt/nas-matcher
# SMB:
sudo mount -t cifs //nas-ip/matcher /mnt/nas-matcher -o user=...,pass=...
# Eller lägg till i /etc/fstab för auto-mount vid boot
```

## 7. Kom igång

1. Logga in som admin
2. Gå till **Admin** → Skapa lag + säsong
3. Gå till **Ladda upp** → Ladda upp en matchvideo + DVW-scoutfil
4. Klicka på matchen → Se scout-data, heatmap, scoreboard
5. Gå till **Spelare** → Se alla spelares statistik
6. Gå till **Analys** → Välj matcher för flermatchsanalys

## Portar

| Port | Tjänst | Beskrivning |
|------|--------|-------------|
| 3001 | LVC Media Hub | Huvudappen |
| 3040 | Supabase Studio | Databas-dashboard |
| 80 | Caddy | Reverse proxy (HTTP) |
| 443 | Caddy | Reverse proxy (HTTPS) |
| 5432 | PostgreSQL | Databas (intern, ej exponerad) |

## Uppdatera

```bash
cd /opt/lvcmediahub
git pull origin main
docker compose up -d --build
```

## Felsökning

```bash
# Se loggar
docker compose logs -f lvc-media-hub

# Starta om allt
docker compose down && docker compose up -d

# Återskapa databasen (VARNING: raderar all data)
docker compose down -v
docker compose up -d --build

# Kolla diskutrymme
df -h
docker system df
```
