// ===========================================
// LVC Media Hub — Filvalideringsverktyg
// Stöder disk-baserade filer (multer diskStorage)
// ===========================================
import path from 'path';
import { open } from 'fs/promises';
import logger from './logger.js';

const ALLOWED_MIME_TYPES = (process.env.ALLOWED_FILE_TYPES || 'video/mp4,video/quicktime,video/x-matroska').split(',');
const ALLOWED_EXTENSIONS = (process.env.ALLOWED_EXTENSIONS || '.mp4,.mov,.mkv').split(',');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || '10737418240'); // 10 GB

export const fileValidator = {
  // Validera MIME-typ
  isAllowedMimeType(mimeType) {
    return ALLOWED_MIME_TYPES.includes(mimeType);
  },

  // Validera filändelse
  isAllowedExtension(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  },

  // Validera filstorlek
  isAllowedSize(fileSize) {
    return fileSize > 0 && fileSize <= MAX_FILE_SIZE;
  },

  // Validera magiska bytes från en Buffer
  validateMagicBytes(buffer, claimedMimeType) {
    if (buffer.length < 12) return false;

    // MP4/MOV kontroll — sök efter 'ftyp' inom de första 12 bytes
    if (claimedMimeType === 'video/mp4' || claimedMimeType === 'video/quicktime') {
      const ftypIndex = buffer.indexOf('ftyp', 0, 'ascii');
      return ftypIndex >= 0 && ftypIndex <= 8;
    }

    // MKV kontroll — EBML header
    if (claimedMimeType === 'video/x-matroska') {
      return buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;
    }

    return false;
  },

  // BUG FIX #9: Läs bara de första 12 bytes från disk — ingen hel fil i RAM
  async readMagicBytesFromDisk(filePath) {
    let fileHandle = null;
    try {
      fileHandle = await open(filePath, 'r');
      const buffer = Buffer.alloc(12);
      const { bytesRead } = await fileHandle.read(buffer, 0, 12, 0);
      return buffer.subarray(0, bytesRead);
    } catch (error) {
      logger.error('Kunde inte läsa magic bytes:', { filePath, error: error.message });
      return null;
    } finally {
      if (fileHandle) await fileHandle.close();
    }
  },

  // Sanitera filnamn — förhindra path traversal
  sanitizeFileName(fileName) {
    let safe = path.basename(fileName);
    safe = safe.replace(/[^a-zA-Z0-9åäöÅÄÖ._-]/g, '_');
    safe = safe.replace(/\.{2,}/g, '_');

    if (safe.length > 200) {
      const ext = path.extname(safe);
      safe = safe.substring(0, 200 - ext.length) + ext;
    }

    return safe;
  },

  // BUG FIX #8+#9: Fullständig filvalidering för disk-baserade filer (multer diskStorage)
  async validateFile(file) {
    const errors = [];

    if (!file) {
      return { valid: false, errors: ['Ingen fil bifogad.'] };
    }

    if (!this.isAllowedMimeType(file.mimetype)) {
      errors.push(`Filtypen ${file.mimetype} är inte tillåten. Använd MP4, MOV eller MKV.`);
    }

    if (!this.isAllowedExtension(file.originalname)) {
      errors.push('Filändelsen är inte tillåten. Använd .mp4, .mov eller .mkv.');
    }

    if (!this.isAllowedSize(file.size)) {
      errors.push(`Filen är för stor. Maximal storlek: ${Math.round(MAX_FILE_SIZE / 1073741824)} GB.`);
    }

    // Kontrollera magiska bytes — läs från disk (file.path) eller buffer
    const magicSource = file.path
      ? await this.readMagicBytesFromDisk(file.path)
      : (file.buffer && file.buffer.length >= 12 ? file.buffer : null);

    if (magicSource && magicSource.length >= 12) {
      if (!this.validateMagicBytes(magicSource, file.mimetype)) {
        errors.push('Filens innehåll matchar inte den angivna filtypen.');
        logger.warn('Magiska bytes matchar inte — möjlig filmanipulering', {
          fileName: file.originalname,
          claimedType: file.mimetype
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};
