# CorevoSports V1 -- Komplett Systemdokumentation

**Plattform:** CorevoSports (Multi-tenant Volleyball Video Analysis)
**Version:** 1.0 (Kvittra-arkitektur)
**Dokumentdatum:** 2026-04-09
**Server:** Dell Optiplex "Fallover" (192.168.50.100)
**Doman:** corevo.se (Cloudflare)

---

## Innehallsforteckning

1. [Oversikt och Bakgrund](#1-oversikt-och-bakgrund)
2. [Infrastruktur och Ntverk](#2-infrastruktur-och-natverk)
3. [Docker-stack -- Alla Containrar](#3-docker-stack----alla-containrar)
4. [Caddy Reverse Proxy](#4-caddy-reverse-proxy)
5. [Cloudflare Tunnel](#5-cloudflare-tunnel)
6. [Kong API Gateway](#6-kong-api-gateway)
7. [Databas -- PostgreSQL och Scheman](#7-databas----postgresql-och-scheman)
8. [Schema: public (Legacy LVC)](#8-schema-public-legacy-lvc)
9. [Schema: kvittra (Multi-tenant)](#9-schema-kvittra-multi-tenant)
10. [Row Level Security (RLS)](#10-row-level-security-rls)
11. [Supabase Auth (GoTrue)](#11-supabase-auth-gotrue)
12. [Edge Functions (OTP)](#12-edge-functions-otp)
13. [Autentiseringsflode](#13-autentiseringsflode)
14. [Frontend-arkitektur](#14-frontend-arkitektur)
15. [Context-lager](#15-context-lager)
16. [Routing och Sidor](#16-routing-och-sidor)
17. [Layout och Navigation](#17-layout-och-navigation)
18. [Superadmin-panelen](#18-superadmin-panelen)
19. [Branding-system](#19-branding-system)
20. [Feature Flags](#20-feature-flags)
21. [Supabase-klienter i Frontend](#21-supabase-klienter-i-frontend)
22. [Kompatibilitetslager (SupabaseAuthContext)](#22-kompatibilitetslager)
23. [Hooks](#23-hooks)
24. [Storage Buckets](#24-storage-buckets)
25. [Organisationer och Anvandare](#25-organisationer-och-anvandare)
26. [Migrationshistorik](#26-migrationshistorik)
27. [Byggprocess och Deploy](#27-byggprocess-och-deploy)
28. [Konfigurationsfiler](#28-konfigurationsfiler)
29. [Felsoning och Drifttips](#29-felsoning-och-drifttips)
30. [Arkitekturdiagram](#30-arkitekturdiagram)

---

## 1. Oversikt och Bakgrund

CorevoSports ar en multi-tenant plattform for volleyboll-videoanalys. Systemet hanterar
uppladdning, lagring, uppspelning och statistisk analys av volleybollmatcher med stod for
DVW-filer (Data Volley format).

### Historik

Plattformen borjade som **LVC Media Hub** -- en single-tenant applikation byggd enbart for
Linkopings VC. Under 2026 migrerades systemet till en multi-tenant-arkitektur under
varumarket **CorevoSports**, med kodnamnet **Kvittra** for det nya schemat och
autentiseringsfldet.

Migreringen beholl samtliga tabeller i `public`-schemat intakta (bakatkompabilitet) och
la till ett helt nytt `kvittra`-schema med organisationsbaserad dataisolering.

### Vad plattformen gor

- Volleybollklubbar (t.ex. Linkopings VC, Norrkoping VK) far var sin isolerad miljo
- Coacher laddar upp matchvideor och DVW-filer
- Systemet parsar DVW-data till individuella aktioner (serve, reception, passning, etc.)
- Spelare kan se sin egen statistik, ta emot feedback fran coacher
- Publica matchsidor kan delas utan inloggning
- Superadmin (Filip) hanterar alla organisationer, branding och anvandare

---

## 2. Infrastruktur och Natverk

### Serverspecifikation

```
Hostname:       Fallover
Maskin:         Dell Optiplex
IP (LAN):       192.168.50.100
OS:             Linux (6.17.0-19-generic)
Docker:         Ja, alla tjanster kors som containrar
```

### Natverksflode

```
                        INTERNET
                           |
                    +--------------+
                    |  Cloudflare  |
                    |  DNS + CDN   |
                    |  Zone:       |
                    |  corevo.se   |
                    +--------------+
                           |
                    +-------------------+
                    | Cloudflare Tunnel |
                    | "kvikta"          |
                    | UUID: 04b5d8a6... |
                    +-------------------+
                           |
                     localhost:80
                           |
                    +--------------+
                    |   lvc-caddy  |
                    |   Port 80/443|
                    +--------------+
                      /          \
            /supabase-api     /allt-annat
                 |                |
          +----------+    +--------------+
          | lvc-kong |    | lvc-media-hub|
          | Port 8000|    | Port 3001    |
          +----------+    +--------------+
           /  |  |  \
      auth rest storage realtime functions
```

### DNS-poster (Cloudflare)

| Hostname                  | Typ   | Pekar pa                     |
|---------------------------|-------|------------------------------|
| corevosports.corevo.se    | CNAME | 04b5d8a6...cfargotunnel.com  |
| filipadmin.corevo.se      | CNAME | 04b5d8a6...cfargotunnel.com  |

Cloudflare Zone ID: `72cfc6ef04d85d0b13572f94e35e479a`

---

## 3. Docker-stack -- Alla Containrar

Hela plattformen kors via `docker compose` fran `/opt/lvcmediahub/docker-compose.yml`.

### Oversikt av alla containrar

```
+---------------------+------------------------------------+--------+------------------+
| Container           | Image                              | Port   | Funktion         |
+---------------------+------------------------------------+--------+------------------+
| lvc-postgres        | supabase/postgres:15.8.1.060       | 5433*  | Databas          |
| lvc-supabase-auth   | supabase/gotrue:v2.164.0           | 9999** | Auth (GoTrue)    |
| lvc-supabase-rest   | postgrest/postgrest:v12.2.3        | 3000** | REST API         |
| lvc-supabase-kong   | kong:2.8.1                         | 8000** | API Gateway      |
| lvc-supabase-realtime| supabase/realtime:v2.30.34        | 4000** | Realtime/WS      |
| lvc-supabase-storage| supabase/storage-api:v1.11.13      | 5000** | Fillagring       |
| lvc-supabase-meta   | supabase/postgres-meta:v0.84.2     | 8080** | DB-metadata      |
| lvc-supabase-studio | supabase/studio:20240422-5cf8f30   | 3040   | Admin-GUI (LAN)  |
| lvc-supabase-functions| supabase/edge-runtime:v1.58.3    | 9000** | Edge Functions   |
| lvc-media-hub       | lvcmediahub-lvc-media-hub (custom) | 3001** | React frontend   |
| lvc-caddy           | caddy:2-alpine                     | 80,443 | Reverse proxy    |
+---------------------+------------------------------------+--------+------------------+

*  = Bunden till 127.0.0.1 (enbart lokal atkomst)
** = Exponerad enbart internt i Docker-natverket (ej host)
```

### Beroendekedja (starordning)

```
postgres (healthcheck)
   |
   +-- supabase-auth
   +-- supabase-rest
   +-- supabase-realtime
   +-- supabase-storage --> supabase-rest
   +-- supabase-meta
   |
   +-- kong --> supabase-auth, supabase-rest
   +-- supabase-studio --> supabase-meta, kong
   |
   +-- caddy --> lvc-media-hub, kong
```

### Docker Volumes

| Volume            | Anvandning                              |
|-------------------|-----------------------------------------|
| lvc-pgdata        | PostgreSQL-data (persistent)             |
| lvc-storage-data  | Uppladdade filer (videos, bilder, DVW)   |
| lvc-caddy-data    | Caddy TLS-certifikat (automatiska)       |
| lvc-caddy-config  | Caddy-konfiguration                      |

---

## 4. Caddy Reverse Proxy

Caddy fungerar som ingangspunkt for all HTTP-trafik. Konfigurationen ar minimal men
effektiv.

**Fil:** `/opt/lvcmediahub/Caddyfile`

```caddy
:80 {
    @supabase path /rest/v1/* /auth/v1/* /storage/v1/* /realtime/v1/* /functions/v1/* /pg/*
    handle @supabase {
        reverse_proxy kong:8000
    }
    handle {
        reverse_proxy lvc-media-hub:3001
    }
}
```

### Hur det fungerar

1. Caddy lyssnar pa port 80 (Cloudflare terminerar TLS)
2. Alla Supabase API-anrop (`/rest/v1/`, `/auth/v1/`, etc.) dirigeras till Kong (port 8000)
3. Allt annat (frontend, landingssida, SPA-routes) gar till lvc-media-hub (port 3001)
4. `serve` i lvc-media-hub hanterar SPA-routing med `-s` flaggan (single page app mode)

### Viktigt om TLS

Cloudflare Tunnel terminerar TLS at internet-sidan. Mellan tunnel och Caddy gar trafiken
over HTTP (localhost). Caddy utforder darfor INTE TLS-certifikat sjalv -- den kors pa `:80`.

---

## 5. Cloudflare Tunnel

**Fil:** `/etc/cloudflared/config.yml`

```yaml
tunnel: 04b5d8a6-f31b-458d-a86d-57c8b3cd6491
credentials-file: /home/zivar/.cloudflared/04b5d8a6-f31b-458d-a86d-57c8b3cd6491.json
ingress:
  - hostname: filipadmin.corevo.se
    service: http://localhost:80
  - hostname: corevosports.corevo.se
    service: http://localhost:80
  - service: http_status:404
```

### Tunnelnamn: kvikta

Tunneln heter "kvikta" och routar tva hostnamn till samma Caddy-instans (port 80).
Caddy och frontend-appen skiljer sedan pa hostnamen i klienten:
- `corevosports.corevo.se` --> Normal app
- `filipadmin.corevo.se` --> Superadmin-mode (detekteras av `window.location.hostname`)

Credentials-filen finns under `/home/zivar/.cloudflared/`.

---

## 6. Kong API Gateway

Kong sitter mellan Caddy och alla Supabase-tjanster. Den hanterar autentisering via
API-nycklar (anon key / service_role key) och CORS.

**Fil:** `/opt/lvcmediahub/volumes/api/kong.yml`

### Routingtabell

| Route              | Backend                              | Autentisering          |
|--------------------|--------------------------------------|------------------------|
| /auth/v1/verify    | supabase-auth:9999/verify            | Oppen (CORS)           |
| /auth/v1/callback  | supabase-auth:9999/callback          | Oppen (CORS)           |
| /auth/v1/authorize | supabase-auth:9999/authorize         | Oppen (CORS)           |
| /auth/v1/*         | supabase-auth:9999                   | key-auth + ACL         |
| /rest/v1/*         | supabase-rest:3000                   | key-auth + ACL         |
| /realtime/v1/*     | supabase-realtime:4000/socket/       | key-auth + ACL         |
| /storage/v1/*      | supabase-storage:5000                | key-auth + ACL         |
| /functions/v1/*    | supabase-functions:9000              | key-auth + ACL         |
| /pg/*              | supabase-meta:8080                   | key-auth (admin only)  |

### Consumers

- `anon` -- Anonym anvandare, anvander SUPABASE_ANON_KEY
- `service_role` -- Full databasatkomst, anvander SUPABASE_SERVICE_ROLE_KEY
- `DASHBOARD` -- Supabase Studio

### ACL-grupper

- `anon` -- Tillaten pa alla publika endpoints
- `admin` -- Tillaten overallt (inklusive /pg/ for Studio)

---

## 7. Databas -- PostgreSQL och Scheman

### Anslutning

```
Host:     127.0.0.1 (enbart fran servern)
Port:     5433 (mappat fran Docker 5432)
Databas:  postgres
Anvandare: supabase_admin (intern), authenticator (PostgREST)
```

### Supabase Studio

Atkomlig pa `192.168.50.100:3040` -- ENBART fran LAN. Bundet till serverns IP,
inte 0.0.0.0, for sakerhets skull.

### Schemastruktur

```
postgres
  |
  +-- auth           (Supabase Auth -- auth.users, auth.sessions, etc.)
  +-- storage        (Supabase Storage -- buckets, objects)
  +-- _realtime      (Supabase Realtime intern)
  +-- public         (Legacy LVC-tabeller)
  +-- kvittra        (Multi-tenant CorevoSports-tabeller)
```

PostgREST exponerar tre scheman: `public`, `storage`, och `kvittra`.
Konfigurerat via: `PGRST_DB_SCHEMAS: public,storage,kvittra`

---

## 8. Schema: public (Legacy LVC)

Dessa tabeller skapades i migration `00001_initial_schema.sql` och ar kvar fran
den ursprungliga single-tenant-applikationen.

### Tabeller

| Tabell              | Beskrivning                                    |
|---------------------|------------------------------------------------|
| profiles            | Utokad anvandarprofil (extends auth.users)     |
| invite_tokens       | Inbjudningslnkar for registrering              |
| teams               | Lag (Herrlag, Damlag, etc.)                    |
| seasons             | Sasonger per lag                               |
| videos              | Matchvideor med metadata                       |
| match_documents     | Bilagor kopplade till videor                   |
| changelog_entries   | Versionshistorik for appen                     |
| thumbnail_library   | Lagbilder/thumbnails                           |
| user_teams          | Many-to-many: anvandare <-> lag                |
| coach_reviews       | Coachfeedback pa enskilda aktioner              |
| settings            | Nyckel-varde-inst:llningar                     |
| audit_logs          | Granskningslogg                                |

### profiles-tabellen

```sql
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text UNIQUE NOT NULL,
  username      text UNIQUE NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin', 'coach', 'uploader', 'viewer')),
  jersey_number int,
  preferences   jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

En trigger `on_auth_user_created` skapar automatiskt en profil nar en ny auth-anvandare
skapas:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### videos-tabellen (legacy)

```sql
CREATE TABLE public.videos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  opponent        text NOT NULL,
  match_date      timestamptz NOT NULL,
  file_path       text NOT NULL,
  file_size       bigint NOT NULL,
  dvw_path        text,
  match_type      text NOT NULL DEFAULT 'own'
                    CHECK (match_type IN ('own', 'opponent')),
  video_offset    int NOT NULL DEFAULT 0,
  team_id         int REFERENCES public.teams(id),
  season_id       int REFERENCES public.seasons(id),
  uploaded_by_id  uuid NOT NULL REFERENCES public.profiles(id),
  -- ... fler kolumner
);
```

### RLS-hjalpfunktioner (public)

```sql
public.user_role()           -- Returnerar roll fran profiles-tabellen
public.is_admin()            -- true om anvandaren ar admin
public.is_coach_or_admin()   -- true om coach eller admin
public.can_upload()          -- true om admin, coach, eller uploader
```

---

## 9. Schema: kvittra (Multi-tenant)

Kvittra-schemat implementerar fullstandig multi-tenancy. Varje tabell har en `org_id`
som kopplar data till en organisation.

### Tabeller

```
kvittra
  |
  +-- organizations           Organisationer (LVC, Norrkoping VK, ...)
  +-- organization_members    Medlemskap: user_id + org_id + roles[]
  +-- player_profiles         Spelardata (position, tronummer)
  +-- teams                   Lag (org-scopade)
  +-- matches                 Matcher (intern/publik)
  +-- videos                  Videofiler kopplade till matcher
  +-- actions                 DVW-parsade aktioner (serve, reception, etc.)
  +-- features_config         Feature flags (global + per org)
  +-- otp_codes               OTP-koder for 2FA
  +-- audit_logs              Granskningslogg (org-scopad)
  +-- settings                Nyckel-varde per org
  +-- coach_reviews           Coachfeedback (org-scopad)
  +-- match_documents         Bilagor till matcher (org-scopad)
```

### organizations

```sql
CREATE TABLE kvittra.organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,             -- "Linkopings VC"
  slug            text UNIQUE NOT NULL,      -- "lvc"
  branding_config jsonb NOT NULL DEFAULT '{}',
  features_config jsonb NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

Slug anvands i URL:er: `/app/lvc`, `/app/norrkoping`.

### organization_members

```sql
CREATE TABLE kvittra.organization_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  roles       text[] NOT NULL DEFAULT '{}',   -- {'admin', 'coach', 'uploader', 'player'}
  is_active   boolean NOT NULL DEFAULT true,
  recovery_email text,                        -- Tillagd i migration 00005
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);
```

**Viktigt:** En anvandare kan vara medlem i FLERA organisationer med OLIKA roller.
Roller ar en text-array, sa en anvandare kan ha `{admin, coach}` i en org och
`{player}` i en annan.

### matches

```sql
CREATE TABLE kvittra.matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES kvittra.organizations(id),
  team_id       uuid REFERENCES kvittra.teams(id),
  title         text NOT NULL,
  match_date    date,
  visibility    text NOT NULL DEFAULT 'internal'
                  CHECK (visibility IN ('internal', 'public')),
  match_type    text NOT NULL DEFAULT 'match'
                  CHECK (match_type IN ('match', 'scout')),
  dvw_file_url  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

Matcher kan vara `internal` (krav pa inloggning + org-medlemskap) eller `public`
(atkomliga for alla, aven anonyma besokare).

### actions (DVW-data)

```sql
CREATE TABLE kvittra.actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid NOT NULL REFERENCES kvittra.matches(id),
  org_id        uuid NOT NULL REFERENCES kvittra.organizations(id),
  player_name   text,
  player_id     uuid REFERENCES kvittra.player_profiles(id),
  team_name     text,
  action_type   text,      -- S=Serve, R=Reception, P=Pass, A=Attack, D=Dig, B=Block, G=Set
  result        text,      -- #=Perfekt, +=Bra, !=OK, -=Dalig, /=Fel, ==Boll borta
  zone_start    int,       -- Startzon (1-9, volleybollplan)
  zone_end      int,       -- Slutzon
  set_number    int,       -- Setnummer (1-5)
  timestamp_sec int,       -- Sekund i videon
  raw_code      text,      -- Original DVW-kodrad
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### DVW Betygssystem

```
  # = Perfekt (grn)
  + = Bra (ljusgron)
  ! = OK (orange)
  - = Dalig (rod-orange)
  / = Fel (rod)
  = = Boll borta (morkrod)
```

### Aktionstyper

```
  S = Serve
  R = Reception
  P = Passning (set)
  A = Attack
  D = Forsvar (dig)
  B = Block
  G = Fripassning
```

---

## 10. Row Level Security (RLS)

RLS ar aktiverat pa ALLA tabeller i bade `public` och `kvittra`. Policies
kontrollerar vilken data varje anvandare kan se och modifiera.

### kvittra RLS-hjalpfunktioner

```sql
-- Returnerar alla org-ID:n anvandaren tillhor
kvittra.get_my_org_ids() -> uuid[]

-- Kontrollerar om anvandaren har en specifik roll i en org
kvittra.has_role_in_org(p_org_id uuid, p_role text) -> boolean

-- Bekvamlighetsmetoder
kvittra.is_org_admin(p_org_id uuid) -> boolean
kvittra.is_org_coach_or_admin(p_org_id uuid) -> boolean
kvittra.can_upload_in_org(p_org_id uuid) -> boolean
kvittra.get_my_member_id(p_org_id uuid) -> uuid
```

Alla hjalpfunktioner ar `SECURITY DEFINER` och `STABLE`, sa de kors med
skaparens ratigheter och kan cachas av PostgreSQL.

### RLS-principen for kvittra

```
+-----------------------+-------------------+-------------------+--------------------+
| Tabell                | SELECT            | INSERT            | UPDATE/DELETE      |
+-----------------------+-------------------+-------------------+--------------------+
| organizations         | Egna orgs (auth)  | service_role      | service_role       |
|                       | Alla aktiva (anon)|                   |                    |
+-----------------------+-------------------+-------------------+--------------------+
| organization_members  | Egna orgs         | Org-admin         | Org-admin          |
+-----------------------+-------------------+-------------------+--------------------+
| teams                 | Egna orgs         | Coach/admin       | Coach/admin (upd)  |
|                       |                   |                   | Admin (delete)     |
+-----------------------+-------------------+-------------------+--------------------+
| matches               | Egna orgs (auth)  | Uploader+         | Coach/admin (upd)  |
|                       | Publika (anon)    |                   | Admin (delete)     |
+-----------------------+-------------------+-------------------+--------------------+
| videos                | Egna orgs (auth)  | Uploader+         | Admin (delete)     |
|                       | Publika (anon)    |                   |                    |
+-----------------------+-------------------+-------------------+--------------------+
| actions               | Egna orgs (auth)  | Uploader+         | Coach/admin (del)  |
|                       | Publika (anon)    |                   |                    |
+-----------------------+-------------------+-------------------+--------------------+
| coach_reviews         | Spelare/coach/adm | Coach/admin       | Spelare/coach/adm  |
+-----------------------+-------------------+-------------------+--------------------+
| features_config       | Alla (auth+anon)  | service_role      | service_role       |
+-----------------------+-------------------+-------------------+--------------------+
| otp_codes             | Egna koder        | service_role      | service_role       |
+-----------------------+-------------------+-------------------+--------------------+
| audit_logs            | Org-admin         | Alla auth         | --                 |
+-----------------------+-------------------+-------------------+--------------------+
| settings              | Egna orgs         | Org-admin         | Org-admin          |
+-----------------------+-------------------+-------------------+--------------------+
```

---

## 11. Supabase Auth (GoTrue)

GoTrue hanterar all autentisering: skapa anvandare, logga in, sessioner, JWT-tokens.

### Konfiguration (docker-compose.yml)

```yaml
supabase-auth:
  image: supabase/gotrue:v2.164.0
  environment:
    GOTRUE_API_HOST: 0.0.0.0
    GOTRUE_API_PORT: 9999
    GOTRUE_SITE_URL: https://lvcmediahub.corevo.se
    GOTRUE_DB_DATABASE_URL: postgresql://supabase_auth_admin:***@postgres:5432/postgres?search_path=auth
    GOTRUE_DISABLE_SIGNUP: "false"
    GOTRUE_JWT_SECRET: ${SUPABASE_JWT_SECRET}
    GOTRUE_JWT_EXP: 3600
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
    GOTRUE_MAILER_AUTOCONFIRM: "true"
```

### Viktiga detaljer

- **JWT-utgangstid:** 3600 sekunder (1 timme)
- **Auto-confirm:** Aktiverat (anvandare bekraftas direkt vid skapande)
- **Signup:** Oppet (men kontrolleras i praktiken av superadmin)
- **Roller i JWT:** `anon` (anonym) och `authenticated` (inloggad)
- **Admin-roll:** `service_role` i JWT for full databasatkomst

### Superadmin-flagga

Superadmin identifieras via `is_super_admin = true` i `auth.users`-tabellen.
I frontend detekteras superadmin-mode via hostname (`filipadmin.corevo.se`).

---

## 12. Edge Functions (OTP)

Edge Functions kors i Supabase Edge Runtime (Deno). En enda router-fil hanterar
bade generering och verifiering av OTP-koder.

### Fil: `/opt/lvcmediahub/supabase/functions/main/index.ts`

### Funktioner

#### generate-otp

```
POST /functions/v1/generate-otp
Body: { userId: string, email: string }
```

1. Genererar 6-siffrig slumpkod
2. Hashar koden med SHA-256
3. Invaliderar alla befintliga koder for anvandaren (`used = true`)
4. Sparar ny hash i `kvittra.otp_codes` med 10 minuters TTL
5. Slr upp `recovery_email` fran `organization_members`
6. Skickar kod via SMTP till recovery_email (eller login-email som fallback)

#### verify-otp

```
POST /functions/v1/verify-otp
Body: { userId: string, code: string }
```

1. Hashar den inskickade koden med SHA-256
2. Soker matchande, oanvand, ej utgangen kod i `kvittra.otp_codes`
3. Markerar koden som `used = true`
4. Hamtar anvandarens organisationer fran `organization_members`
5. Returnerar lista av organisationer (for org-picker)

### SMTP-konfiguration

```
Host:     send.one.com
Port:     465 (TLS/SSL)
Anvandare: support.volleybol@corevo.se
Fran:     support.volleybol@corevo.se
```

SMTP-losenord sats som environment-variabel `SMTP_PASSWORD` pa supabase-functions-containern.

### OTP-kodens livscykel

```
  +----------+     +--------+     +----------+     +--------+
  | Generate |---->| Hash   |---->| Store DB |---->| Email  |
  | 6 siffr. |     | SHA256 |     | 10 min   |     | SMTP   |
  +----------+     +--------+     +----------+     +--------+
                                        |
                                        v
  +----------+     +--------+     +----------+
  | Verify   |---->| Hash   |---->| Match?   |---> success / fail
  | Input    |     | SHA256 |     | DB lookup|
  +----------+     +--------+     +----------+
```

---

## 13. Autentiseringsflode

Inloggning sker i fyra steg pa `/login`:

```
  +---------+     +----------+     +--------+     +------------+     +----------+
  | Steg 1  |---->| Steg 2   |---->| Steg 3 |---->| Steg 4     |---->| Redirect |
  | Email   |     | Losenord |     | OTP    |     | Org-picker |     | /app/slug|
  +---------+     +----------+     +--------+     +------------+     +----------+
```

### Steg 1: E-post

Anvandaren anger sin e-postadress. Ingen server-validering -- alltid vidare till steg 2.

### Steg 2: Losenord

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email, password
});
```

Vid lyckad inloggning sparas `userId` och `email` i komponentens state.
Sedan anropas `requestOtp()` automatiskt.

### Steg 3: OTP-verifiering

En 6-siffrig kod skickas till anvandarens recovery_email (eller login-email).
Anvandaren anger koden. Vid verifiering returneras en lista av organisationer.

### Steg 4: Org-picker (villkorlig)

- Om anvandaren tillhor **en** organisation: Direkt redirect till `/app/{slug}`
- Om anvandaren tillhor **flera** organisationer: Visa lista att valja fran
- Om anvandaren tillhor **noll** organisationer: Felmeddelande

### Sessionhantering

Efter inloggning lagras session i localStorage via Supabase-klientens inbyggda
auth. JWT-token refreshas automatiskt (1 timmes utgangstid). OTP-verifiering ar
en extra skerhetslager OVANPA Supabase Auth -- den forhindrar inte sessionen fran
att skapas, men styr om anvandaren far se org-panelen.

---

## 14. Frontend-arkitektur

### Teknikstack

| Teknik            | Version     | Anvandning                          |
|-------------------|-------------|-------------------------------------|
| React             | 18.3.1      | UI-ramverk                          |
| React Router DOM  | 6.28.0      | Klientroutning                      |
| Vite              | 5.4.11      | Bundler och dev-server              |
| @supabase/supabase-js | 2.102.1 | Supabase-klient                    |
| SWR               | 2.4.1       | Data-fetching med cache             |
| serve             | 14.x        | Statisk filserver i produktion      |

### Katalogstruktur

```
frontend/src/
  |
  +-- main.jsx                      Entrypoint
  +-- KvittraApp.jsx                Routing (Routes + ProtectedRoute)
  +-- index.css                     Globala stilar
  +-- App.jsx                       (Legacy, ej anvand)
  |
  +-- context/
  |   +-- KvittraAuthContext.jsx     Primar auth-kontext
  |   +-- OrgContext.jsx             Organisations-kontext
  |   +-- BrandingContext.jsx        Temahantering
  |   +-- SupabaseAuthContext.jsx    Kompatibilitetslager
  |   +-- AuthContext.jsx            (Legacy)
  |
  +-- pages/
  |   +-- LandingPage.jsx            Publik startsida
  |   +-- KvittraLoginPage.jsx       Flerstegs-inloggning
  |   +-- SuperadminPage.jsx         filipadmin.corevo.se
  |   +-- OrgHomePage.jsx            Dashboard per org
  |   +-- TeamsPage.jsx              Lagvy
  |   +-- SeasonsPage.jsx            Sasonger per lag
  |   +-- VideosPage.jsx             Videolista
  |   +-- VideoPlayerPage.jsx        Videospelare
  |   +-- UploadPage.jsx             Uppladdning
  |   +-- AdminPage.jsx              Org-admin
  |   +-- AnalysisPage.jsx           Statistik/analys
  |   +-- MultiScoutPage.jsx         Scout-verktyg
  |   +-- PlayerStatsPage.jsx        Spelarstatistik
  |   +-- InboxPage.jsx              Coach-feedback inbox
  |   +-- ChangelogPage.jsx          Versionshistorik
  |   +-- public/
  |       +-- CoachAdminPanel.jsx    Coach-vy (kvittra)
  |       +-- PlayerDashboard.jsx    Spelarvy (kvittra)
  |       +-- UploaderPanel.jsx      Uppladdarvy (kvittra)
  |       +-- PublicMatchesPage.jsx  Publika matcher
  |       +-- PublicVideoPage.jsx    Publik video
  |
  +-- components/
  |   +-- layout/
  |   |   +-- Layout.jsx             Huvudlayout med navigation
  |   |   +-- Layout.css
  |   +-- player/                    Spelarrelaterade komponenter
  |   +-- public/                    Publika komponenter
  |
  +-- hooks/
  |   +-- useApi.js                  API-anrop
  |   +-- useFeature.js              Feature flag-kontroll
  |   +-- useGradeSymbols.js         Anpassningsbara betygsymboler
  |   +-- useScoreboardSettings.js   Scoreboard-installningar
  |
  +-- utils/
      +-- supabaseClient.js          Supabase-klientinstanser
      +-- apiSwitch.js               API-router (re-export)
      +-- supabaseApi.js             Supabase API-funktioner
```

### Provider-hierarki

```javascript
// main.jsx
<React.StrictMode>
  <BrowserRouter>
    <AuthProvider>          {/* KvittraAuthContext */}
      <OrgProvider>         {/* OrgContext -- laser slug fran URL */}
        <BrandingProvider>  {/* BrandingContext -- applicerar CSS-variabler */}
          <KvittraApp />    {/* Routing */}
        </BrandingProvider>
      </OrgProvider>
    </AuthProvider>
  </BrowserRouter>
</React.StrictMode>
```

---

## 15. Context-lager

### KvittraAuthContext (primar)

**Fil:** `context/KvittraAuthContext.jsx`

Exporterar: `AuthProvider`, `useAuth()`

Tillhandahller:
- `user` -- Inloggad anvandare (id, email, name)
- `loading` -- Laddar session?
- `isAuthenticated` -- Ar anvandaren inloggad?
- `signInWithPassword(email, password)` -- Steg 2
- `requestOtp(userId, email)` -- Steg 3 (generera OTP)
- `verifyOtp(userId, code)` -- Steg 3 (verifiera OTP, returnerar organisationer)
- `redirectToOrg(slug)` -- Steg 4
- `logout()` -- Logga ut
- `changePassword(current, new)` -- Byt losenord
- Steg-konstanter: `STEP_EMAIL`, `STEP_PASSWORD`, `STEP_OTP`, `STEP_ORG_PICKER`, `STEP_DONE`

### OrgContext

**Fil:** `context/OrgContext.jsx`

Exporterar: `OrgProvider`, `useOrg()`

Laser `slug` fran URL-pathen (`/app/:slug`), hamtar organisation och medlemskap.

Tillhandahller:
- `org` -- Organisationsobjekt (id, name, slug, branding_config, etc.)
- `membership` -- Anvndarens medlemskap (id, roles, is_active)
- `slug` -- Organisationens slug
- `orgId` -- Organisationens UUID
- `roles` -- Anvandarens roller (text-array)
- `isSuperadmin` -- Ar vi pa filipadmin.corevo.se?
- `isLandingPage` -- Ar vi pa startsidan?
- `hasRole(role)` -- Kontrollera en specifik roll
- `isOrgAdmin` -- Ar anvandaren admin i denna org?
- `isOrgCoach` -- Ar anvandaren coach (eller admin)?
- `canUpload` -- Kan anvandaren ladda upp?
- `isPlayer` -- Ar anvandaren spelare?

### BrandingContext

**Fil:** `context/BrandingContext.jsx`

Exporterar: `BrandingProvider`, `useBranding()`

Laser `branding_config` fran organisationsobjektet och applicerar CSS-variabler pa `:root`.

CSS-variabler som satts:
```css
--brand-primary     /* Primarfarg */
--brand-secondary   /* Sekundarfarg */
--brand-bg          /* Bakgrundsfarg */
--brand-surface     /* Ytfarg (kort, paneler) */
--brand-text        /* Textfarg */
--brand-font        /* Typsnitt */
```

Default-tema (om org saknar branding):
```javascript
{
  primary_color: '#1a5fb4',
  secondary_color: '#e8a825',
  background_color: '#0a1628',
  surface_color: '#111f3a',
  text_color: '#f4f5f7',
  font: "'DM Sans', system-ui, sans-serif"
}
```

---

## 16. Routing och Sidor

### KvittraApp.jsx -- Routingstruktur

```
/                          LandingPage (publik)
/login                     KvittraLoginPage (publik)
/app/:slug                 Layout (ProtectedRoute)
  |-- (index)                TeamsPage
  |-- dashboard              OrgHomePage
  |-- team/:teamId           SeasonsPage
  |-- team/:teamId/season/:seasonId  VideosPage
  |-- videos                 VideosPage
  |-- video/:id              VideoPlayerPage
  |-- upload                 UploadPage [admin/coach/uploader]
  |-- admin                  AdminPage [admin]
  |-- coach                  CoachAdminPanel [admin/coach]
  |-- uploader               UploaderPanel [admin/coach/uploader]
  |-- analys                 AnalysisPage
  |-- multi-scout            MultiScoutPage
  |-- player/:playerId       PlayerStatsPage
  |-- my-stats               PlayerDashboard
  |-- inbox                  InboxPage
  |-- changelog              ChangelogPage
/app/:slug/public            PublicMatchesPage (ingen auth)
/app/:slug/public/match/:matchId  PublicVideoPage (ingen auth)
```

### filipadmin.corevo.se (specialfall)

Nar hostname borjar med `filipadmin.` aktiveras superadmin-mode:

```javascript
if (isSuperadmin) {
  return (
    <Routes>
      <Route path="/login" element={<KvittraLoginPage />} />
      <Route path="*" element={<SuperadminPage />} />
    </Routes>
  );
}
```

### ProtectedRoute-komponenten

```javascript
function ProtectedRoute({ children, requiredRoles }) {
  const { user, loading: authLoading } = useAuth();
  const { membership, loading: orgLoading, slug } = useOrg();

  if (!user) return <Navigate to="/login" replace />;
  if (!membership) return "Ingen atkomst";

  if (requiredRoles) {
    const hasRole = requiredRoles.some(r => membership.roles.includes(r));
    if (!hasRole) return <Navigate to={`/app/${slug}`} replace />;
  }

  return children;
}
```

### Lazy Loading

Alla sidor anvander `React.lazy()` for koddelning:

```javascript
const TeamsPage = React.lazy(() => import('./pages/TeamsPage.jsx'));
const SeasonsPage = React.lazy(() => import('./pages/SeasonsPage.jsx'));
// ... etc
```

Varje sida laddas som en separat JavaScript-chunk forst nar den behovs.

---

## 17. Layout och Navigation

**Fil:** `components/layout/Layout.jsx`

Layout-komponenten innehaller:
1. Topbar med logotyp, navigation och anvandarmeny
2. Mobil-meny (hamburgar)
3. Dropdown for anvandarprofil
4. Losenordsbyte
5. Installningar (symboler + scoreboard)
6. "Visa som roll"-funktion (admin kan forhandsgranska andra roller)

### NavLink-mangd (viktigt)

Alla NavLinks anvander **relativa sokvagar** (utan ledande `/`):

```jsx
<NavLink to="dashboard" className="nav-link">Dashboard</NavLink>
<NavLink to="." end className="nav-link">Videor</NavLink>
<NavLink to="coach" className="nav-link">Coach</NavLink>
```

Detta ar kritiskt for att routes ska fungera under `/app/:slug` -- med absoluta
sokvagar skulle lankarna ga till `/dashboard` istallet for `/app/lvc/dashboard`.

### Villkorlig navigation

| Lank        | Visas for               |
|-------------|-------------------------|
| Dashboard   | Alla                    |
| Videor      | Alla                    |
| Coach       | Admin, Coach            |
| Uppladdning | Admin, Coach, Uploader  |
| Min statistik| Alla                   |
| Analys      | Alla                    |
| Admin       | Admin                   |
| Inbox       | Alla (badge for olasta) |
| Logg        | Alla                    |

### "Visa som roll"-funktionen

Admins kan forhandsgranska vad andra roller ser via en roll-valjare i
anvandardropdownen. Detta andrar inte nagot i databasen -- det paverkar
enbart vilka menyval och sidor som visas i UI:t.

---

## 18. Superadmin-panelen

**URL:** `filipadmin.corevo.se`
**Fil:** `pages/SuperadminPage.jsx`

Superadmin-panelen anvander `supabaseAdmin` och `supabaseAdminKvittra` (service_role key)
for full databasatkomst utan RLS-restriktioner.

### Flikar

#### 1. Organisationer

- Lista alla organisationer med namn, slug, status, skapandedatum
- Skapa ny organisation med namn, slug och brandingtemplate
- Aktivera/inaktivera organisationer

#### 2. Branding

- Valj organisation fran dropdown
- Valj brandingtemplate (Morkt Bla, Morkt Gront, Morkt Rott, Morkt Lila, Ljust Rent)
- Anpassa enskilda farger med color picker
- Andara typsnitt
- Live-forhandsvisning av temat
- Spara direkt till `kvittra.organizations.branding_config`

#### 3. Features

- Valj "Globala features" eller en specifik organisation
- Sla pa/av features
- Lagg till nya feature-nycklar
- Organisationsspecifika features overskriver globala

#### 4. Anvandare

Arbetsflode for att skapa en ny anvandare:

```
1. Valj organisation
2. Ange login-epost
3. Ange recovery-epost (valfri)
4. Valj roller (checkboxar: admin/coach/uploader/player)
5. Klicka "Skapa"
```

Bakom kulisserna:

```
a) Soker i auth.users om eposten redan finns
b) OM NY: Skapar auth-anvandare med slumpmassigt temp-losenord
   OM BEFINTLIG: Ateranvander befintligt user_id
c) Kontrollerar om redan medlem i vald org
d) Skapar rad i kvittra.organization_members med roller + recovery_email
e) Visar resultat med kopierbart temp-losenord (om ny anvandare)
```

#### 5. Statistik

- Antal organisationer
- Antal aktiva medlemmar
- Matcher per organisation (summary)

---

## 19. Branding-system

Varje organisation har sin egen `branding_config` (JSONB) som styr utseendet.

### Tillgangliga templates

| Nyckel       | Namn          | Primarfarg | Bakgrund  |
|--------------|---------------|-----------|-----------|
| dark_blue    | Morkt Bla     | #1a5fb4   | #0a1628   |
| dark_green   | Morkt Gront   | #2ea043   | #0d1117   |
| dark_red     | Morkt Rott    | #cf222e   | #161616   |
| dark_purple  | Morkt Lila    | #8b5cf6   | #0f0a1a   |
| light_clean  | Ljust Rent    | #2563eb   | #f8fafc   |

### Hur branding appliceras

```
1. OrgContext hamtar org.branding_config fran databasen
2. BrandingContext merged med DEFAULT_BRANDING
3. CSS-variabler satts pa document.documentElement:
     --brand-primary, --brand-secondary, --brand-bg,
     --brand-surface, --brand-text, --brand-font
4. Alla CSS-regler refererar till dessa variabler
```

---

## 20. Feature Flags

Feature flags styr vilka funktioner som ar tillgangliga per organisation.

### Datamodell

```sql
CREATE TABLE kvittra.features_config (
  id          uuid PRIMARY KEY,
  org_id      uuid REFERENCES kvittra.organizations(id),  -- NULL = global
  feature_key text NOT NULL,
  is_enabled  boolean NOT NULL DEFAULT true,
  config      jsonb NOT NULL DEFAULT '{}',
  UNIQUE(org_id, feature_key)
);
```

### Overordningshierarki

1. Globala features (org_id IS NULL) -- gallande for alla orgs
2. Org-specifika features -- overskriver globala for den orgen

### useFeature hook

```javascript
const { isEnabled, getConfig, loading } = useFeature();

if (isEnabled('multi_scout')) {
  // Visa Multi Scout-funktionen
}

const config = getConfig('video_player');
// { maxResolution: 1080, autoplay: true }
```

Hooken cachar features i minnet for att undvika onodiga databasanrop.

---

## 21. Supabase-klienter i Frontend

**Fil:** `utils/supabaseClient.js`

Fyra Supabase-klienter skapas med olika konfigurationer:

### 1. supabase (default)

```javascript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: false }
});
```
- Anvands for: auth (login/logout), queries mot public-schemat
- JWT: anon key
- Session: Sparas i localStorage, auto-refresh

### 2. supabaseKvittra

```javascript
export const supabaseKvittra = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'kvittra' },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  }
});
```
- Anvands for: queries mot kvittra-schemat
- JWT: anon key
- Session: **INGEN** (undviker duplikat GoTrueClient)
- **OBS:** Denna klient har INTE en egen session. Den anvander headern fran
  den normala `supabase`-klienten via API-nyckeln.

### 3. supabaseAdmin

```javascript
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});
```
- Anvands for: Superadmin-operationer (skapa anvandare, hantera auth)
- JWT: **service_role key** (full atkomst, bypasas RLS)
- Session: Ingen
- **VARNING:** Enbart pa filipadmin.corevo.se

### 4. supabaseAdminKvittra

```javascript
export const supabaseAdminKvittra = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'kvittra' },
  auth: { persistSession: false }
});
```
- Anvands for: Superadmin-queries mot kvittra
- JWT: **service_role key**
- Session: Ingen

### Varfor fyra klienter?

Supabase JavaScript-klient skapar en GoTrueClient per instans. Tv klienter med
samma `storageKey` skulle krocka med varandras auth-sessioner. Darfor har varje
klient ett unikt `storageKey` och de icke-primara klienterna har `persistSession: false`.

---

## 22. Kompatibilitetslager

**Fil:** `context/SupabaseAuthContext.jsx`

Nar appen migrerades fran single-tenant till multi-tenant, anvande manga sidor
`useAuth()` fran det gamla `SupabaseAuthContext`. Istallet for att skriva om alla
sidor skapades ett kompatibilitetslager.

### Hur det fungerar

```javascript
export function useAuth() {
  const kvittraAuth = useKvittraAuth();   // Ny auth
  const org = useOrgSafe();              // Ny org-kontext

  // Mappa till det gamla API:et
  const roles = org?.roles || [];
  const highestRole = roles.includes('admin') ? 'admin'
    : roles.includes('coach') ? 'coach'
    : roles.includes('uploader') ? 'uploader'
    : 'viewer';

  return {
    user: { id, email, name, role: highestRole, ... },
    isAdmin: roles.includes('admin'),
    isUploader: roles.includes('admin') || roles.includes('uploader') || ...,
    isCoach: roles.includes('admin') || roles.includes('coach'),
    login: kvittraAuth.signInWithPassword,
    logout: kvittraAuth.logout,
    // ... etc
  };
}
```

### Vilka sidor anvander det?

Alla sidor som importerar fran `SupabaseAuthContext`:
- Layout.jsx
- AdminPage.jsx
- TeamsPage.jsx
- VideosPage.jsx
- VideoPlayerPage.jsx
- UploadPage.jsx
- MultiScoutPage.jsx
- AnalysisPage.jsx
- PlayerStatsPage.jsx
- InboxPage.jsx

Nya sidor (OrgHomePage, CoachAdminPanel, PlayerDashboard, UploaderPanel)
importerar direkt fran `KvittraAuthContext` och `OrgContext`.

---

## 23. Hooks

### useApi

Re-export av alla API-funktioner fran `supabaseApi.js`:
```javascript
authApi, videoApi, adminApi, reviewApi, changelogApi,
multiScoutApi, teamApi, settingsApi, userApi, playerStatsApi,
documentApi, scoutApi, inviteApi, teamAdminApi
```

### useFeature

Feature flag-kontroll med caching. Se kapitel 20.

### useGradeSymbols

Later anvandaren anpassa hur DVW-betyg visas. Sparas i localStorage.

Standardvarden:
```
# -> # (Perfekt)
+ -> + (Bra)
! -> ! (OK)
- -> - (Dalig)
/ -> / (Fel)
= -> = (Boll borta)
```

Anvandaren kan byta ut t.ex. `#` mot ett emoji eller annan text.

### useScoreboardSettings

Styr scoreboardets utseende i videospelaren:
- `visible` (boolean) -- Visa/dolj scoreboard
- `fontSize` ('small'/'medium'/'large') -- Textstorlek
- `opacity` (0-1) -- Genomskinlighet
- `pinned` (boolean) -- Last position

---

## 24. Storage Buckets

Supabase Storage anvands for fillagring med foljande buckets:

| Bucket      | Publik | Max storlek | MIME-typer                                |
|-------------|--------|-------------|-------------------------------------------|
| videos      | Nej    | 10 GB       | video/mp4, video/quicktime, video/x-mkv   |
| thumbnails  | Ja     | 5 MB        | image/jpeg, image/png, image/webp          |
| documents   | Nej    | 50 MB       | application/pdf, image/jpeg, image/png     |
| dvw-files   | Nej    | 10 MB       | Alla (DVW har ingen standard MIME)         |

### Org-scopade sokvagar

I multi-tenant-arkitekturen anvands org-prefixade sokvagar:

```
videos/{org_id}/match-2026-04-09.mp4
thumbnails/{org_id}/team-photo.jpg
documents/{org_id}/matchprotokoll.pdf
dvw-files/{org_id}/lvc-vs-norrkoping.dvw
```

### RLS pa Storage

Storage buckets har RLS-policies som kontrollerar atkomst:
- **SELECT:** Alla autentiserade (videos, documents, dvw-files). Alla (thumbnails).
- **INSERT:** Enbart uploaders/coaches/admins
- **DELETE:** Enbart admins (videos, thumbnails). Agare eller admin (documents).

---

## 25. Organisationer och Anvandare

### Organisationer

| Namn            | Slug        | URL                                    |
|-----------------|-------------|----------------------------------------|
| Linkopings VC   | lvc         | corevosports.corevo.se/app/lvc         |
| Norrkoping VK   | norrkoping  | corevosports.corevo.se/app/norrkoping  |

### Anvandare

| Epost                          | Org            | Roller                       | Recovery              | Losenord          |
|--------------------------------|----------------|------------------------------|-----------------------|-------------------|
| support.volleybol@corevo.se    | (superadmin)   | is_super_admin=true          | --                    | --                |
| admincorevo@lvc.se             | Linkopings VC  | admin, coach, uploader, player| support@corevo.se    | CorevoAdmin2026   |
| admintest@lvc.se               | Linkopings VC  | admin                        | support@corevo.se    | TestLvc2026       |

### Rollbeskrivningar

| Roll     | Rattigheter                                                        |
|----------|--------------------------------------------------------------------|
| admin    | Full atkomst: hantera anvandare, ta bort videor, andara inst.      |
| coach    | Skapa lag/matcher, ladda upp, ge feedback, se all statistik        |
| uploader | Ladda upp videor och DVW-filer                                     |
| player   | Se sina egna matcher, ta emot feedback, se statistik               |
| viewer   | (Legacy, public schema) Enbart lasa                                |

---

## 26. Migrationshistorik

```
supabase/migrations/
  |
  +-- 00001_initial_schema.sql
  |     Skapar public-schemat: profiles, teams, seasons, videos,
  |     match_documents, changelog_entries, thumbnail_library,
  |     user_teams, coach_reviews, settings, audit_logs.
  |     Skapar storage buckets. Skapar RLS-policies.
  |     Skapar hjalpfunktioner: user_role(), is_admin(), etc.
  |     Skapar trigger: on_auth_user_created -> handle_new_user().
  |
  +-- 00002_auth_helpers.sql
  |     Ytterligare auth-hjalpfunktioner.
  |
  +-- 00003_kvittra_multi_tenant.sql
  |     STORT: Skapar kvittra-schemat med alla 13 tabeller.
  |     Skapar RLS-hjalpfunktioner for multi-tenant.
  |     Skapar alla RLS-policies for kvittra.
  |     Grantar ratigheter till anon, authenticated, service_role.
  |
  +-- 00004_seed_features_and_templates.sql
  |     Seedar feature flags och standardmallar.
  |
  +-- 00005_add_recovery_email.sql
        Lagger till recovery_email-kolumn pa organization_members.
        Skapar index pa recovery_email.
```

---

## 27. Byggprocess och Deploy

### Dockerfile (multi-stage)

```dockerfile
# Steg 1: Bygg frontend
FROM node:20-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
COPY frontend/.env .env
RUN npm run build

# Steg 2: Serva statiska filer
FROM node:20-alpine
RUN npm install -g serve@14
WORKDIR /app
COPY --from=build /app/frontend/dist ./dist
EXPOSE 3001
CMD ["serve", "dist", "-l", "3001", "-s"]
```

### Byggflode

```
1. npm install (i frontend/)
2. vite build -> frontend/dist/
3. Kopierar dist till production-image
4. serve kors pa port 3001 med -s (SPA-mode)
```

### Deploy-steg

```bash
# Fran /opt/lvcmediahub:
docker compose build lvc-media-hub       # Bygg frontend
docker compose up -d lvc-media-hub       # Starta om frontend

# Eller bygga och starta om allt:
docker compose up -d --build
```

### Viktigt: PostgREST-omstart

Nar man lagger till nya kolumner eller tabeller i databasen maste PostgREST
startas om for att ladda om schema-cachen:

```bash
docker restart lvc-supabase-rest
```

Alternativt skicka NOTIFY i SQL:
```sql
NOTIFY pgrst, 'reload schema';
```

---

## 28. Konfigurationsfiler

### /opt/lvcmediahub/.env (rot)

Innehaller hemliga nycklar (ALDRIG committas):
```
POSTGRES_PASSWORD=...
SUPABASE_JWT_SECRET=...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
SECRET_KEY_BASE=...
```

### /opt/lvcmediahub/frontend/.env

```
VITE_SUPABASE_URL=https://corevosports.corevo.se
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

**OBS:** `VITE_SUPABASE_SERVICE_ROLE_KEY` ar tillganglig i frontend-koden.
Den anvands ENBART av superadmin-panelen pa filipadmin.corevo.se. Det ar
inte idealt sakerhetsmassigt men fungerar for nu da service_role-nyckeln
aldrig exponeras for vanliga anvandare (filipadmin ar separerad via hostname).

### /opt/lvcmediahub/docker-compose.yml

Hela Docker-stacken definierad i en fil. Viktigaste environment-variabler:

| Container           | Variabel                          | Varde/Referens            |
|---------------------|-----------------------------------|---------------------------|
| postgres            | POSTGRES_PASSWORD                 | .env                      |
| supabase-auth       | GOTRUE_SITE_URL                   | https://lvcmediahub...    |
| supabase-auth       | GOTRUE_JWT_SECRET                 | .env                      |
| supabase-rest       | PGRST_DB_SCHEMAS                  | public,storage,kvittra    |
| supabase-rest       | PGRST_JWT_SECRET                  | .env                      |
| supabase-storage    | FILE_SIZE_LIMIT                   | 52428800 (50 MB)          |
| supabase-storage    | FILE_STORAGE_BACKEND_PATH         | /var/lib/storage          |
| supabase-functions  | SMTP_HOST                         | send.one.com              |
| supabase-functions  | SMTP_PORT                         | 465                       |
| supabase-functions  | SMTP_USER                         | support.volleybol@corevo.se|
| caddy               | SITE_ADDRESS                      | :80                       |

### /opt/lvcmediahub/volumes/api/kong.yml

Kong API Gateway deklarativ konfiguration. Se kapitel 6.

### /etc/cloudflared/config.yml

Cloudflare Tunnel-konfiguration. Se kapitel 5.

---

## 29. Felsoning och Drifttips

### Vanliga problem och losningar

#### 1. "Ny kolumn syns inte i API:et"

PostgREST cachar schemat vid start. Omstart kravs:
```bash
docker restart lvc-supabase-rest
```

#### 2. "OTP-mail kommer inte"

Kontrollera:
1. Ar SMTP_PASSWORD satt pa supabase-functions?
2. Fungerar SMTP-servern (send.one.com:465)?
3. Titta i loggar: `docker logs lvc-supabase-functions`
4. I dev-mode (utan SMTP_PASSWORD) loggas koden till stdout

#### 3. "Anvandaren kan inte se sin organisation"

Kontrollera:
1. Finns raden i `kvittra.organization_members`?
2. Ar `is_active = true` pa bade member och organization?
3. Har slug i URL:en ratt varde?

#### 4. "Frontend visar vit sida"

1. Kontrollera att `lvc-media-hub` containern ar healthy:
   `docker ps` -- kontrollera STATUS
2. Titta i loggar: `docker logs lvc-media-hub`
3. Bygg om: `docker compose build lvc-media-hub && docker compose up -d lvc-media-hub`

#### 5. "Supabase Studio ar nere"

Studio ar inte kritisk for drift. Starta om:
```bash
docker restart lvc-supabase-studio
```
Studio visar ofta "unhealthy" men fungerar anda.

#### 6. "CORS-fel i browsern"

Kong hanterar CORS. Kontrollera att:
1. Kong-containern kors: `docker ps | grep kong`
2. `kong.yml` har `cors`-plugin pa alla routes
3. Caddy dirigerar Supabase-trafik till Kong (inte direkt till tjanster)

### Loggar

```bash
# Se loggar for en specifik container
docker logs lvc-media-hub
docker logs lvc-supabase-auth
docker logs lvc-supabase-functions
docker logs lvc-caddy

# Folj loggar i realtid
docker logs -f lvc-supabase-rest

# Se alla containrars status
docker ps
```

### Backup

```bash
# Databas-backup
docker exec lvc-postgres pg_dump -U supabase_admin postgres > backup.sql

# Specifikt schema
docker exec lvc-postgres pg_dump -U supabase_admin -n kvittra postgres > kvittra_backup.sql
```

### Starta om hela stacken

```bash
cd /opt/lvcmediahub
docker compose down
docker compose up -d
```

---

## 30. Arkitekturdiagram

### Overgrip ande systemdiagram

```
+===========================================================================+
|                             INTERNET                                       |
+===========================================================================+
          |                                         |
          v                                         v
+-------------------+                   +-------------------+
| corevosports.     |                   | filipadmin.       |
| corevo.se         |                   | corevo.se         |
+-------------------+                   +-------------------+
          |                                         |
          +------------------+----------------------+
                             |
                    +-------------------+
                    | Cloudflare Tunnel |
                    | "kvikta"          |
                    +-------------------+
                             |
                        localhost:80
                             |
                    +-------------------+
                    |    lvc-caddy      |
                    |    (port 80)      |
                    +-------------------+
                       /            \
                      /              \
          +-----------+        +------------------+
          | /rest/v1/ |        | /* (allt annat)  |
          | /auth/v1/ |        +------------------+
          | /storage/ |               |
          | /funcs/   |        +------------------+
          +-----------+        | lvc-media-hub    |
               |               | (React + serve)  |
        +------+------+       | Port 3001         |
        |  lvc-kong   |       +------------------+
        |  (port 8000)|
        +------+------+
               |
    +----------+----------+----------+----------+-----------+
    |          |          |          |          |           |
    v          v          v          v          v           v
+-------+ +--------+ +--------+ +--------+ +--------+ +--------+
| Auth  | | REST   | |Storage | |Realtime| | Meta   | | Funcs  |
| 9999  | | 3000   | | 5000   | | 4000   | | 8080   | | 9000   |
+-------+ +--------+ +--------+ +--------+ +--------+ +--------+
    |          |          |          |          |
    +----------+----------+----------+----------+
                          |
                 +------------------+
                 |   lvc-postgres   |
                 |  (PostgreSQL 15) |
                 |   Port 5432      |
                 +------------------+
                 | auth | public    |
                 | kvittra | storage|
                 +------------------+
```

### Autentiseringsflode (sekvensdiagram)

```
  Anvandare          Frontend           Supabase Auth      Edge Functions      Databas
     |                  |                    |                   |                |
     |  1. Ange email   |                    |                   |                |
     |----------------->|                    |                   |                |
     |                  |                    |                   |                |
     |  2. Ange losenord|                    |                   |                |
     |----------------->|                    |                   |                |
     |                  | signInWithPassword |                   |                |
     |                  |------------------->|                   |                |
     |                  |   JWT + session    |                   |                |
     |                  |<-------------------|                   |                |
     |                  |                    |                   |                |
     |                  | invoke generate-otp|                   |                |
     |                  |-------------------------------------->|                |
     |                  |                    |                   | hash + store   |
     |                  |                    |                   |--------------->|
     |                  |                    |                   | lookup recovery|
     |                  |                    |                   |--------------->|
     |                  |                    |                   | send SMTP      |
     |                  |                    |                   |-------+        |
     |                  |                    |                   |       |        |
     |  3. Email med OTP|                    |                   |<------+        |
     |<-----------------+--------------------+-------------------+               |
     |                  |                    |                   |                |
     |  4. Ange OTP-kod |                    |                   |                |
     |----------------->|                    |                   |                |
     |                  | invoke verify-otp  |                   |                |
     |                  |-------------------------------------->|                |
     |                  |                    |                   | verify hash    |
     |                  |                    |                   |--------------->|
     |                  |                    |                   | fetch orgs     |
     |                  |                    |                   |--------------->|
     |                  |   { organizations }|                   |                |
     |                  |<--------------------------------------|                |
     |                  |                    |                   |                |
     |  5. Org-picker   |                    |                   |                |
     |<-----------------|                    |                   |                |
     |  Valjer org      |                    |                   |                |
     |----------------->|                    |                   |                |
     |                  | redirect /app/slug |                   |                |
     |  <-- Redirect -->|                    |                   |                |
```

### Multi-tenant dataflode

```
+------------------+
| filipadmin       |
| (Superadmin)     |
+--------+---------+
         |
         v  service_role key
+------------------+        +-------------------+
| kvittra.         |        | kvittra.          |
| organizations    |------->| organization_     |
| id, name, slug,  |   1:N | members           |
| branding_config  |        | user_id, org_id,  |
+------------------+        | roles[], recovery |
         |                  +-------------------+
         |                           |
    +----+----+                      |
    |         |                      |
    v         v                      v
+-------+ +--------+         +-------------+
| teams | |features|         | player_     |
| org_id| |_config |         | profiles    |
+---+---+ +--------+         | member_id,  |
    |                         | jersey_no,  |
    v                         | position    |
+--------+                    +-------------+
| matches|                         |
| org_id,|                         |
| team_id|                         |
+---+----+                         |
    |                              |
    +--------+--------+            |
    |        |        |            |
    v        v        v            |
+------+ +------+ +--------+      |
|videos| | docs | |actions  |<-----+
|      | |      | |player_id|
+------+ +------+ +--------+
```

---

## Bilaga A: Fullstandig URL-karta

```
corevosports.corevo.se
  |
  +-- /                              Landing Page (publik)
  +-- /login                         Inloggning (4 steg)
  |
  +-- /app/lvc/                      Linkopings VC
  |   +-- (index)                    TeamsPage
  |   +-- dashboard                  OrgHomePage
  |   +-- team/:teamId              SeasonsPage
  |   +-- team/:teamId/season/:id   VideosPage
  |   +-- videos                     VideosPage
  |   +-- video/:id                  VideoPlayerPage
  |   +-- upload                     UploadPage
  |   +-- admin                      AdminPage
  |   +-- coach                      CoachAdminPanel
  |   +-- uploader                   UploaderPanel
  |   +-- analys                     AnalysisPage
  |   +-- multi-scout                MultiScoutPage
  |   +-- player/:playerId          PlayerStatsPage
  |   +-- my-stats                   PlayerDashboard
  |   +-- inbox                      InboxPage
  |   +-- changelog                  ChangelogPage
  |   +-- public                     PublicMatchesPage
  |   +-- public/match/:matchId     PublicVideoPage
  |
  +-- /app/norrkoping/               Norrkoping VK (samma struktur)
  |
  +-- /rest/v1/*                     PostgREST API
  +-- /auth/v1/*                     GoTrue Auth API
  +-- /storage/v1/*                  Storage API
  +-- /realtime/v1/*                 Realtime WebSocket
  +-- /functions/v1/*                Edge Functions

filipadmin.corevo.se
  |
  +-- /login                         Inloggning
  +-- /*                             SuperadminPage (5 flikar)

192.168.50.100:3040                  Supabase Studio (LAN only)
```

---

## Bilaga B: Docker-kommandon (snabbreferens)

```bash
# Status
docker ps                                    # Lista alla containrar
docker logs <container>                      # Se loggar
docker logs -f <container>                   # Folj loggar live

# Omstart
docker restart lvc-supabase-rest             # Ladda om schema-cache
docker restart lvc-media-hub                 # Starta om frontend
docker compose restart                       # Starta om alla

# Bygga om frontend
cd /opt/lvcmediahub
docker compose build lvc-media-hub
docker compose up -d lvc-media-hub

# Bygga om allt
docker compose up -d --build

# Stanga ner allt
docker compose down

# Databas
docker exec -it lvc-postgres psql -U supabase_admin postgres
docker exec lvc-postgres pg_dump -U supabase_admin postgres > backup.sql

# Cloudflare Tunnel
sudo systemctl status cloudflared
sudo systemctl restart cloudflared
```

---

## Bilaga C: Sakerhetsnoteringar

1. **service_role key i frontend:** Lagras i VITE_SUPABASE_SERVICE_ROLE_KEY och ar
   tekniskt tillganglig i den byggda JavaScript-koden. Aven om den enbart anvands pa
   filipadmin.corevo.se kan den hittas av nagon som inspekterar kallkoden. Overvrg att
   flytta superadmin-funktioner till en skyddad backend/API.

2. **OTP via Edge Functions:** OTP-verifiering sker pa serversidan (Edge Functions med
   service_role). Klienten kan inte bypassa OTP utan att kanna till koden.

3. **RLS:** Alla tabeller har RLS aktiverat. Aven om nagon far tag pa anon-nyckeln
   kan de enbart se data som RLS-policies tillater.

4. **Supabase Studio:** Bundet till 192.168.50.100:3040 (LAN). Ej tillgangligt fran
   internet. Krav pa VPN eller fysisk LAN-atkomst.

5. **PostgreSQL:** Port 5433 bunden till 127.0.0.1. Ej atkomlig fran andra maskiner.

6. **Cloudflare Tunnel:** All trafik gar krypterat genom tunneln. Ingen port ar oppnad
   i serverns brandvagg at internet.

---

## Bilaga D: Miljvariabler (fullstandig lista)

### .env (rot, ej committat)

| Variabel                    | Anvandning                             |
|-----------------------------|----------------------------------------|
| POSTGRES_PASSWORD           | Databas-losenord (alla Supabase-roller)|
| POSTGRES_DB                 | Databasnamn (default: postgres)        |
| SUPABASE_JWT_SECRET         | JWT-signeringsnyckel                   |
| SUPABASE_ANON_KEY           | Anonym JWT (begransad atkomst)         |
| SUPABASE_SERVICE_ROLE_KEY   | Service-roll JWT (full atkomst)        |
| SECRET_KEY_BASE             | Realtime-tjanstens nyckel              |
| SITE_ADDRESS                | Caddy-adress (default: :80)            |

### frontend/.env

| Variabel                        | Anvandning                          |
|---------------------------------|-------------------------------------|
| VITE_SUPABASE_URL               | Supabase API-URL                    |
| VITE_SUPABASE_ANON_KEY          | Anonym nyckel for frontend          |
| VITE_SUPABASE_SERVICE_ROLE_KEY  | Service-roll nyckel (superadmin)    |

### Environment pa supabase-functions (docker-compose)

| Variabel            | Varde                              |
|---------------------|------------------------------------|
| SMTP_HOST           | send.one.com                       |
| SMTP_PORT           | 465                                |
| SMTP_USER           | support.volleybol@corevo.se        |
| SMTP_PASSWORD       | (hemligt)                          |
| SMTP_FROM           | support.volleybol@corevo.se        |
| SUPABASE_URL        | http://kong:8000                   |
| SUPABASE_SERVICE_ROLE_KEY | (hemligt)                     |

---

*Slut pa dokumentation -- CorevoSports V1, 2026-04-09*
