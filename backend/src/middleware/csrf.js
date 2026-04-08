// ===========================================
// LVC Media Hub — CSRF-skydd
// ===========================================
import { doubleCsrf } from 'csrf-csrf';
import logger from '../utils/logger.js';

const useHttps = process.env.USE_HTTPS === 'true';

// Bakom Cloudflare Tunnel: undvik __Host- prefix (kräver exakt cookie-config)
// Använd lax sameSite — fungerar med redirects och reverse proxies
const {
  generateToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: 'kvittra.csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: useHttps,
    path: '/'
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Middleware som hanterar CSRF-fel
export const csrfProtection = (req, res, next) => {
  doubleCsrfProtection(req, res, (err) => {
    if (err === invalidCsrfTokenError) {
      logger.warn('CSRF-tokenverifiering misslyckades', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.user?.id
      });
      return res.status(403).json({ error: 'Ogiltig CSRF-token. Ladda om sidan och försök igen.' });
    }
    if (err) {
      return next(err);
    }
    next();
  });
};

// Endpoint för att hämta CSRF-token
export const getCsrfToken = (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
};

export { generateToken };
