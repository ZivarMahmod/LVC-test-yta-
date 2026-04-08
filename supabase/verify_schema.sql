-- ============================================================
-- Verification queries — run after applying the migration
-- to confirm all tables, RLS, and buckets are set up correctly.
-- ============================================================

-- 1. List all tables in public schema
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- Expected: audit_logs, changelog_entries, coach_reviews, invite_tokens,
--           match_documents, profiles, seasons, settings, teams,
--           thumbnail_library, user_teams, videos

-- 2. Verify RLS is enabled on all tables
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- All should have rowsecurity = true

-- 3. List all RLS policies
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 4. Verify storage buckets
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('videos', 'thumbnails', 'documents', 'dvw-files');

-- Expected: 4 buckets, thumbnails is public, rest are private

-- 5. List storage policies
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 6. Verify helper functions exist
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('handle_updated_at', 'handle_new_user', 'user_role', 'is_admin', 'is_coach_or_admin', 'can_upload')
order by routine_name;

-- 7. Verify triggers
select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table;

-- Expected triggers:
--   profiles_updated_at on profiles
--   videos_updated_at on videos
--   changelog_entries_updated_at on changelog_entries
--   settings_updated_at on settings

-- 8. Test profile auto-creation trigger exists on auth.users
select trigger_name, event_object_table
from information_schema.triggers
where event_object_schema = 'auth' and event_object_table = 'users';

-- Expected: on_auth_user_created
