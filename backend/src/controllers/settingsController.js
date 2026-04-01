// ===========================================
// LVC Media Hub — Settings Controller
// Hanterar globala inställningar (t.ex. skill-namn)
// ===========================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default skill-namn
const DEFAULT_SKILL_NAMES = {
  S: 'Serve', R: 'Mottagning', P: 'Pass',
  A: 'Anfall', B: 'Block', D: 'Försvar',
  G: 'Gratisboll', O: 'Övrigt'
};

export const settingsController = {
  // GET /api/settings/skill-names — alla kan läsa
  async getSkillNames(req, res) {
    try {
      const setting = await prisma.setting.findUnique({ where: { key: 'skill_names' } });
      const names = setting ? JSON.parse(setting.value) : DEFAULT_SKILL_NAMES;
      res.json(names);
    } catch {
      res.json(DEFAULT_SKILL_NAMES);
    }
  },

  // PUT /api/admin/settings/skill-names — bara admin
  async updateSkillNames(req, res) {
    try {
      const names = req.body;
      if (!names || typeof names !== 'object') {
        return res.status(400).json({ error: 'Ogiltigt format' });
      }
      await prisma.setting.upsert({
        where: { key: 'skill_names' },
        update: { value: JSON.stringify(names) },
        create: { key: 'skill_names', value: JSON.stringify(names) }
      });
      res.json({ ok: true, names });
    } catch (err) {
      res.status(500).json({ error: 'Kunde inte spara' });
    }
  }
};
