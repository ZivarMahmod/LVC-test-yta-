// ===========================================
// LVC Media Hub — Prisma Client (Singleton)
// ===========================================
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const prisma = new PrismaClient({
  log: [
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' }
  ]
});

prisma.$on('error', (e) => {
  logger.error('Prisma-fel:', { message: e.message });
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma-varning:', { message: e.message });
});

export default prisma;
