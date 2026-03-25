// ===========================================
// LVC Media Hub — OpenCloud WebDAV Service
// All kommunikation med OpenCloud sker server-side
// ===========================================
import { Readable } from 'stream';
import { createReadStream } from 'fs';
import { stat, unlink } from 'fs/promises';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import logger from '../utils/logger.js';

const getWebDAVUrl = (path) => {
  const baseUrl = process.env.OPENCLOUD_WEBDAV_URL.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

const getAuthHeader = () => {
  const credentials = Buffer.from(
    `${process.env.OPENCLOUD_USERNAME}:${process.env.OPENCLOUD_PASSWORD}`
  ).toString('base64');
  return `Basic ${credentials}`;
};

export const openCloudService = {
  // Skapa mapp om den inte finns
  async ensureDirectory(dirPath) {
    const url = getWebDAVUrl(dirPath);

    try {
      const response = await fetch(url, {
        method: 'MKCOL',
        headers: { Authorization: getAuthHeader() }
      });

      // 201 = skapad, 405 = finns redan — båda är OK
      if (response.ok || response.status === 405) {
        return true;
      }

      logger.error('Kunde inte skapa mapp i OpenCloud', {
        path: dirPath,
        status: response.status
      });
      return false;
    } catch (error) {
      logger.error('OpenCloud MKCOL-fel:', { path: dirPath, error: error.message });
      return false;
    }
  },

  // Skapa alla mappar i sökvägen
  async ensureDirectoryTree(filePath) {
    const parts = filePath.split('/').filter(Boolean);
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += `/${parts[i]}`;
      const ok = await this.ensureDirectory(currentPath);
      if (!ok) return false;
    }
    return true;
  },

  // Ladda upp fil från disk (streaming — hanterar stora filer utan att äta RAM)
  // Använder https.request + pipe istället för fetch för att undvika
  // undici:s 30-sekunders headersTimeout, som kraschar stora videouppladdningar.
  async uploadFileFromDisk(remotePath, localDiskPath, contentType) {
    // Skapa mappstruktur i OpenCloud
    const dirsOk = await this.ensureDirectoryTree(remotePath);
    if (!dirsOk) return false;

    const url = getWebDAVUrl(remotePath);

    try {
      const fileStat = await stat(localDiskPath);

      return await new Promise((resolve) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const transport = isHttps ? https : http;

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'PUT',
          headers: {
            Authorization: getAuthHeader(),
            'Content-Type': contentType,
            'Content-Length': fileStat.size
          }
        };

        const req = transport.request(options, (res) => {
          // Konsumera svaret för att frigöra socketen
          res.resume();
          if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
            logger.info('Fil uppladdad till OpenCloud', {
              path: remotePath,
              size: fileStat.size
            });
            resolve(true);
          } else {
            logger.error('Filuppladdning till OpenCloud misslyckades', {
              path: remotePath,
              status: res.statusCode
            });
            resolve(false);
          }
        });

        req.on('error', (error) => {
          logger.error('OpenCloud PUT-fel:', { path: remotePath, error: error.message });
          resolve(false);
        });

        // Strömma filen direkt — ingen timeout, inga minnesproblem för stora filer
        const fileStream = createReadStream(localDiskPath);
        fileStream.on('error', (error) => {
          logger.error('Filläsningsfel:', { path: localDiskPath, error: error.message });
          req.destroy();
          resolve(false);
        });
        fileStream.pipe(req);
      });
    } catch (error) {
      logger.error('OpenCloud PUT-fel:', { path: remotePath, error: error.message });
      return false;
    }
  },

  // Ta bort temporär fil från disk (ignorera om redan borttagen)
  async cleanupTempFile(localPath) {
    if (!localPath) return;
    try {
      await unlink(localPath);
    } catch {
      // Filen kan redan vara borttagen — ignorera
    }
  },

  // Streama fil från OpenCloud (för videouppspelning via proxy)
  async streamFile(filePath, rangeHeader = null) {
    const url = getWebDAVUrl(filePath);

    const headers = {
      Authorization: getAuthHeader()
    };

    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok && response.status !== 206) {
        logger.error('Kunde inte streama fil från OpenCloud', {
          path: filePath,
          status: response.status
        });
        return null;
      }

      return {
        stream: Readable.fromWeb(response.body),
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type'),
          'content-length': response.headers.get('content-length'),
          'content-range': response.headers.get('content-range'),
          'accept-ranges': response.headers.get('accept-ranges') || 'bytes'
        }
      };
    } catch (error) {
      logger.error('OpenCloud GET-fel:', { path: filePath, error: error.message });
      return null;
    }
  },

  // Hämta filinformation (HEAD-request)
  async getFileInfo(filePath) {
    const url = getWebDAVUrl(filePath);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { Authorization: getAuthHeader() }
      });

      if (!response.ok) return null;

      return {
        contentLength: parseInt(response.headers.get('content-length') || '0'),
        contentType: response.headers.get('content-type'),
        lastModified: response.headers.get('last-modified')
      };
    } catch (error) {
      logger.error('OpenCloud HEAD-fel:', { path: filePath, error: error.message });
      return null;
    }
  },

  // Ta bort fil från OpenCloud
  async deleteFile(filePath) {
    const url = getWebDAVUrl(filePath);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: getAuthHeader() }
      });

      if (response.ok || response.status === 204) {
        logger.info('Fil borttagen från OpenCloud', { path: filePath });
        return true;
      }

      logger.error('Kunde inte ta bort fil från OpenCloud', {
        path: filePath,
        status: response.status
      });
      return false;
    } catch (error) {
      logger.error('OpenCloud DELETE-fel:', { path: filePath, error: error.message });
      return false;
    }
  },

  // Generera signerad temporär URL (HMAC-baserad verifiering)
  generateSignedUrl(videoId, expiresInSeconds = null) {
    const expiry = expiresInSeconds || parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || '3600');
    const expiresAt = Math.floor(Date.now() / 1000) + expiry;

    const signature = crypto
      .createHmac('sha256', process.env.JWT_ACCESS_SECRET)
      .update(`${videoId}:${expiresAt}`)
      .digest('hex');

    return {
      url: `${process.env.STREAM_BASE_URL || process.env.BACKEND_URL}/api/videos/${videoId}/stream?expires=${expiresAt}&sig=${signature}`,
      expiresAt
    };
  },

  // Verifiera signerad URL (timing-safe)
  verifySignedUrl(videoId, expires, signature) {
    const now = Math.floor(Date.now() / 1000);

    if (now > parseInt(expires)) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.JWT_ACCESS_SECRET)
      .update(`${videoId}:${expires}`)
      .digest('hex');

    // BUG FIX #5: Kontrollera längd innan timingSafeEqual — kraschar annars
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  },

  // Bygg filsökväg: /Matcher/YYYY/YYYY-MM-DD_LVC-vs-Opponent.ext
  buildFilePath(matchDate, opponent, originalFileName) {
    const date = new Date(matchDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Sanitera motståndarnamnet
    const safeOpponent = opponent
      .replace(/[^a-zA-ZåäöÅÄÖ0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);

    // BUG FIX #6: Kontrollera att sanitering inte gav tomt namn
    if (!safeOpponent) {
      throw new Error('Ogiltigt motståndarnamn efter sanitering');
    }

    // BUG FIX #7: Explicit validering av filändelse
    const ext = originalFileName.substring(originalFileName.lastIndexOf('.')).toLowerCase();
    if (!['.mp4', '.mov', '.mkv'].includes(ext)) {
      throw new Error('Otillåten filändelse');
    }

    const basePath = (process.env.OPENCLOUD_BASE_PATH || '/Matcher').replace(/\.\./g, '');
    const filePath = `${basePath}/${year}/${year}-${month}-${day}_LVC-vs-${safeOpponent}${ext}`;

    // Path traversal-skydd
    if (filePath.includes('..') || filePath.includes('//') || filePath.includes('\\')) {
      throw new Error('Ogiltig sökväg detekterad');
    }

    return filePath;
  }
};
