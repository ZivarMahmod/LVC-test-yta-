// ===========================================
// LVC Media Hub — Settings Controller
// Hanterar globala inställningar (t.ex. skill-namn)
// ===========================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default skill-namn och bokstäver
const DEFAULT_SKILL_NAMES = {
  S: 'Serve', R: 'Mottagning', P: 'Pass',
  A: 'Anfall', B: 'Block', D: 'Försvar',
  G: 'Gratisboll', O: 'Övrigt'
};

const DEFAULT_SKILL_LETTERS = {
  S: 'S', R: 'R', P: 'P',
  A: 'A', B: 'B', D: 'D',
  G: 'G', O: 'O'
};

export const settingsController = {
  // GET /api/settings/skill-names — alla kan läsa
  async getSkillNames(req, res) {
    try {
      const [nameSetting, letterSetting] = await Promise.all([
        prisma.setting.findUnique({ where: { key: 'skill_names' } }),
        prisma.setting.findUnique({ where: { key: 'skill_letters' } })
      ]);
      res.json({
        names: nameSetting ? JSON.parse(nameSetting.value) : DEFAULT_SKILL_NAMES,
        letters: letterSetting ? JSON.parse(letterSetting.value) : DEFAULT_SKILL_LETTERS
      });
    } catch {
      res.json({ names: DEFAULT_SKILL_NAMES, letters: DEFAULT_SKILL_LETTERS });
    }
  },

  // PUT /api/admin/settings/skill-names — bara admin
  async updateSkillNames(req, res) {
    try {
      const { names, letters } = req.body;
      if (!names || typeof names !== 'object') {
        return res.status(400).json({ error: 'Ogiltigt format' });
      }
      const ops = [
        prisma.setting.upsert({
          where: { key: 'skill_names' },
          update: { value: JSON.stringify(names) },
          create: { key: 'skill_names', value: JSON.stringify(names) }
        })
      ];
      if (letters && typeof letters === 'object') {
        ops.push(prisma.setting.upsert({
          where: { key: 'skill_letters' },
          update: { value: JSON.stringify(letters) },
          create: { key: 'skill_letters', value: JSON.stringify(letters) }
        }));
      }
      await Promise.all(ops);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunde inte spara' });
    }
  }
};
