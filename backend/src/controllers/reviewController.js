import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

export const reviewController = {

  // Coach skapar en review (en eller flera spelare)
  async createReview(req, res) {
    try {
      const { videoId, actionIndex, playerIds, comment } = req.body;
      const coachId = req.user.id;

      if (!videoId || actionIndex === undefined || !playerIds || !playerIds.length || !comment || comment.length > 5000) {
        return res.status(400).json({ error: 'Saknade fält eller kommentar för lång (max 5000 tecken)' });
      }

      // Verifiera att videon finns
      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (!video) return res.status(404).json({ error: 'Video hittades inte' });

      // Skapa en review per spelare
      const reviews = await Promise.all(
        playerIds.map(playerId =>
          prisma.coachReview.create({
            data: { videoId, actionIndex, coachId, playerId, comment }
          })
        )
      );

      res.status(201).json({ reviews });
    } catch (err) {
      logger.error('createReview error:', err);
      res.status(500).json({ error: 'Serverfel' });
    }
  },

  // Spelare hämtar sin inbox
  async getInbox(req, res) {
    try {
      const playerId = req.user.id;

      const reviews = await prisma.coachReview.findMany({
        where: { playerId },
        orderBy: { createdAt: 'desc' },
        include: {
          coach: { select: { id: true, name: true, username: true } }
        }
      });

      // Hämta videoinfo separat för varje unik video
      const videoIds = [...new Set(reviews.map(r => r.videoId))];
      const videos = await prisma.video.findMany({
        where: { id: { in: videoIds } },
        select: { id: true, title: true, opponent: true, matchDate: true }
      });
      const videoMap = Object.fromEntries(videos.map(v => [v.id, v]));

      const result = reviews.map(r => ({
        ...r,
        video: videoMap[r.videoId] || null
      }));

      res.json({ reviews: result });
    } catch (err) {
      logger.error('getInbox error:', err);
      res.status(500).json({ error: 'Serverfel' });
    }
  },

  // Coach hämtar sina skickade reviews
  async getSent(req, res) {
    try {
      const coachId = req.user.id;

      const reviews = await prisma.coachReview.findMany({
        where: { coachId },
        orderBy: { createdAt: 'desc' },
        include: {
          player: { select: { id: true, name: true, username: true } }
        }
      });

      const videoIds = [...new Set(reviews.map(r => r.videoId))];
      const videos = await prisma.video.findMany({
        where: { id: { in: videoIds } },
        select: { id: true, title: true, opponent: true, matchDate: true }
      });
      const videoMap = Object.fromEntries(videos.map(v => [v.id, v]));

      const result = reviews.map(r => ({
        ...r,
        video: videoMap[r.videoId] || null
      }));

      res.json({ reviews: result });
    } catch (err) {
      logger.error('getSent error:', err);
      res.status(500).json({ error: 'Serverfel' });
    }
  },

  // Spelare bekräftar en review med lösenord
  async acknowledgeReview(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const userId = req.user.id;

      if (!password) return res.status(400).json({ error: 'Lösenord krävs' });

      const review = await prisma.coachReview.findUnique({ where: { id } });
      if (!review) return res.status(404).json({ error: 'Review hittades inte' });
      if (review.playerId !== userId) return res.status(403).json({ error: 'Inte din review' });
      if (review.acknowledgedAt) return res.status(400).json({ error: 'Redan bekräftad' });

      // Verifiera lösenord
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        logger.warn('Misslyckat lösenordsförsök vid review-bekräftelse', { userId, reviewId: id, ip: req.ip });
        return res.status(401).json({ error: 'Fel lösenord' });
      }

      const updated = await prisma.coachReview.update({
        where: { id },
        data: { acknowledgedAt: new Date() }
      });

      logger.info('Review bekräftad', { userId, reviewId: id });

      res.json({ review: updated });
    } catch (err) {
      logger.error('acknowledgeReview error:', err);
      res.status(500).json({ error: 'Serverfel' });
    }
  },

  // Spelare hämtar sina reviews för en specifik video (obekräftade)
  async getVideoReviews(req, res) {
    try {
      const playerId = req.user.id;
      const { videoId } = req.params;

      const reviews = await prisma.coachReview.findMany({
        where: { playerId, videoId },
        orderBy: { createdAt: 'desc' },
        include: {
          coach: { select: { id: true, name: true, username: true } }
        }
      });

      res.json({ reviews });
    } catch (err) {
      logger.error('getVideoReviews error:', err);
      res.status(500).json({ error: 'Serverfel' });
    }
  },

  // Hämta lagspelare för coach (filtrerat på coachens lag)
  async getTeamPlayers(req, res) {
    try {
      // Hämta coachens lag
      const coachTeams = await prisma.userTeam.findMany({
        where: { userId: req.user.id },
        select: { teamId: true }
      });
      const teamIds = coachTeams.map(t => t.teamId);
      if (teamIds.length === 0) return res.json({ players: [] });

      // Hämta alla spelare i samma lag
      const userTeams = await prisma.userTeam.findMany({
        where: { teamId: { in: teamIds }, userId: { not: req.user.id } },
        include: {
          user: { select: { id: true, name: true, username: true, role: true, jerseyNumber: true } },
          team: { select: { id: true, name: true } }
        }
      });

      // Gruppera per lag
      const grouped = {};
      for (const ut of userTeams) {
        if (!grouped[ut.teamId]) {
          grouped[ut.teamId] = { team: ut.team, players: [] };
        }
        const exists = grouped[ut.teamId].players.find(p => p.id === ut.user.id);
        if (!exists) grouped[ut.teamId].players.push(ut.user);
      }

      res.json({ teams: Object.values(grouped) });
    } catch (err) {
      logger.error('getTeamPlayers error:', err);
      res.status(500).json({ error: 'Kunde inte hämta spelare' });
    }
  },

  // Coach hämtar lagöversikt med spelare och deras reviews
  async getCoachOverview(req, res) {
    try {
      const coachId = req.user.id;

      // Hämta coachens lag och alla spelare i dem
      const coachTeams = await prisma.userTeam.findMany({
        where: { userId: coachId },
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, name: true, username: true, jerseyNumber: true, role: true }
                  }
                }
              }
            }
          }
        }
      });

      // Hämta alla reviews coach skickat
      const reviews = await prisma.coachReview.findMany({
        where: { coachId },
        orderBy: { createdAt: 'desc' }
      });

      // Hämta videoinfo
      const videoIds = [...new Set(reviews.map(r => r.videoId))];
      const videos = await prisma.video.findMany({
        where: { id: { in: videoIds } },
        select: { id: true, title: true, opponent: true, matchDate: true }
      });
      const videoMap = Object.fromEntries(videos.map(v => [v.id, v]));

      // Bygg lagöversikt
      const teams = coachTeams.map(ct => {
        const players = ct.team.members
          .filter(m => m.user.id !== coachId)
          .map(m => {
            const playerReviews = reviews
              .filter(r => r.playerId === m.user.id)
              .map(r => ({ ...r, video: videoMap[r.videoId] || null }));
            return {
              ...m.user,
              reviews: playerReviews,
              unacknowledged: playerReviews.filter(r => !r.acknowledgedAt).length
            };
          })
          .sort((a, b) => (a.jerseyNumber || 99) - (b.jerseyNumber || 99));

        return { team: ct.team, players };
      });

      res.json({ teams });
    } catch (err) {
      logger.error('getCoachOverview error:', err);
      res.status(500).json({ error: 'Serverfel' });
    }
  }
};
