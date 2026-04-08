-- ============================================================
-- Kvittra — Seed: Core features + branding templates
-- ============================================================

-- =========================
-- CORE FEATURES (always on, cannot be disabled)
-- org_id = NULL means global for all orgs
-- =========================
INSERT INTO kvittra.features_config (org_id, feature_key, is_enabled, config) VALUES
  (NULL, 'video_library', true, '{"core": true, "description": "Videobibliotek med lag/säsong/match"}'),
  (NULL, 'dvw_import', true, '{"core": true, "description": "DVW scout-fil import och parsing"}'),
  (NULL, 'actions_filter', true, '{"core": true, "description": "Filtrering av actions (skill, spelare, set, grad)"}'),
  (NULL, 'role_routing', true, '{"core": true, "description": "Rollbaserad routing och paneler"}')
ON CONFLICT (org_id, feature_key) DO NOTHING;

-- =========================
-- GLOBAL OPTIONAL FEATURES (Filip pushes to all when ready)
-- =========================
INSERT INTO kvittra.features_config (org_id, feature_key, is_enabled, config) VALUES
  (NULL, 'player_dashboard', true, '{"description": "Personlig spelardashboard med stats och grafer"}'),
  (NULL, 'heatmap', true, '{"description": "Heatmap-overlay på planen per match/spelare"}'),
  (NULL, 'player_comparison', true, '{"description": "Jämför två spelare med radarchart"}'),
  (NULL, 'coach_reviews', true, '{"description": "Coach-feedback på enskilda actions"}'),
  (NULL, 'match_publish', true, '{"description": "Publicera matcher som publika (visibility=public)"}'),
  (NULL, 'season_graph', true, '{"description": "Säsongsgraf med prestation match för match"}'),
  (NULL, 'multi_scout', true, '{"description": "Flermatchsanalys med DVW-data"}'),
  (NULL, 'highlights', false, '{"description": "Automatgenererade highlights-klipp", "beta": true}'),
  (NULL, 'public_view', true, '{"description": "Publik vy för ej inloggade besökare"}')
ON CONFLICT (org_id, feature_key) DO NOTHING;

-- =========================
-- BRANDING TEMPLATES
-- Stored in kvittra.settings as a global config
-- =========================
INSERT INTO kvittra.settings (org_id, key, value) VALUES
  -- Use a placeholder org_id — templates are stored per-org but we need
  -- a global way to define them. We use the settings table with a special key.
  -- Superadmin reads these and applies to new orgs.
  ((SELECT id FROM kvittra.organizations LIMIT 1), 'branding_templates', '{
    "dark_blue": {
      "name": "Mörkt Blå",
      "preview": "Professionellt mörkt blått tema",
      "config": {
        "primary_color": "#1a5fb4",
        "secondary_color": "#e8a825",
        "background_color": "#0a1628",
        "surface_color": "#111f3a",
        "text_color": "#f4f5f7",
        "font": "DM Sans, system-ui, sans-serif"
      }
    },
    "dark_green": {
      "name": "Mörkt Grönt",
      "preview": "Sportigt grönt tema",
      "config": {
        "primary_color": "#2ea043",
        "secondary_color": "#f0c75e",
        "background_color": "#0d1117",
        "surface_color": "#161b22",
        "text_color": "#f0f6fc",
        "font": "DM Sans, system-ui, sans-serif"
      }
    },
    "dark_red": {
      "name": "Mörkt Rött",
      "preview": "Kraftfullt rött tema",
      "config": {
        "primary_color": "#cf222e",
        "secondary_color": "#f9826c",
        "background_color": "#161616",
        "surface_color": "#1e1e1e",
        "text_color": "#f5f5f5",
        "font": "DM Sans, system-ui, sans-serif"
      }
    },
    "dark_purple": {
      "name": "Mörkt Lila",
      "preview": "Elegant lila tema",
      "config": {
        "primary_color": "#8b5cf6",
        "secondary_color": "#c084fc",
        "background_color": "#0f0a1a",
        "surface_color": "#1a1425",
        "text_color": "#f3f0ff",
        "font": "DM Sans, system-ui, sans-serif"
      }
    },
    "light_clean": {
      "name": "Ljust Rent",
      "preview": "Modernt ljust tema",
      "config": {
        "primary_color": "#2563eb",
        "secondary_color": "#f59e0b",
        "background_color": "#f8fafc",
        "surface_color": "#ffffff",
        "text_color": "#1e293b",
        "font": "Inter, system-ui, sans-serif"
      }
    }
  }'::jsonb)
ON CONFLICT (org_id, key) DO NOTHING;
