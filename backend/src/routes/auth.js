// ===========================================
// LVC Media Hub — Auth Routes
// ===========================================
import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { loginLimiter, refreshLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection, getCsrfToken } from '../middleware/csrf.js';
import { loginValidation, registerValidation } from '../middleware/validators.js';
import { handleValidationErrors } from '../middleware/validationHandler.js';

const router = Router();

router.get('/csrf-token', getCsrfToken);

// Inloggning
router.post('/login',
  loginLimiter,
  csrfProtection,
  loginValidation,
  handleValidationErrors,
  authController.login
);

// Registrering via inbjudan
router.post('/register',
  loginLimiter,
  csrfProtection,
  registerValidation,
  handleValidationErrors,
  authController.register
);

// Validera inbjudan
router.get('/invite/:token', authController.validateInvite);

// Ändra lösenord
router.post('/change-password',
  authenticateToken,
  csrfProtection,
  authController.changePassword
);

// Refresh token
router.post('/refresh',
  refreshLimiter,
  authController.refresh
);

// Utloggning
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
