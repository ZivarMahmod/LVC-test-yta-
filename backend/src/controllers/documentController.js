// ===========================================
// LVC Media Hub — Document Controller
// ===========================================
import prisma from '../config/database.js';
import { fileStorageService } from '../services/fileStorage.js';
import path from 'path';
import { mkdir, unlink, stat as fsStat, createReadStream } from 'fs/promises';
import logger from '../utils/logger.js';

export const documentController = {

  // Lista dokument för en video
  async list(req, res) {
    try {
      const docs = await prisma.matchDocument.findMany({
        where: { videoId: req.params.id },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ documents: docs.map(d => ({ ...d, fileSize: Number(d.fileSize) })) });
    } catch (error) {
      logger.error('Document list error:', error);
      res.status(500).json({ error: 'Kunde inte hämta dokument.' });
    }
  },

  // Ladda upp dokument
  async upload(req, res) {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Ingen fil bifogad.' });

      const video = await prisma.video.findUnique({ where: { id: req.params.id } });
      if (!video) return res.status(404).json({ error: 'Videon hittades inte.' });

      const docType = req.body.type || 'other';
      const docName = req.body.name || file.originalname.replace(/\.[^.]+$/, '');

      // Spara filen
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = docName.replace(/[^a-zA-Z0-9åäöÅÄÖ _-]/g, '').substring(0, 100);
      const relPath = `/documents/${video.id}/${Date.now()}_${safeName}${ext}`;
      const absPath = fileStorageService.getAbsolutePath(relPath);

      await mkdir(path.dirname(absPath), { recursive: true });

      const { createReadStream: crs, createWriteStream: cws } = await import('fs');
      const { pipeline } = await import('stream/promises');
      await pipeline(crs(file.path), cws(absPath));
      await unlink(file.path).catch(() => {});

      const fileStat = await fsStat(absPath);

      const doc = await prisma.matchDocument.create({
        data: {
          name: docName,
          type: docType,
          filePath: relPath,
          fileSize: BigInt(fileStat.size),
          videoId: video.id,
          uploadedById: req.user.id
        }
      });

      logger.info('Document uploaded', { docId: doc.id, videoId: video.id, name: docName });
      res.status(201).json({ document: { ...doc, fileSize: Number(doc.fileSize) } });
    } catch (error) {
      if (req.file) await unlink(req.file.path).catch(() => {});
      logger.error('Document upload error:', error);
      res.status(500).json({ error: 'Kunde inte ladda upp dokumentet.' });
    }
  },

  // Visa/ladda ner dokument
  async serve(req, res) {
    try {
      const doc = await prisma.matchDocument.findUnique({ where: { id: req.params.docId } });
      if (!doc) return res.status(404).json({ error: 'Dokumentet hittades inte.' });

      const absPath = fileStorageService.getAbsolutePath(doc.filePath);
      const ext = path.extname(doc.filePath).toLowerCase();

      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg'
      };

      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${doc.name}${ext}"`);

      const { createReadStream: crs } = await import('fs');
      crs(absPath).pipe(res);
    } catch (error) {
      logger.error('Document serve error:', error);
      res.status(500).json({ error: 'Kunde inte visa dokumentet.' });
    }
  },

  // Ta bort dokument
  async remove(req, res) {
    try {
      const doc = await prisma.matchDocument.findUnique({ where: { id: req.params.docId } });
      if (!doc) return res.status(404).json({ error: 'Dokumentet hittades inte.' });

      const absPath = fileStorageService.getAbsolutePath(doc.filePath);
      await unlink(absPath).catch(() => {});

      await prisma.matchDocument.delete({ where: { id: doc.id } });

      logger.info('Document deleted', { docId: doc.id });
      res.json({ success: true });
    } catch (error) {
      logger.error('Document delete error:', error);
      res.status(500).json({ error: 'Kunde inte ta bort dokumentet.' });
    }
  }
};
