// ===========================================
// LVC Media Hub — Auth Controller
// Inloggning, registrering, token-refresh, utloggning
// ===========================================
import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import { tokenService } from '../services/tokenService.js';
import { bruteForceService } from '../services/bruteForce.js';
import logger from '../utils/logger.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export const authController = {
  // -------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------
  async login(req, res) {
    try {
      const { identifier, password } = req.body;
      const ipAddress = req.ip;

      const locked = await bruteForceService.isLocked(identifier, ipAddress);
      if (locked) {
        return res.status(429).json({
          error: 'För många misslyckade inloggningsförsök. Försök igen om 15 minuter.'
        });
      }

      // Sök på email eller username
      let user;
      if (identifier.includes('@')) {
        user = await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } });
      } else {
        user = await prisma.user.findUnique({ where: { username: identifier.toLowerCase() } });
      }

      const genericError = 'Felaktigt användarnamn eller lösenord.';

      if (!user || !user.isActive) {
        await bruteForceService.recordAttempt(identifier, ipAddress, false);
        return res.status(401).json({ error: genericError });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        await bruteForceService.recordAttempt(identifier, ipAddress, false, user.id);
        return res.status(401).json({ error: genericError });
      }

      await bruteForceService.recordAttempt(identifier, ipAddress, true, user.id);

      const accessToken = tokenService.generateAccessToken(user);
      const refreshToken = await tokenService.generateRefreshToken(user);
      tokenService.setTokenCookies(res, accessToken, refreshToken);

      logger.info('Lyckad inloggning', { userId: user.id, username: user.username, ip: ipAddress });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
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
  // POST /api/auth/register
  // -------------------------------------------
  async register(req, res) {
    try {
      const { token, username, password, name } = req.body;

      // Validera invite-token
      const invite = await prisma.inviteToken.findUnique({ where: { token } });
      if (!invite) {
        return res.status(400).json({ error: 'Ogiltig inbjudningslänk.' });
      }
      if (invite.useCount >= invite.maxUses) {
        return res.status(400).json({ error: 'Denna inbjudningslänk har nått max antal registreringar.' });
      }
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ error: 'Inbjudningslänken har gått ut.' });
      }

      // Kolla att username inte redan finns
      const existingUsername = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
      if (existingUsername) {
        return res.status(409).json({ error: 'Användarnamnet är redan taget.' });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Skapa användare + markera invite som använd
      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: username.toLowerCase() + '@lvcmediahub.local',
            username: username.toLowerCase(),
            name: name || username,
            passwordHash,
            role: invite.role,
            isActive: true
          }
        });

        await tx.inviteToken.update({
          where: { id: invite.id },
          data: { useCount: { increment: 1 } }
        });

        return newUser;
      });

      // Logga in direkt
      const accessToken = tokenService.generateAccessToken(user);
      const refreshToken = await tokenService.generateRefreshToken(user);
      tokenService.setTokenCookies(res, accessToken, refreshToken);

      logger.info('Ny användare registrerad via inbjudan', {
        userId: user.id, username: user.username, role: user.role, inviteId: invite.id
      });

      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Registreringsfel:', error);
      res.status(500).json({ error: 'Kunde inte registrera användaren.' });
    }
  },

  // -------------------------------------------
  // GET /api/auth/invite/:token — Validera inbjudan
  // -------------------------------------------
  async validateInvite(req, res) {
    try {
      const { token } = req.params;
      const invite = await prisma.inviteToken.findUnique({ where: { token } });

      if (!invite || invite.useCount >= invite.maxUses || new Date() > invite.expiresAt) {
        return res.status(400).json({ valid: false, error: 'Ogiltig eller utgången inbjudan.' });
      }

      res.json({ valid: true, role: invite.role });
    } catch {
      res.status(500).json({ valid: false, error: 'Kunde inte validera inbjudan.' });
    }
  },

  // -------------------------------------------
  // POST /api/auth/change-password
  // -------------------------------------------
  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });

      if (!user) {
        return res.status(404).json({ error: 'Användaren hittades inte.' });
      }

      const valid = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Felaktigt nuvarande lösenord.' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Nytt lösenord måste vara minst 8 tecken.' });
      }

      const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash }
      });

      logger.info('Lösenord ändrat', { userId: req.user.id });
      res.json({ message: 'Lösenord ändrat.' });
    } catch (error) {
      logger.error('Ändra lösenord-fel:', error);
      res.status(500).json({ error: 'Kunde inte ändra lösenord.' });
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

      const result = await tokenService.rotateRefreshToken(oldRefreshToken);

      if (!result) {
        tokenService.clearTokenCookies(res);
        return res.status(401).json({ error: 'Ogiltig eller utgången session. Logga in igen.' });
      }

      const accessToken = tokenService.generateAccessToken(result.user);
      tokenService.setTokenCookies(res, accessToken, result.newRefreshToken);

      res.json({
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
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
        username: req.user.username,
        name: req.user.name,
        role: req.user.role
      }
    });
  }
};
