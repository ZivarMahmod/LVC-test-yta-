// ===========================================
// LVC Media Hub — Token Service
// Access tokens, refresh token rotation, hashning
// ===========================================
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

// Hash refresh token innan lagring i databasen
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const tokenService = {
  // Generera access token (kort livslängd)
  generateAccessToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' }
    );
  },

  // Generera refresh token (lång livslängd) + spara hashad i DB
  async generateRefreshToken(user) {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dagar

    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt
      }
    });

    return token;
  },

  // Verifiera och rotera refresh token
  async rotateRefreshToken(oldToken) {
    const oldTokenHash = hashToken(oldToken);

    // Hitta token i databasen
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: oldTokenHash },
      include: { user: true }
    });

    if (!storedToken) {
      logger.warn('Okänd refresh token användes — möjlig tokenstöld');
      return null;
    }

    // Kontrollera om token är återkallad
    if (storedToken.isRevoked) {
      // Möjlig tokenåteranvändning — invalidera ALLA tokens för användaren
      logger.warn('Återkallad refresh token återanvändes — invaliderar alla tokens', {
        userId: storedToken.userId
      });
      await this.revokeAllUserTokens(storedToken.userId);
      return null;
    }

    // Kontrollera utgångsdatum
    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true }
      });
      return null;
    }

    // Kontrollera att användaren är aktiv
    if (!storedToken.user.isActive) {
      await this.revokeAllUserTokens(storedToken.userId);
      return null;
    }

    // Invalidera gamla token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true }
    });

    // Generera nytt refresh token (rotation)
    const newToken = await this.generateRefreshToken(storedToken.user);

    return {
      newRefreshToken: newToken,
      user: storedToken.user
    };
  },

  // Invalidera alla refresh tokens för en användare
  async revokeAllUserTokens(userId) {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });
    logger.info('Alla refresh tokens invaliderade', { userId });
  },

  // Rensa utgångna tokens (kör periodiskt)
  async cleanupExpiredTokens() {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
        ]
      }
    });
    if (result.count > 0) {
      logger.info(`Rensade ${result.count} utgångna/återkallade refresh tokens.`);
    }
  },

  // Ställ in token-cookies
  setTokenCookies(res, accessToken, refreshToken) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minuter
      path: '/'
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dagar
      path: '/api/auth/refresh' // Bara tillgänglig för refresh-endpoint
    });
  },

  // Rensa token-cookies
  clearTokenCookies(res) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  }
};
