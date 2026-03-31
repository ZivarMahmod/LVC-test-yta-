// ===========================================
// LVC Media Hub — Thumbnail Controller
// ===========================================
import prisma from '../config/database.js';
import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import multer from 'multer';
import logger from '../utils/logger.js';

const thumbUpload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 5 * 1024 * 1024 } });
const THUMB_DIR = '/app/data/thumbnails/library';
const TEAM_THUMB_DIR = '/app/data/thumbnails/teams';

const MIMES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp'
};

export const thumbnailController = {
  // GET /api/thumbnail-library
  async list(req, res) {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId) : null;
      const where = teamId ? { teamId } : {};
      const thumbs = await prisma.thumbnailLibrary.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { team: { select: { id: true, name: true } } }
      });
      res.json({ thumbnails: thumbs });
    } catch (err) {
      logger.error('Thumbnail list error:', err);
      res.status(500).json({ error: 'Kunde inte hämta thumbnails' });
    }
  },

  // POST /api/admin/thumbnail-library
  upload: [thumbUpload.array('images', 20), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Inga bilder bifogade' });
      const teamId = parseInt(req.body.teamId);
      if (!teamId) return res.status(400).json({ error: 'teamId krävs' });
      await fsp.mkdir(THUMB_DIR, { recursive: true });
      const created = [];
      for (const file of req.files) {
        const name = Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/\.[^.]+$/, '');
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const id = crypto.randomUUID();
        const fileName = id + ext;
        const destPath = path.join(THUMB_DIR, fileName);
        await fsp.copyFile(file.path, destPath);
        await fsp.unlink(file.path).catch(() => {});
        const entry = await prisma.thumbnailLibrary.create({
          data: { id, name, filePath: fileName, teamId }
        });
        created.push(entry);
      }
      res.status(201).json({ thumbnails: created });
    } catch (err) {
      logger.error('Thumbnail upload error:', err);
      res.status(500).json({ error: 'Kunde inte ladda upp thumbnails' });
    }
  }],

  // DELETE /api/admin/thumbnail-library/:id
  async remove(req, res) {
    try {
      const entry = await prisma.thumbnailLibrary.findUnique({ where: { id: req.params.id } });
      if (!entry) return res.status(404).json({ error: 'Hittades inte' });
      await fsp.unlink(path.join(THUMB_DIR, entry.filePath)).catch(() => {});
      await prisma.thumbnailLibrary.delete({ where: { id: req.params.id } });
      res.json({ message: 'Borttagen' });
    } catch (err) {
      logger.error('Thumbnail delete error:', err);
      res.status(500).json({ error: 'Kunde inte ta bort thumbnail' });
    }
  },

  // GET /api/thumbnail-library/image/:file
  serveImage(req, res) {
    try {
      const file = path.basename(req.params.file);
      const thumbPath = path.join(THUMB_DIR, file);
      if (!fs.existsSync(thumbPath)) return res.status(404).json({ error: 'Bild hittades inte' });
      const ext = path.extname(thumbPath).toLowerCase();
      res.set('Content-Type', MIMES[ext] || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(thumbPath).pipe(res);
    } catch (err) {
      res.status(500).json({ error: 'Serverfel' });
    }
  },

  // GET /api/team-thumbnail/:file
  serveTeamImage(req, res) {
    const file = path.basename(req.params.file);
    const thumbPath = path.join(TEAM_THUMB_DIR, file);
    if (!fs.existsSync(thumbPath)) return res.status(404).json({ error: 'Bild hittades inte.' });
    const ext = path.extname(thumbPath).toLowerCase();
    res.set('Content-Type', MIMES[ext] || 'image/jpeg');
    res.set('Cache-Control', 'no-cache');
    fs.createReadStream(thumbPath).pipe(res);
  }
};
