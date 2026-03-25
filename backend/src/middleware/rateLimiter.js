// ===========================================
// LVC Media Hub — Rate Limiting
// ===========================================
import rateLimit from 'express-rate-limit';

// Generell rate limit för alla endpoints
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'För många förfrågningar. Försök igen om en stund.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

// Strikt rate limit för inloggning
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'För många inloggningsförsök. Försök igen om 15 minuter.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

// Rate limit för token-refresh
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'För många tokenförfrågningar.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

// Rate limit för admin-operationer
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'För många administratörsförfrågningar.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});
