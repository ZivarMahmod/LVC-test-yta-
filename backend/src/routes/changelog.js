// ===========================================
// LVC Media Hub — Changelog Routes
// ===========================================
import { Router } from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';

const router = Router();

// GET /api/changelog — public, no auth
router.get('/', async (req, res) => {
  try {
    const entries = await prisma.changelogEntry.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // Sortera på versionsnummer (nyast först)
    entries.sort((a, b) => {
      const parse = (v) => v.replace('v','').split('.').map(Number);
      const av = parse(a.version), bv = parse(b.version);
      for (let i = 0; i < 3; i++) { if ((bv[i]||0) !== (av[i]||0)) return (bv[i]||0) - (av[i]||0); }
      return 0;
    });
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte h\u00e4mta \u00e4ndringslogg' });
  }
});

// POST /api/changelog — admin only
router.post('/', authenticateToken, requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { version, title, content: body } = req.body;
    if (!version || !title || !body) return res.status(400).json({ error: 'Version, titel och inneh\u00e5ll kr\u00e4vs' });
    const entry = await prisma.changelogEntry.create({ data: { version, title, content: body } });
    res.status(201).json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte skapa post' });
  }
});

// PUT /api/changelog/:id — admin only
router.put('/:id', authenticateToken, requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { version, title, content: body } = req.body;
    const entry = await prisma.changelogEntry.update({ where: { id: req.params.id }, data: { version, title, content: body } });
    res.json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte uppdatera post' });
  }
});

// DELETE /api/changelog/:id — admin only
router.delete('/:id', authenticateToken, requireAdmin, csrfProtection, async (req, res) => {
  try {
    await prisma.changelogEntry.delete({ where: { id: req.params.id } });
    res.json({ message: 'Post borttagen' });
  } catch (err) {
    res.status(500).json({ error: 'Kunde inte ta bort post' });
  }
});

export default router;
