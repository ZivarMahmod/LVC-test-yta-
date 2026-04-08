// ===========================================
// Kvittra — Auth Controller
// Login → Lösenord → OTP → Session → Org-redirect
// ===========================================
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../config/database.js';
import { tokenService } from '../services/tokenService.js';
import logger from '../utils/logger.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const OTP_EXPIRY_MINUTES = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Generera 6-siffrig OTP
function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

export const kvittraAuthController = {

  // -------------------------------------------
  // POST /api/auth/login
  // Steg 1: Verifiera lösenord, returnera behov av OTP
  // -------------------------------------------
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'E-post och lösenord krävs.' });
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Felaktiga inloggningsuppgifter.' });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Felaktiga inloggningsuppgifter.' });
      }

      // Generera OTP
      const otpCode = generateOtp();
      const otpHash = await bcrypt.hash(otpCode, 4); // Snabb hash för OTP
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Spara OTP (invalidera gamla först)
      await prisma.$executeRaw`
        DELETE FROM "LoginAttempt" WHERE "userId" = ${user.id} AND "success" = false
      `.catch(() => {});

      // Lagra OTP temporärt i user preferences (enkel lösning tills vi har otp_codes-tabell i kvittra-schemat)
      // I framtiden: använd kvittra.otp_codes
      await prisma.setting.upsert({
        where: { key: `otp:${user.id}` },
        update: { value: JSON.stringify({ hash: otpHash, expiresAt: expiresAt.toISOString(), attempts: 0 }) },
        create: { key: `otp:${user.id}`, value: JSON.stringify({ hash: otpHash, expiresAt: expiresAt.toISOString(), attempts: 0 }) }
      });

      // TODO: Skicka OTP via mail (support@kvittra.se)
      // För nu: logga OTP till konsolen (BARA i dev/test)
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`[DEV] OTP för ${user.email}: ${otpCode}`);
      }
      // I produktion: integrera Resend.com eller SMTP
      // await sendOtpEmail(user.email, otpCode);

      logger.info('OTP genererad', { userId: user.id, email: user.email });

      res.json({
        step: 'otp_required',
        message: 'Kod skickad till din e-post.',
        userId: user.id,
        // DEV ONLY: ta bort i produktion
        ...(process.env.NODE_ENV !== 'production' ? { _devOtp: otpCode } : {})
      });
    } catch (error) {
      logger.error('Login-fel:', error);
      res.status(500).json({ error: 'Ett fel uppstod.' });
    }
  },

  // -------------------------------------------
  // POST /api/auth/verify-otp
  // Steg 2: Verifiera OTP → skapa session → returnera orgar
  // -------------------------------------------
  async verifyOtp(req, res) {
    try {
      const { userId, code } = req.body;
      if (!userId || !code) {
        return res.status(400).json({ error: 'Användar-ID och kod krävs.' });
      }

      // Hämta OTP-data
      const otpSetting = await prisma.setting.findUnique({
        where: { key: `otp:${userId}` }
      });

      if (!otpSetting) {
        return res.status(400).json({ error: 'Ingen aktiv kod. Logga in igen.' });
      }

      const otpData = JSON.parse(otpSetting.value);

      // Kolla försök
      if (otpData.attempts >= 5) {
        await prisma.setting.delete({ where: { key: `otp:${userId}` } });
        return res.status(429).json({ error: 'För många försök. Logga in igen.' });
      }

      // Kolla expiry
      if (new Date() > new Date(otpData.expiresAt)) {
        await prisma.setting.delete({ where: { key: `otp:${userId}` } });
        return res.status(400).json({ error: 'Koden har gått ut. Logga in igen.' });
      }

      // Verifiera OTP
      const validOtp = await bcrypt.compare(code, otpData.hash);
      if (!validOtp) {
        // Öka försöksräknare
        otpData.attempts++;
        await prisma.setting.update({
          where: { key: `otp:${userId}` },
          data: { value: JSON.stringify(otpData) }
        });
        return res.status(401).json({ error: 'Felaktig kod.', attemptsLeft: 5 - otpData.attempts });
      }

      // OTP korrekt — rensa och skapa session
      await prisma.setting.delete({ where: { key: `otp:${userId}` } });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Kontot är inte aktivt.' });
      }

      // Skapa JWT-session
      const accessToken = tokenService.generateAccessToken(user);
      const refreshToken = await tokenService.generateRefreshToken(user);
      tokenService.setTokenCookies(res, accessToken, refreshToken);

      // Hämta användarens organisationer
      // Tills Kvittra-schemat är fullt integrerat, returnera grundläggande data
      // I framtiden: SELECT från kvittra.organization_members
      const organizations = []; // Fylls i när org-tabellen är aktiv

      logger.info('Lyckad inloggning med OTP', { userId: user.id });

      res.json({
        step: 'authenticated',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          role: user.role,
        },
        organizations,
      });
    } catch (error) {
      logger.error('OTP-verifiering fel:', error);
      res.status(500).json({ error: 'Ett fel uppstod.' });
    }
  },

  // -------------------------------------------
  // GET /api/auth/my-orgs
  // Hämta inloggad användares organisationer
  // -------------------------------------------
  async getMyOrgs(req, res) {
    try {
      // Tills Kvittra-schemat används fullt ut, returnera mockdata
      // I framtiden: SELECT från kvittra.organization_members JOIN kvittra.organizations
      res.json({
        organizations: [],
        message: 'Org-systemet aktiveras snart.'
      });
    } catch (error) {
      logger.error('Hämta orgar fel:', error);
      res.status(500).json({ error: 'Kunde inte hämta organisationer.' });
    }
  },

  // -------------------------------------------
  // POST /api/auth/resend-otp
  // Skicka ny OTP-kod
  // -------------------------------------------
  async resendOtp(req, res) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'Användar-ID krävs.' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        return res.status(404).json({ error: 'Användaren hittades inte.' });
      }

      const otpCode = generateOtp();
      const otpHash = await bcrypt.hash(otpCode, 4);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await prisma.setting.upsert({
        where: { key: `otp:${user.id}` },
        update: { value: JSON.stringify({ hash: otpHash, expiresAt: expiresAt.toISOString(), attempts: 0 }) },
        create: { key: `otp:${user.id}`, value: JSON.stringify({ hash: otpHash, expiresAt: expiresAt.toISOString(), attempts: 0 }) }
      });

      if (process.env.NODE_ENV !== 'production') {
        logger.info(`[DEV] Ny OTP för ${user.email}: ${otpCode}`);
      }

      res.json({
        message: 'Ny kod skickad.',
        ...(process.env.NODE_ENV !== 'production' ? { _devOtp: otpCode } : {})
      });
    } catch (error) {
      logger.error('Resend OTP fel:', error);
      res.status(500).json({ error: 'Kunde inte skicka ny kod.' });
    }
  },
};
