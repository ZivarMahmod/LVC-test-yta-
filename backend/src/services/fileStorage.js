// ===========================================
// LVC Media Hub — File Storage Service
// Direkt filsystemsåtkomst istället för WebDAV
// ===========================================
import { createReadStream } from 'fs';
import { stat, unlink, mkdir, copyFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger.js';

const getStoragePath = () => {
  return process.env.STORAGE_PATH || '/storage';
};

export const fileStorageService = {

  getAbsolutePath(filePath) {
    const storagePath = path.resolve(getStoragePath());
    const cleaned = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const normalized = path.normalize(cleaned);
    if (normalized.startsWith('..')) {
      throw new Error('Ogiltig sökväg: path traversal detekterad');
    }
    const absPath = path.resolve(storagePath, normalized);
    if (!absPath.startsWith(storagePath)) {
      throw new Error('Ogiltig sökväg: utanför storage');
    }
    return absPath;
  },

  async ensureDirectoryTree(filePath) {
    const absPath = this.getAbsolutePath(filePath);
    const dir = path.dirname(absPath);
    try {
      await mkdir(dir, { recursive: true });
      return true;
    } catch (error) {
      logger.error('Kunde inte skapa mapp:', { dir, error: error.message });
      return false;
    }
  },

  async uploadFileFromDisk(remotePath, localDiskPath, _contentType) {
    const dirsOk = await this.ensureDirectoryTree(remotePath);
    if (!dirsOk) return false;
    const destPath = this.getAbsolutePath(remotePath);
    try {
      await copyFile(localDiskPath, destPath);
      const fileStat = await stat(destPath);
      logger.info('Fil sparad till storage', { path: remotePath, size: fileStat.size });
      return true;
    } catch (error) {
      logger.error('Filkopiering misslyckades:', { path: remotePath, error: error.message });
      return false;
    }
  },

  async cleanupTempFile(localPath) {
    if (!localPath) return;
    try { await unlink(localPath); } catch {}
  },

  async streamFile(filePath, rangeHeader = null) {
    const absPath = this.getAbsolutePath(filePath);
    try {
      const fileStat = await stat(absPath);
      const fileSize = fileStat.size;
      const ext = path.extname(absPath).toLowerCase();
      const mimeTypes = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
      const contentType = mimeTypes[ext] || 'video/mp4';

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        return {
          stream: createReadStream(absPath, { start, end }),
          status: 206,
          headers: {
            'content-type': contentType,
            'content-length': String(chunkSize),
            'content-range': `bytes ${start}-${end}/${fileSize}`,
            'accept-ranges': 'bytes'
          }
        };
      } else {
        return {
          stream: createReadStream(absPath),
          status: 200,
          headers: {
            'content-type': contentType,
            'content-length': String(fileSize),
            'accept-ranges': 'bytes'
          }
        };
      }
    } catch (error) {
      logger.error('Streaming-fel från disk:', { path: filePath, error: error.message });
      return null;
    }
  },

  async getFileInfo(filePath) {
    const absPath = this.getAbsolutePath(filePath);
    try {
      const fileStat = await stat(absPath);
      return { contentLength: fileStat.size, lastModified: fileStat.mtime.toUTCString() };
    } catch { return null; }
  },

  async deleteFile(filePath) {
    const absPath = this.getAbsolutePath(filePath);
    try {
      await unlink(absPath);
      logger.info('Fil borttagen från storage', { path: filePath });
      return true;
    } catch (error) {
      logger.error('Kunde inte ta bort fil:', { path: filePath, error: error.message });
      return false;
    }
  },

  generateSignedUrl(videoId, expiresInSeconds = null) {
    const expiry = expiresInSeconds || parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || '3600');
    const expiresAt = Math.floor(Date.now() / 1000) + expiry;
    const signature = crypto
      .createHmac('sha256', process.env.JWT_ACCESS_SECRET)
      .update(`${videoId}:${expiresAt}`)
      .digest('hex');
    return {
      url: `${process.env.STREAM_BASE_URL ? process.env.STREAM_BASE_URL : ''}/api/videos/${videoId}/stream?expires=${expiresAt}&sig=${signature}`,
      expiresAt
    };
  },

  verifySignedUrl(videoId, expires, signature) {
    const now = Math.floor(Date.now() / 1000);
    if (now > parseInt(expires)) return false;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.JWT_ACCESS_SECRET)
      .update(`${videoId}:${expires}`)
      .digest('hex');
    if (signature.length !== expectedSignature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  },

  buildFilePath(matchDate, opponent, originalFileName) {
    const date = new Date(matchDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const safeOpponent = opponent
      .replace(/[^a-zA-ZåäöÅÄÖ0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    if (!safeOpponent) throw new Error('Ogiltigt motståndarnamn efter sanitering');
    const ext = originalFileName.substring(originalFileName.lastIndexOf('.')).toLowerCase();
    if (!['.mp4', '.mov', '.mkv'].includes(ext)) throw new Error('Otillåten filändelse');
    const filePath = `/${year}/${year}-${month}-${day}_LVC-vs-${safeOpponent}${ext}`;
    if (filePath.includes('..') || filePath.includes('//') || filePath.includes('\\')) {
      throw new Error('Ogiltig sökväg detekterad');
    }
    return filePath;
  }
};
