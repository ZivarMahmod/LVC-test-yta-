// ===========================================
// LVC Media Hub — Global felhanterare
// Returnerar ALDRIG stack traces eller interna detaljer
// ===========================================
import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, _next) => {
  // Logga detaljerade fel internt
  logger.error('Ohanterat fel:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // Multer-specifika fel
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'Filen är för stor. Maximal storlek är 10 GB.'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Oväntad fil i förfrågan.'
    });
  }

  // Generiskt felmeddelande till klienten — ALDRIG interna detaljer
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500
      ? 'Ett internt serverfel uppstod. Försök igen senare.'
      : err.clientMessage || 'Ett fel uppstod.'
  });
};

// 404-hanterare
export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'Resursen kunde inte hittas.' });
};
