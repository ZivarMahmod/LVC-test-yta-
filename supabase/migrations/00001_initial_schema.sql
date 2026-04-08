-- ============================================================
-- LVC Media Hub — Supabase Schema Migration
-- Converted from Prisma/SQLite to PostgreSQL/Supabase
-- ============================================================
-- Auth: Supabase Auth (auth.users) replaces custom User + RefreshToken + LoginAttempt
-- Storage: Supabase Storage replaces NAS-mounted file system
-- RLS: Row Level Security enforced on all tables
-- ============================================================

-- =========================
-- HELPER: updated_at trigger
-- =========================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================
-- 1. PROFILES (extends auth.users)
-- =========================
-- Replaces Prisma "User" model.
-- email + password handled by auth.users.
-- RefreshToken + LoginAttempt no longer needed (Supabase Auth).
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  username    text unique not null,
  name        text not null,
  role        text not null default 'viewer'
                check (role in ('admin', 'coach', 'uploader', 'viewer')),
  jersey_number int,
  preferences  jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_profiles_email on public.profiles(email);
create index idx_profiles_username on public.profiles(username);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'viewer')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- 2. INVITE TOKENS
-- =========================
create table public.invite_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null,
  role        text not null default 'viewer'
                check (role in ('admin', 'coach', 'uploader', 'viewer')),
  expires_at  timestamptz not null,
  max_uses    int not null default 1,
  use_count   int not null default 0,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index idx_invite_tokens_token on public.invite_tokens(token);

-- =========================
-- 3. TEAMS
-- =========================
create table public.teams (
  id              serial primary key,
  name            text unique not null,
  thumbnail_path  text,
  created_at      timestamptz not null default now()
);

-- =========================
-- 4. SEASONS
-- =========================
create table public.seasons (
  id          serial primary key,
  name        text not null,
  team_id     int not null references public.teams(id) on delete cascade,
  created_at  timestamptz not null default now(),

  unique(name, team_id)
);

-- =========================
-- 5. VIDEOS
-- =========================
create table public.videos (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  opponent        text not null,
  match_date      timestamptz not null,
  description     text,
  file_name       text not null,
  file_path       text not null,
  file_size       bigint not null,
  mime_type       text not null,
  thumbnail_path  text,
  dvw_path        text,
  match_type      text not null default 'own'
                    check (match_type in ('own', 'opponent')),
  video_offset    int not null default 0,
  deleted_at      timestamptz,
  deleted_by_id   uuid references public.profiles(id),
  uploaded_by_id  uuid not null references public.profiles(id),
  team_id         int references public.teams(id) on delete set null,
  season_id       int references public.seasons(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_videos_match_date on public.videos(match_date);
create index idx_videos_opponent on public.videos(opponent);
create index idx_videos_team_id on public.videos(team_id);
create index idx_videos_season_id on public.videos(season_id);
create index idx_videos_file_path on public.videos(file_path);
create index idx_videos_created_at on public.videos(created_at);
create index idx_videos_uploaded_by on public.videos(uploaded_by_id);
create index idx_videos_deleted_date on public.videos(deleted_at, match_date);
create index idx_videos_team_deleted on public.videos(team_id, deleted_at);

create trigger videos_updated_at
  before update on public.videos
  for each row execute function public.handle_updated_at();

-- =========================
-- 6. MATCH DOCUMENTS
-- =========================
create table public.match_documents (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            text not null default 'other',
  file_path       text not null,
  file_size       bigint not null,
  video_id        uuid not null references public.videos(id) on delete cascade,
  uploaded_by_id  uuid not null references public.profiles(id),
  created_at      timestamptz not null default now()
);

create index idx_match_documents_video on public.match_documents(video_id);

-- =========================
-- 7. CHANGELOG ENTRIES
-- =========================
create table public.changelog_entries (
  id          uuid primary key default gen_random_uuid(),
  version     text not null,
  title       text not null,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger changelog_entries_updated_at
  before update on public.changelog_entries
  for each row execute function public.handle_updated_at();

-- =========================
-- 8. THUMBNAIL LIBRARY
-- =========================
create table public.thumbnail_library (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  file_path   text not null,
  team_id     int not null references public.teams(id) on delete cascade,
  created_at  timestamptz not null default now(),

  unique(name, team_id)
);

create index idx_thumbnail_library_team on public.thumbnail_library(team_id);

-- =========================
-- 9. USER TEAMS (many-to-many)
-- =========================
create table public.user_teams (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  team_id   int not null references public.teams(id) on delete cascade,
  primary key (user_id, team_id)
);

create index idx_user_teams_user on public.user_teams(user_id);
create index idx_user_teams_team on public.user_teams(team_id);

-- =========================
-- 10. COACH REVIEWS
-- =========================
create table public.coach_reviews (
  id              uuid primary key default gen_random_uuid(),
  video_id        uuid not null references public.videos(id) on delete cascade,
  action_index    int not null,
  coach_id        uuid not null references public.profiles(id) on delete cascade,
  player_id       uuid not null references public.profiles(id) on delete cascade,
  comment         text not null,
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index idx_coach_reviews_coach on public.coach_reviews(coach_id);
create index idx_coach_reviews_player on public.coach_reviews(player_id);
create index idx_coach_reviews_video on public.coach_reviews(video_id);
create index idx_coach_reviews_created on public.coach_reviews(created_at);
create index idx_coach_reviews_video_player on public.coach_reviews(video_id, player_id);

-- =========================
-- 11. SETTINGS (key-value)
-- =========================
create table public.settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

create trigger settings_updated_at
  before update on public.settings
  for each row execute function public.handle_updated_at();

-- =========================
-- 12. AUDIT LOG
-- =========================
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  entity      text not null,
  entity_id   text,
  user_id     uuid not null,
  user_name   text not null,
  details     text,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index idx_audit_logs_user on public.audit_logs(user_id);
create index idx_audit_logs_action on public.audit_logs(action);
create index idx_audit_logs_entity on public.audit_logs(entity);
create index idx_audit_logs_created on public.audit_logs(created_at);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Helper: check if current user has a specific role
create or replace function public.user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
  select public.user_role() = 'admin';
$$ language sql security definer stable;

-- Helper: check if current user is coach or admin
create or replace function public.is_coach_or_admin()
returns boolean as $$
  select public.user_role() in ('admin', 'coach');
$$ language sql security definer stable;

-- Helper: check if current user can upload (admin, coach, uploader)
create or replace function public.can_upload()
returns boolean as $$
  select public.user_role() in ('admin', 'coach', 'uploader');
$$ language sql security definer stable;

-- -------------------------
-- PROFILES
-- -------------------------
alter table public.profiles enable row level security;

-- All authenticated users can read profiles
create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update their own profile (preferences, jersey_number)
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can update any profile (role, is_active, etc.)
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Profile insert handled by trigger (security definer), no direct insert needed
-- Admins can delete users
create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- -------------------------
-- INVITE TOKENS
-- -------------------------
alter table public.invite_tokens enable row level security;

-- Admins can do everything with invite tokens
create policy "invite_tokens_admin"
  on public.invite_tokens for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Anyone (including anon) can validate a token by reading it
create policy "invite_tokens_validate"
  on public.invite_tokens for select
  to anon, authenticated
  using (true);

-- -------------------------
-- TEAMS
-- -------------------------
alter table public.teams enable row level security;

create policy "teams_select"
  on public.teams for select
  to authenticated
  using (true);

create policy "teams_admin"
  on public.teams for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------
-- SEASONS
-- -------------------------
alter table public.seasons enable row level security;

create policy "seasons_select"
  on public.seasons for select
  to authenticated
  using (true);

create policy "seasons_admin"
  on public.seasons for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------
-- VIDEOS
-- -------------------------
alter table public.videos enable row level security;

-- All authenticated users can read non-deleted videos
create policy "videos_select"
  on public.videos for select
  to authenticated
  using (deleted_at is null or public.is_admin());

-- Uploaders, coaches, admins can insert
create policy "videos_insert"
  on public.videos for insert
  to authenticated
  with check (public.can_upload());

-- Uploaders can update their own videos, admins can update any
create policy "videos_update"
  on public.videos for update
  to authenticated
  using (uploaded_by_id = auth.uid() or public.is_admin())
  with check (uploaded_by_id = auth.uid() or public.is_admin());

-- Only admins can hard-delete
create policy "videos_delete_admin"
  on public.videos for delete
  to authenticated
  using (public.is_admin());

-- -------------------------
-- MATCH DOCUMENTS
-- -------------------------
alter table public.match_documents enable row level security;

create policy "match_documents_select"
  on public.match_documents for select
  to authenticated
  using (true);

create policy "match_documents_insert"
  on public.match_documents for insert
  to authenticated
  with check (public.can_upload());

create policy "match_documents_delete"
  on public.match_documents for delete
  to authenticated
  using (uploaded_by_id = auth.uid() or public.is_admin());

-- -------------------------
-- CHANGELOG ENTRIES
-- -------------------------
alter table public.changelog_entries enable row level security;

create policy "changelog_select"
  on public.changelog_entries for select
  to authenticated
  using (true);

create policy "changelog_admin"
  on public.changelog_entries for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------
-- THUMBNAIL LIBRARY
-- -------------------------
alter table public.thumbnail_library enable row level security;

create policy "thumbnail_library_select"
  on public.thumbnail_library for select
  to authenticated
  using (true);

create policy "thumbnail_library_admin"
  on public.thumbnail_library for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------
-- USER TEAMS
-- -------------------------
alter table public.user_teams enable row level security;

create policy "user_teams_select"
  on public.user_teams for select
  to authenticated
  using (true);

create policy "user_teams_admin"
  on public.user_teams for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------
-- COACH REVIEWS
-- -------------------------
alter table public.coach_reviews enable row level security;

-- Players can see their own reviews, coaches/admins can see all
create policy "coach_reviews_select"
  on public.coach_reviews for select
  to authenticated
  using (
    player_id = auth.uid()
    or coach_id = auth.uid()
    or public.is_admin()
  );

-- Coaches and admins can create reviews
create policy "coach_reviews_insert"
  on public.coach_reviews for insert
  to authenticated
  with check (public.is_coach_or_admin());

-- Coaches can update their own reviews, players can acknowledge
create policy "coach_reviews_update"
  on public.coach_reviews for update
  to authenticated
  using (
    coach_id = auth.uid()
    or player_id = auth.uid()
    or public.is_admin()
  );

-- Coaches can delete their own reviews, admins can delete any
create policy "coach_reviews_delete"
  on public.coach_reviews for delete
  to authenticated
  using (coach_id = auth.uid() or public.is_admin());

-- -------------------------
-- SETTINGS
-- -------------------------
alter table public.settings enable row level security;

create policy "settings_select"
  on public.settings for select
  to authenticated
  using (true);

create policy "settings_admin"
  on public.settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------
-- AUDIT LOGS
-- -------------------------
alter table public.audit_logs enable row level security;

-- Only admins can read audit logs
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- All authenticated users can insert audit log entries
create policy "audit_logs_insert"
  on public.audit_logs for insert
  to authenticated
  with check (true);


-- ============================================================
-- SUPABASE STORAGE BUCKETS
-- ============================================================

-- Create storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos', 'videos', false, 10737418240,  -- 10 GB
    array['video/mp4', 'video/quicktime', 'video/x-matroska']),
  ('thumbnails', 'thumbnails', true, 5242880,  -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp']),
  ('documents', 'documents', false, 52428800,  -- 50 MB
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('dvw-files', 'dvw-files', false, 10485760,  -- 10 MB
    null)  -- DVW files have no standard MIME type
on conflict (id) do nothing;

-- -------------------------
-- STORAGE POLICIES: videos
-- -------------------------
create policy "videos_bucket_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'videos');

create policy "videos_bucket_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'videos'
    and (select public.can_upload())
  );

create policy "videos_bucket_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'videos'
    and (owner_id = auth.uid()::text or (select public.is_admin()))
  );

create policy "videos_bucket_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'videos'
    and (select public.is_admin())
  );

-- -------------------------
-- STORAGE POLICIES: thumbnails (public read)
-- -------------------------
create policy "thumbnails_bucket_select"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'thumbnails');

create policy "thumbnails_bucket_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'thumbnails'
    and (select public.can_upload())
  );

create policy "thumbnails_bucket_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (select public.is_admin())
  );

-- -------------------------
-- STORAGE POLICIES: documents
-- -------------------------
create policy "documents_bucket_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');

create policy "documents_bucket_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (select public.can_upload())
  );

create policy "documents_bucket_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (owner_id = auth.uid()::text or (select public.is_admin()))
  );

-- -------------------------
-- STORAGE POLICIES: dvw-files
-- -------------------------
create policy "dvw_files_bucket_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'dvw-files');

create policy "dvw_files_bucket_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dvw-files'
    and (select public.can_upload())
  );

create policy "dvw_files_bucket_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dvw-files'
    and (owner_id = auth.uid()::text or (select public.is_admin()))
  );
