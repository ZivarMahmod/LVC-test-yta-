# CLAUDE.md — LVC Media Hub

## Projekt
Volleyboll-videoanalysplattform för Linköpings Volleybollklubb (LVC).
Hanterar matchvideor med DVW scout-filer, heatmaps, zonfilter, flermatchsanalys och dokument.

## Teknikstack
- **Frontend**: React (Vite), vanilla CSS, react-router-dom
- **Backend**: Node.js (ES modules), Express, Prisma ORM, SQLite
- **Lagring**: NAS-monterad `/mnt/nas-matcher` → `/storage` i container
- **Docker**: `docker-compose.yml` (live, port 3001), `docker-compose.dev.yml` (dev, port 3002)
- **Domän**: https://lvcmediahub.com

## Viktiga mappar
```
backend/src/controllers/   — API-controllers (videoController, documentController)
backend/src/services/      — dvwParser.js, fileStorage.js, folderScanner.js
backend/src/routes/        — Express routes
backend/prisma/            — schema.prisma + migrations
frontend/src/pages/        — React-sidor (VideoPlayerPage, MultiScoutPage, AnalysisPage, etc.)
frontend/src/components/   — Återanvändbara komponenter (CourtHeatmap, DraggableScoreboard, Layout)
frontend/src/hooks/        — Custom hooks (useGradeSymbols, useScoreboardSettings)
frontend/src/utils/api.js  — Alla API-anrop (videoApi, documentApi, multiScoutApi, userApi, etc.)
```

## Utvecklingsflöde
1. Gör ändringar på en **feature branch** (inte direkt på main)
2. Testa i dev: `cd /opt/lvcmediahub && git pull origin <branch> --rebase && docker compose -f docker-compose.dev.yml up -d --build`
3. Skapa PR → merga till main
4. Pusha live: `git pull origin main && docker compose up -d --build`
5. Dev och live delar samma NAS-storage men har **separata databaser** (Docker volumes `lvc-data` vs `lvc-data-dev`)

## Per-user inställningar
- Sparas i `User.preferences` (JSON-sträng i SQLite)
- API: `GET/PUT /api/auth/user/preferences`
- Frontend: custom hooks (`useGradeSymbols`, `useScoreboardSettings`) synkar localStorage (keyed per userId) + backend
- Mönster för nya inställningar: skapa utility i `utils/`, hook i `hooks/`, lägg till i Layout.jsx inställningsmodal

## DVW-format (DataVolley)
- Scout-filer (.dvw) innehåller matchdata: spelare, actions, zoner, score
- Lag: `H` = hemma, `V` = borta (parsas i dvwParser.js)
- Grades: `#` = perfekt, `+` = positiv, `!` = OK, `-` = negativ, `/`/`=` = error
- Zoner: 1-9 (DVW-standard), startZone och endZone per action
- Score-lines: `*pHH:AA` / `apHH:AA`

## Databas (Prisma/SQLite)
- `Video` — matchvideor med opponent, matchDate, dvwPath, matchType (own/opponent)
- `MatchDocument` — PDF:er/bilder kopplade till en video
- `Team`, `Season` — lagstruktur
- `User` — roller: admin, coach, uploader, viewer. `preferences` (JSON-sträng) för per-user inställningar
- `CoachReview` — coach-feedback på actions

## Konventioner
- Språk i UI: **svenska** (labels, knappar, meddelanden)
- Språk i kod: **engelska** (variabelnamn, funktioner, kommentarer OK på engelska)
- Alla API-routes under `/api/videos/`, `/api/admin/` eller `/api/auth/`
- CSRF-skydd på alla POST/PUT/PATCH/DELETE
- Helmet för säkerhetsheaders (CSP tillåter frame-src 'self' för PDF-visning)
- Chunked upload för stora videofiler (95 MB chunks)
- Changelog i CHANGELOG.md, versionsformat: vX.Y.Z — YYYY-MM-DD

## Vanliga uppgifter
- **Ny funktion**: Skapa i controller → route → api.js → frontend-sida
- **Databasändring**: Ändra schema.prisma → `DATABASE_URL="file:./dev.db" npx prisma migrate dev --name namn`
- **Dockerfile**: `backend/scripts/` måste COPY:as explicit (rad med `COPY backend/scripts/ ./scripts/`)
- **Ny sida**: Lazy-import i App.jsx, lägg till Route, lägg till NavLink i Layout.jsx (desktop + mobil)

## Kända begränsningar
- Heatmap-overlay fungerar inte i webbläsarens native fullscreen (behöver custom fullscreen)
- Backend-validator tillåter max limit=50 per sida (AnalysisPage paginerar)
- `video.updatedAt` måste inkluderas i API-svar för thumbnail cache-busting
