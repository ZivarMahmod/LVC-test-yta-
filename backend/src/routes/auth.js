// ===========================================
// LVC Media Hub — Auth Routes
// ===========================================
import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { loginLimiter, refreshLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection, getCsrfToken } from '../middleware/csrf.js';
import { loginValidation } from '../middleware/validators.js';
import { handleValidationErrors } from '../middleware/validationHandler.js';

const router = Router();

// CSRF-token endpoint (GET — ingen CSRF-kontroll behövs)
router.get('/csrf-token', getCsrfToken);

// Inloggning
router.post('/login',
  loginLimiter,
  csrfProtection,
  loginValidation,
  handleValidationErrors,
  authController.login
);

// Refresh token
router.post('/refresh',
  refreshLimiter,
  authController.refresh
);

// Utloggning (kräver auth)
router.post('/logout',
  authenticateToken,
  csrfProtection,
  authController.logout
);

// Hämta inloggad användare
router.get('/me',
  authenticateToken,
  authController.me
);

export default router;
