// ===========================================
// LVC Media Hub — Audit Log Service
// Loggar admin-åtgärder för spårbarhet
// ===========================================
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

export const auditService = {
  async log({ action, entity, entityId, req, details }) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity,
          entityId: entityId ? String(entityId) : null,
          userId: req.user.id,
          userName: req.user.name || req.user.username,
          details: details ? JSON.stringify(details) : null,
          ipAddress: req.ip || req.connection?.remoteAddress || null
        }
      });
    } catch (err) {
      logger.error('Audit log misslyckades:', err);
    }
  }
};
