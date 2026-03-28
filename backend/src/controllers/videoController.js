// ===========================================
// LVC Media Hub — Video Controller
// ===========================================
import prisma from '../config/database.js';
import { fileStorageService } from '../services/fileStorage.js';
import { fileValidator } from '../utils/fileValidator.js';
import path from 'path';
import { mkdir, unlink, rename, copyFile, stat as fsStat } from 'fs/promises';
import logger from '../utils/logger.js';

export const videoController = {


  async upload(req, res) {
    try {
      const videoFile = req.files && req.files.video && req.files.video[0];
      const dvwFile = req.files && req.files.dvw && req.files.dvw[0];

      if (!videoFile) return res.status(400).json({ error: 'Ingen videofil bifogad.' });

      const { opponent, matchDate, description, teamId, seasonId } = req.body;
      if (!opponent || !matchDate) return res.status(400).json({ error: 'Motstandare och matchdatum kravs.' });

      const filePath = fileStorageService.buildFilePath(matchDate, opponent, videoFile.originalname);
      const absPath = fileStorageService.getAbsolutePath(filePath);

      const dir = path.dirname(absPath);
      await mkdir(dir, { recursive: true });

      const { createReadStream, createWriteStream } = await import('fs');
      const { pipeline } = await import('stream/promises');
      await pipeline(createReadStream(videoFile.path), createWriteStream(absPath));
      await unlink(videoFile.path).catch(() => {});
      logger.info('Video sparad till NAS', { path: filePath });

      let dvwPath = null;
      if (dvwFile) {
        dvwPath = filePath.replace(/\.[^.]+$/, '.dvw');
        const dvwAbsPath = fileStorageService.getAbsolutePath(dvwPath);
        await pipeline(createReadStream(dvwFile.path), createWriteStream(dvwAbsPath));
        await unlink(dvwFile.path).catch(() => {});
        logger.info('DVW-fil sparad till NAS', { path: dvwPath });
      }

      const fileStat = await fsStat(absPath);

      const date = new Date(matchDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const title = 'LVC vs ' + opponent + ' \u2014 ' + day + '/' + month + '/' + year;

      const ext = path.extname(videoFile.originalname).toLowerCase();
      const mimeType = ext === '.mp4' ? 'video/mp4' : ext === '.mov' ? 'video/quicktime' : 'video/x-matroska';

      const video = await prisma.video.create({
        data: {
          title,
          opponent,
          matchDate: date,
          description: description || null,
          fileName: path.basename(filePath),
          filePath,
          fileSize: BigInt(fileStat.size),
          mimeType,
          dvwPath,
          uploadedById: req.user.id,
          teamId: teamId ? parseInt(teamId) : null,
          seasonId: seasonId ? parseInt(seasonId) : null
        }
      });

      logger.info('Video uppladdad', { videoId: video.id, title, uploadedBy: req.user.email });
      res.status(201).json({ video: { id: video.id, title } });
    } catch (error) {
      if (req.files && req.files.video && req.files.video[0]) await unlink(req.files.video[0].path).catch(() => {});
      if (req.files && req.files.dvw && req.files.dvw[0]) await unlink(req.files.dvw[0].path).catch(() => {});
      logger.error('Upload-fel:', error);
      res.status(500).json({ error: error.message || 'Uppladdningen misslyckades.' });
    }
  },

  async list(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const search = req.query.search || '';
      const teamId = req.query.teamId ? parseInt(req.query.teamId) : null;
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId) : null;
      const skip = (page - 1) * limit;

      const where = { deletedAt: null };
      if (search) {
        where.OR = [
          { opponent: { contains: search } },
          { title: { contains: search } },
          { description: { contains: search } }
        ];
      }
      if (teamId) where.teamId = teamId;
      if (seasonId) where.seasonId = seasonId;

      const [videos, total] = await Promise.all([
        prisma.video.findMany({
          where,
          orderBy: { matchDate: 'desc' },
          skip,
          take: limit,
          include: {
            uploadedBy: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } },
            season: { select: { id: true, name: true } }
          }
        }),
        prisma.video.count({ where })
      ]);
      const videosWithUrls = videos.map(video => ({
        id: video.id,
        title: video.title,
        opponent: video.opponent,
        matchDate: video.matchDate,
        description: video.description,
        fileSize: Number(video.fileSize),
        mimeType: video.mimeType,
        uploadedBy: video.uploadedBy,
        team: video.team,
        season: video.season,
        createdAt: video.createdAt,
        streamUrl: fileStorageService.generateSignedUrl(video.id).url,
        thumbnailUrl: video.thumbnailPath ? `/api/videos/thumbnail/${video.thumbnailPath.replace('/local/', '')}` : null
      }));
      res.json({ videos: videosWithUrls, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
      logger.error('Videolistnings-fel:', error);
      res.status(500).json({ error: 'Kunde inte hämta videolistan.' });
    }
  },

  async getOne(req, res) {
    try {
      const video = await prisma.video.findUnique({
        where: { id: req.params.id },
        include: { uploadedBy: { select: { id: true, name: true } } }
      });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });
      const streamUrl = fileStorageService.generateSignedUrl(video.id);
      res.json({
        video: {
          id: video.id,
          title: video.title,
          opponent: video.opponent,
          matchDate: video.matchDate,
          description: video.description,
          fileSize: Number(video.fileSize),
          mimeType: video.mimeType,
          uploadedBy: video.uploadedBy,
          createdAt: video.createdAt,
          streamUrl: streamUrl.url,
          streamUrlExpires: streamUrl.expiresAt,
          thumbnailUrl: video.thumbnailPath ? `/api/videos/thumbnail/${video.thumbnailPath.replace('/local/', '')}` : null
        }
      });
    } catch (error) {
      logger.error('Video-hämtningsfel:', error);
      res.status(500).json({ error: 'Kunde inte hämta videon.' });
    }
  },

  async thumbnail(req, res) {
    try {
      const filePath = req.params[0];
      if (!filePath || filePath.includes('..')) {
        return res.status(400).json({ error: 'Ogiltig sökväg.' });
      }

      const fs = await import('fs');
      const fsp = await import('fs/promises');

      // Kolla lokalt först (/app/data/thumbnails/)
      const localPath = path.join('/app/data/thumbnails', filePath);
      try {
        await fsp.access(localPath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
        res.set('Content-Type', mimeTypes[ext] || 'image/jpeg');
        res.set('Cache-Control', 'no-cache');
        fs.createReadStream(localPath).pipe(res);
        return;
      } catch {}

      // Fallback: kolla storage
      const result = await fileStorageService.streamFile(filePath, null);
      if (!result) return res.status(404).json({ error: 'Bild hittades inte.' });
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'no-cache');
      result.stream.pipe(res);
    } catch (error) {
      logger.error('Thumbnail-fel:', error);
      res.status(500).json({ error: 'Kunde inte hämta bilden.' });
    }
  },

  async uploadThumbnail(req, res) {
    try {
      const { id } = req.params;
      const video = await prisma.video.findUnique({ where: { id } });
      if (!video) return res.status(404).json({ error: 'Videon hittades inte.' });

      if (!req.file) return res.status(400).json({ error: 'Ingen bild bifogad.' });

      const fs = await import('fs/promises');
      // Radera gamla thumbnails (alla extensions)
      const exts = ['.jpg', '.jpeg', '.png', '.webp'];
      for (const e of exts) {
        await fs.unlink(path.join('/app/data/thumbnails', id + e)).catch(() => {});
      }

      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      const thumbDir = '/app/data/thumbnails';
      await fs.mkdir(thumbDir, { recursive: true });
      const thumbFile = id + ext;
      const destPath = path.join(thumbDir, thumbFile);
      await fs.copyFile(req.file.path, destPath);
      await fs.unlink(req.file.path).catch(() => {});

      const thumbnailPath = '/local/' + thumbFile;
      await prisma.video.update({
        where: { id },
        data: { thumbnailPath }
      });

      logger.info('Thumbnail uppladdad', { videoId: id, thumbnailPath });
      res.json({ thumbnailUrl: '/api/videos/thumbnail/' + thumbFile + '?t=' + Date.now() });
    } catch (error) {
      logger.error('Thumbnail upload-fel:', error);
      res.status(500).json({ error: 'Kunde inte ladda upp bilden.' });
    }
  },

  async stream(req, res) {
    try {
      res.set('Access-Control-Allow-Origin', 'https://lvcmediahub.com');
      res.set('Access-Control-Allow-Methods', 'GET');
      const { id } = req.params;
      const { expires, sig } = req.query;
      if (!expires || !sig || !fileStorageService.verifySignedUrl(id, expires, sig)) {
        return res.status(403).json({ error: 'Ogiltig eller utgången streaming-URL.' });
      }
      const video = await prisma.video.findUnique({ where: { id } });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });
      const rangeHeader = req.headers.range || null;
      const result = await fileStorageService.streamFile(video.filePath, rangeHeader);
      if (!result) return res.status(500).json({ error: 'Kunde inte streama videon.' });
      res.status(result.status);
      if (result.headers['content-type']) res.set('Content-Type', result.headers['content-type']);
      if (result.headers['content-length']) res.set('Content-Length', result.headers['content-length']);
      if (result.headers['content-range']) res.set('Content-Range', result.headers['content-range']);
      res.set('Accept-Ranges', result.headers['accept-ranges']);
      res.set('Cache-Control', 'no-store');
      result.stream.pipe(res);
      result.stream.on('error', (error) => {
        logger.error('Streaming-fel:', { videoId: id, error: error.message });
        if (!res.headersSent) res.status(500).json({ error: 'Streaming-fel.' });
      });
    } catch (error) {
      logger.error('Stream-controller-fel:', error);
      if (!res.headersSent) res.status(500).json({ error: 'Kunde inte streama videon.' });
    }
  },

  async remove(req, res) {
    try {
      const video = await prisma.video.findUnique({ where: { id: req.params.id } });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });

      if (req.user.role === 'admin') {
        // Admin = permanent radering
        await fileStorageService.deleteFile(video.filePath);
        if (video.dvwPath) await fileStorageService.deleteFile(video.dvwPath);
        if (video.thumbnailPath) await fileStorageService.deleteFile(video.thumbnailPath);
        await prisma.video.delete({ where: { id: video.id } });
        logger.info('Video permanent raderad av admin', { videoId: video.id, title: video.title, deletedBy: req.user.email });
        res.json({ message: 'Videon har raderats permanent.' });
      } else {
        // Uppladdare = soft delete
        await prisma.video.update({
          where: { id: video.id },
          data: { deletedAt: new Date(), deletedById: req.user.id }
        });
        logger.info('Video soft-deleted av uppladdare', { videoId: video.id, title: video.title, deletedBy: req.user.email });
        res.json({ message: 'Videon har tagits bort.' });
      }
    } catch (error) {
      logger.error('Borttagningsfel:', error);
      res.status(500).json({ error: 'Kunde inte ta bort videon.' });
    }
  },

  async restore(req, res) {
    try {
      const video = await prisma.video.findUnique({ where: { id: req.params.id } });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });
      if (!video.deletedAt) return res.status(400).json({ error: 'Videon ar inte borttagen.' });
      await prisma.video.update({
        where: { id: video.id },
        data: { deletedAt: null, deletedById: null }
      });
      logger.info('Video aterstall av admin', { videoId: video.id, title: video.title });
      res.json({ message: 'Videon har aterstallts.' });
    } catch (error) {
      logger.error('Aterstellningsfel:', error);
      res.status(500).json({ error: 'Kunde inte aterstalla videon.' });
    }
  },

  async permanentDelete(req, res) {
    try {
      const video = await prisma.video.findUnique({ where: { id: req.params.id } });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });
      await fileStorageService.deleteFile(video.filePath);
      if (video.dvwPath) await fileStorageService.deleteFile(video.dvwPath);
      if (video.thumbnailPath) await fileStorageService.deleteFile(video.thumbnailPath);
      await prisma.video.delete({ where: { id: video.id } });
      logger.info('Video permanent raderad', { videoId: video.id, title: video.title, deletedBy: req.user.email });
      res.json({ message: 'Videon har raderats permanent.' });
    } catch (error) {
      logger.error('Permanent raderingsfel:', error);
      res.status(500).json({ error: 'Kunde inte radera videon.' });
    }
  }
};

// Exportera scout-data (läggs till befintlig export)
export const scoutController = {
  async getScout(req, res) {
    try {
      const video = await prisma.video.findUnique({ where: { id: req.params.id } });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });
      if (!video.dvwPath) return res.status(404).json({ error: 'Ingen scout-fil hittades.' });

      const { dvwParserService } = await import('../services/dvwParser.js');
      const data = await dvwParserService.parseFile(video.dvwPath, video.videoOffset || 0);
      res.json(data);
    } catch (error) {
      console.error('Scout-fel:', error);
      res.status(500).json({ error: 'Kunde inte läsa scout-filen.' });
    }
  },

  async updateOffset(req, res) {
    try {
      const { offset } = req.body;
      if (typeof offset !== 'number') return res.status(400).json({ error: 'Ogiltig offset.' });
      const video = await prisma.video.update({
        where: { id: req.params.id },
        data: { videoOffset: offset }
      });
      res.json({ videoOffset: video.videoOffset });
    } catch (error) {
      res.status(500).json({ error: 'Kunde inte uppdatera offset.' });
    }
  }
};
