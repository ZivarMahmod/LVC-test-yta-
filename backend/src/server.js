// ===========================================
// LVC Media Hub — Server
// Express med all säkerhetsmiddleware
// ===========================================
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

// Routes
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import adminRoutes from './routes/admin.js';
import reviewRoutes from './routes/reviews.js';
import changelogRoutes from './routes/changelog.js';
import settingsRoutes from './routes/settings.js';
import { thumbnailController } from './controllers/thumbnailController.js';
import { adminController } from './controllers/adminController.js';
import { kvittraOrgController } from './controllers/kvittraOrgController.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { trackActivity } from './middleware/activityTracker.js';
import { csrfProtection } from './middleware/csrf.js';


// Periodisk rensning
import { tokenService } from './services/tokenService.js';
import { bruteForceService } from './services/bruteForce.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const useHttps = process.env.USE_HTTPS === 'true'; // Explicit HTTPS-flagga

// Lita på proxy (Cloudflare Tunnel) — MÅSTE vara före all middleware som använder req.ip
app.set('trust proxy', 1);

// ===========================================
// Säkerhetsmiddleware
// ===========================================

// Helmet — säkra HTTP-headers (anpassat för HTTP + lokal IP-åtkomst)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:', ...(process.env.STREAM_BASE_URL ? [process.env.STREAM_BASE_URL] : [])],
      connectSrc: ["'self'", ...(process.env.STREAM_BASE_URL ? [process.env.STREAM_BASE_URL] : [])],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'self'"],
      frameSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: useHttps ? [] : null,
    }
  },
  hsts: useHttps ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Gzip-kompression — komprimera alla HTTP-svar (utom videostreaming)
app.use(compression({
  filter: (req, res) => {
    if (req.path.includes('/stream')) return false;
    return compression.filter(req, res);
  }
}));

// CORS — tillåt konfigurerade origins + lokal åtkomst
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.STREAM_BASE_URL,
  !isProduction && 'http://localhost:5173',
  !isProduction && 'http://localhost:3001',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Same-origin requests (ingen origin header) eller tillåtna origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/)) {
      // Tillåt lokalt nätverk
      callback(null, true);
    } else {
      callback(null, true); // Tillåt alla i tidigt stadie — skärp till senare
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
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
app.use('/api/videos', trackActivity, videoRoutes);
app.use('/api/admin', trackActivity, adminRoutes);
app.use('/api/reviews', reviewRoutes);

// Impersonering — kräver INTE admin-roll (verifierar via cookie)
app.post('/api/admin/stop-impersonate', authenticateToken, csrfProtection, (req, res) => adminController.stopImpersonate(req, res));
app.post('/api/admin/switch-user/:id', authenticateToken, csrfProtection, (req, res) => adminController.switchUser(req, res));
app.get('/api/admin/switch-users', authenticateToken, (req, res) => adminController.listUsersForSwitch(req, res));

// ===========================================
// Kvittra API Routes
// ===========================================
app.get('/api/kvittra/org/:slug', authenticateToken, (req, res) => kvittraOrgController.getOrg(req, res));
app.get('/api/kvittra/features/:slug', authenticateToken, (req, res) => kvittraOrgController.getFeatures(req, res));
app.get('/api/kvittra/orgs', authenticateToken, (req, res) => kvittraOrgController.listMyOrgs(req, res));

// Thumbnail-bibliotek
app.get('/api/thumbnail-library', authenticateToken, requireAdmin, thumbnailController.list);
app.post('/api/admin/thumbnail-library', authenticateToken, requireAdmin, csrfProtection, ...thumbnailController.upload);
app.delete('/api/admin/thumbnail-library/:id', authenticateToken, requireAdmin, csrfProtection, thumbnailController.remove);
app.get('/api/thumbnail-library/image/:file', authenticateToken, thumbnailController.serveImage);
app.get('/api/team-thumbnail/:file', thumbnailController.serveTeamImage);

// Changelog
app.use('/api/changelog', changelogRoutes);

// Inställningar
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===========================================
// Statisk frontend (produktion)
// ===========================================
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

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
});
