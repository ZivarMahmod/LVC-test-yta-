// ===========================================
// LVC Media Hub — Video Routes
// ===========================================
import { Router } from 'express';
import multer from 'multer';
const thumbnailUpload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 5 * 1024 * 1024 } });
const docUpload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 50 * 1024 * 1024 } });
const videoUpload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 15 * 1024 * 1024 * 1024 } });
import { videoController, scoutController, playerStatsController } from '../controllers/videoController.js';
import { documentController } from '../controllers/documentController.js';
import { adminController } from '../controllers/adminController.js';
import { authenticateToken, requireRole, requireViewer, requireAdmin, requireUploader } from '../middleware/auth.js';
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

// Historisk spelarstatistik
router.get('/player-stats/:playerId',
  authenticateToken,
  requireViewer,
  playerStatsController.getPlayerHistory
);

// Lagöversikt — alla spelares nyckeltal
router.get('/team-roster/:teamId',
  authenticateToken,
  requireViewer,
  playerStatsController.getTeamRoster
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

// Multi-scout (flermatchsvy)
router.post('/multi-scout',
  authenticateToken,
  requireViewer,
  scoutController.getMultiScout
);

// Scout-data
router.get('/:id/scout',
  authenticateToken,
  requireViewer,
  videoIdValidation,
  handleValidationErrors,
  scoutController.getScout
);

// Ladda ner scout-fil (admin)
router.get('/:id/dvw/download',
  authenticateToken,
  requireAdmin,
  scoutController.downloadDvw
);

// Uppdatera videotitel (admin)
router.patch('/:id/title',
  authenticateToken,
  requireAdmin,
  csrfProtection,
  videoController.updateTitle
);

// Publicera/avpublicera match (admin)
router.patch('/:id/visibility',
  authenticateToken,
  requireAdmin,
  csrfProtection,
  videoController.updateVisibility
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

// Ladda upp thumbnail (admin)
router.post('/:id/thumbnail',
  authenticateToken,
  requireAdmin,
  csrfProtection,
  thumbnailUpload.single('thumbnail'),
  videoController.uploadThumbnail
);

// Chunked upload
router.post('/upload/chunk',
  authenticateToken,
  requireUploader,
  csrfProtection,
  videoUpload.single('chunk'),
  videoController.uploadChunk
);

router.post('/upload/complete',
  authenticateToken,
  requireUploader,
  csrfProtection,
  videoController.uploadComplete
);

router.post('/:id/dvw',
  authenticateToken,
  requireRole('admin', 'uploader', 'coach'),
  csrfProtection,
  thumbnailUpload.single('dvw'),
  videoController.uploadDvw
);

// Ladda upp video (uploader+)
router.post('/upload',
  authenticateToken,
  requireUploader,
  csrfProtection,
  videoUpload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'dvw', maxCount: 1 }
  ]),
  videoController.upload
);

// Dokument (PDF etc.)
router.get('/:id/documents',
  authenticateToken,
  requireViewer,
  documentController.list
);

router.post('/:id/documents',
  authenticateToken,
  requireRole('admin', 'uploader', 'coach'),
  csrfProtection,
  docUpload.single('file'),
  documentController.upload
);

router.get('/documents/:docId/view',
  authenticateToken,
  requireViewer,
  documentController.serve
);

router.delete('/documents/:docId',
  authenticateToken,
  requireRole('admin', 'coach'),
  csrfProtection,
  documentController.remove
);

// Ta bort video (admin permanent, uploader soft delete)
router.delete('/:id',
  authenticateToken,
  requireUploader,
  csrfProtection,
  videoIdValidation,
  handleValidationErrors,
  videoController.remove
);

// Aterstall soft-deleted video (admin)
router.patch('/:id/restore',
  authenticateToken,
  requireAdmin,
  csrfProtection,
  videoIdValidation,
  handleValidationErrors,
  videoController.restore
);

// Permanent radera video (admin)
router.delete('/:id/permanent',
  authenticateToken,
  requireAdmin,
  csrfProtection,
  videoIdValidation,
  handleValidationErrors,
  videoController.permanentDelete
);

export default router;
