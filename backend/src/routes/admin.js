// ===========================================
// LVC Media Hub — Admin Routes
// ===========================================
import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import {
  createUserValidation,
  updateUserValidation,
  userIdValidation,
  searchValidation
} from '../middleware/validators.js';
import { handleValidationErrors } from '../middleware/validationHandler.js';

const router = Router();

// Alla admin-routes kräver admin-roll
router.use(authenticateToken, requireAdmin, adminLimiter);

// Användare
router.get('/users', adminController.listUsers);

router.post('/users',
  csrfProtection,
  createUserValidation,
  handleValidationErrors,
  adminController.createUser
);

router.put('/users/:id',
  csrfProtection,
  updateUserValidation,
  handleValidationErrors,
  adminController.updateUser
);

router.delete('/users/:id',
  csrfProtection,
  userIdValidation,
  handleValidationErrors,
  adminController.deleteUser
);

// Uppladdningshistorik
router.get('/uploads',
  searchValidation,
  handleValidationErrors,
  adminController.uploadHistory
);

export default router;
