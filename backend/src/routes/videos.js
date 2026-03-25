// ===========================================
// LVC Media Hub — Video Routes
// ===========================================
import { Router } from 'express';
import { videoController, scoutController } from '../controllers/videoController.js';
import { adminController } from '../controllers/adminController.js';
import { authenticateToken, requireViewer, requireAdmin } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { videoIdValidation, searchValidation } from '../middleware/validators.js';
import { handleValidationErrors } from '../middleware/validationHandler.js';

const router = Router();

// Lag och säsonger (tillgängligt för alla inloggade)
router.get('/teams',
  authenticateToken,
  requireViewer,
  adminController.listTeams
);
router.get('/teams/:teamId/seasons',
  authenticateToken,
  requireViewer,
  adminController.listSeasons
);

// Lista videor
router.get('/',
  authenticateToken,
  requireViewer,
  searchValidation,
  handleValidationErrors,
  videoController.list
);

// Hämta en video
router.get('/:id',
  authenticateToken,
  requireViewer,
  videoIdValidation,
  handleValidationErrors,
  videoController.getOne
);

// Thumbnail
router.get("/thumbnail/*",
  authenticateToken,
  requireViewer,
  videoController.thumbnail
);

// Streama video (signerad URL)
router.get('/:id/stream',
  videoController.stream
);

// Scout-data
router.get('/:id/scout',
  authenticateToken,
  requireViewer,
  videoIdValidation,
  handleValidationErrors,
  scoutController.getScout
);

// Uppdatera offset (admin)
router.patch('/:id/offset',
  authenticateToken,
  requireAdmin,
  csrfProtection,
  videoIdValidation,
  handleValidationErrors,
  scoutController.updateOffset
);

// Ta bort video (admin)
router.delete('/:id',
  authenticateToken,
  requireAdmin,
  csrfProtection,
  videoIdValidation,
  handleValidationErrors,
  videoController.remove
);

export default router;
