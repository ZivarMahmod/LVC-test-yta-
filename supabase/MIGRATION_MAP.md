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
