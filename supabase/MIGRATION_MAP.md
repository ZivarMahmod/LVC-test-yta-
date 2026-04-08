# Prisma → Supabase Migration Map

## Tables

| Prisma Model      | Supabase Table        | Notes                                            |
|--------------------|-----------------------|--------------------------------------------------|
| User               | profiles              | Extends auth.users. No passwordHash/tokens.      |
| RefreshToken       | —                     | Removed. Supabase Auth handles sessions.         |
| LoginAttempt       | —                     | Removed. Supabase Auth handles rate-limiting.    |
| InviteToken        | invite_tokens         | Kept for invite-only registration.               |
| Team               | teams                 | serial PK (was autoincrement).                   |
| Season             | seasons               | serial PK. FK to teams.                          |
| Video              | videos                | FK to profiles. Soft-delete preserved.           |
| MatchDocument      | match_documents       | FK to videos (cascade).                          |
| ChangelogEntry     | changelog_entries     | Simple table.                                    |
| ThumbnailLibrary   | thumbnail_library     | FK to teams (cascade).                           |
| UserTeam           | user_teams            | Composite PK (user_id, team_id).                 |
| CoachReview        | coach_reviews         | Two FKs to profiles (coach, player).             |
| Setting            | settings              | Text PK (key).                                   |
| AuditLog           | audit_logs            | No FK to profiles (keeps history if user deleted).|

## Column Naming

| Prisma (camelCase) | Supabase (snake_case) |
|--------------------|-----------------------|
| uploadedById       | uploaded_by_id        |
| deletedById        | deleted_by_id         |
| matchDate          | match_date            |
| matchType          | match_type            |
| videoOffset        | video_offset          |
| thumbnailPath      | thumbnail_path        |
| dvwPath            | dvw_path              |
| fileSize           | file_size             |
| mimeType           | mime_type             |
| fileName           | file_name             |
| filePath           | file_path             |
| teamId             | team_id               |
| seasonId           | season_id             |
| jerseyNumber       | jersey_number         |
| passwordHash       | — (Supabase Auth)     |
| isActive           | is_active             |
| createdAt          | created_at            |
| updatedAt          | updated_at            |
| actionIndex        | action_index          |
| coachId            | coach_id              |
| playerId           | player_id             |
| acknowledgedAt     | acknowledged_at       |
| videoId            | video_id              |
| uploadedById       | uploaded_by_id        |
| entityId           | entity_id             |
| userId             | user_id               |
| userName           | user_name             |
| ipAddress          | ip_address            |
| expiresAt          | expires_at            |
| maxUses            | max_uses              |
| useCount           | use_count             |
| createdBy          | created_by            |
| tokenHash          | — (Removed)           |
| isRevoked          | — (Removed)           |

## Storage Buckets

| Bucket       | Public | Max Size | Replaces                        |
|-------------|--------|----------|----------------------------------|
| videos      | No     | 10 GB    | /storage/videos/                 |
| thumbnails  | Yes    | 5 MB     | /storage/thumbnails/             |
| documents   | No     | 50 MB    | /storage/documents/              |
| dvw-files   | No     | 10 MB    | /storage/dvw/                    |

## Auth Mapping

| Old (Express)              | New (Supabase Auth)                    |
|---------------------------|----------------------------------------|
| POST /api/auth/login       | supabase.auth.signInWithPassword()     |
| POST /api/auth/register    | supabase.auth.signUp() + invite check  |
| POST /api/auth/logout      | supabase.auth.signOut()                |
| POST /api/auth/refresh     | Automatic (Supabase client)            |
| GET  /api/auth/me          | supabase.auth.getUser()                |
| CSRF token                 | Not needed (Supabase uses JWT)         |
| Brute force service        | Supabase Auth built-in protection      |
| Token rotation             | Supabase Auth built-in                 |

## RLS Role Helpers

| Function           | Returns                      |
|-------------------|------------------------------|
| user_role()        | Current user's role string   |
| is_admin()         | true if role = 'admin'       |
| is_coach_or_admin()| true if role in (admin,coach)|
| can_upload()       | true if admin/coach/uploader |

## Edge Functions

| Function      | Purpose                                      |
|--------------|----------------------------------------------|
| parse-dvw    | Parses DataVolley .dvw files from Storage    |

## Switchover: How to activate Supabase

The migration uses a **zero-downtime switchover**. Both old (Express) and new
(Supabase) backends coexist. The switch is controlled by environment variables.

### Steps to activate:

1. **Run migrations** in your Supabase project:
   ```
   supabase db push  # or paste SQL from supabase/migrations/ in SQL Editor
   ```

2. **Deploy Edge Function**:
   ```
   supabase functions deploy parse-dvw
   ```

3. **Set frontend env vars** (in `.env` or hosting platform):
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Rebuild frontend** — the switchover in `main.jsx` and `apiSwitch.js`
   will automatically pick up Supabase when those env vars exist.

5. **Verify** everything works. The old Express backend still runs and
   serves as fallback if you remove the env vars.

6. **Clean up** (Step 6 — only after full verification):
   - Remove `backend/` folder
   - Remove old `context/AuthContext.jsx`
   - Remove old `utils/api.js`
   - Replace `apiSwitch.js` imports with direct `supabaseApi.js` imports
   - Remove `Dockerfile`, `docker-compose.yml`, etc.

### Files overview:

| File | Role |
|------|------|
| `main.jsx` | Switches AuthProvider (Express vs Supabase) |
| `utils/apiSwitch.js` | Switches API module (api.js vs supabaseApi.js) |
| `utils/supabaseClient.js` | Supabase client singleton |
| `utils/supabaseApi.js` | Complete API layer using Supabase |
| `context/SupabaseAuthContext.jsx` | Auth using supabase.auth |
