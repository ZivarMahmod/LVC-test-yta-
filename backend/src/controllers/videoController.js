// ===========================================
// LVC Media Hub — Video Controller
// ===========================================
import prisma from '../config/database.js';
import { fileStorageService } from '../services/fileStorage.js';
import { fileValidator } from '../utils/fileValidator.js';
import path from 'path';
import { mkdir, unlink, stat as fsStat } from 'fs/promises';
import logger from '../utils/logger.js';
import { formatVideoTitle } from '../utils/formatTitle.js';

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
      const title = formatVideoTitle(opponent, matchDate);

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
      res.status(500).json({ error: 'Uppladdningen misslyckades.' });
    }
  },



  async uploadChunk(req, res) {
    try {
      const chunk = req.file;
      if (!chunk) return res.status(400).json({ error: 'Ingen chunk bifogad.' });

      const { uploadId, chunkIndex, totalChunks, _fileName } = req.body;
      if (!uploadId || chunkIndex === undefined || !totalChunks) {
        return res.status(400).json({ error: 'uploadId, chunkIndex och totalChunks kravs.' });
      }

      // Validera uploadId-format (UUID) för att förhindra path traversal
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uploadId)) {
        return res.status(400).json({ error: 'Ogiltigt uploadId-format.' });
      }

      const chunkDir = path.join('/tmp/uploads', uploadId);
      await mkdir(chunkDir, { recursive: true });

      const chunkPath = path.join(chunkDir, `chunk_${String(chunkIndex).padStart(5, '0')}`);
      const { createReadStream: crs, createWriteStream: cws } = await import('fs');
      const { pipeline: pl } = await import('stream/promises');
      await pl(crs(chunk.path), cws(chunkPath));
      await unlink(chunk.path).catch(() => {});

      logger.info('Chunk mottagen', { uploadId, chunkIndex, totalChunks });
      res.json({ received: parseInt(chunkIndex) });
    } catch (error) {
      logger.error('Chunk upload-fel:', error);
      res.status(500).json({ error: 'Chunk-uppladdning misslyckades.' });
    }
  },

  async uploadComplete(req, res) {
    try {
      const { uploadId, fileName, opponent, matchDate, description, teamId, seasonId, thumbnailId, matchType, homeTeam } = req.body;
      if (!uploadId || !fileName || !opponent || !matchDate) {
        return res.status(400).json({ error: 'Saknar obligatoriska falt.' });
      }

      // Validera uploadId-format (UUID) för att förhindra path traversal
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uploadId)) {
        return res.status(400).json({ error: 'Ogiltigt uploadId-format.' });
      }

      const chunkDir = path.join('/tmp/uploads', uploadId);
      const { readdir: rd } = await import('fs/promises');
      const chunks = (await rd(chunkDir)).filter(f => f.startsWith('chunk_')).sort();

      if (chunks.length === 0) {
        return res.status(400).json({ error: 'Inga chunks hittades.' });
      }

      // Bygg filsokvag
      const filePath = fileStorageService.buildFilePath(matchDate, opponent, fileName);
      const absPath = fileStorageService.getAbsolutePath(filePath);
      const dir = path.dirname(absPath);
      await mkdir(dir, { recursive: true });

      // Satt ihop chunks direkt till NAS
      const { createReadStream: crs, createWriteStream: cws } = await import('fs');
      const writeStream = cws(absPath);

      for (const chunkFile of chunks) {
        const chunkPath = path.join(chunkDir, chunkFile);
        await new Promise((resolve, reject) => {
          const readStream = crs(chunkPath);
          readStream.pipe(writeStream, { end: false });
          readStream.on('end', resolve);
          readStream.on('error', reject);
        });
      }
      writeStream.end();
      await new Promise((resolve) => writeStream.on('finish', resolve));

      logger.info('Video ihopsatt och sparad till NAS', { path: filePath });

      // Rensa chunks
      for (const chunkFile of chunks) {
        await unlink(path.join(chunkDir, chunkFile)).catch(() => {});
      }
      const { rmdir } = await import('fs/promises');
      await rmdir(chunkDir).catch(() => {});

      // Filstorlek
      const fileStat = await fsStat(absPath);

      // Validera den ihopsatta filen (magic bytes + extension)
      const ext = path.extname(fileName).toLowerCase();
      const mimeType = ext === '.mp4' ? 'video/mp4' : ext === '.mov' ? 'video/quicktime' : 'video/x-matroska';
      const validation = await fileValidator.validateFile({
        originalname: fileName,
        mimetype: mimeType,
        size: fileStat.size,
        path: absPath
      });
      if (!validation.valid) {
        await unlink(absPath).catch(() => {});
        return res.status(400).json({ error: validation.errors?.[0] || 'Ogiltig videofil.' });
      }

      // Skapa datum och titel
      const date = new Date(matchDate);
      const title = formatVideoTitle(opponent, matchDate, homeTeam || 'LVC');

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
          dvwPath: null,
          matchType: matchType === 'opponent' ? 'opponent' : 'own',
          thumbnailPath: thumbnailId ? '/local/library/' + thumbnailId : null,
          uploadedById: req.user.id,
          teamId: teamId ? parseInt(teamId) : null,
          seasonId: seasonId ? parseInt(seasonId) : null
        }
      });

      logger.info('Video uppladdad via chunks', { videoId: video.id, title, uploadedBy: req.user.email });
      res.status(201).json({ video: { id: video.id, title } });
    } catch (error) {
      logger.error('Upload complete-fel:', error);
      res.status(500).json({ error: error.message || 'Kunde inte slutfora uppladdningen.' });
    }
  },

  async uploadDvw(req, res) {
    try {
      const { id } = req.params;
      const dvwFile = req.file;
      if (!dvwFile) return res.status(400).json({ error: 'Ingen DVW-fil bifogad.' });

      const video = await prisma.video.findUnique({ where: { id } });
      if (!video) return res.status(404).json({ error: 'Videon hittades inte.' });

      const dvwPath = video.filePath.replace(/\.[^.]+$/, '.dvw');
      const dvwAbsPath = fileStorageService.getAbsolutePath(dvwPath);

      const { createReadStream: crs, createWriteStream: cws } = await import('fs');
      const { pipeline: pl } = await import('stream/promises');
      await pl(crs(dvwFile.path), cws(dvwAbsPath));
      await unlink(dvwFile.path).catch(() => {});

      await prisma.video.update({ where: { id }, data: { dvwPath } });
      logger.info('DVW-fil uppladdad', { videoId: id, dvwPath });
      res.json({ dvwPath });
    } catch (error) {
      logger.error('DVW upload-fel:', error);
      res.status(500).json({ error: 'Kunde inte ladda upp DVW-filen.' });
    }
  },

  async updateTitle(req, res) {
    try {
      const { id } = req.params;
      const { opponent } = req.body;
      if (!opponent || !opponent.trim()) return res.status(400).json({ error: 'Motståndarnamn krävs.' });

      const video = await prisma.video.findUnique({ where: { id } });
      if (!video) return res.status(404).json({ error: 'Videon hittades inte.' });

      const newOpponent = opponent.trim();
      const newTitle = formatVideoTitle(newOpponent, video.matchDate);

      const updated = await prisma.video.update({
        where: { id },
        data: { title: newTitle, opponent: newOpponent }
      });
      logger.info('Videotitel uppdaterad', { videoId: id, title: updated.title, opponent: updated.opponent });
      res.json({ title: updated.title, opponent: updated.opponent });
    } catch (error) {
      logger.error('Titel update-fel:', error);
      res.status(500).json({ error: 'Kunde inte uppdatera titeln.' });
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
      const videosWithUrls = await Promise.all(videos.map(async (video) => {
        let hasDvw = false;
        if (video.dvwPath) {
          try {
            await fsStat(fileStorageService.getAbsolutePath(video.dvwPath));
            hasDvw = true;
          } catch {}
        }
        return {
          id: video.id,
          title: video.title,
          opponent: video.opponent,
          matchType: video.matchType || 'own',
          matchDate: video.matchDate,
          description: video.description,
          fileSize: Number(video.fileSize),
          mimeType: video.mimeType,
          uploadedBy: video.uploadedBy,
          team: video.team,
          season: video.season,
          createdAt: video.createdAt,
          updatedAt: video.updatedAt,
          hasDvw,
          streamUrl: fileStorageService.generateSignedUrl(video.id).url,
          thumbnailUrl: video.thumbnailPath ? `/api/videos/thumbnail/${video.thumbnailPath.replace('/local/', '')}` : null
        };
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
          matchType: video.matchType || 'own',
          matchDate: video.matchDate,
          description: video.description,
          fileSize: Number(video.fileSize),
          mimeType: video.mimeType,
          uploadedBy: video.uploadedBy,
          createdAt: video.createdAt,
          streamUrl: streamUrl.url,
          streamUrlExpires: streamUrl.expiresAt,
          thumbnailUrl: video.thumbnailPath ? `/api/videos/thumbnail/${video.thumbnailPath.replace('/local/', '')}` : null,
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

      // Validera filtyp — endast bilder tillåtna
      const allowedImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedImageExts.includes(fileExt) || !allowedImageMimes.includes(req.file.mimetype)) {
        const fs0 = await import('fs/promises');
        await fs0.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'Endast bildfiler tillåtna (jpg, jpeg, png, gif, webp).' });
      }

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

      // Kolla om en annan video använder samma fil (undvik att radera aktiv fil)
      const otherVideo = await prisma.video.findFirst({
        where: { filePath: video.filePath, id: { not: video.id } }
      });

      if (!otherVideo) {
        // Ingen annan video använder filen — säkert att radera
        await fileStorageService.deleteFile(video.filePath);
        if (video.dvwPath) await fileStorageService.deleteFile(video.dvwPath);
        if (video.thumbnailPath) await fileStorageService.deleteFile(video.thumbnailPath);
      } else {
        logger.info('Hoppar över filradering — annan video använder samma fil', { videoId: video.id, otherVideoId: otherVideo.id });
      }

      await prisma.video.delete({ where: { id: video.id } });
      logger.info('Video permanent raderad', { videoId: video.id, title: video.title, deletedBy: req.user.email });
      res.json({ message: 'Videon har raderats permanent.' });
    } catch (error) {
      logger.error('Permanent raderingsfel:', error);
      res.status(500).json({ error: 'Kunde inte radera videon.' });
    }
  }
};

// Scout-cache (in-memory, 10 min TTL)
const scoutCache = new Map();
const SCOUT_CACHE_TTL = 10 * 60 * 1000;

const getCachedScout = async (videoId, dvwPath, videoOffset) => {
  const cacheKey = `${videoId}:${videoOffset}`;
  const cached = scoutCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SCOUT_CACHE_TTL) {
    return cached.data;
  }
  const { dvwParserService } = await import('../services/dvwParser.js');
  const data = await dvwParserService.parseFile(dvwPath, videoOffset);
  scoutCache.set(cacheKey, { data, timestamp: Date.now() });
  // Rensa gamla entries om cachen växer
  if (scoutCache.size > 50) {
    const now = Date.now();
    for (const [key, val] of scoutCache) {
      if (now - val.timestamp > SCOUT_CACHE_TTL) scoutCache.delete(key);
    }
  }
  return data;
};

// Exportera scout-data (läggs till befintlig export)
export const scoutController = {
  async getMultiScout(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20) {
        return res.status(400).json({ error: 'Ange 1-20 video-IDn.' });
      }

      const videos = await prisma.video.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, opponent: true, matchDate: true, matchType: true, dvwPath: true, videoOffset: true }
      });

      const allActions = [];
      const matches = [];
      let zonePositions = {};

      for (const video of videos) {
        matches.push({
          videoId: video.id,
          opponent: video.opponent,
          matchDate: video.matchDate,
          matchType: video.matchType || 'own'
        });

        if (!video.dvwPath) continue;
        const data = await getCachedScout(video.id, video.dvwPath, video.videoOffset || 0);
        if (data.zonePositions) zonePositions = data.zonePositions;

        for (const action of data.actions) {
          allActions.push({
            ...action,
            videoId: video.id,
            matchOpponent: video.opponent,
            matchDate: video.matchDate,
            matchType: video.matchType || 'own'
          });
        }
      }

      res.json({ actions: allActions, matches, zonePositions });
    } catch (error) {
      logger.error('Multi-scout-fel:', error);
      res.status(500).json({ error: 'Kunde inte hämta scout-data.' });
    }
  },

  async getScout(req, res) {
    try {
      const video = await prisma.video.findUnique({ where: { id: req.params.id } });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });
      if (!video.dvwPath) return res.status(404).json({ error: 'Ingen scout-fil hittades.' });

      const data = await getCachedScout(video.id, video.dvwPath, video.videoOffset || 0);
      res.json(data);
    } catch (error) {
      logger.error('Scout-fel:', error);
      res.status(500).json({ error: 'Kunde inte läsa scout-filen.' });
    }
  },

  async downloadDvw(req, res) {
    try {
      const video = await prisma.video.findUnique({ where: { id: req.params.id } });
      if (!video) return res.status(404).json({ error: 'Videon kunde inte hittas.' });
      if (!video.dvwPath) return res.status(404).json({ error: 'Ingen scout-fil hittades.' });

      const absPath = fileStorageService.getAbsolutePath(video.dvwPath);
      const { existsSync } = await import('fs');
      if (!existsSync(absPath)) return res.status(404).json({ error: 'Filen hittades inte på disk.' });

      const fileName = video.dvwPath.split('/').pop();
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      const { createReadStream } = await import('fs');
      createReadStream(absPath).pipe(res);
    } catch (error) {
      logger.error('DVW download-fel:', error);
      res.status(500).json({ error: 'Kunde inte ladda ner filen.' });
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
      // Invalidera cache vid offset-ändring
      for (const key of scoutCache.keys()) {
        if (key.startsWith(req.params.id + ':')) scoutCache.delete(key);
      }
      res.json({ videoOffset: video.videoOffset });
    } catch {
      res.status(500).json({ error: 'Kunde inte uppdatera offset.' });
    }
  }
};

// Historisk spelarstatistik — aggregerar data över flera matcher
export const playerStatsController = {
  async getPlayerHistory(req, res) {
    try {
      const { playerId } = req.params;
      const { teamId, name: queryName } = req.query;

      // Stödjer både UUID och tröjnummer-sökning
      const isUuid = playerId.includes('-');
      const jerseyNumber = isUuid ? null : parseInt(playerId, 10);

      let player = null;

      if (isUuid) {
        player = await prisma.user.findUnique({ where: { id: playerId }, select: { id: true, name: true, username: true, jerseyNumber: true } });
        if (!player) return res.status(404).json({ error: 'Spelaren hittades inte.' });
      } else {
        // Skapa objekt med tröjnummer + namn från query (DVW-namn)
        player = { id: null, name: queryName || null, username: null, jerseyNumber };
      }

      // Hämta alla videor med DVW-filer (valfritt filtrerade på lag)
      const where = { dvwPath: { not: null }, deletedAt: null };
      if (teamId) where.teamId = parseInt(teamId);

      const videos = await prisma.video.findMany({
        where,
        orderBy: { matchDate: 'desc' },
        select: {
          id: true, title: true, opponent: true, matchDate: true,
          dvwPath: true, videoOffset: true,
          team: { select: { id: true, name: true } }
        },
        take: 50
      });

      // Parsa varje video och extrahera spelarens statistik
      const matches = [];
      const totals = { serve: { total: 0, err: 0, pts: 0 }, attack: { total: 0, err: 0, blocked: 0, pts: 0 }, reception: { total: 0, pos: 0, exc: 0, err: 0 }, block: { pts: 0 }, dig: { total: 0, pos: 0, err: 0 }, totalPts: 0 };

      for (const video of videos) {
        try {
          const data = await getCachedScout(video.id, video.dvwPath, video.videoOffset || 0);
          // Matcha på namn (fungerar oavsett om LVC är hemma eller borta)
          const playerActions = data.actions.filter(a => {
            if (queryName) return a.playerName === queryName;
            return a.playerNumber === player.jerseyNumber && a.team === 'H';
          });
          if (playerActions.length === 0) continue;

          // Hämta spelarnamn från DVW om det saknas
          if (!player.name && playerActions.length > 0) {
            player.name = playerActions[0].playerName;
          }
          // Uppdatera tröjnummer från denna match (kan variera mellan säsonger)
          if (!player.jerseyNumber && playerActions.length > 0) {
            player.jerseyNumber = playerActions[0].playerNumber;
          }

          const stats = { serve: { total: 0, err: 0, pts: 0 }, attack: { total: 0, err: 0, blocked: 0, pts: 0 }, reception: { total: 0, pos: 0, exc: 0, err: 0 }, block: { pts: 0 }, dig: { total: 0, pos: 0, err: 0 }, totalPts: 0 };

          for (const a of playerActions) {
            const isErr = a.grade === '/' || a.grade === '=';
            const isPerfect = a.grade === '#';
            const isPositive = a.grade === '+';

            switch (a.skill) {
              case 'S':
                stats.serve.total++;
                if (isPerfect) { stats.serve.pts++; stats.totalPts++; }
                if (isErr) stats.serve.err++;
                break;
              case 'A':
                stats.attack.total++;
                if (isPerfect) { stats.attack.pts++; stats.totalPts++; }
                if (isErr) stats.attack.err++;
                if (a.grade === '/') stats.attack.blocked++;
                break;
              case 'R':
                stats.reception.total++;
                if (isPerfect || isPositive) stats.reception.pos++;
                if (isPerfect) stats.reception.exc++;
                if (isErr) stats.reception.err++;
                break;
              case 'B':
                if (isPerfect) { stats.block.pts++; stats.totalPts++; }
                break;
              case 'D':
                stats.dig.total++;
                if (isPerfect || isPositive) stats.dig.pos++;
                if (isErr) stats.dig.err++;
                break;
            }
          }

          // Ackumulera totaler
          for (const skill of ['serve', 'attack', 'reception', 'dig']) {
            for (const key of Object.keys(totals[skill])) {
              totals[skill][key] += stats[skill][key];
            }
          }
          totals.block.pts += stats.block.pts;
          totals.totalPts += stats.totalPts;

          matches.push({
            videoId: video.id,
            title: video.title,
            opponent: video.opponent,
            matchDate: video.matchDate,
            team: video.team,
            stats,
            actionCount: playerActions.length
          });
        } catch {
          // Skippa videor vars DVW-filer inte kan läsas
        }
      }

      // Om spelaren inte hittades i DB och inga matcher hittades i DVW
      if (!player.name) {
        player.name = `#${player.jerseyNumber}`;
      }

      res.json({ player, matches, totals, matchCount: matches.length });
    } catch (error) {
      logger.error('Spelarhistorik-fel:', error);
      res.status(500).json({ error: 'Kunde inte hämta spelarhistorik.' });
    }
  }
};
