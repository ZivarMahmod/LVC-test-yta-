-- ===========================================
-- Kvittra — Komplett Supabase Schema
-- Allt från Prisma + Kvittra i en migration
-- Körs direkt mot Supabase PostgreSQL
-- ===========================================

-- Skapa roller
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

-- Aktivera UUID-extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- ORGANISATIONER (multi-tenant)
-- ===========================================
CREATE TABLE IF NOT EXISTS organizations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  branding_config jsonb DEFAULT '{}',
  features_config jsonb DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- ANVÄNDARE (utökar Supabase Auth)
-- ===========================================
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text,
  username        text UNIQUE,
  name            text NOT NULL DEFAULT '',
  role            text DEFAULT 'viewer',
  jersey_number   int,
  position        text,
  photo_url       text,
  preferences     jsonb DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ===========================================
-- ORG-MEDLEMSKAP
-- ===========================================
CREATE TABLE IF NOT EXISTS organization_members (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  roles           text[] DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- ===========================================
-- LAG
-- ===========================================
CREATE TABLE IF NOT EXISTS teams (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  season          text,
  thumbnail_url   text,
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- MATCHER
-- ===========================================
CREATE TABLE IF NOT EXISTS matches (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  team_id         uuid REFERENCES teams(id) ON DELETE SET NULL,
  title           text NOT NULL,
  opponent        text,
  match_date      date,
  description     text,
  match_type      text DEFAULT 'match',
  visibility      text DEFAULT 'internal',
  dvw_file_url    text,
  video_offset    int DEFAULT 0,
  deleted_at      timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ===========================================
-- VIDEOR
-- ===========================================
CREATE TABLE IF NOT EXISTS videos (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id        uuid REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  file_name       text,
  file_size       bigint,
  mime_type       text DEFAULT 'video/mp4',
  thumbnail_path  text,
  duration_sec    int,
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- MATCH-DOKUMENT (PDFs, bilder)
-- ===========================================
CREATE TABLE IF NOT EXISTS match_documents (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id        uuid REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text DEFAULT 'other',
  storage_path    text NOT NULL,
  file_size       bigint,
  uploaded_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- ACTIONS (DVW scout-data)
-- ===========================================
CREATE TABLE IF NOT EXISTS actions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id        uuid REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  org_id          uuid REFERENCES organizations(id),
  set_number      int,
  player_number   int,
  player_name     text,
  team_side       text,
  team_name       text,
  skill           text,
  skill_name      text,
  grade           text,
  grade_name      text,
  start_zone      int,
  end_zone        int,
  start_coord_x   int,
  start_coord_y   int,
  end_coord_x     int,
  end_coord_y     int,
  video_time      int,
  raw_code        text,
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- SCORE EVENTS (poängställning per rally)
-- ===========================================
CREATE TABLE IF NOT EXISTS score_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id        uuid REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  action_index    int,
  set_number      int,
  score_home      int,
  score_away      int
);

-- ===========================================
-- COACH REVIEWS (feedback på aktioner)
-- ===========================================
CREATE TABLE IF NOT EXISTS coach_reviews (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id        uuid REFERENCES matches(id) ON DELETE CASCADE,
  org_id          uuid REFERENCES organizations(id),
  action_index    int NOT NULL,
  coach_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  comment         text NOT NULL,
  acknowledged_at timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- INVITE TOKENS
-- ===========================================
CREATE TABLE IF NOT EXISTS invite_tokens (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  token           text UNIQUE NOT NULL,
  role            text DEFAULT 'viewer',
  expires_at      timestamptz NOT NULL,
  max_uses        int DEFAULT 1,
  use_count       int DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- FEATURE FLAGS
-- ===========================================
CREATE TABLE IF NOT EXISTS features_config (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key     text NOT NULL,
  is_enabled      boolean DEFAULT true,
  config          jsonb DEFAULT '{}',
  UNIQUE(org_id, feature_key)
);

-- ===========================================
-- CHANGELOG
-- ===========================================
CREATE TABLE IF NOT EXISTS changelog (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  version         text NOT NULL,
  title           text NOT NULL,
  content         text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- AUDIT LOG
-- ===========================================
CREATE TABLE IF NOT EXISTS audit_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  action          text NOT NULL,
  entity          text NOT NULL,
  entity_id       text,
  user_id         uuid REFERENCES auth.users(id),
  user_name       text,
  details         jsonb,
  ip_address      text,
  created_at      timestamptz DEFAULT now()
);

-- ===========================================
-- SETTINGS (nyckel-värde)
-- ===========================================
CREATE TABLE IF NOT EXISTS settings (
  key             text PRIMARY KEY,
  value           text NOT NULL,
  updated_at      timestamptz DEFAULT now()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(org_id);
CREATE INDEX IF NOT EXISTS idx_matches_org ON matches(org_id);
CREATE INDEX IF NOT EXISTS idx_matches_team ON matches(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_matches_visibility ON matches(visibility);
CREATE INDEX IF NOT EXISTS idx_videos_match ON videos(match_id);
CREATE INDEX IF NOT EXISTS idx_videos_org ON videos(org_id);
CREATE INDEX IF NOT EXISTS idx_actions_match ON actions(match_id);
CREATE INDEX IF NOT EXISTS idx_actions_org ON actions(org_id);
CREATE INDEX IF NOT EXISTS idx_actions_skill ON actions(skill);
CREATE INDEX IF NOT EXISTS idx_actions_player ON actions(player_name);
CREATE INDEX IF NOT EXISTS idx_score_events_match ON score_events(match_id);
CREATE INDEX IF NOT EXISTS idx_coach_reviews_match ON coach_reviews(match_id);
CREATE INDEX IF NOT EXISTS idx_coach_reviews_player ON coach_reviews(player_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_org ON invite_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_features_org ON features_config(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_match_docs_match ON match_documents(match_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- ===========================================
-- RLS HJÄLPFUNKTIONER
-- ===========================================
CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(
    ARRAY(SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = true),
    '{}'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_org_role(check_org_id uuid, check_role text)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND org_id = check_org_id AND is_active = true AND check_role = ANY(roles)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_admin_or_coach(check_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND org_id = check_org_id AND is_active = true AND (roles && ARRAY['admin', 'coach'])
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===========================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ===========================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alla kan se profiler" ON profiles FOR SELECT USING (true);
CREATE POLICY "Användare kan uppdatera sin profil" ON profiles FOR UPDATE USING (id = auth.uid());

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar ser sin org" ON organizations FOR SELECT
  USING (id = ANY(get_my_org_ids()) OR NOT is_active);
CREATE POLICY "Service role hanterar orgs" ON organizations FOR ALL
  USING (auth.role() = 'service_role');

-- Organization Members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar ser orgmedlemmar" ON organization_members FOR SELECT
  USING (org_id = ANY(get_my_org_ids()));
CREATE POLICY "Admin hanterar medlemmar" ON organization_members FOR INSERT
  WITH CHECK (has_org_role(org_id, 'admin'));
CREATE POLICY "Admin uppdaterar medlemmar" ON organization_members FOR UPDATE
  USING (has_org_role(org_id, 'admin'));

-- Teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar ser lag" ON teams FOR SELECT USING (org_id = ANY(get_my_org_ids()));
CREATE POLICY "Admin/coach skapar lag" ON teams FOR INSERT WITH CHECK (is_org_admin_or_coach(org_id));
CREATE POLICY "Admin/coach uppdaterar lag" ON teams FOR UPDATE USING (is_org_admin_or_coach(org_id));
CREATE POLICY "Admin tar bort lag" ON teams FOR DELETE USING (has_org_role(org_id, 'admin'));

-- Matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar ser matcher" ON matches FOR SELECT USING (org_id = ANY(get_my_org_ids()));
CREATE POLICY "Publika matcher" ON matches FOR SELECT USING (visibility = 'public');
CREATE POLICY "Admin/coach/uploader skapar" ON matches FOR INSERT
  WITH CHECK (has_org_role(org_id, 'admin') OR has_org_role(org_id, 'coach') OR has_org_role(org_id, 'uploader'));
CREATE POLICY "Admin/coach uppdaterar" ON matches FOR UPDATE USING (is_org_admin_or_coach(org_id));
CREATE POLICY "Admin tar bort" ON matches FOR DELETE USING (has_org_role(org_id, 'admin'));

-- Videos
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medlemmar ser videor" ON videos FOR SELECT USING (org_id = ANY(get_my_org_ids()));
CREATE POLICY "Publik via match" ON videos FOR SELECT
  USING (match_id IN (SELECT id FROM matches WHERE visibility = 'public'));
CREATE POLICY "Uppladdare skapar" ON videos FOR INSERT
  WITH CHECK (has_org_role(org_id, 'admin') OR has_org_role(org_id, 'coach') OR has_org_role(org_id, 'uploader'));

-- Actions (DVW — öppen inom org)
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alla i org ser actions" ON actions FOR SELECT USING (org_id = ANY(get_my_org_ids()));
CREATE POLICY "Publika actions" ON actions FOR SELECT
  USING (match_id IN (SELECT id FROM matches WHERE visibility = 'public'));
CREATE POLICY "Admin/coach/uploader importerar" ON actions FOR INSERT
  WITH CHECK (has_org_role(org_id, 'admin') OR has_org_role(org_id, 'coach') OR has_org_role(org_id, 'uploader'));

-- Score Events
ALTER TABLE score_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Via match" ON score_events FOR SELECT
  USING (match_id IN (SELECT id FROM matches WHERE org_id = ANY(get_my_org_ids()) OR visibility = 'public'));
CREATE POLICY "Import" ON score_events FOR INSERT WITH CHECK (true);

-- Coach Reviews
ALTER TABLE coach_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org ser reviews" ON coach_reviews FOR SELECT USING (org_id = ANY(get_my_org_ids()));
CREATE POLICY "Coach skapar" ON coach_reviews FOR INSERT WITH CHECK (is_org_admin_or_coach(org_id));

-- Match Documents
ALTER TABLE match_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org ser dokument" ON match_documents FOR SELECT USING (org_id = ANY(get_my_org_ids()));
CREATE POLICY "Uppladdare skapar" ON match_documents FOR INSERT
  WITH CHECK (has_org_role(org_id, 'admin') OR has_org_role(org_id, 'coach') OR has_org_role(org_id, 'uploader'));

-- Invite Tokens
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin ser tokens" ON invite_tokens FOR SELECT USING (has_org_role(org_id, 'admin'));
CREATE POLICY "Admin skapar tokens" ON invite_tokens FOR INSERT WITH CHECK (has_org_role(org_id, 'admin'));

-- Features Config
ALTER TABLE features_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alla ser features" ON features_config FOR SELECT USING (true);

-- Changelog
ALTER TABLE changelog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alla ser changelog" ON changelog FOR SELECT USING (true);

-- Audit Log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin ser audit" ON audit_log FOR SELECT
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alla ser settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admin uppdaterar" ON settings FOR ALL USING (auth.role() = 'service_role');

-- ===========================================
-- RÄTTIGHETER
-- ===========================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- ===========================================
-- SUPABASE STORAGE BUCKETS
-- ===========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('dvw-files', 'dvw-files', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Auth users upload videos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users read videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'videos' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users upload dvw" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dvw-files' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users read dvw" ON storage.objects FOR SELECT
  USING (bucket_id = 'dvw-files' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users upload docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users read docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
CREATE POLICY "Public read thumbnails" ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails');
CREATE POLICY "Auth upload thumbnails" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'thumbnails' AND auth.role() = 'authenticated');
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
