// ===========================================
// Kvittra — CSRF-skydd
// Fungerar bakom Cloudflare Tunnel / reverse proxy
// ===========================================
import { doubleCsrf } from 'csrf-csrf';
import logger from '../utils/logger.js';

// Bakom Cloudflare Tunnel: secure=false, sameSite=lax
// Cloudflare hanterar HTTPS — vi behöver inte secure cookies internt
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
    secure: false,
    path: '/'
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token']
});

export const csrfProtection = (req, res, next) => {
  doubleCsrfProtection(req, res, (err) => {
    if (err === invalidCsrfTokenError) {
      logger.warn('CSRF-fel', { ip: req.ip, path: req.path, method: req.method });
      return res.status(403).json({ error: 'Ogiltig CSRF-token. Ladda om sidan och försök igen.' });
    }
    if (err) return next(err);
    next();
  });
};

export const getCsrfToken = (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
};

export { generateToken };
