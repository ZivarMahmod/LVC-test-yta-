// ===========================================
// LVC Media Hub — CSRF-skydd
// ===========================================
import { doubleCsrf } from 'csrf-csrf';
import logger from '../utils/logger.js';

const useHttps = process.env.USE_HTTPS === 'true';

// __Host- prefix kräver secure=true (HTTPS)
// Utan HTTPS använder vi vanligt cookie-namn
const {
  generateToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: useHttps ? '__Host-lvc.x-csrf-token' : 'lvc.x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: useHttps ? 'strict' : 'lax',
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
