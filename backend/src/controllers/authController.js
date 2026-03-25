// ===========================================
// LVC Media Hub — Auth Controller
// Inloggning, token-refresh, utloggning
// ===========================================
import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import { tokenService } from '../services/tokenService.js';
import { bruteForceService } from '../services/bruteForce.js';
import logger from '../utils/logger.js';

export const authController = {
  // -------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip;

      // Kontrollera brute force-lockout
      const locked = await bruteForceService.isLocked(email, ipAddress);
      if (locked) {
        return res.status(429).json({
          error: 'För många misslyckade inloggningsförsök. Försök igen om 15 minuter.'
        });
      }

      // Hitta användare
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      // Generiskt felmeddelande — förhindrar användaruppräkning
      const genericError = 'Felaktig e-postadress eller lösenord.';

      if (!user || !user.isActive) {
        // Logga försöket även om användaren inte finns
        await bruteForceService.recordAttempt(email, ipAddress, false);
        return res.status(401).json({ error: genericError });
      }

      // Verifiera lösenord
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        await bruteForceService.recordAttempt(email, ipAddress, false, user.id);
        return res.status(401).json({ error: genericError });
      }

      // Inloggning lyckad
      await bruteForceService.recordAttempt(email, ipAddress, true, user.id);

      // Generera tokens
      const accessToken = tokenService.generateAccessToken(user);
      const refreshToken = await tokenService.generateRefreshToken(user);

      // Sätt httpOnly cookies
      tokenService.setTokenCookies(res, accessToken, refreshToken);

      logger.info('Lyckad inloggning', { userId: user.id, email: user.email, ip: ipAddress });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Inloggningsfel:', error);
      res.status(500).json({ error: 'Ett fel uppstod vid inloggning.' });
    }
  },

  // -------------------------------------------
  // POST /api/auth/refresh
  // -------------------------------------------
  async refresh(req, res) {
    try {
      const oldRefreshToken = req.cookies?.refreshToken;

      if (!oldRefreshToken) {
        return res.status(401).json({ error: 'Ingen refresh token. Logga in igen.' });
      }

      // Rotera refresh token
      const result = await tokenService.rotateRefreshToken(oldRefreshToken);

      if (!result) {
        tokenService.clearTokenCookies(res);
        return res.status(401).json({ error: 'Ogiltig eller utgången session. Logga in igen.' });
      }

      // Generera nytt access token
      const accessToken = tokenService.generateAccessToken(result.user);

      // Uppdatera cookies
      tokenService.setTokenCookies(res, accessToken, result.newRefreshToken);

      res.json({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role
        }
      });
    } catch (error) {
      logger.error('Token refresh-fel:', error);
      tokenService.clearTokenCookies(res);
      res.status(500).json({ error: 'Kunde inte uppdatera sessionen.' });
    }
  },

  // -------------------------------------------
  // POST /api/auth/logout
  // -------------------------------------------
  async logout(req, res) {
    try {
      if (req.user) {
        // Invalidera alla refresh tokens för användaren
        await tokenService.revokeAllUserTokens(req.user.id);
        logger.info('Utloggning', { userId: req.user.id });
      }

      tokenService.clearTokenCookies(res);
      res.json({ message: 'Utloggad.' });
    } catch (error) {
      logger.error('Utloggningsfel:', error);
      tokenService.clearTokenCookies(res);
      res.json({ message: 'Utloggad.' });
    }
  },

  // -------------------------------------------
  // GET /api/auth/me
  // -------------------------------------------
  async me(req, res) {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role
      }
    });
  }
};
