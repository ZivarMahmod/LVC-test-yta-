// ===========================================
// LVC Media Hub — Brute Force-skydd
// Max 5 misslyckade försök → 15 min lockout
// ===========================================
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const bruteForceService = {
  // Kontrollera om e-post/IP är låst
  async isLocked(email, ipAddress) {
    const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);

    // Kontrollera per e-post
    const emailAttempts = await prisma.loginAttempt.count({
      where: {
        email: email.toLowerCase(),
        success: false,
        createdAt: { gte: since }
      }
    });

    if (emailAttempts >= MAX_ATTEMPTS) {
      logger.warn('Konto låst pga för många misslyckade inloggningar', {
        email,
        attempts: emailAttempts,
        ip: ipAddress
      });
      return true;
    }

    // Kontrollera per IP
    const ipAttempts = await prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: { gte: since }
      }
    });

    if (ipAttempts >= MAX_ATTEMPTS * 3) { // Mer generös gräns per IP
      logger.warn('IP-adress låst pga för många misslyckade inloggningar', {
        ip: ipAddress,
        attempts: ipAttempts
      });
      return true;
    }

    return false;
  },

  // Registrera inloggningsförsök
  async recordAttempt(email, ipAddress, success, userId = null) {
    await prisma.loginAttempt.create({
      data: {
        email: email.toLowerCase(),
        ipAddress,
        success,
        userId
      }
    });

    if (!success) {
      logger.warn('Misslyckat inloggningsförsök', { email, ip: ipAddress });
    }
  },

  // Rensa gamla försök (kör periodiskt)
  async cleanup() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 timmar
    const result = await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: cutoff } }
    });
    if (result.count > 0) {
      logger.info(`Rensade ${result.count} gamla inloggningsförsök.`);
    }
  }
};
