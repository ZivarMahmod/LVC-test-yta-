import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  createReview,
  getInbox,
  getSent,
  acknowledgeReview,
  getCoachOverview
} from '../controllers/reviewController.js';

const router = express.Router();

// Coach skapar en review
router.post('/', authenticateToken, requireRole('coach', 'admin'), createReview);

// Spelare hämtar sin inbox
router.get('/inbox', authenticateToken, getInbox);

// Coach hämtar sina skickade reviews
router.get('/sent', authenticateToken, requireRole('coach', 'admin'), getSent);

// Coach hämtar lagöversikt
router.get('/coach-overview', authenticateToken, requireRole('coach', 'admin'), getCoachOverview);

// Spelare bekräftar en review med lösenord
router.post('/:id/acknowledge', authenticateToken, acknowledgeReview);

export default router;
