// ===========================================
// LVC Media Hub — Server
// Express med all säkerhetsmiddleware
// ===========================================
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import crypto from 'crypto';

// Routes
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import adminRoutes from './routes/admin.js';
import reviewRoutes from './routes/reviews.js';
import { authenticateToken, requireAdmin, requireCoach } from './middleware/auth.js';
import { startFolderScanner } from './services/folderScanner.js';

// Periodisk rensning
import { tokenService } from './services/tokenService.js';
import { bruteForceService } from './services/bruteForce.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Lita på proxy (Cloudflare Tunnel) — MÅSTE vara före all middleware som använder req.ip
app.set('trust proxy', 1);

// ===========================================
// Säkerhetsmiddleware
// ===========================================

// Helmet — säkra HTTP-headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:', 'https://stream.lvcmediahub.com'],
      connectSrc: ["'self'", 'https://stream.lvcmediahub.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false, // Behövs för videostreaming
  crossOriginResourcePolicy: { policy: 'same-site' } // Tillåt stream.lvcmediahub.com → lvcmediahub.com
}));// Helmet — säkra HTTP-headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:', isProduction ? 'https://stream.lvcmediahub.com' : "'self'"],
      connectSrc: ["'self'", isProduction ? 'https://stream.lvcmediahub.com' : "'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(isProduction ? {} : { upgradeInsecureRequests: null })
    }
  },
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: isProduction ? 'same-site' : 'cross-origin' }
}));

// CORS — låst till vår domän
app.use(cors({
  origin: isProduction
    ? [process.env.FRONTEND_URL || 'https://lvcmediahub.com', process.env.STREAM_BASE_URL || 'https://stream.lvcmediahub.com']
    : [process.env.FRONTEND_URL || 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));

// Cookie-parser
app.use(cookieParser());

// Body parsers med storleksbegränsning
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Generell rate limiting
app.use((req, res, next) => {
  if (req.path.includes('/stream')) return next();
  generalLimiter(req, res, next);
});

// ===========================================
// API Routes
// ===========================================
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);

// Avsluta impersonering (tillgänglig för alla inloggade)
app.post('/api/admin/stop-impersonate', authenticateToken, csrfProtection, async (req, res) => {
  const { adminController: ac } = await import('./controllers/adminController.js');
  return ac.stopImpersonate(req, res);
});

// Borttagna videor (admin)
app.get('/api/admin/deleted-videos', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    const videos = await prisma.video.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: { uploadedBy: { select: { id: true, name: true } } }
    });
    res.json({ videos: videos.map(v => ({ ...v, fileSize: Number(v.fileSize) })) });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte hamta borttagna videor' });
  }
});

// Thumbnail Library
app.get('/api/thumbnail-library', authenticateToken, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    const teamId = req.query.teamId ? parseInt(req.query.teamId) : null;
    const where = teamId ? { teamId } : {};
    const thumbs = await prisma.thumbnailLibrary.findMany({ where, orderBy: { name: 'asc' }, include: { team: { select: { id: true, name: true } } } });
    res.json({ thumbnails: thumbs });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte hamta thumbnails' });
  }
});

app.post('/api/admin/thumbnail-library', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const upload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 5 * 1024 * 1024 } });
    upload.array('images', 20)(req, res, async (err) => {
      if (err) return res.status(400).json({ error: 'Uppladdning misslyckades' });
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Inga bilder bifogade' });
      const teamId = parseInt(req.body.teamId);
      if (!teamId) return res.status(400).json({ error: 'teamId kravs' });
      const { default: prisma } = await import('./config/database.js');
      const fsp = await import('fs/promises');
      const p = await import('path');
      const thumbDir = '/app/data/thumbnails/library';
      await fsp.mkdir(thumbDir, { recursive: true });
      const created = [];
      for (const file of req.files) {
        const name = Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/\.[^.]+$/, '');
        const ext = p.default.extname(file.originalname).toLowerCase() || '.jpg';
        const id = crypto.randomUUID();
        const fileName = id + ext;
        const destPath = p.default.join(thumbDir, fileName);
        await fsp.copyFile(file.path, destPath);
        await fsp.unlink(file.path).catch(() => {});
        const entry = await prisma.thumbnailLibrary.create({
          data: { id, name, filePath: fileName, teamId }
        });
        created.push(entry);
      }
      res.status(201).json({ thumbnails: created });
    });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte ladda upp thumbnails' });
  }
});

app.delete('/api/admin/thumbnail-library/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    const fsp = await import('fs/promises');
    const p = await import('path');
    const entry = await prisma.thumbnailLibrary.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: 'Hittades inte' });
    await fsp.unlink(p.default.join('/app/data/thumbnails/library', entry.filePath)).catch(() => {});
    await prisma.thumbnailLibrary.delete({ where: { id: req.params.id } });
    res.json({ message: 'Borttagen' });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte ta bort thumbnail' });
  }
});

app.get('/api/thumbnail-library/image/:file', authenticateToken, async (req, res) => {
  try {
    const file = req.params.file.replace(/\.\./g, '');
    const thumbPath = '/app/data/thumbnails/library/' + file;
    const fs = await import('fs');
    const p = await import('path');
    if (!fs.existsSync(thumbPath)) return res.status(404).json({ error: 'Bild hittades inte' });
    const ext = p.default.extname(thumbPath).toLowerCase();
    const mimes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    res.set('Content-Type', mimes[ext] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(thumbPath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Serverfel' });
  }
});


// ===========================================
// UserTeam — Lag-kopplingar för användare
// ===========================================
app.post('/api/admin/users/:id/teams', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId krävs' });
    const entry = await prisma.userTeam.create({
      data: { userId: req.params.id, teamId: parseInt(teamId) }
    });
    res.status(201).json({ entry });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Användaren är redan i detta lag' });
    res.status(500).json({ error: 'Kunde inte lägga till lag' });
  }
});

app.delete('/api/admin/users/:id/teams/:teamId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    await prisma.userTeam.delete({
      where: {
        userId_teamId: {
          userId: req.params.id,
          teamId: parseInt(req.params.teamId)
        }
      }
    });
    res.json({ message: 'Lag borttaget från användare' });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte ta bort lag' });
  }
});

app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    const { role } = req.body;
    const validRoles = ['viewer', 'uploader', 'coach', 'admin'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Ogiltig roll' });
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role }
    });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte uppdatera roll' });
  }
});

// Hämta lagspelare för coach (filtrerat på coachens lag)
app.get('/api/reviews/team-players', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    // Hämta coachens lag
    const coachTeams = await prisma.userTeam.findMany({
      where: { userId: req.user.id },
      select: { teamId: true }
    });
    const teamIds = coachTeams.map(t => t.teamId);
    if (teamIds.length === 0) return res.json({ players: [] });

    // Hämta alla spelare i samma lag
    const userTeams = await prisma.userTeam.findMany({
      where: { teamId: { in: teamIds }, userId: { not: req.user.id } },
      include: {
        user: { select: { id: true, name: true, username: true, role: true, jerseyNumber: true } },
        team: { select: { id: true, name: true } }
      }
    });

    // Gruppera per lag
    const grouped = {};
    for (const ut of userTeams) {
      if (!grouped[ut.teamId]) {
        grouped[ut.teamId] = { team: ut.team, players: [] };
      }
      const exists = grouped[ut.teamId].players.find(p => p.id === ut.user.id);
      if (!exists) grouped[ut.teamId].players.push(ut.user);
    }

    res.json({ teams: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte hämta spelare' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Changelog CRUD
app.get('/api/changelog', async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    const entries = await prisma.changelogEntry.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // Sortera på versionsnummer (nyast först)
    entries.sort((a, b) => {
      const parse = (v) => v.replace('v','').split('.').map(Number);
      const av = parse(a.version), bv = parse(b.version);
      for (let i = 0; i < 3; i++) { if ((bv[i]||0) !== (av[i]||0)) return (bv[i]||0) - (av[i]||0); }
      return 0;
    });
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte h\u00e4mta \u00e4ndringslogg' });
  }
});

app.post('/api/changelog', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    const { version, title, content: body } = req.body;
    if (!version || !title || !body) return res.status(400).json({ error: 'Version, titel och inneh\u00e5ll kr\u00e4vs' });
    const entry = await prisma.changelogEntry.create({ data: { version, title, content: body } });
    res.status(201).json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte skapa post' });
  }
});

app.put('/api/changelog/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    const { version, title, content: body } = req.body;
    const entry = await prisma.changelogEntry.update({ where: { id: req.params.id }, data: { version, title, content: body } });
    res.json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte uppdatera post' });
  }
});

app.delete('/api/changelog/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { default: prisma } = await import('./config/database.js');
    await prisma.changelogEntry.delete({ where: { id: req.params.id } });
    res.json({ message: 'Post borttagen' });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte ta bort post' });
  }
});

// ===========================================
// Statisk frontend (produktion)
// ===========================================
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Team thumbnails
app.get('/api/team-thumbnail/:file', (req, res) => {
  const file = req.params.file.replace(/\.\./, '');
  const thumbPath = '/app/data/thumbnails/teams/' + file;
  import('fs').then(fs => {
    if (!fs.existsSync(thumbPath)) return res.status(404).json({ error: 'Bild hittades inte.' });
    const ext = thumbPath.split('.').pop().toLowerCase();
    const mimes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    res.set('Content-Type', mimes[ext] || 'image/jpeg');
    res.set('Cache-Control', 'no-cache');
    fs.createReadStream(thumbPath).pipe(res);
  }).catch(() => res.status(500).json({ error: 'Serverfel.' }));
});

// SPA fallback — alla icke-API-routes skickas till React
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ===========================================
// Felhantering
// ===========================================
app.use('/api/*', notFoundHandler);
app.use(errorHandler);

// ===========================================
// Periodiska uppgifter
// ===========================================
// Rensa utgångna tokens och gamla inloggningsförsök var 6:e timme
setInterval(async () => {
  try {
    await tokenService.cleanupExpiredTokens();
    await bruteForceService.cleanup();
  } catch (error) {
    logger.error('Rensningsfel:', error);
  }
}, 6 * 60 * 60 * 1000);

// ===========================================
// Starta HTTPS-server för video-streaming
app.listen(PORT, () => {
  logger.info(`🎬 LVC Media Hub-servern körs å port ${PORT}`);
  logger.info(`   Miljö: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   CORS: ${isProduction ? process.env.FRONTEND_URL : 'http://localhost:5173'}`);
  startFolderScanner();
});
