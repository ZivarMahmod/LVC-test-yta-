// ===========================================
// LVC Media Hub — Settings Routes (publika)
// ===========================================
import { Router } from 'express';
import { settingsController } from '../controllers/settingsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Alla inloggade kan läsa skill-namn
router.get('/skill-names', authenticateToken, settingsController.getSkillNames);

// Alla inloggade kan läsa musik-URL
router.get('/music-url', authenticateToken, settingsController.getMusicUrl);

export default router;
