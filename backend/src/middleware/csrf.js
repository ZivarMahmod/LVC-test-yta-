// ===========================================
// LVC Media Hub — CSRF-skydd
// ===========================================
import { doubleCsrf } from 'csrf-csrf';
import logger from '../utils/logger.js';

const isProduction = process.env.NODE_ENV === 'production';

// __Host- prefix kräver secure=true, vilket inte fungerar i dev (http)
// Använd prefix enbart i produktion
const {
  generateToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: isProduction ? '__Host-lvc.x-csrf-token' : 'lvc.x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: isProduction ? 'strict' : 'lax', // lax i dev för att undvika problem
    secure: isProduction,
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
