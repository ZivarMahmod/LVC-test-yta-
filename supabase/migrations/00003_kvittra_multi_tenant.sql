-- ============================================================
-- KVITTRA — Multi-tenant schema upgrade
-- Migration 00003: Adds kvittra schema with organizations,
-- org-scoped members, player profiles, matches/videos split,
-- persistent actions, features, OTP, and org-based RLS.
--
-- This migration EXTENDS the existing public schema (00001/00002).
-- Nothing from public is dropped — the old LVC tables remain
-- usable as fallback. All new Kvittra data lives in the
-- kvittra schema.
-- ============================================================

-- =========================
-- CREATE SCHEMA
-- =========================
CREATE SCHEMA IF NOT EXISTS kvittra;

-- Grant usage to Supabase roles
GRANT USAGE ON SCHEMA kvittra TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA kvittra TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA kvittra TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA kvittra TO anon, authenticated, service_role;

-- Make sure new objects in kvittra also get these grants
ALTER DEFAULT PRIVILEGES IN SCHEMA kvittra
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA kvittra
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA kvittra
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- =========================
-- HELPER: updated_at trigger (in kvittra schema)
-- =========================
CREATE OR REPLACE FUNCTION kvittra.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. ORGANIZATIONS
-- ============================================================
CREATE TABLE kvittra.organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,  -- subdomain: lvc.kvittra.se
  branding_config jsonb NOT NULL DEFAULT '{}',
  features_config jsonb NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON kvittra.organizations(slug);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON kvittra.organizations
  FOR EACH ROW EXECUTE FUNCTION kvittra.handle_updated_at();


-- ============================================================
-- 2. ORGANIZATION MEMBERS
-- ============================================================
CREATE TABLE kvittra.organization_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  roles       text[] NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, org_id)
);

CREATE INDEX idx_org_members_user ON kvittra.organization_members(user_id);
CREATE INDEX idx_org_members_org ON kvittra.organization_members(org_id);

CREATE TRIGGER org_members_updated_at
  BEFORE UPDATE ON kvittra.organization_members
  FOR EACH ROW EXECUTE FUNCTION kvittra.handle_updated_at();


-- ============================================================
-- 3. PLAYER PROFILES
-- ============================================================
CREATE TABLE kvittra.player_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL REFERENCES kvittra.organization_members(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  display_name  text,
  jersey_number int,
  position      text,  -- libero, setter, outside, middle, opposite
  photo_url     text,
  bio           text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_profiles_member ON kvittra.player_profiles(member_id);
CREATE INDEX idx_player_profiles_org ON kvittra.player_profiles(org_id);

CREATE TRIGGER player_profiles_updated_at
  BEFORE UPDATE ON kvittra.player_profiles
  FOR EACH ROW EXECUTE FUNCTION kvittra.handle_updated_at();


-- ============================================================
-- 4. TEAMS
-- ============================================================
CREATE TABLE kvittra.teams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  name          text NOT NULL,
  season        text,            -- "25/26"
  thumbnail_url text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_org ON kvittra.teams(org_id);

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON kvittra.teams
  FOR EACH ROW EXECUTE FUNCTION kvittra.handle_updated_at();


-- ============================================================
-- 5. MATCHES
-- ============================================================
CREATE TABLE kvittra.matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  team_id       uuid REFERENCES kvittra.teams(id) ON DELETE SET NULL,
  title         text NOT NULL,
  match_date    date,
  visibility    text NOT NULL DEFAULT 'internal'
                  CHECK (visibility IN ('internal', 'public')),
  match_type    text NOT NULL DEFAULT 'match'
                  CHECK (match_type IN ('match', 'scout')),
  dvw_file_url  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_org ON kvittra.matches(org_id);
CREATE INDEX idx_matches_team ON kvittra.matches(team_id);
CREATE INDEX idx_matches_date ON kvittra.matches(match_date);
CREATE INDEX idx_matches_visibility ON kvittra.matches(visibility);

CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON kvittra.matches
  FOR EACH ROW EXECUTE FUNCTION kvittra.handle_updated_at();


-- ============================================================
-- 6. VIDEOS
-- ============================================================
CREATE TABLE kvittra.videos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid NOT NULL REFERENCES kvittra.matches(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  storage_url   text NOT NULL,
  duration_sec  int,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_videos_match ON kvittra.videos(match_id);
CREATE INDEX idx_videos_org ON kvittra.videos(org_id);


-- ============================================================
-- 7. ACTIONS (persistent DVW data)
-- ============================================================
CREATE TABLE kvittra.actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid NOT NULL REFERENCES kvittra.matches(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES kvittra.organizations(id),
  player_name   text,
  player_id     uuid REFERENCES kvittra.player_profiles(id) ON DELETE SET NULL,
  team_name     text,
  action_type   text,    -- S, R, P, A, D, B, G
  result        text,    -- #, +, !, -, /
  zone_start    int,
  zone_end      int,
  set_number    int,
  timestamp_sec int,     -- second in video
  raw_code      text,    -- original DVW code line
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_actions_match ON kvittra.actions(match_id);
CREATE INDEX idx_actions_org ON kvittra.actions(org_id);
CREATE INDEX idx_actions_player ON kvittra.actions(player_id);
CREATE INDEX idx_actions_type ON kvittra.actions(action_type);
CREATE INDEX idx_actions_match_player ON kvittra.actions(match_id, player_id);


-- ============================================================
-- 8. FEATURES CONFIG (global + per org)
-- ============================================================
CREATE TABLE kvittra.features_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_enabled  boolean NOT NULL DEFAULT true,
  config      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(org_id, feature_key)
);

CREATE INDEX idx_features_org ON kvittra.features_config(org_id);
CREATE INDEX idx_features_key ON kvittra.features_config(feature_key);

CREATE TRIGGER features_config_updated_at
  BEFORE UPDATE ON kvittra.features_config
  FOR EACH ROW EXECUTE FUNCTION kvittra.handle_updated_at();


-- ============================================================
-- 9. OTP CODES (custom 2FA)
-- ============================================================
CREATE TABLE kvittra.otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_user ON kvittra.otp_codes(user_id);
CREATE INDEX idx_otp_expires ON kvittra.otp_codes(expires_at);


-- ============================================================
-- 10. AUDIT LOG (org-scoped)
-- ============================================================
CREATE TABLE kvittra.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  user_id     uuid,
  user_name   text,
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   text,
  details     jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org ON kvittra.audit_logs(org_id);
CREATE INDEX idx_audit_user ON kvittra.audit_logs(user_id);
CREATE INDEX idx_audit_created ON kvittra.audit_logs(created_at);


-- ============================================================
-- 11. SETTINGS (org-scoped key-value)
-- ============================================================
CREATE TABLE kvittra.settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(org_id, key)
);

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON kvittra.settings
  FOR EACH ROW EXECUTE FUNCTION kvittra.handle_updated_at();


-- ============================================================
-- 12. COACH REVIEWS (org-scoped)
-- ============================================================
CREATE TABLE kvittra.coach_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  match_id        uuid NOT NULL REFERENCES kvittra.matches(id) ON DELETE CASCADE,
  action_index    int NOT NULL,
  coach_id        uuid NOT NULL REFERENCES kvittra.organization_members(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES kvittra.organization_members(id) ON DELETE CASCADE,
  comment         text NOT NULL,
  acknowledged_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_org ON kvittra.coach_reviews(org_id);
CREATE INDEX idx_reviews_coach ON kvittra.coach_reviews(coach_id);
CREATE INDEX idx_reviews_player ON kvittra.coach_reviews(player_id);
CREATE INDEX idx_reviews_match ON kvittra.coach_reviews(match_id);


-- ============================================================
-- 13. MATCH DOCUMENTS (org-scoped)
-- ============================================================
CREATE TABLE kvittra.match_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  match_id        uuid NOT NULL REFERENCES kvittra.matches(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL DEFAULT 'other',
  storage_url     text NOT NULL,
  file_size       bigint,
  uploaded_by_id  uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_docs_match ON kvittra.match_documents(match_id);
CREATE INDEX idx_docs_org ON kvittra.match_documents(org_id);


-- ============================================================
-- RLS HELPER FUNCTIONS
-- ============================================================

-- Core helper: returns all org IDs the current user belongs to
CREATE OR REPLACE FUNCTION kvittra.get_my_org_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT org_id FROM kvittra.organization_members
      WHERE user_id = auth.uid() AND is_active = true
    ),
    '{}'::uuid[]
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user has a specific role in a specific org
CREATE OR REPLACE FUNCTION kvittra.has_role_in_org(p_org_id uuid, p_role text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM kvittra.organization_members
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND is_active = true
      AND p_role = ANY(roles)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user is admin in an org
CREATE OR REPLACE FUNCTION kvittra.is_org_admin(p_org_id uuid)
RETURNS boolean AS $$
  SELECT kvittra.has_role_in_org(p_org_id, 'admin')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user is coach or admin in an org
CREATE OR REPLACE FUNCTION kvittra.is_org_coach_or_admin(p_org_id uuid)
RETURNS boolean AS $$
  SELECT kvittra.has_role_in_org(p_org_id, 'admin')
      OR kvittra.has_role_in_org(p_org_id, 'coach')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user can upload in an org
CREATE OR REPLACE FUNCTION kvittra.can_upload_in_org(p_org_id uuid)
RETURNS boolean AS $$
  SELECT kvittra.has_role_in_org(p_org_id, 'admin')
      OR kvittra.has_role_in_org(p_org_id, 'coach')
      OR kvittra.has_role_in_org(p_org_id, 'uploader')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's member_id in an org
CREATE OR REPLACE FUNCTION kvittra.get_my_member_id(p_org_id uuid)
RETURNS uuid AS $$
  SELECT id FROM kvittra.organization_members
  WHERE user_id = auth.uid()
    AND org_id = p_org_id
    AND is_active = true
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- -------------------------
-- ORGANIZATIONS
-- -------------------------
ALTER TABLE kvittra.organizations ENABLE ROW LEVEL SECURITY;

-- Members can see their own orgs
CREATE POLICY "org_select_member"
  ON kvittra.organizations FOR SELECT
  TO authenticated
  USING (id = ANY(kvittra.get_my_org_ids()));

-- Public can read org info by slug (for branding on public pages)
CREATE POLICY "org_select_public"
  ON kvittra.organizations FOR SELECT
  TO anon
  USING (is_active = true);

-- Only service_role can insert/update/delete (superadmin)
-- (No explicit policy needed — service_role bypasses RLS)

-- -------------------------
-- ORGANIZATION MEMBERS
-- -------------------------
ALTER TABLE kvittra.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select"
  ON kvittra.organization_members FOR SELECT
  TO authenticated
  USING (org_id = ANY(kvittra.get_my_org_ids()));

CREATE POLICY "members_insert_admin"
  ON kvittra.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (kvittra.is_org_admin(org_id));

CREATE POLICY "members_update_admin"
  ON kvittra.organization_members FOR UPDATE
  TO authenticated
  USING (kvittra.is_org_admin(org_id))
  WITH CHECK (kvittra.is_org_admin(org_id));

-- Delete: service_role only (no policy needed)

-- -------------------------
-- PLAYER PROFILES
-- -------------------------
ALTER TABLE kvittra.player_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_org"
  ON kvittra.player_profiles FOR SELECT
  TO authenticated
  USING (org_id = ANY(kvittra.get_my_org_ids()));

CREATE POLICY "profiles_insert_coach"
  ON kvittra.player_profiles FOR INSERT
  TO authenticated
  WITH CHECK (kvittra.is_org_coach_or_admin(org_id));

CREATE POLICY "profiles_update_own_or_coach"
  ON kvittra.player_profiles FOR UPDATE
  TO authenticated
  USING (
    member_id = kvittra.get_my_member_id(org_id)
    OR kvittra.is_org_coach_or_admin(org_id)
  );

-- -------------------------
-- TEAMS
-- -------------------------
ALTER TABLE kvittra.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select"
  ON kvittra.teams FOR SELECT
  TO authenticated
  USING (org_id = ANY(kvittra.get_my_org_ids()));

CREATE POLICY "teams_insert_coach"
  ON kvittra.teams FOR INSERT
  TO authenticated
  WITH CHECK (kvittra.is_org_coach_or_admin(org_id));

CREATE POLICY "teams_update_coach"
  ON kvittra.teams FOR UPDATE
  TO authenticated
  USING (kvittra.is_org_coach_or_admin(org_id));

CREATE POLICY "teams_delete_admin"
  ON kvittra.teams FOR DELETE
  TO authenticated
  USING (kvittra.is_org_admin(org_id));

-- -------------------------
-- MATCHES
-- -------------------------
ALTER TABLE kvittra.matches ENABLE ROW LEVEL SECURITY;

-- Internal matches: org members only
CREATE POLICY "matches_select_internal"
  ON kvittra.matches FOR SELECT
  TO authenticated
  USING (org_id = ANY(kvittra.get_my_org_ids()));

-- Public matches: anyone can see
CREATE POLICY "matches_select_public"
  ON kvittra.matches FOR SELECT
  TO anon
  USING (visibility = 'public');

CREATE POLICY "matches_insert"
  ON kvittra.matches FOR INSERT
  TO authenticated
  WITH CHECK (kvittra.can_upload_in_org(org_id));

CREATE POLICY "matches_update"
  ON kvittra.matches FOR UPDATE
  TO authenticated
  USING (kvittra.is_org_coach_or_admin(org_id));

CREATE POLICY "matches_delete"
  ON kvittra.matches FOR DELETE
  TO authenticated
  USING (kvittra.is_org_admin(org_id));

-- -------------------------
-- VIDEOS
-- -------------------------
ALTER TABLE kvittra.videos ENABLE ROW LEVEL SECURITY;

-- Videos inherit match visibility: org members see all, anon sees public
CREATE POLICY "videos_select_org"
  ON kvittra.videos FOR SELECT
  TO authenticated
  USING (org_id = ANY(kvittra.get_my_org_ids()));

CREATE POLICY "videos_select_public"
  ON kvittra.videos FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM kvittra.matches m
      WHERE m.id = match_id AND m.visibility = 'public'
    )
  );

CREATE POLICY "videos_insert"
  ON kvittra.videos FOR INSERT
  TO authenticated
  WITH CHECK (kvittra.can_upload_in_org(org_id));

CREATE POLICY "videos_delete"
  ON kvittra.videos FOR DELETE
  TO authenticated
  USING (kvittra.is_org_admin(org_id));

-- -------------------------
-- ACTIONS (DVW data)
-- -------------------------
ALTER TABLE kvittra.actions ENABLE ROW LEVEL SECURITY;

-- All org members see all actions (Kvittra spec: DVW data is open within org)
CREATE POLICY "actions_select_org"
  ON kvittra.actions FOR SELECT
  TO authenticated
  USING (org_id = ANY(kvittra.get_my_org_ids()));

-- Public matches: anon can see actions too
CREATE POLICY "actions_select_public"
  ON kvittra.actions FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM kvittra.matches m
      WHERE m.id = match_id AND m.visibility = 'public'
    )
  );

CREATE POLICY "actions_insert"
  ON kvittra.actions FOR INSERT
  TO authenticated
  WITH CHECK (kvittra.can_upload_in_org(org_id));

CREATE POLICY "actions_delete"
  ON kvittra.actions FOR DELETE
  TO authenticated
  USING (kvittra.is_org_coach_or_admin(org_id));

-- -------------------------
-- FEATURES CONFIG
-- -------------------------
ALTER TABLE kvittra.features_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read global features (org_id IS NULL) and their org's features
CREATE POLICY "features_select"
  ON kvittra.features_config FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(kvittra.get_my_org_ids())
  );

-- Anon can also read features (for public page feature checks)
CREATE POLICY "features_select_anon"
  ON kvittra.features_config FOR SELECT
  TO anon
  USING (org_id IS NULL OR true);

-- Insert/update/delete: service_role only (superadmin)

-- -------------------------
-- OTP CODES
-- -------------------------
ALTER TABLE kvittra.otp_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own OTP codes (but really handled by Edge Functions)
CREATE POLICY "otp_select_own"
  ON kvittra.otp_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insert/verify handled by Edge Functions with service_role

-- -------------------------
-- AUDIT LOGS
-- -------------------------
ALTER TABLE kvittra.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin"
  ON kvittra.audit_logs FOR SELECT
  TO authenticated
  USING (kvittra.is_org_admin(org_id));

CREATE POLICY "audit_insert"
  ON kvittra.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- -------------------------
-- SETTINGS
-- -------------------------
ALTER TABLE kvittra.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select"
  ON kvittra.settings FOR SELECT
  TO authenticated
  USING (org_id = ANY(kvittra.get_my_org_ids()));

CREATE POLICY "settings_admin"
  ON kvittra.settings FOR ALL
  TO authenticated
  USING (kvittra.is_org_admin(org_id))
  WITH CHECK (kvittra.is_org_admin(org_id));

-- -------------------------
-- COACH REVIEWS
-- -------------------------
ALTER TABLE kvittra.coach_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select"
  ON kvittra.coach_reviews FOR SELECT
  TO authenticated
  USING (
    org_id = ANY(kvittra.get_my_org_ids())
    AND (
      player_id = kvittra.get_my_member_id(org_id)
      OR coach_id = kvittra.get_my_member_id(org_id)
      OR kvittra.is_org_admin(org_id)
    )
  );

CREATE POLICY "reviews_insert_coach"
  ON kvittra.coach_reviews FOR INSERT
  TO authenticated
  WITH CHECK (kvittra.is_org_coach_or_admin(org_id));

CREATE POLICY "reviews_update"
  ON kvittra.coach_reviews FOR UPDATE
  TO authenticated
  USING (
    player_id = kvittra.get_my_member_id(org_id)
    OR coach_id = kvittra.get_my_member_id(org_id)
    OR kvittra.is_org_admin(org_id)
  );

-- -------------------------
-- MATCH DOCUMENTS
-- -------------------------
ALTER TABLE kvittra.match_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_select"
  ON kvittra.match_documents FOR SELECT
  TO authenticated
  USING (org_id = ANY(kvittra.get_my_org_ids()));

CREATE POLICY "docs_insert"
  ON kvittra.match_documents FOR INSERT
  TO authenticated
  WITH CHECK (kvittra.can_upload_in_org(org_id));

CREATE POLICY "docs_delete"
  ON kvittra.match_documents FOR DELETE
  TO authenticated
  USING (kvittra.is_org_coach_or_admin(org_id));


-- ============================================================
-- STORAGE BUCKETS (org-scoped paths)
-- ============================================================
-- Reuse existing buckets from 00001, but with org-prefixed paths:
--   videos/{org_id}/...
--   thumbnails/{org_id}/...
--   documents/{org_id}/...
--   dvw-files/{org_id}/...
-- No new buckets needed — the existing ones work with org-prefixed paths.


-- ============================================================
-- EXPOSE kvittra SCHEMA TO PostgREST (Supabase API)
-- ============================================================
-- Self-hosted Supabase: add 'kvittra' to the PGRST_DB_SCHEMAS
-- env var in your docker-compose.yml:
--   PGRST_DB_SCHEMAS: "public,kvittra"
-- Or in supabase config.toml:
--   [api]
--   schemas = ["public", "kvittra"]

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
