// ===========================================
// LVC Media Hub — Admin Controller
// Hantera användare och visa uppladdningshistorik
// ===========================================
import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import { tokenService } from '../services/tokenService.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export const adminController = {

  // -------------------------------------------
  // POST /api/admin/impersonate/:id
  // -------------------------------------------
  async impersonate(req, res) {
    try {
      const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!targetUser) return res.status(404).json({ error: 'Användaren hittades inte.' });

      // Spara admin-ID i cookie så vi kan byta tillbaka
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('adminId', req.user.id, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });

      // Generera tokens för målsanvändaren
      const accessToken = tokenService.generateAccessToken(targetUser);
      const refreshToken = await tokenService.generateRefreshToken(targetUser);
      tokenService.setTokenCookies(res, accessToken, refreshToken);

      logger.info('Admin impersonerar användare', { adminId: req.user.id, targetUserId: targetUser.id, targetName: targetUser.name });
      res.json({ user: { id: targetUser.id, name: targetUser.name, role: targetUser.role, username: targetUser.username } });
    } catch (error) {
      logger.error('Impersonate-fel:', error);
      res.status(500).json({ error: 'Kunde inte byta användare.' });
    }
  },

  // -------------------------------------------
  // POST /api/admin/stop-impersonate
  // -------------------------------------------
  async stopImpersonate(req, res) {
    try {
      const adminId = req.cookies?.adminId;
      if (!adminId) return res.status(400).json({ error: 'Ingen aktiv impersonering.' });

      const admin = await prisma.user.findUnique({ where: { id: adminId } });
      if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Ogiltigt admin-ID.' });

      // Rensa adminId-cookie
      res.clearCookie('adminId', { path: '/' });

      // Generera tokens för admin
      const accessToken = tokenService.generateAccessToken(admin);
      const refreshToken = await tokenService.generateRefreshToken(admin);
      tokenService.setTokenCookies(res, accessToken, refreshToken);

      logger.info('Admin avslutar impersonering', { adminId: admin.id });
      res.json({ user: { id: admin.id, name: admin.name, role: admin.role, username: admin.username } });
    } catch (error) {
      logger.error('Stop impersonate-fel:', error);
      res.status(500).json({ error: 'Kunde inte byta tillbaka.' });
    }
  },

  // -------------------------------------------
  // GET /api/admin/users
  // -------------------------------------------
  async listUsers(req, res) {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          role: true,
          jerseyNumber: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { videos: { where: { deletedAt: null } } } },
          teams: { include: { team: { select: { id: true, name: true } } } }
        }
      });

      res.json({ users });
    } catch (error) {
      logger.error('Listning av användare misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte hämta användarlistan.' });
    }
  },

  // -------------------------------------------
  // POST /api/admin/users
  // -------------------------------------------
  async createUser(req, res) {
    try {
      const { email, name, password, role } = req.body;

      // Kontrollera om e-post redan finns
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return res.status(409).json({ error: 'E-postadressen är redan registrerad.' });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const username = email.toLowerCase().split('@')[0];

      // Kolla om username redan finns
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername) {
        return res.status(409).json({ error: 'Användarnamnet är redan taget.' });
      }

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username,
          name,
          passwordHash,
          role
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      });

      logger.info('Ny användare skapad', {
        createdUserId: user.id,
        email: user.email,
        role: user.role,
        createdBy: req.user.email
      });

      res.status(201).json({ message: 'Användaren har skapats.', user });
    } catch (error) {
      logger.error('Skapa användare misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte skapa användaren.' });
    }
  },

  // -------------------------------------------
  // PUT /api/admin/users/:id
  // -------------------------------------------
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { email, name, password, role, isActive, jerseyNumber } = req.body;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({ error: 'Användaren kunde inte hittas.' });
      }

      // Förhindra att admin tar bort sin egen admin-roll
      if (id === req.user.id && role && role !== 'admin') {
        return res.status(400).json({ error: 'Du kan inte ta bort din egen admin-roll.' });
      }

      const updateData = {};
      if (email) updateData.email = email.toLowerCase();
      if (name) updateData.name = name;
      if (role) updateData.role = role;
      if (typeof isActive === 'boolean') updateData.isActive = isActive;
      if (jerseyNumber !== undefined) updateData.jerseyNumber = jerseyNumber ? parseInt(jerseyNumber) : null;

      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        // Invalidera alla tokens om lösenord ändras
        await tokenService.revokeAllUserTokens(id);
      }

      // Om kontot inaktiveras — invalidera alla tokens
      if (isActive === false) {
        await tokenService.revokeAllUserTokens(id);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          updatedAt: true
        }
      });

      logger.info('Användare uppdaterad', {
        updatedUserId: id,
        changes: Object.keys(updateData),
        updatedBy: req.user.email
      });

      res.json({ message: 'Användaren har uppdaterats.', user: updatedUser });
    } catch (error) {
      logger.error('Uppdatera användare misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte uppdatera användaren.' });
    }
  },

  // -------------------------------------------
  // DELETE /api/admin/users/:id
  // -------------------------------------------
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Förhindra att admin tar bort sig själv
      if (id === req.user.id) {
        return res.status(400).json({ error: 'Du kan inte ta bort ditt eget konto.' });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({ error: 'Användaren kunde inte hittas.' });
      }

      // Invalidera alla tokens först
      await tokenService.revokeAllUserTokens(id);

      await prisma.user.delete({ where: { id } });

      logger.info('Användare borttagen', {
        deletedUserId: id,
        deletedEmail: user.email,
        deletedBy: req.user.email
      });

      res.json({ message: 'Användaren har tagits bort.' });
    } catch (error) {
      logger.error('Ta bort användare misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte ta bort användaren.' });
    }
  },

  // -------------------------------------------
  // GET /api/admin/uploads
  // -------------------------------------------
  async uploadHistory(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const [videos, total] = await Promise.all([
        prisma.video.findMany({
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            uploadedBy: {
              select: { id: true, name: true, email: true }
            },
            team: { select: { id: true, name: true } },
            season: { select: { id: true, name: true } }
          }
        }),
        prisma.video.count()
      ]);

      // BUG FIX #11: BigInt → Number för JSON-serialisering
      const safeVideos = videos.map(v => ({
        ...v,
        fileSize: Number(v.fileSize)
      }));

      res.json({
        videos: safeVideos,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      logger.error('Uppladdningshistorik-fel:', error);
      res.status(500).json({ error: 'Kunde inte hämta uppladdningshistorik.' });
    }
  },

  // -------------------------------------------
  // GET /api/admin/teams
  // -------------------------------------------
  async listTeams(req, res) {
    try {
      const teams = await prisma.team.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { videos: { where: { deletedAt: null } }, seasons: true } },
          seasons: { orderBy: { name: 'desc' } }
        }
      });
      res.json({ teams });
    } catch (error) {
      logger.error('Listning av lag misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte hämta lag.' });
    }
  },

  // -------------------------------------------
  // POST /api/admin/teams
  // -------------------------------------------
  async createTeam(req, res) {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Lagnamn krävs.' });
      }
      const existing = await prisma.team.findUnique({ where: { name: name.trim() } });
      if (existing) {
        return res.status(409).json({ error: 'Ett lag med det namnet finns redan.' });
      }
      const team = await prisma.team.create({ data: { name: name.trim() } });
      logger.info('Nytt lag skapat', { teamId: team.id, name: team.name, createdBy: req.user.email });
      res.status(201).json({ message: 'Laget har skapats.', team });
    } catch (error) {
      logger.error('Skapa lag misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte skapa laget.' });
    }
  },

  // -------------------------------------------
  // DELETE /api/admin/teams/:id
  // -------------------------------------------
  async deleteTeam(req, res) {
    try {
      const id = parseInt(req.params.id);
      const team = await prisma.team.findUnique({ where: { id } });
      if (!team) {
        return res.status(404).json({ error: 'Laget kunde inte hittas.' });
      }
      await prisma.team.delete({ where: { id } });
      logger.info('Lag borttaget', { teamId: id, name: team.name, deletedBy: req.user.email });
      res.json({ message: 'Laget har tagits bort.' });
    } catch (error) {
      logger.error('Ta bort lag misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte ta bort laget.' });
    }
  },

  // -------------------------------------------
  // POST /api/admin/teams/:id/thumbnail
  // -------------------------------------------
  async uploadTeamThumbnail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const team = await prisma.team.findUnique({ where: { id } });
      if (!team) return res.status(404).json({ error: 'Laget hittades inte.' });
      if (!req.file) return res.status(400).json({ error: 'Ingen bild bifogad.' });

      const fs = await import('fs/promises');
      const path = await import('path');

      // Radera gamla thumbnails (alla extensions)
      const exts = ['.jpg', '.jpeg', '.png', '.webp'];
      for (const e of exts) {
        await fs.unlink(path.default.join('/app/data/thumbnails/teams', 'team-' + id + e)).catch(() => {});
      }

      const ext = path.default.extname(req.file.originalname).toLowerCase() || '.jpg';
      const thumbDir = '/app/data/thumbnails/teams';
      await fs.mkdir(thumbDir, { recursive: true });
      const thumbFile = 'team-' + id + ext;
      const destPath = path.default.join(thumbDir, thumbFile);
      await fs.copyFile(req.file.path, destPath);
      await fs.unlink(req.file.path).catch(() => {});

      const thumbnailPath = '/teams/' + thumbFile;
      await prisma.team.update({
        where: { id },
        data: { thumbnailPath }
      });

      logger.info('Team thumbnail uppladdad', { teamId: id, thumbnailPath });
      res.json({ thumbnailUrl: '/api/admin/team-thumbnail/' + thumbFile });
    } catch (error) {
      logger.error('Team thumbnail-fel:', error);
      res.status(500).json({ error: 'Kunde inte ladda upp bilden.' });
    }
  },

  // -------------------------------------------
  // GET /api/admin/seasons
  // -------------------------------------------
  async listSeasons(req, res) {
    try {
      const teamId = req.params.teamId || req.query.teamId;
      const where = teamId ? { teamId: parseInt(teamId) } : {};
      const seasons = await prisma.season.findMany({
        where,
        orderBy: { name: 'desc' },
        include: {
          team: { select: { id: true, name: true } },
          _count: { select: { videos: { where: { deletedAt: null } } } }
        }
      });
      res.json({ seasons });
    } catch (error) {
      logger.error('Listning av säsonger misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte hämta säsonger.' });
    }
  },

  // -------------------------------------------
  // POST /api/admin/seasons
  // -------------------------------------------
  async createSeason(req, res) {
    try {
      const { name, teamId } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Säsongsnamn krävs.' });
      }
      if (!teamId) {
        return res.status(400).json({ error: 'Lag krävs.' });
      }
      const team = await prisma.team.findUnique({ where: { id: parseInt(teamId) } });
      if (!team) {
        return res.status(404).json({ error: 'Laget kunde inte hittas.' });
      }
      const existing = await prisma.season.findUnique({
        where: { name_teamId: { name: name.trim(), teamId: parseInt(teamId) } }
      });
      if (existing) {
        return res.status(409).json({ error: 'Den säsongen finns redan för detta lag.' });
      }
      const season = await prisma.season.create({
        data: { name: name.trim(), teamId: parseInt(teamId) },
        include: { team: { select: { id: true, name: true } } }
      });
      logger.info('Ny säsong skapad', { seasonId: season.id, name: season.name, teamId, createdBy: req.user.email });
      res.status(201).json({ message: 'Säsongen har skapats.', season });
    } catch (error) {
      logger.error('Skapa säsong misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte skapa säsongen.' });
    }
  },

  // -------------------------------------------
  // DELETE /api/admin/seasons/:id
  // -------------------------------------------
  async deleteSeason(req, res) {
    try {
      const id = parseInt(req.params.id);
      const season = await prisma.season.findUnique({ where: { id } });
      if (!season) {
        return res.status(404).json({ error: 'Säsongen kunde inte hittas.' });
      }
      await prisma.season.delete({ where: { id } });
      logger.info('Säsong borttagen', { seasonId: id, name: season.name, deletedBy: req.user.email });
      res.json({ message: 'Säsongen har tagits bort.' });
    } catch (error) {
      logger.error('Ta bort säsong misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte ta bort säsongen.' });
    }
  },

  // -------------------------------------------
  // PATCH /api/admin/videos/:id/assign
  // Tilldela video till lag/säsong
  // -------------------------------------------
  // -------------------------------------------
  // POST /api/admin/invites — Skapa inbjudan
  // -------------------------------------------
  async createInvite(req, res) {
    try {
      const { role, maxUses } = req.body;
      const validRoles = ['viewer', 'uploader', 'coach'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ error: 'Ogiltig roll.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 timmar

      const invite = await prisma.inviteToken.create({
        data: {
          token,
          role: role || 'viewer',
          maxUses: maxUses || 1,
          expiresAt,
          createdBy: req.user.id
        }
      });

      logger.info('Inbjudan skapad', { inviteId: invite.id, role: invite.role, createdBy: req.user.email });

      res.status(201).json({
        invite: {
          id: invite.id,
          token: invite.token,
          role: invite.role,
          expiresAt: invite.expiresAt,
          url: '/register/' + invite.token
        }
      });
    } catch (error) {
      logger.error('Skapa inbjudan misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte skapa inbjudan.' });
    }
  },

  // -------------------------------------------
  // GET /api/admin/invites — Lista inbjudningar
  // -------------------------------------------
  async listInvites(req, res) {
    try {
      const invites = await prisma.inviteToken.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      res.json({ invites });
    } catch (error) {
      logger.error('Lista inbjudningar misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte hämta inbjudningar.' });
    }
  },

  // -------------------------------------------
  // DELETE /api/admin/invites/:id
  // -------------------------------------------
  async deleteInvite(req, res) {
    try {
      const { id } = req.params;
      await prisma.inviteToken.delete({ where: { id } });
      logger.info('Inbjudan borttagen', { inviteId: id, deletedBy: req.user.email });
      res.json({ message: 'Inbjudan borttagen.' });
    } catch (error) {
      logger.error('Ta bort inbjudan misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte ta bort inbjudan.' });
    }
  },



  async uploadSecondaryVideo(req, res) {
    try {
      const { id } = req.params;
      if (!req.file) return res.status(400).json({ error: 'Ingen fil uppladdad.' });
      const video = await prisma.video.findUnique({ where: { id } });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });

      const filePath = fileStorageService.buildFilePath(video.matchDate, video.opponent, req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_') + '_vinkel2' + require('path').extname(req.file.originalname));
      const absPath = fileStorageService.getAbsolutePath(filePath);

      const fs = await import('fs/promises');
      const path = await import('path');
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.copyFile(req.file.path, absPath);
      await fs.unlink(req.file.path).catch(() => {});

      await prisma.video.update({ where: { id }, data: { secondaryFilePath: filePath } });
      logger.info('Sekundär video uppladdad', { videoId: id, filePath });
      res.json({ message: 'Vinkel 2 uppladdad.', secondaryFilePath: filePath });
    } catch (error) {
      logger.error('uploadSecondaryVideo misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte ladda upp vinkel 2.' });
    }
  },

  async setSecondaryVideo(req, res) {
    try {
      const { id } = req.params;
      const { secondaryFilePath } = req.body;
      const video = await prisma.video.findUnique({ where: { id } });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });
      const updated = await prisma.video.update({
        where: { id },
        data: { secondaryFilePath: secondaryFilePath || null }
      });
      logger.info('Sekundär videovinkel satt', { videoId: id, secondaryFilePath });
      res.json({ message: 'Sekundär vinkel sparad.', secondaryFilePath: updated.secondaryFilePath });
    } catch (error) {
      logger.error('setSecondaryVideo misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte spara sekundär vinkel.' });
    }
  },

  async assignVideo(req, res) {
    try {
      const { id } = req.params;
      const { teamId, seasonId } = req.body;

      const video = await prisma.video.findUnique({ where: { id } });
      if (!video) {
        return res.status(404).json({ error: 'Videon kunde inte hittas.' });
      }

      const updateData = {
        teamId: teamId ? parseInt(teamId) : null,
        seasonId: seasonId ? parseInt(seasonId) : null
      };

      const updated = await prisma.video.update({
        where: { id },
        data: updateData,
        include: {
          team: { select: { id: true, name: true } },
          season: { select: { id: true, name: true } }
        }
      });

      logger.info('Video tilldelad lag/säsong', { videoId: id, teamId, seasonId, updatedBy: req.user.email });
      res.json({ message: 'Videon har tilldelats.', video: { ...updated, fileSize: Number(updated.fileSize) } });
    } catch (error) {
      logger.error('Tilldela video misslyckades:', error);
      res.status(500).json({ error: 'Kunde inte tilldela videon.' });
    }
  }

};