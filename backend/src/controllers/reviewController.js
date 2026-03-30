import bcrypt from 'bcrypt';
import prisma from '../config/database.js';

// Coach skapar en review (en eller flera spelare)
export async function createReview(req, res) {
  try {
    const { videoId, actionIndex, playerIds, comment } = req.body;
    const coachId = req.user.id;

    if (!videoId || actionIndex === undefined || !playerIds || !playerIds.length || !comment) {
      return res.status(400).json({ error: 'Saknade fält' });
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
    console.error('createReview error:', err);
    res.status(500).json({ error: 'Serverfel' });
  }
}

// Spelare hämtar sin inbox
export async function getInbox(req, res) {
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
    console.error('getInbox error:', err);
    res.status(500).json({ error: 'Serverfel' });
  }
}

// Coach hämtar sina skickade reviews
export async function getSent(req, res) {
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
    console.error('getSent error:', err);
    res.status(500).json({ error: 'Serverfel' });
  }
}

// Spelare bekräftar en review med lösenord
export async function acknowledgeReview(req, res) {
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
    if (!valid) return res.status(401).json({ error: 'Fel lösenord' });

    const updated = await prisma.coachReview.update({
      where: { id },
      data: { acknowledgedAt: new Date() }
    });

    res.json({ review: updated });
  } catch (err) {
    console.error('acknowledgeReview error:', err);
    res.status(500).json({ error: 'Serverfel' });
  }
}

// Spelare hämtar sina reviews för en specifik video (obekräftade)
export async function getVideoReviews(req, res) {
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
    console.error('getVideoReviews error:', err);
    res.status(500).json({ error: 'Serverfel' });
  }
}

// Coach hämtar lagöversikt med spelare och deras reviews
export async function getCoachOverview(req, res) {
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
    console.error('getCoachOverview error:', err);
    res.status(500).json({ error: 'Serverfel' });
  }
}
