import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { reviewController } from '../controllers/reviewController.js';

const router = express.Router();

// Coach skapar en review
router.post('/', authenticateToken, requireRole('coach', 'admin'), csrfProtection, reviewController.createReview.bind(reviewController));

// Spelare hämtar sin inbox
router.get('/inbox', authenticateToken, reviewController.getInbox.bind(reviewController));

// Coach hämtar sina skickade reviews
router.get('/sent', authenticateToken, requireRole('coach', 'admin'), reviewController.getSent.bind(reviewController));

// Coach hämtar lagöversikt
router.get('/coach-overview', authenticateToken, requireRole('coach', 'admin'), reviewController.getCoachOverview.bind(reviewController));

// Coach hämtar lagspelare
router.get('/team-players', authenticateToken, requireRole('coach', 'admin'), reviewController.getTeamPlayers.bind(reviewController));

// Spelare hämtar reviews för en specifik video
router.get('/video/:videoId', authenticateToken, reviewController.getVideoReviews.bind(reviewController));

// Spelare bekräftar en review med lösenord
router.post('/:id/acknowledge', authenticateToken, csrfProtection, reviewController.acknowledgeReview.bind(reviewController));

export default router;
