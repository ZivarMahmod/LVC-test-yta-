-- ===========================================
-- Kvittra — Supabase Schema
-- Multi-tenant sports video analysis platform
-- ===========================================

-- Skapa kvittra-schemat
CREATE SCHEMA IF NOT EXISTS kvittra;

-- Ge Supabase-roller åtkomst
GRANT USAGE ON SCHEMA kvittra TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA kvittra GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA kvittra GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA kvittra GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ===========================================
-- TABELLER
-- ===========================================

-- Organisationer (klubbar)
CREATE TABLE kvittra.organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  branding_config jsonb DEFAULT '{}',
  features_config jsonb DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Organisationsmedlemmar (kopplar auth.users till org)
CREATE TABLE kvittra.organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id          uuid REFERENCES kvittra.organizations(id) ON DELETE CASCADE NOT NULL,
  roles           text[] DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- Spelarprofiler
CREATE TABLE kvittra.player_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       uuid REFERENCES kvittra.organization_members(id) ON DELETE CASCADE NOT NULL,
  org_id          uuid REFERENCES kvittra.organizations(id) ON DELETE CASCADE NOT NULL,
  display_name    text,
  jersey_number   int,
  position        text,
  photo_url       text,
  bio             text,
  created_at      timestamptz DEFAULT now()
);

-- Lag
CREATE TABLE kvittra.teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES kvittra.organizations(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  season          text,
  thumbnail_url   text,
  created_at      timestamptz DEFAULT now()
);

-- Matcher
CREATE TABLE kvittra.matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES kvittra.organizations(id) ON DELETE CASCADE NOT NULL,
  team_id         uuid REFERENCES kvittra.teams(id),
  title           text NOT NULL,
  match_date      date,
  visibility      text DEFAULT 'internal',
  match_type      text DEFAULT 'match',
  dvw_file_url    text,
  created_at      timestamptz DEFAULT now()
);

-- Videor
CREATE TABLE kvittra.videos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        uuid REFERENCES kvittra.matches(id) ON DELETE CASCADE NOT NULL,
  org_id          uuid REFERENCES kvittra.organizations(id) ON DELETE CASCADE NOT NULL,
  storage_url     text NOT NULL,
  duration_sec    int,
  created_at      timestamptz DEFAULT now()
);

-- Actions (DVW-data)
CREATE TABLE kvittra.actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        uuid REFERENCES kvittra.matches(id) ON DELETE CASCADE NOT NULL,
  org_id          uuid REFERENCES kvittra.organizations(id) NOT NULL,
  player_name     text,
  player_id       uuid REFERENCES kvittra.player_profiles(id),
  team_name       text,
  action_type     text,
  result          text,
  zone_start      int,
  zone_end        int,
  coord_start_x   int,
  coord_start_y   int,
  coord_end_x     int,
  coord_end_y     int,
  set_number      int,
  timestamp_sec   int,
  raw_code        text,
  created_at      timestamptz DEFAULT now()
);

-- Feature-flags (global + per org)
CREATE TABLE kvittra.features_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES kvittra.organizations(id) ON DELETE CASCADE,
  feature_key     text NOT NULL,
  is_enabled      boolean DEFAULT true,
  config          jsonb DEFAULT '{}',
  UNIQUE(org_id, feature_key)
);

-- OTP-koder för tvåfaktorsautentisering
CREATE TABLE kvittra.otp_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code_hash       text NOT NULL,
  expires_at      timestamptz NOT NULL,
  used            boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_org_members_user ON kvittra.organization_members(user_id);
CREATE INDEX idx_org_members_org ON kvittra.organization_members(org_id);
CREATE INDEX idx_player_profiles_org ON kvittra.player_profiles(org_id);
CREATE INDEX idx_player_profiles_member ON kvittra.player_profiles(member_id);
CREATE INDEX idx_teams_org ON kvittra.teams(org_id);
CREATE INDEX idx_matches_org ON kvittra.matches(org_id);
CREATE INDEX idx_matches_team ON kvittra.matches(team_id);
CREATE INDEX idx_matches_date ON kvittra.matches(match_date);
CREATE INDEX idx_matches_visibility ON kvittra.matches(visibility);
CREATE INDEX idx_videos_match ON kvittra.videos(match_id);
CREATE INDEX idx_videos_org ON kvittra.videos(org_id);
CREATE INDEX idx_actions_match ON kvittra.actions(match_id);
CREATE INDEX idx_actions_org ON kvittra.actions(org_id);
CREATE INDEX idx_actions_player ON kvittra.actions(player_id);
CREATE INDEX idx_actions_type ON kvittra.actions(action_type);
CREATE INDEX idx_features_org ON kvittra.features_config(org_id);
CREATE INDEX idx_features_key ON kvittra.features_config(feature_key);
CREATE INDEX idx_otp_user ON kvittra.otp_codes(user_id);
CREATE INDEX idx_otp_expires ON kvittra.otp_codes(expires_at);
CREATE INDEX idx_organizations_slug ON kvittra.organizations(slug);

-- ===========================================
-- RLS HJÄLPFUNKTION
-- ===========================================
CREATE OR REPLACE FUNCTION kvittra.get_my_org_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT org_id FROM kvittra.organization_members
      WHERE user_id = auth.uid() AND is_active = true
    ),
    '{}'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Hjälpfunktion: har användaren en specifik roll i en org?
CREATE OR REPLACE FUNCTION kvittra.has_role(check_org_id uuid, check_role text)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM kvittra.organization_members
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
      AND is_active = true
      AND check_role = ANY(roles)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Hjälpfunktion: har användaren admin eller coach-roll?
CREATE OR REPLACE FUNCTION kvittra.is_admin_or_coach(check_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM kvittra.organization_members
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
      AND is_active = true
      AND (roles && ARRAY['admin', 'coach'])
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

-- Organizations
ALTER TABLE kvittra.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar kan se sin org"
  ON kvittra.organizations FOR SELECT
  USING (id = ANY(kvittra.get_my_org_ids()));

-- Organization Members
ALTER TABLE kvittra.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar kan se orgmedlemmar"
  ON kvittra.organization_members FOR SELECT
  USING (org_id = ANY(kvittra.get_my_org_ids()));
CREATE POLICY "Admin kan hantera medlemmar"
  ON kvittra.organization_members FOR INSERT
  WITH CHECK (kvittra.has_role(org_id, 'admin'));
CREATE POLICY "Admin kan uppdatera medlemmar"
  ON kvittra.organization_members FOR UPDATE
  USING (kvittra.has_role(org_id, 'admin'));

-- Player Profiles
ALTER TABLE kvittra.player_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar kan se spelarprofiler i sin org"
  ON kvittra.player_profiles FOR SELECT
  USING (org_id = ANY(kvittra.get_my_org_ids()));
CREATE POLICY "Spelare kan uppdatera sin egen profil"
  ON kvittra.player_profiles FOR UPDATE
  USING (member_id IN (
    SELECT id FROM kvittra.organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Admin/coach kan skapa profiler"
  ON kvittra.player_profiles FOR INSERT
  WITH CHECK (kvittra.is_admin_or_coach(org_id));

-- Teams
ALTER TABLE kvittra.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar kan se lag"
  ON kvittra.teams FOR SELECT
  USING (org_id = ANY(kvittra.get_my_org_ids()));
CREATE POLICY "Admin/coach kan hantera lag"
  ON kvittra.teams FOR INSERT
  WITH CHECK (kvittra.is_admin_or_coach(org_id));
CREATE POLICY "Admin/coach kan uppdatera lag"
  ON kvittra.teams FOR UPDATE
  USING (kvittra.is_admin_or_coach(org_id));
CREATE POLICY "Admin kan ta bort lag"
  ON kvittra.teams FOR DELETE
  USING (kvittra.has_role(org_id, 'admin'));

-- Matches
ALTER TABLE kvittra.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar kan se interna matcher"
  ON kvittra.matches FOR SELECT
  USING (org_id = ANY(kvittra.get_my_org_ids()));
CREATE POLICY "Publika matcher synliga för alla"
  ON kvittra.matches FOR SELECT
  USING (visibility = 'public');
CREATE POLICY "Admin/coach/uploader kan skapa matcher"
  ON kvittra.matches FOR INSERT
  WITH CHECK (
    kvittra.has_role(org_id, 'admin')
    OR kvittra.has_role(org_id, 'coach')
    OR kvittra.has_role(org_id, 'uploader')
  );
CREATE POLICY "Admin/coach kan uppdatera matcher"
  ON kvittra.matches FOR UPDATE
  USING (kvittra.is_admin_or_coach(org_id));

-- Videos
ALTER TABLE kvittra.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar kan se videor i sin org"
  ON kvittra.videos FOR SELECT
  USING (org_id = ANY(kvittra.get_my_org_ids()));
CREATE POLICY "Publika videor via publik match"
  ON kvittra.videos FOR SELECT
  USING (match_id IN (
    SELECT id FROM kvittra.matches WHERE visibility = 'public'
  ));
CREATE POLICY "Uppladdare kan skapa videor"
  ON kvittra.videos FOR INSERT
  WITH CHECK (
    kvittra.has_role(org_id, 'admin')
    OR kvittra.has_role(org_id, 'coach')
    OR kvittra.has_role(org_id, 'uploader')
  );

-- Actions (DVW-data — öppen inom org per Filips krav)
ALTER TABLE kvittra.actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alla i org ser all DVW-data"
  ON kvittra.actions FOR SELECT
  USING (org_id = ANY(kvittra.get_my_org_ids()));
CREATE POLICY "Publika actions via publik match"
  ON kvittra.actions FOR SELECT
  USING (match_id IN (
    SELECT id FROM kvittra.matches WHERE visibility = 'public'
  ));
CREATE POLICY "Admin/coach/uploader kan importera actions"
  ON kvittra.actions FOR INSERT
  WITH CHECK (
    kvittra.has_role(org_id, 'admin')
    OR kvittra.has_role(org_id, 'coach')
    OR kvittra.has_role(org_id, 'uploader')
  );

-- Features Config
ALTER TABLE kvittra.features_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alla kan se globala features"
  ON kvittra.features_config FOR SELECT
  USING (org_id IS NULL);
CREATE POLICY "Medlemmar kan se sin orgs features"
  ON kvittra.features_config FOR SELECT
  USING (org_id = ANY(kvittra.get_my_org_ids()));

-- OTP Codes
ALTER TABLE kvittra.otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Användare kan se sina egna OTP"
  ON kvittra.otp_codes FOR SELECT
  USING (user_id = auth.uid());

-- ===========================================
-- EXPOSE SCHEMA VIA POSTGREST
-- ===========================================
-- PostgREST behöver veta om kvittra-schemat
NOTIFY pgrst, 'reload schema';
