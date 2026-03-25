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

// Routes
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import adminRoutes from './routes/admin.js';
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Changelog
app.get('/api/changelog', (req, res) => {
  try {
    const changelogPath = path.join(__dirname, '..', '..', 'CHANGELOG.md');
    const content = fs.readFileSync(changelogPath, 'utf-8');
    res.json({ changelog: content });
  } catch {
    res.status(404).json({ error: 'Changelog hittades inte' });
  }
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
  startFolderScanner();
});
