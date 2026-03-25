// ===========================================
// LVC Media Hub — Valideringsfelhanterare
// ===========================================
import { validationResult } from 'express-validator';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const messages = errors.array().map(err => err.msg);
    return res.status(400).json({
      error: 'Valideringsfel.',
      details: messages
    });
  }

  next();
};
