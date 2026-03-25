// ===========================================
// LVC Media Hub — Folder Scanner
// Scannar /storage var 5:e minut efter nya videofiler
// Namnformat: YYYY-MM-DD_LVC-vs-Motståndare.mp4
// ===========================================
import { readdir, stat } from 'fs/promises';
import path from 'path';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

const STORAGE_PATH = process.env.STORAGE_PATH || '/storage';
const VALID_EXTENSIONS = ['.mp4', '.mov', '.mkv'];

const parseFileName = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  if (!VALID_EXTENSIONS.includes(ext)) return null;
  const base = path.basename(fileName, ext);
  const match = base.match(/^(\d{4}-\d{2}-\d{2})_LVC-vs-(.+)$/i);
  if (!match) return null;
  const [, dateStr, opponent] = match;
  const matchDate = new Date(dateStr);
  if (isNaN(matchDate.getTime())) return null;
  return { matchDate, opponent: opponent.replace(/-/g, ' '), ext };
};

const scanDirectory = async (dirPath, relativePath = '') => {
  const files = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const subFiles = await scanDirectory(fullPath, relPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VALID_EXTENSIONS.includes(ext)) {
          files.push({ fullPath, relativePath: `/${relPath}`, fileName: entry.name });
        }
      }
    }
  } catch (error) {
    logger.error('Fel vid mappskanning:', { dirPath, error: error.message });
  }
  return files;
};

export const startFolderScanner = async () => {
  const scan = async () => {
    logger.info('Mappskannar /storage efter nya videofiler...');
    try {
      const files = await scanDirectory(STORAGE_PATH);

      for (const file of files) {
        const parsed = parseFileName(file.fileName);
        if (!parsed) {
          logger.info('Skippar fil med okänt namnformat:', { file: file.fileName });
          continue;
        }

        const fileStat = await stat(file.fullPath);
        const { matchDate, opponent, ext } = parsed;
        const year = matchDate.getFullYear();
        const month = String(matchDate.getMonth() + 1).padStart(2, '0');
        const day = String(matchDate.getDate()).padStart(2, '0');
        const title = `LVC vs ${opponent} — ${day}/${month}/${year}`;

        // Kolla om det finns en .dvw scout-fil med samma namn
        const dvwRelPath = file.relativePath.replace(/.[^.]+$/, '.dvw');
        const dvwAbsPath = path.join(STORAGE_PATH, dvwRelPath);
        let dvwPath = null;
        try {
          await stat(dvwAbsPath);
          dvwPath = dvwRelPath;
        } catch {}

        // Kolla om det finns en thumbnail-bild med samma namn
        const thumbRelPath = file.relativePath.replace(/\.[^.]+$/, '.jpg');
        const thumbAbsPath = path.join(STORAGE_PATH, thumbRelPath);
        let thumbnailPath = null;
        try {
          await stat(thumbAbsPath);
          thumbnailPath = thumbRelPath;
        } catch {}

        const existing = await prisma.video.findFirst({
          where: { filePath: file.relativePath }
        });

        // Uppdatera dvwPath och thumbnailPath för befintliga videos
        if (existing) {
          const updates = {};
          if (!existing.dvwPath && dvwPath) updates.dvwPath = dvwPath;
          if (!existing.thumbnailPath && thumbnailPath) updates.thumbnailPath = thumbnailPath;
          if (Object.keys(updates).length > 0) {
            await prisma.video.update({ where: { id: existing.id }, data: updates });
            logger.info('Video uppdaterad med nya filer:', { title: existing.title, updates });
          }
          continue;
        }


        const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });

        await prisma.video.create({
          data: {
            title,
            opponent,
            matchDate,
            description: null,
            fileName: file.fileName,
            filePath: file.relativePath,
            fileSize: BigInt(fileStat.size),
            mimeType: ext === '.mp4' ? 'video/mp4' : ext === '.mov' ? 'video/quicktime' : 'video/x-matroska',
            uploadedById: adminUser.id,
            dvwPath,
            thumbnailPath
          }
        });

        logger.info('Ny video registrerad från drop-folder:', { title, path: file.relativePath });
      }
    } catch (error) {
      logger.error('Mappskanning misslyckades:', { error: error.message });
    }
  };

  await scan();
  setInterval(scan, 5 * 60 * 1000);
  logger.info('Mappskanning aktiv — kontrollerar var 5:e minut');
};
