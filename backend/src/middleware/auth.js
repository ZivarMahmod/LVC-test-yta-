// ===========================================
// LVC Media Hub — Auth Middleware
// JWT-verifiering + rollkontroll
// ===========================================
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

// -------------------------------------------
// Verifiera access token från httpOnly cookie
// -------------------------------------------
export const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({ error: 'Åtkomst nekad. Logga in först.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Hämta användare från databasen för att verifiera att kontot fortfarande är aktivt
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Kontot är inaktiverat eller existerar inte.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessionen har gått ut. Uppdatera din token.' });
    }
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Ogiltig JWT-token försöktes användas', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({ error: 'Ogiltig token.' });
    }
    logger.error('Auth middleware-fel:', error);
    return res.status(500).json({ error: 'Internt serverfel.' });
  }
};

// -------------------------------------------
// Rollbaserad åtkomstkontroll
// -------------------------------------------
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Ej autentiserad.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Obehörig åtkomstförsök', {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(403).json({ error: 'Du har inte behörighet för denna åtgärd.' });
    }

    next();
  };
};

// Bekvämlighetsexporter
export const requireAdmin = requireRole('admin');
export const requireCoach = requireRole('admin', 'coach');
export const requireUploader = requireRole('admin', 'uploader', 'coach');
export const requireViewer = requireRole('admin', 'uploader', 'coach', 'viewer');
