import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import {
  createReview,
  getInbox,
  getSent,
  acknowledgeReview,
  getCoachOverview,
  getVideoReviews
} from '../controllers/reviewController.js';

const router = express.Router();

// Coach skapar en review
router.post('/', authenticateToken, requireRole('coach', 'admin'), csrfProtection, createReview);

// Spelare hämtar sin inbox
router.get('/inbox', authenticateToken, getInbox);

// Coach hämtar sina skickade reviews
router.get('/sent', authenticateToken, requireRole('coach', 'admin'), getSent);

// Coach hämtar lagöversikt
router.get('/coach-overview', authenticateToken, requireRole('coach', 'admin'), getCoachOverview);

// Spelare hämtar reviews för en specifik video
router.get('/video/:videoId', authenticateToken, getVideoReviews);

// Spelare bekräftar en review med lösenord
router.post('/:id/acknowledge', authenticateToken, csrfProtection, acknowledgeReview);

export default router;
