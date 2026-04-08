// ===========================================
// Kvittra — Token Service
// Access tokens, refresh token rotation, hashning
// Fungerar bakom Cloudflare Tunnel / reverse proxy
// ===========================================
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const tokenService = {
  generateAccessToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' }
    );
  },

  async generateRefreshToken(user) {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: { tokenHash, userId: user.id, expiresAt }
    });
    return token;
  },

  async rotateRefreshToken(oldToken) {
    const oldTokenHash = hashToken(oldToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: oldTokenHash },
      include: { user: true }
    });
    if (!storedToken) {
      logger.warn('Okänd refresh token');
      return null;
    }
    if (storedToken.isRevoked) {
      logger.warn('Återkallad token återanvändes', { userId: storedToken.userId });
      await this.revokeAllUserTokens(storedToken.userId);
      return null;
    }
    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.update({ where: { id: storedToken.id }, data: { isRevoked: true } });
      return null;
    }
    if (!storedToken.user.isActive) {
      await this.revokeAllUserTokens(storedToken.userId);
      return null;
    }
    await prisma.refreshToken.update({ where: { id: storedToken.id }, data: { isRevoked: true } });
    const newToken = await this.generateRefreshToken(storedToken.user);
    return { newRefreshToken: newToken, user: storedToken.user };
  },

  async revokeAllUserTokens(userId) {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });
  },

  async cleanupExpiredTokens() {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
        ]
      }
    });
    if (result.count > 0) logger.info(`Rensade ${result.count} tokens`);
  },

  // Cookies: secure=false bakom Cloudflare Tunnel
  // Cloudflare hanterar HTTPS — internt kör vi HTTP
  setTokenCookies(res, accessToken, refreshToken) {
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/'
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh'
    });
  },

  clearTokenCookies(res) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  }
};
