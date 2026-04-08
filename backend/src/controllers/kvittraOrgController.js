// ===========================================
// Kvittra — Organization Controller
// Hanterar org-data, membership, features
// ===========================================
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

export const kvittraOrgController = {

  // GET /api/kvittra/org/:slug
  // Hämta organisation + användarens membership
  async getOrg(req, res) {
    try {
      const { slug } = req.params;
      const userId = req.user.id;

      // Sök org i kvittra-schemat (om det finns)
      // Fallback: använd befintlig team-data
      let organization = null;
      let membership = null;

      try {
        // Försök kvittra-schemat först
        const [orgRows] = await prisma.$queryRawUnsafe(
          `SELECT * FROM kvittra.organizations WHERE slug = $1 AND is_active = true LIMIT 1`,
          slug
        );
        if (orgRows) {
          organization = orgRows;
          const [memberRows] = await prisma.$queryRawUnsafe(
            `SELECT * FROM kvittra.organization_members WHERE org_id = $1 AND user_id = $2 AND is_active = true LIMIT 1`,
            organization.id, userId
          );
          if (memberRows) {
            membership = memberRows;
          }
        }
      } catch {
        // Kvittra-schemat finns kanske inte ännu — fallback till legacy
      }

      // Fallback: skapa en "virtuell" org baserat på befintlig data
      if (!organization) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Användaren hittades inte.' });

        organization = {
          id: 'legacy',
          name: 'LVC Media Hub',
          slug: slug || 'lvc',
          branding_config: {},
          features_config: {},
          is_active: true,
        };
        membership = {
          id: 'legacy',
          user_id: userId,
          org_id: 'legacy',
          roles: [user.role], // Mappa befintlig roll
          is_active: true,
        };
      }

      res.json({ organization, membership });
    } catch (error) {
      logger.error('Kvittra getOrg fel:', error);
      res.status(500).json({ error: 'Kunde inte hämta organisation.' });
    }
  },

  // GET /api/kvittra/features/:slug
  // Hämta aktiva features för en org
  async getFeatures(req, res) {
    try {
      const { slug } = req.params;
      let features = {};

      try {
        // Hämta globala features + org-specifika
        const globalFeatures = await prisma.$queryRawUnsafe(
          `SELECT feature_key, is_enabled, config FROM kvittra.features_config WHERE org_id IS NULL`
        );
        for (const f of globalFeatures) {
          features[f.feature_key] = f.is_enabled;
        }

        // Org-specifika överskriver globala
        const orgFeatures = await prisma.$queryRawUnsafe(
          `SELECT fc.feature_key, fc.is_enabled, fc.config
           FROM kvittra.features_config fc
           JOIN kvittra.organizations o ON o.id = fc.org_id
           WHERE o.slug = $1`,
          slug
        );
        for (const f of orgFeatures) {
          features[f.feature_key] = f.is_enabled;
        }
      } catch {
        // Kvittra-schemat kanske inte finns ännu — returnera alla features aktiva
        features = {
          player_dashboard: true,
          heatmap: true,
          player_comparison: true,
          precision_heatmap: true,
          pressure_stats: true,
          team_roster: true,
          match_report: true,
          coach_review: true,
          multi_scout: true,
        };
      }

      res.json({ features });
    } catch (error) {
      logger.error('Kvittra getFeatures fel:', error);
      res.status(500).json({ error: 'Kunde inte hämta features.' });
    }
  },

  // GET /api/kvittra/orgs
  // Lista alla orgar för inloggad användare
  async listMyOrgs(req, res) {
    try {
      const userId = req.user.id;
      let organizations = [];

      try {
        organizations = await prisma.$queryRawUnsafe(
          `SELECT o.id, o.name, o.slug, o.branding_config, om.roles
           FROM kvittra.organizations o
           JOIN kvittra.organization_members om ON om.org_id = o.id
           WHERE om.user_id = $1 AND om.is_active = true AND o.is_active = true
           ORDER BY o.name`,
          userId
        );
      } catch {
        // Fallback: returnera en "legacy" org
        const user = await prisma.user.findUnique({ where: { id: userId } });
        organizations = [{
          id: 'legacy',
          name: 'LVC Media Hub',
          slug: 'lvc',
          branding_config: {},
          roles: [user?.role || 'viewer'],
        }];
      }

      res.json({ organizations });
    } catch (error) {
      logger.error('Kvittra listMyOrgs fel:', error);
      res.status(500).json({ error: 'Kunde inte hämta organisationer.' });
    }
  },
};
