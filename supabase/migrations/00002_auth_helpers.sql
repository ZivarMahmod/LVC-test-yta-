-- ============================================================
-- Auth helper: lookup email by username or email
-- Used by frontend login to support username-based login
-- with Supabase Auth (which requires email).
-- ============================================================

-- Returns the email for a given identifier (username or email).
-- Returns null if not found (prevents enumeration when combined
-- with generic error messages on the frontend).
create or replace function public.get_email_for_login(identifier text)
returns text as $$
  select email
  from public.profiles
  where
    lower(email) = lower(identifier)
    or lower(username) = lower(identifier)
  limit 1;
$$ language sql security definer stable;

-- Allow anon and authenticated to call this function
grant execute on function public.get_email_for_login(text) to anon, authenticated;
