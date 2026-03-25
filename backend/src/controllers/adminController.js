// ===========================================
// LVC Media Hub — Admin Controller
// Hantera användare och visa uppladdningshistorik
// ===========================================
import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import { tokenService } from '../services/tokenService.js';
import logger from '../utils/logger.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export const adminController = {
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
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { videos: true } }
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

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
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
      const { email, name, password, role, isActive } = req.body;

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
            }
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
  }
};
