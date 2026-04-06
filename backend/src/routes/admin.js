// ===========================================
// LVC Media Hub — Admin Routes
// ===========================================
import { Router } from 'express';
import multer from 'multer';
const upload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 5 * 1024 * 1024 } });
import { adminController } from '../controllers/adminController.js';
import { settingsController } from '../controllers/settingsController.js';
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

// Impersonera användare (byt vy)
router.post('/impersonate/:id', csrfProtection, adminController.impersonate);

// Borttagna videor
router.get('/deleted-videos', adminController.listDeletedVideos);

// UserTeam — Lag-kopplingar för användare
router.post('/users/:id/teams', csrfProtection, adminController.addUserTeam);
router.delete('/users/:id/teams/:teamId', csrfProtection, adminController.removeUserTeam);

// Uppdatera användarroll
router.put('/users/:id/role', csrfProtection, adminController.updateUserRole);

// Uppladdningshistorik
router.get('/uploads',
  searchValidation,
  handleValidationErrors,
  adminController.uploadHistory
);


// Lag
router.get('/teams', adminController.listTeams);
router.post('/teams', csrfProtection, adminController.createTeam);
router.delete('/teams/:id', csrfProtection, adminController.deleteTeam);
router.post('/teams/:id/thumbnail', csrfProtection, upload.single('thumbnail'), adminController.uploadTeamThumbnail);

// Säsonger
router.get('/seasons', adminController.listSeasons);
router.post('/seasons', csrfProtection, adminController.createSeason);
router.delete('/seasons/:id', csrfProtection, adminController.deleteSeason);

// Inbjudningar
router.post('/invites', csrfProtection, adminController.createInvite);
router.get('/invites', adminController.listInvites);
router.delete('/invites/:id', csrfProtection, adminController.deleteInvite);

// Tilldela video till lag/säsong
router.patch('/videos/:id/assign', csrfProtection, adminController.assignVideo);
// Inställningar
router.put('/settings/skill-names', csrfProtection, settingsController.updateSkillNames);
router.put('/settings/music-url', csrfProtection, settingsController.updateMusicUrl);

// Aktiva användare
import { getActiveUsers } from '../middleware/activityTracker.js';
router.get('/active-users', (req, res) => {
  res.json(getActiveUsers());
});

export default router;
