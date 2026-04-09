# KVITTRA — Systemdokumentation

> Senast uppdaterad: 2026-04-08
> Server: Optiplex 192.168.50.100 (Fallover)
> Domän: corevosports.corevo.se

---

## 1. Vad är Kvittra?

Kvittra är en multi-tenant videoanalysplattform för volleybollföreningar. Systemet låter klubbar ladda upp matchvideor med DVW scout-filer, analysera spelarstatistik, jämföra prestationer och dela resultat med tränare och spelare.

Plattformen är byggd som en lökstruktur med fem lager:

```
Lager 1 — Superadmin (Filip)           → ser allt
  Lager 2 — Organisation (klubb)        → ser sin org
    Lager 3 — Roll inom org             → ser sin roll
      Lager 4 — Vy baserat på roll      → ser sin panel
        Lager 5 — RLS i Supabase        → data isolerad
```

Ingen data läcker mellan organisationer. Allt skyddas av Row Level Security i databasen.

---

## 2. Arkitekturöversikt

```
                    ┌──────────────────────────────────┐
                    │        Cloudflare DNS             │
                    │  corevosports.corevo.se → .100    │
                    │  filipadmin.corevo.se  → .100     │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │     Nginx (corevo-frontend)       │
                    │     Port 80/443                   │
                    │     Subdomän-routing              │
                    └──────┬─────────┬─────────────────┘
                           │         │
              ┌────────────▼──┐  ┌───▼──────────────┐
              │  Frontend     │  │  Supabase Kong    │
              │  React (Vite) │  │  Port 8000        │
              │  Port 3001    │  │  API Gateway      │
              └───────────────┘  └──┬──┬──┬──┬──────┘
                                    │  │  │  │
                        ┌───────────┘  │  │  └──────────┐
                        │              │  │              │
                  ┌─────▼─────┐ ┌─────▼──▼───┐ ┌───────▼─────┐
                  │ PostgREST │ │  GoTrue     │ │  Storage    │
                  │ REST API  │ │  Auth       │ │  S3-compat  │
                  │ Port 3000 │ │             │ │  Port 5000  │
                  └─────┬─────┘ └─────┬───────┘ └─────────────┘
                        │             │
                  ┌─────▼─────────────▼───────┐
                  │  PostgreSQL (Supabase)     │
                  │  supabase/postgres:15.8    │
                  │  Port 5433                 │
                  │  Scheman: public, kvittra  │
                  └───────────────────────────┘
```

---

## 3. Vad är nytt vs vad som fanns innan

### Fanns innan (LVC Media Hub — Express/Prisma)

| Del | Teknik | Status |
|-----|--------|--------|
| Backend | Node.js + Express + Prisma ORM + SQLite | Kvar som fallback, rör inte |
| Auth | JWT cookies + CSRF + bcrypt + brute force | Kvar, inaktiv i Kvittra-läge |
| Frontend-sidor | TeamsPage, SeasonsPage, VideosPage, VideoPlayerPage, UploadPage, AdminPage, InboxPage, AnalysisPage, MultiScoutPage, PlayerStatsPage, ChangelogPage | Kvar och fungerar |
| DVW-parser | Server-side i Express (dvwParser.js) | Kvar, används i legacy-läge |
| Fillagring | NAS-monterad /storage | Ersatt av Supabase Storage |
| Databas | SQLite via Prisma | Ersatt av PostgreSQL/Supabase |

### Nytt (Kvittra — Supabase multi-tenant)

| Del | Teknik | Fil |
|-----|--------|-----|
| Databas | PostgreSQL i `kvittra`-schemat, 13 tabeller | `00003_kvittra_multi_tenant.sql` |
| RLS | Org-isolering via `get_my_org_ids()` | Samma fil |
| Auth | Supabase Auth + custom OTP (2FA) | KvittraAuthContext.jsx |
| OTP | Edge Functions (generate-otp, verify-otp) | `supabase/functions/` |
| DVW-parser | Edge Function som sparar till `kvittra.actions` | `parse-dvw-and-store/` |
| Org-context | Slug från URL → org-data → roller | OrgContext.jsx |
| Branding | CSS-variabler från `branding_config` per org | BrandingContext.jsx |
| Feature-flags | `useFeature` hook, `features_config` tabell | useFeature.js |
| Superadmin | 5-tabs admin (orgs, branding, features, users, stats) | SuperadminPage.jsx |
| Landningssida | Hero + funktioner + hur det funkar + priser | LandingPage.jsx |
| Spelarjämförelse | SVG-radarchart + stapeldiagram, 2 spelare | PlayerComparisonPage.jsx |
| Login | Email → lösenord → OTP → org-väljare → redirect | KvittraLoginPage.jsx |

---

## 4. Tre driftlägen

Frontend kan köras i tre lägen. Styrs av env-variabler:

| Läge | Env-variabler | Auth | App |
|------|--------------|------|-----|
| **Kvittra** (multi-tenant) | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `VITE_KVITTRA_MODE=true` | KvittraAuthContext | KvittraApp.jsx |
| **Supabase** (single-tenant) | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | SupabaseAuthContext | App.jsx |
| **Legacy** (Express) | Inga Supabase-variabler | AuthContext | App.jsx |

---

## 5. URLer och åtkomst

| Vad | URL | Beskrivning |
|-----|-----|-------------|
| Landningssida | `https://corevosports.corevo.se` | Publik marknadsföring + login |
| Login | `https://corevosports.corevo.se/login` | Enda inloggningspunkt |
| [org-slug]-panel | `https://[org].corevosports.corevo.se/app` | Kund-panel (t.ex. lvc.corevosports.corevo.se/app) |
| [org-slug]-publik | `https://[org].corevosports.corevo.se/public` | Publik vy utan inloggning |
| Superadmin (frontend) | `https://filipadmin.corevo.se` | Filips admin-verktyg (HTTP Basic Auth) |
| Supabase Studio | `http://192.168.50.100:3040` | Databas-UI (bara LAN) |

---

## 6. Inloggningar

### Superadmin

| | |
|---|---|
| URL | https://corevosports.corevo.se/login |
| Email | admin@corevo.se |
| Lösenord | Filip12345 |
| Roll | Admin i båda orgs |

### Linköpings VC (slug: `lvc`)

| Roll | Email | Lösenord |
|------|-------|----------|
| Admin | test-lvc@corevo.se | test123456 |
| Coach | coach-lvc@corevo.se | Coach2024lvc |
| Uploader | uploader-lvc@corevo.se | Upload2024lvc |
| Player | player-lvc@corevo.se | Player2024lvc |

### Norrköping VK (slug: `norrkoping`)

| Roll | Email | Lösenord |
|------|-------|----------|
| Admin | test-nor@corevo.se | test123456 |
| Coach | coach-nor@corevo.se | Coach2024nor |
| Uploader | uploader-nor@corevo.se | Upload2024nor |
| Player | player-nor@corevo.se | Player2024nor |

---

## 7. Infra-nycklar

| Nyckel | Värde |
|--------|-------|
| Supabase Anon Key | `eyJhbG...AZEdCq...` (se `.env` på servern) |
| Supabase Service Key | `eyJhbG...Ddj6ks...` (se `.env` på servern) |
| JWT Secret | `QKnRFFQEDYcF997WDIUyBEWzchTNS2ow5h5ZsZ3ikrc=` |
| Postgres | `supabase_admin` / `09bb37c94eda07b846aa8f4563084009` @ `127.0.0.1:5433` |

> OBS: Fullständiga nycklar finns i `.env`-filen på servern (192.168.50.100). Publicera aldrig dessa.

---

## 8. Databas-schema (kvittra)

### Tabeller

| Tabell | Vad den gör | RLS |
|--------|-------------|-----|
| `organizations` | En rad per klubb (namn, slug, branding, features) | Ja — members ser sin org, anon ser aktiva |
| `organization_members` | Kopplar user → org med `roles text[]` | Ja — org-scoped |
| `player_profiles` | Spelarprofil (namn, nummer, position, foto) | Ja — org-scoped |
| `teams` | Lag inom org ("LVC Dam", "LVC Herr") | Ja — org-scoped |
| `matches` | Matcher med visibility (internal/public) | Ja — org + public |
| `videos` | Video kopplad till match (storage_url) | Ja — ärver match visibility |
| `actions` | Persistent DVW-data (skill, result, zone, timestamp) | Ja — öppen inom org (Kvittra-principen) |
| `features_config` | Feature-flaggor (global + per org) | Ja — org + global |
| `otp_codes` | 2FA-koder (SHA-256 hash, 10 min giltig) | Ja — bara egna |
| `coach_reviews` | Coach-feedback på enskilda actions | Ja — coach + player + admin |
| `match_documents` | PDF/bilder kopplade till matcher | Ja — org-scoped |
| `settings` | Key-value config per org | Ja — org-scoped |
| `audit_logs` | Logg av alla admin-handlingar | Ja — admin only |

### RLS-hjälpfunktioner

| Funktion | Returnerar |
|----------|-----------|
| `get_my_org_ids()` | Array av alla org-IDs användaren tillhör |
| `has_role_in_org(org_id, role)` | true om användaren har rollen i orgen |
| `is_org_admin(org_id)` | true om admin |
| `is_org_coach_or_admin(org_id)` | true om coach eller admin |
| `can_upload_in_org(org_id)` | true om admin/coach/uploader |
| `get_my_member_id(org_id)` | member-id i specifik org |

---

## 9. Rollsystemet

Roller lagras som en array i `organization_members.roles`. En person kan ha flera roller.

| Roll | Ser / Kan | Kan INTE |
|------|-----------|----------|
| `admin` | Allt inom orgen — användare, branding, matcher, analys, publicering | Ingenting begränsat |
| `coach` | Allt admin ser utom användarhantering och org-inställningar | Skapa/radera users, ändra org-config |
| `uploader` | Uppladdningsverktyg, koppla video till match | Analys, statistik, användarhantering |
| `player` | Personlig dashboard, alla matchvideos, all DVW-data inom org | Andras profiler, användarhantering |
| `publik` | Matcher med visibility=public, ingen auth krävs | Allt internt |

**Viktig princip:** DVW-matchdata är alltid öppen för alla inloggade inom organisationen — oavsett roll.

---

## 10. Edge Functions

| Funktion | Anropas via | Vad den gör |
|----------|------------|-------------|
| `generate-otp` | `supabase.functions.invoke('generate-otp')` | Skapar 6-siffrig kod, hashar SHA-256, sparar i `otp_codes`, skickar mail via Resend |
| `verify-otp` | `supabase.functions.invoke('verify-otp')` | Validerar kod mot hash, markerar used, returnerar org-lista |
| `parse-dvw` | `supabase.functions.invoke('parse-dvw')` | Parsear DVW-fil och returnerar JSON (legacy, on-the-fly) |
| `parse-dvw-and-store` | `supabase.functions.invoke('parse-dvw-and-store')` | Parsear DVW och sparar persistent i `kvittra.actions` |

---

## 11. Storage Buckets

| Bucket | Publik | Max storlek | Innehåll |
|--------|--------|-------------|----------|
| `videos` | Nej | 10 GB | Matchvideor (mp4, mov, mkv) |
| `thumbnails` | Ja | 5 MB | Video/lag-thumbnails (jpg, png, webp) |
| `documents` | Nej | 50 MB | Match-dokument (PDF, bilder) |
| `dvw-files` | Nej | 10 MB | DVW scout-filer |

Org-prefix i sökväg: `{org_id}/videos/...`, `{org_id}/thumbnails/...` osv.

---

## 12. Feature-flaggor

Features styrs i `kvittra.features_config`. Tre nivåer:

| Nivå | org_id | Beskrivning |
|------|--------|-------------|
| **Core** | NULL, is_enabled=true | Kan aldrig stängas av. Video, DVW, filtrering, routing |
| **Global optional** | NULL | Filip aktiverar för alla. player_dashboard, heatmap, jämförelse |
| **Org-specific** | Specifikt org_id | Överskriver global. Beta-features, premium |

Frontend kollar via `useFeature()` hook:
```js
const { isEnabled } = useFeature();
if (isEnabled('player_dashboard')) { /* rendera */ }
```

---

## 13. Auth-flödet (steg för steg)

```
1. Användare → corevosports.corevo.se/login
2. Skriver in e-post → "Fortsätt"
3. Skriver in lösenord → supabase.auth.signInWithPassword()
4. Om rätt → generate-otp Edge Function → 6-siffrig kod till mail
5. Användare skriver in koden → verify-otp Edge Function
6. Om rätt → returnerar lista på användarens organisationer
7. Om 1 org → direkt redirect till [slug].corevo.se
   Om 2+ orgs → visa org-väljare → välj → redirect
8. På [slug].corevo.se → OrgContext läser slug → hämtar org + roller
9. Rätt panel renderas baserat på roles[]
```

---

## 14. Filstruktur (viktiga filer)

```
/home/zivar/LVC-test-yta-/
├── frontend/src/
│   ├── main.jsx                    ← Startpunkt, väljer läge
│   ├── App.jsx                     ← Legacy/Supabase single-tenant routing
│   ├── KvittraApp.jsx              ← Kvittra multi-tenant routing
│   ├── context/
│   │   ├── AuthContext.jsx          ← Legacy Express auth
│   │   ├── SupabaseAuthContext.jsx  ← Supabase single-tenant auth
│   │   ├── KvittraAuthContext.jsx   ← Kvittra auth (OTP + org-väljare)
│   │   ├── OrgContext.jsx           ← Org-data från slug
│   │   └── BrandingContext.jsx      ← CSS-variabler från branding_config
│   ├── hooks/
│   │   ├── useFeature.js            ← Feature-flag hook
│   │   └── useApi.js                ← SWR data-fetching
│   ├── pages/
│   │   ├── KvittraLoginPage.jsx     ← Steg-login (email→lösenord→OTP→org)
│   │   ├── LandingPage.jsx          ← Publik marknadsföringssida
│   │   ├── SuperadminPage.jsx       ← Filips admin (5 tabs)
│   │   ├── PlayerComparisonPage.jsx ← Radarchart + bars
│   │   └── ... (13 befintliga sidor)
│   └── utils/
│       ├── supabaseClient.js        ← Supabase JS-klient
│       ├── supabaseApi.js           ← Alla API-anrop via Supabase
│       └── api.js                   ← Legacy Express API-anrop
├── supabase/
│   ├── migrations/
│   │   ├── 00001_initial_schema.sql ← Bastabeller (public)
│   │   ├── 00002_auth_helpers.sql   ← Username→email RPC
│   │   ├── 00003_kvittra_multi_tenant.sql ← Hela kvittra-schemat
│   │   └── 00004_seed_features_and_templates.sql ← Features + templates
│   └── functions/
│       ├── generate-otp/            ← OTP-generering + mail
│       ├── verify-otp/              ← OTP-validering
│       ├── parse-dvw/               ← DVW → JSON (on-the-fly)
│       └── parse-dvw-and-store/     ← DVW → kvittra.actions
├── backend/                          ← Legacy Express (orört)
├── nginx/kvittra.conf               ← Subdomain-routing
└── docker-compose.yml               ← Legacy Docker-setup
```

---

## 15. Docker-containrar på servern

| Container | Image | Port | Funktion |
|-----------|-------|------|----------|
| lvc-postgres | supabase/postgres:15.8.1.060 | 5433 | Databas |
| lvc-supabase-kong | kong:2.8.1 | 8000 | API-gateway |
| lvc-supabase-auth | supabase/gotrue:v2.164.0 | — | Auth (GoTrue) |
| lvc-supabase-rest | postgrest/postgrest:v12.2.3 | 3000 | REST API |
| lvc-supabase-meta | supabase/postgres-meta:v0.84.2 | 8080 | Meta API |
| lvc-supabase-studio | supabase/studio:latest | 3040 | DB-UI |
| lvc-supabase-storage | supabase/storage-api:v1.11.13 | 5000 | Fillagring |
| corevo-frontend | nginx:alpine | 80/443 | Reverse proxy |

---

## 16. Branding-templates

5 färdiga templates att välja vid org-skapande:

| Template | Primärfärg | Bakgrund | Känsla |
|----------|-----------|----------|--------|
| Mörkt Blå | #1a5fb4 | #0a1628 | Professionellt, LVC-standard |
| Mörkt Grönt | #2ea043 | #0d1117 | Sportigt, energiskt |
| Mörkt Rött | #cf222e | #161616 | Kraftfullt, aggressivt |
| Mörkt Lila | #8b5cf6 | #0f0a1a | Elegant, modernt |
| Ljust Rent | #2563eb | #f8fafc | Fräscht, minimalistiskt |

---

## 17. Ny organisation — steg för steg

1. Logga in på `filipadmin.corevo.se` som superadmin
2. Fliken "Organisationer" → Fyll i namn + slug + välj template → "Skapa"
3. Fliken "Användare" → Välj org → Skriv in admin-email → "Skapa admin"
4. DNS: Wildcard `*.corevo.se` täcker automatiskt (redan uppsatt)
5. Admin loggar in → får sin org → kan bjuda in tränare/spelare

Ingen kod-deploy krävs. Allt är konfigurationsbaserat.
