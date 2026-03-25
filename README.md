# 🏐 LVC Media Hub

Privat videoplattform för **Linköpings Volleybollklubb**. Här lagras och streamas matchvideor säkert — enbart för klubbmedlemmar.

---

## Teknikstack

| Lager | Teknologi |
|-------|-----------|
| Frontend | React 18 (Vite) |
| Backend | Node.js + Express |
| Databas | SQLite via Prisma ORM |
| Fillagring | OpenCloud (WebDAV API) |
| Auth | JWT access + refresh tokens (httpOnly cookies) |
| Deploy | Cloudflare Tunnel → Windows-hemmaserver |

---

## Säkerhetsöversikt

- **JWT-autentisering** med kort access token (15 min) + lång refresh token (7 dagar)
- **Refresh token-rotation** — ny refresh token vid varje förnyelse
- **httpOnly + Secure + SameSite=Strict cookies** — aldrig localStorage
- **Refresh tokens hashade** med SHA-256 i databasen
- **Brute force-skydd** — max 5 misslyckade inloggningar → 15 min lockout
- **Lösenord hashade med bcrypt** (12 rundor)
- **Tre roller:** admin, uploader, viewer — kontrolleras server-side
- **CORS låst** till lvcmediahub.com
- **Helmet.js** — CSP, HSTS, X-Frame-Options m.m.
- **Rate limiting** på alla endpoints
- **CSRF-skydd** på alla state-changing requests
- **Filvalidering** — typ, storlek, magiska bytes, sanitering av filnamn
- **Video proxyas** genom backend — aldrig direkta OpenCloud-URL:er
- **Signerade temporära URL:er** för streaming (1 timmes giltighetstid)
- **Generiska felmeddelanden** — inga stack traces till klienten
- **Loggning** av misslyckade inloggningar och misstänkt aktivitet

---

## Installation

### 1. Klona och installera beroenden

```bash
git clone <repo-url>
cd lvc-media-hub

cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Konfigurera miljövariabler

```bash
cd backend
cp .env.example .env
```

Redigera `.env` och fyll i:
- `JWT_ACCESS_SECRET` och `JWT_REFRESH_SECRET` — generera med:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- `CSRF_SECRET` — minst 32 slumpmässiga tecken
- `OPENCLOUD_WEBDAV_URL`, `OPENCLOUD_USERNAME`, `OPENCLOUD_PASSWORD`
- `ADMIN_EMAIL` och `ADMIN_PASSWORD` (för första admin-kontot)

### 3. Initiera databasen

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
node src/utils/seedAdmin.js
```

### 4. Starta utvecklingsservern

Terminal 1 (backend):
```bash
cd backend && npm run dev
```

Terminal 2 (frontend):
```bash
cd frontend && npm run dev
```

Öppna `http://localhost:5173`

---

## Produktion (Cloudflare Tunnel)

### 1. Bygg frontend

```bash
cd frontend && npm run build
```

### 2. Konfigurera .env

Ändra i `backend/.env`:
```
NODE_ENV=production
FRONTEND_URL=https://lvcmediahub.com
BACKEND_URL=https://lvcmediahub.com
```

### 3. Starta

```bash
cd backend && npm start
```

Express serverar den byggda frontend-appen som statiska filer.

### 4. Cloudflare Tunnel

Peka tunneln mot `http://localhost:3001`.

---

## Roller

| Roll | Rättigheter |
|------|------------|
| `admin` | Skapa/redigera/ta bort användare, ladda upp, titta, ta bort videor |
| `uploader` | Ladda upp videor, titta |
| `viewer` | Enbart titta på videor |

---

## API-endpoints

### Auth
| Metod | Sökväg | Beskrivning |
|-------|--------|-------------|
| GET | `/api/auth/csrf-token` | Hämta CSRF-token |
| POST | `/api/auth/login` | Logga in |
| POST | `/api/auth/refresh` | Förnya access token |
| POST | `/api/auth/logout` | Logga ut |
| GET | `/api/auth/me` | Hämta inloggad användare |

### Videor
| Metod | Sökväg | Roll | Beskrivning |
|-------|--------|------|-------------|
| GET | `/api/videos` | viewer+ | Lista alla videor |
| GET | `/api/videos/:id` | viewer+ | Hämta en video |
| GET | `/api/videos/:id/stream` | viewer+ | Streama video (signerad URL) |
| POST | `/api/videos/upload` | uploader+ | Ladda upp video |
| DELETE | `/api/videos/:id` | admin | Ta bort video |

### Admin
| Metod | Sökväg | Beskrivning |
|-------|--------|-------------|
| GET | `/api/admin/users` | Lista användare |
| POST | `/api/admin/users` | Skapa användare |
| PUT | `/api/admin/users/:id` | Uppdatera användare |
| DELETE | `/api/admin/users/:id` | Ta bort användare |
| GET | `/api/admin/uploads` | Uppladdningshistorik |

---

## Filstruktur i OpenCloud

```
/Matcher/
  2025/
    2025-03-15_LVC-vs-Norrköping.mp4
    2025-04-02_LVC-vs-Örebro.mov
  2026/
    2026-01-20_LVC-vs-Lindesberg.mp4
```

---

## Projektstruktur

```
lvc-media-hub/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # Prisma-klient
│   │   ├── controllers/
│   │   │   ├── adminController.js
│   │   │   ├── authController.js
│   │   │   └── videoController.js
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT + rollkontroll
│   │   │   ├── csrf.js               # CSRF-skydd
│   │   │   ├── errorHandler.js       # Globala felhanterare
│   │   │   ├── rateLimiter.js        # Rate limiting
│   │   │   ├── validationHandler.js
│   │   │   └── validators.js         # Inputvalidering
│   │   ├── routes/
│   │   │   ├── admin.js
│   │   │   ├── auth.js
│   │   │   └── videos.js
│   │   ├── services/
│   │   │   ├── bruteForce.js         # Brute force-skydd
│   │   │   ├── openCloud.js          # WebDAV-integration
│   │   │   └── tokenService.js       # JWT + refresh tokens
│   │   ├── utils/
│   │   │   ├── fileValidator.js      # Filvalidering
│   │   │   ├── logger.js             # Winston logger
│   │   │   └── seedAdmin.js          # Admin-seed
│   │   └── server.js                 # Express-server
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/
│   │   │       ├── Layout.jsx
│   │   │       └── Layout.css
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── AdminPage.jsx / .css
│   │   │   ├── LoginPage.jsx / .css
│   │   │   ├── UploadPage.jsx / .css
│   │   │   ├── VideoPlayerPage.jsx / .css
│   │   │   └── VideosPage.jsx / .css
│   │   ├── utils/
│   │   │   └── api.js                # API-klient med CSRF + refresh
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .gitignore
├── package.json
└── README.md
```

---

## Säkerhetsanteckningar

1. **Byt alla secrets i `.env`** innan du kör i produktion
2. **Kör `npm audit`** regelbundet
3. **Refresh tokens roteras** — en stulen token fungerar bara en gång
4. **Lösenord hashas med bcrypt** (12 rundor) — aldrig i klartext
5. **Videor serveras aldrig direkt** från OpenCloud — alltid genom autentiserad backend-proxy
6. **Alla felmeddelanden är generiska** — inga stack traces eller interna detaljer exponeras
7. **Loggning** sker till `logs/security.log` för misslyckade inloggningar

---

*Byggt för Linköpings Volleybollklubb 🏐*
