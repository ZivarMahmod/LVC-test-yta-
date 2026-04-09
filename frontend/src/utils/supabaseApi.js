// ===========================================
// LVC Media Hub — Supabase API layer
// Replaces Express-backed api.js with direct Supabase calls.
// Same export names so the rest of the app works unchanged.
// ===========================================
import { supabase } from './supabaseClient.js';

// -------- Auth API --------
// Auth is handled by SupabaseAuthContext, but we keep authApi
// for invite validation (used by RegisterPage).
export const authApi = {
  async validateInvite(token) {
    const { data, error } = await supabase
      .from('invite_tokens')
      .select('id, token, role, expires_at, max_uses, use_count')
      .eq('token', token)
      .single();

    if (error || !data) return { valid: false, error: 'Ogiltig inbjudan.' };
    if (new Date(data.expires_at) < new Date()) return { valid: false, error: 'Inbjudan har gått ut.' };
    if (data.use_count >= data.max_uses) return { valid: false, error: 'Inbjudan har redan använts.' };
    return { valid: true, role: data.role };
  },

  async register(token, username, password, name) {
    // 1. Validate invite
    const invite = await this.validateInvite(token);
    if (!invite.valid) return { error: invite.error };

    // 2. Check username uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (existing) return { error: 'Användarnamnet är redan taget.' };

    // 3. Generate email from username (users don't need a real email for this invite system)
    // If we want to require real emails, the form should include an email field.
    // For now, use a generated email since the old system didn't require email for registration.
    const email = `${username.toLowerCase()}@lvcmediahub.local`;

    // 4. Sign up with Supabase Auth (profile auto-created by trigger)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          name: name || username,
          role: invite.role
        }
      }
    });

    if (authError) return { error: authError.message };

    // 5. Increment invite use count
    const { data: inviteData } = await supabase
      .from('invite_tokens')
      .select('id, use_count')
      .eq('token', token)
      .single();

    if (inviteData) {
      await supabase
        .from('invite_tokens')
        .update({ use_count: inviteData.use_count + 1 })
        .eq('id', inviteData.id);
    }

    return { user: authData.user };
  },

  async changePassword(currentPassword, newPassword) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) throw new Error('Ej inloggad');
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword
    });
    if (verifyError) throw new Error('Nuvarande lösenord är felaktigt');
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(updateError.message || 'Kunde inte byta lösenord');
  }
};

// -------- Video API --------
export const videoApi = {
  async list(page = 1, limit = 20, search = '', teamId = null, seasonId = null) {
    let query = supabase
      .from('videos')
      .select(`
        id, title, opponent, match_date, description, file_name, file_path,
        file_size, mime_type, thumbnail_path, dvw_path, match_type, video_offset,
        uploaded_by_id, team_id, season_id, created_at, updated_at,
        profiles!uploaded_by_id ( username, name ),
        teams ( name ),
        seasons ( name )
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('match_date', { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,opponent.ilike.%${search}%`);
    }
    if (teamId) query = query.eq('team_id', parseInt(teamId));
    if (seasonId) query = query.eq('season_id', parseInt(seasonId));

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error('Kunde inte hämta videor');

    // Map to camelCase to match existing app expectations
    const videos = (data || []).map(mapVideoRow);
    return { videos, total: count, page, limit };
  },

  async getOne(id) {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        id, title, opponent, match_date, description, file_name, file_path,
        file_size, mime_type, thumbnail_path, dvw_path, match_type, video_offset,
        uploaded_by_id, team_id, season_id, created_at, updated_at,
        profiles!uploaded_by_id ( username, name ),
        teams ( name ),
        seasons ( name )
      `)
      .eq('id', id)
      .single();

    if (error) throw new Error('Kunde inte hämta video');
    return { video: mapVideoRow(data) };
  },

  async upload(formData, onProgress) {
    // Extract metadata from FormData
    const title = formData.get('title');
    const opponent = formData.get('opponent');
    const matchDate = formData.get('matchDate');
    const description = formData.get('description');
    const matchType = formData.get('matchType') || 'own';
    const teamId = formData.get('teamId');
    const seasonId = formData.get('seasonId');
    const videoFile = formData.get('video');
    const thumbnailFile = formData.get('thumbnail');
    const dvwFile = formData.get('dvw');

    if (!videoFile) throw new Error('Ingen videofil vald');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Ej inloggad');

    // 1. Upload video to storage
    const videoPath = `${session.user.id}/${Date.now()}_${videoFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(videoPath, videoFile, {
        onUploadProgress: (progress) => {
          if (onProgress) {
            onProgress(Math.round((progress.loaded / progress.total) * 100));
          }
        }
      });
    if (uploadError) throw new Error('Kunde inte ladda upp video: ' + uploadError.message);

    // 2. Upload thumbnail if provided
    let thumbnailPath = null;
    if (thumbnailFile) {
      const thumbPath = `${session.user.id}/${Date.now()}_${thumbnailFile.name}`;
      const { error: thumbErr } = await supabase.storage
        .from('thumbnails')
        .upload(thumbPath, thumbnailFile);
      if (!thumbErr) thumbnailPath = thumbPath;
    }

    // 3. Upload DVW if provided
    let dvwPath = null;
    if (dvwFile) {
      const dvwStorePath = `${session.user.id}/${Date.now()}_${dvwFile.name}`;
      const { error: dvwErr } = await supabase.storage
        .from('dvw-files')
        .upload(dvwStorePath, dvwFile);
      if (!dvwErr) dvwPath = dvwStorePath;
    }

    // 4. Insert video record
    const { data, error: insertError } = await supabase
      .from('videos')
      .insert({
        title,
        opponent,
        match_date: matchDate,
        description: description || null,
        file_name: videoFile.name,
        file_path: videoPath,
        file_size: videoFile.size,
        mime_type: videoFile.type,
        thumbnail_path: thumbnailPath,
        dvw_path: dvwPath,
        match_type: matchType,
        uploaded_by_id: session.user.id,
        team_id: teamId ? parseInt(teamId) : null,
        season_id: seasonId ? parseInt(seasonId) : null
      })
      .select()
      .single();

    if (insertError) throw new Error('Kunde inte spara video: ' + insertError.message);
    return { video: mapVideoRow(data) };
  },

  async uploadThumbnail(id, file) {
    const { data: { session } } = await supabase.auth.getSession();
    const thumbPath = `${session.user.id}/${Date.now()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from('thumbnails')
      .upload(thumbPath, file);
    if (uploadErr) throw new Error('Kunde inte ladda upp thumbnail');

    const { data, error } = await supabase
      .from('videos')
      .update({ thumbnail_path: thumbPath })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error('Kunde inte uppdatera thumbnail');
    return { video: mapVideoRow(data) };
  },

  async remove(id) {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('videos')
      .update({ deleted_at: new Date().toISOString(), deleted_by_id: session.user.id })
      .eq('id', id);
    if (error) throw new Error('Kunde inte ta bort videon');
    return { success: true };
  },

  async restore(id) {
    const { error } = await supabase
      .from('videos')
      .update({ deleted_at: null, deleted_by_id: null })
      .eq('id', id);
    if (error) throw new Error('Kunde inte återställa videon');
    return { success: true };
  },

  async permanentDelete(id) {
    // Get file paths before deleting
    const { data: video } = await supabase
      .from('videos')
      .select('file_path, thumbnail_path, dvw_path')
      .eq('id', id)
      .single();

    if (video) {
      // Delete files from storage
      if (video.file_path) await supabase.storage.from('videos').remove([video.file_path]);
      if (video.thumbnail_path) await supabase.storage.from('thumbnails').remove([video.thumbnail_path]);
      if (video.dvw_path) await supabase.storage.from('dvw-files').remove([video.dvw_path]);
    }

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);
    if (error) throw new Error('Kunde inte radera videon');
    return { success: true };
  },

  async uploadDvw(videoId, file) {
    const { data: { session } } = await supabase.auth.getSession();
    const dvwPath = `${session.user.id}/${Date.now()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from('dvw-files')
      .upload(dvwPath, file);
    if (uploadErr) throw new Error('Kunde inte ladda upp DVW-fil');

    const { data, error } = await supabase
      .from('videos')
      .update({ dvw_path: dvwPath })
      .eq('id', videoId)
      .select()
      .single();

    if (error) throw new Error('Kunde inte uppdatera DVW-sökväg');
    return { video: mapVideoRow(data) };
  },

  async updateTitle(videoId, title) {
    const { data, error } = await supabase
      .from('videos')
      .update({ title })
      .eq('id', videoId)
      .select()
      .single();
    if (error) throw new Error('Kunde inte uppdatera titel');
    return { video: mapVideoRow(data) };
  },

  // Chunked upload is not needed with Supabase Storage (handles large files natively).
  // These are kept as stubs for backward compatibility.
  async uploadChunk() { throw new Error('Använd upload() istället — Supabase hanterar stora filer'); },
  async uploadComplete() { throw new Error('Använd upload() istället — Supabase hanterar stora filer'); }
};

// -------- Admin API --------
export const adminApi = {
  async getActiveUsers() {
    // Supabase doesn't track active sessions the same way.
    // Return all active users as a fallback.
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, name, role, is_active')
      .eq('is_active', true);
    if (error) throw new Error('Kunde inte hämta aktiva användare');
    return data.map(mapProfileRow);
  },

  async listUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, email, username, name, role, jersey_number, is_active, created_at, updated_at,
        user_teams ( team_id, teams ( id, name ) )
      `)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Kunde inte hämta användare');
    return data.map(u => ({
      ...mapProfileRow(u),
      teams: (u.user_teams || []).map(ut => ut.teams)
    }));
  },

  async createUser(userData) {
    // Create user via Supabase Auth admin (requires service role in Edge Function)
    // For now, create via invite flow — admin creates invite token
    throw new Error('Använd inbjudningssystemet för att skapa nya användare');
  },

  async updateUser(id, userData) {
    const updates = {};
    if (userData.name !== undefined) updates.name = userData.name;
    if (userData.role !== undefined) updates.role = userData.role;
    if (userData.isActive !== undefined) updates.is_active = userData.isActive;
    if (userData.jerseyNumber !== undefined) updates.jersey_number = userData.jerseyNumber;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error('Kunde inte uppdatera användare');
    return mapProfileRow(data);
  },

  async deleteUser(id) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw new Error('Kunde inte ta bort användare');
    return { success: true };
  },

  async uploadHistory(page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from('videos')
      .select(`
        id, title, opponent, file_name, file_size, created_at,
        profiles!uploaded_by_id ( username, name )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw new Error('Kunde inte hämta uppladdningshistorik');
    return {
      uploads: (data || []).map(v => ({
        id: v.id,
        title: v.title,
        opponent: v.opponent,
        fileName: v.file_name,
        fileSize: v.file_size,
        createdAt: v.created_at,
        uploadedBy: v.profiles
      })),
      total: count,
      page,
      limit
    };
  },

  async listTeams() {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');
    if (error) throw new Error('Kunde inte hämta lag');
    return data;
  },

  async createTeam(name) {
    const { data, error } = await supabase
      .from('teams')
      .insert({ name })
      .select()
      .single();
    if (error) throw new Error(error.message.includes('unique') ? 'Lagnamnet finns redan' : 'Kunde inte skapa lag');
    return data;
  },

  async deleteTeam(id) {
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) throw new Error('Kunde inte ta bort lag');
    return { success: true };
  },

  async listSeasons(teamId = null) {
    let query = supabase.from('seasons').select('*, teams ( name )').order('name');
    if (teamId) query = query.eq('team_id', parseInt(teamId));
    const { data, error } = await query;
    if (error) throw new Error('Kunde inte hämta säsonger');
    return data.map(s => ({ ...s, teamId: s.team_id, teamName: s.teams?.name }));
  },

  async createSeason(name, teamId) {
    const { data, error } = await supabase
      .from('seasons')
      .insert({ name, team_id: parseInt(teamId) })
      .select()
      .single();
    if (error) throw new Error(error.message.includes('unique') ? 'Säsongen finns redan för detta lag' : 'Kunde inte skapa säsong');
    return data;
  },

  async deleteSeason(id) {
    const { error } = await supabase.from('seasons').delete().eq('id', id);
    if (error) throw new Error('Kunde inte ta bort säsong');
    return { success: true };
  },

  async assignVideo(videoId, teamId, seasonId) {
    const { data, error } = await supabase
      .from('videos')
      .update({
        team_id: teamId ? parseInt(teamId) : null,
        season_id: seasonId ? parseInt(seasonId) : null
      })
      .eq('id', videoId)
      .select()
      .single();
    if (error) throw new Error('Kunde inte tilldela video');
    return { video: mapVideoRow(data) };
  },

  async getThumbnailLibrary(teamId = null) {
    let query = supabase.from('thumbnail_library').select('*').order('name');
    if (teamId) query = query.eq('team_id', parseInt(teamId));
    const { data, error } = await query;
    if (error) throw new Error('Kunde inte hämta thumbnails');
    return data.map(t => ({
      id: t.id,
      name: t.name,
      filePath: t.file_path,
      teamId: t.team_id,
      createdAt: t.created_at
    }));
  },

  async uploadThumbnailLibrary(file, teamId) {
    const path = `library/${teamId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from('thumbnails')
      .upload(path, file);
    if (uploadErr) throw new Error('Kunde inte ladda upp thumbnail');

    const name = file.name.replace(/\.[^.]+$/, '');
    const { data, error } = await supabase
      .from('thumbnail_library')
      .insert({ name, file_path: path, team_id: parseInt(teamId) })
      .select()
      .single();
    if (error) throw new Error('Kunde inte spara thumbnail');
    return data;
  },

  async deleteThumbnailLibrary(id) {
    const { data: thumb } = await supabase.from('thumbnail_library').select('file_path').eq('id', id).single();
    if (thumb?.file_path) await supabase.storage.from('thumbnails').remove([thumb.file_path]);
    const { error } = await supabase.from('thumbnail_library').delete().eq('id', id);
    if (error) throw new Error('Kunde inte ta bort thumbnail');
    return { success: true };
  },

  async getDeletedVideos() {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        id, title, opponent, match_date, deleted_at,
        profiles!uploaded_by_id ( username, name )
      `)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (error) throw new Error('Kunde inte hämta borttagna videor');
    return (data || []).map(mapVideoRow);
  },

  async addUserTeam(userId, teamId) {
    const { error } = await supabase
      .from('user_teams')
      .insert({ user_id: userId, team_id: parseInt(teamId) });
    if (error) throw new Error('Kunde inte lägga till lag');
    return { success: true };
  },

  async removeUserTeam(userId, teamId) {
    const { error } = await supabase
      .from('user_teams')
      .delete()
      .eq('user_id', userId)
      .eq('team_id', parseInt(teamId));
    if (error) throw new Error('Kunde inte ta bort lag');
    return { success: true };
  }
};

// -------- Review API --------
export const reviewApi = {
  async getInbox() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Ej inloggad');

    const { data, error } = await supabase
      .from('coach_reviews')
      .select(`
        id, video_id, action_index, comment, created_at, acknowledged_at,
        coach:profiles!coach_id ( id, username, name ),
        player:profiles!player_id ( id, username, name )
      `)
      .eq('player_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Kunde inte hämta inbox');
    return (data || []).map(mapReviewRow);
  },

  async getCoachOverview() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Ej inloggad');

    const { data, error } = await supabase
      .from('coach_reviews')
      .select(`
        id, video_id, action_index, comment, created_at, acknowledged_at,
        coach:profiles!coach_id ( id, username, name ),
        player:profiles!player_id ( id, username, name )
      `)
      .eq('coach_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Kunde inte hämta översikt');
    return (data || []).map(mapReviewRow);
  },

  async getVideoReviews(videoId) {
    const { data, error } = await supabase
      .from('coach_reviews')
      .select(`
        id, video_id, action_index, comment, created_at, acknowledged_at,
        coach:profiles!coach_id ( id, username, name ),
        player:profiles!player_id ( id, username, name )
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Kunde inte hämta reviews');
    return (data || []).map(mapReviewRow);
  },

  async getTeamPlayers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, name, jersey_number, role')
      .eq('is_active', true)
      .order('name');
    if (error) throw new Error('Kunde inte hämta spelare');
    return data.map(mapProfileRow);
  },

  async create(reviewData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Ej inloggad');

    const { data, error } = await supabase
      .from('coach_reviews')
      .insert({
        video_id: reviewData.videoId,
        action_index: reviewData.actionIndex,
        coach_id: session.user.id,
        player_id: reviewData.playerId,
        comment: reviewData.comment
      })
      .select()
      .single();
    if (error) throw new Error('Kunde inte skapa review');
    return data;
  },

  async acknowledge(reviewId, password) {
    // Verify password by re-signing in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Ej inloggad');

    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password
    });
    if (verifyErr) throw new Error('Felaktigt lösenord');

    const { data, error } = await supabase
      .from('coach_reviews')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', reviewId)
      .select()
      .single();
    if (error) throw new Error('Kunde inte bekräfta review');
    return data;
  }
};

// -------- Changelog API --------
export const changelogApi = {
  async list() {
    const { data, error } = await supabase
      .from('changelog_entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Kunde inte hämta ändringslogg');
    return data.map(e => ({
      id: e.id,
      version: e.version,
      title: e.title,
      content: e.content,
      createdAt: e.created_at,
      updatedAt: e.updated_at
    }));
  },

  async create(version, title, content) {
    const { data, error } = await supabase
      .from('changelog_entries')
      .insert({ version, title, content })
      .select()
      .single();
    if (error) throw new Error('Kunde inte skapa post');
    return data;
  },

  async update(id, version, title, content) {
    const { data, error } = await supabase
      .from('changelog_entries')
      .update({ version, title, content })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error('Kunde inte uppdatera post');
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('changelog_entries').delete().eq('id', id);
    if (error) throw new Error('Kunde inte ta bort post');
    return { success: true };
  }
};

// -------- Multi Scout API --------
export const multiScoutApi = {
  async fetch(ids) {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, opponent, match_date, dvw_path, video_offset, match_type')
      .in('id', ids);
    if (error) throw new Error('Kunde inte hämta scout-data');

    // Parse DVW files via Edge Function in parallel
    const results = await Promise.all(
      (data || []).map(async (video) => {
        if (!video.dvw_path) return { ...mapVideoRow(video), scout: null };

        const { data: parsed, error: fnErr } = await supabase.functions.invoke('parse-dvw', {
          body: { dvwPath: video.dvw_path, videoOffset: video.video_offset }
        });

        if (fnErr) return { ...mapVideoRow(video), scout: null };
        return { ...mapVideoRow(video), scout: parsed };
      })
    );

    return results;
  }
};

// -------- Team API --------
export const teamApi = {
  async listTeams() {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        id, name, thumbnail_path, created_at,
        seasons ( count ),
        videos ( count )
      `)
      .order('name');
    if (error) throw new Error('Kunde inte hämta lag');
    return data.map(t => ({
      id: t.id,
      name: t.name,
      thumbnailPath: t.thumbnail_path,
      createdAt: t.created_at,
      seasonCount: t.seasons?.[0]?.count || 0,
      videoCount: t.videos?.[0]?.count || 0
    }));
  },

  async listSeasons(teamId) {
    const { data, error } = await supabase
      .from('seasons')
      .select(`id, name, team_id, created_at, videos ( count )`)
      .eq('team_id', parseInt(teamId))
      .order('name');
    if (error) throw new Error('Kunde inte hämta säsonger');
    return data.map(s => ({
      id: s.id,
      name: s.name,
      teamId: s.team_id,
      createdAt: s.created_at,
      videoCount: s.videos?.[0]?.count || 0
    }));
  }
};

// -------- Settings API --------
export const settingsApi = {
  async getSkillNames() {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'skill-names')
      .maybeSingle();
    if (!data) return null;
    try { return JSON.parse(data.value); } catch { return null; }
  },

  async updateSkillNames(skillData) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'skill-names', value: JSON.stringify(skillData) });
    if (error) throw new Error('Kunde inte spara');
    return { success: true };
  },

  async getMusicUrl() {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'music-url')
      .maybeSingle();
    if (!data) return null;
    return { url: data.value };
  },

  async updateMusicUrl(url) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'music-url', value: url });
    if (error) throw new Error('Kunde inte spara');
    return { success: true };
  }
};

// -------- User Preferences API --------
export const userApi = {
  async getPreferences() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return {};

    const { data } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', session.user.id)
      .single();
    return data?.preferences || {};
  },

  async updatePreferences(prefs) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Ej inloggad');

    const { error } = await supabase
      .from('profiles')
      .update({ preferences: prefs })
      .eq('id', session.user.id);
    if (error) throw new Error('Kunde inte spara inställningar');
    return { success: true };
  }
};

// -------- Player Stats API --------
export const playerStatsApi = {
  async getHistory(playerId, { teamId = null, name = null } = {}) {
    // Player stats are derived from DVW data — this will be handled
    // by an Edge Function in Step 5. For now, query videos with DVW data.
    let query = supabase
      .from('videos')
      .select('id, title, opponent, match_date, dvw_path, video_offset, match_type, team_id')
      .not('dvw_path', 'is', null)
      .is('deleted_at', null)
      .order('match_date', { ascending: false });

    if (teamId) query = query.eq('team_id', parseInt(teamId));

    const { data, error } = await query;
    if (error) throw new Error('Kunde inte hämta spelarhistorik');
    return (data || []).map(mapVideoRow);
  }
};

// -------- Document API --------
export const documentApi = {
  async list(videoId) {
    const { data, error } = await supabase
      .from('match_documents')
      .select('id, name, type, file_path, file_size, uploaded_by_id, created_at')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Kunde inte hämta dokument');
    return (data || []).map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      filePath: d.file_path,
      fileSize: d.file_size,
      uploadedById: d.uploaded_by_id,
      createdAt: d.created_at
    }));
  },

  async upload(videoId, file, name, type) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Ej inloggad');

    const path = `${videoId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(path, file);
    if (uploadErr) throw new Error('Kunde inte ladda upp dokument');

    const { data, error } = await supabase
      .from('match_documents')
      .insert({
        name: name || file.name,
        type: type || 'other',
        file_path: path,
        file_size: file.size,
        video_id: videoId,
        uploaded_by_id: session.user.id
      })
      .select()
      .single();
    if (error) throw new Error('Kunde inte spara dokument');
    return data;
  },

  async remove(docId) {
    const { data: doc } = await supabase.from('match_documents').select('file_path').eq('id', docId).single();
    if (doc?.file_path) await supabase.storage.from('documents').remove([doc.file_path]);
    const { error } = await supabase.from('match_documents').delete().eq('id', docId);
    if (error) throw new Error('Kunde inte ta bort dokument');
    return { success: true };
  }
};

// -------- Scout API --------
export const scoutApi = {
  async getScout(id) {
    const { data: video, error } = await supabase
      .from('videos')
      .select('dvw_path, video_offset')
      .eq('id', id)
      .single();
    if (error || !video?.dvw_path) throw new Error('Ingen scout-fil');

    // Parse DVW via Edge Function
    const { data: parsed, error: fnErr } = await supabase.functions.invoke('parse-dvw', {
      body: { dvwPath: video.dvw_path, videoOffset: video.video_offset }
    });
    if (fnErr) throw new Error('Kunde inte parsa DVW-fil');

    return { ...parsed, videoOffset: video.video_offset };
  },

  async updateOffset(id, offset) {
    const { data, error } = await supabase
      .from('videos')
      .update({ video_offset: offset })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error('Kunde inte uppdatera offset');
    return { video: mapVideoRow(data) };
  }
};

// -------- Invite API (admin) --------
export const inviteApi = {
  async create(role, maxUses) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Ej inloggad');

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { data, error } = await supabase
      .from('invite_tokens')
      .insert({
        token,
        role,
        expires_at: expiresAt,
        max_uses: maxUses || 1,
        created_by: session.user.id
      })
      .select()
      .single();
    if (error) throw new Error('Kunde inte skapa inbjudan');
    return { invite: data };
  },

  async list() {
    const { data, error } = await supabase
      .from('invite_tokens')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Kunde inte hämta inbjudningar');
    return data.map(i => ({
      id: i.id,
      token: i.token,
      role: i.role,
      expiresAt: i.expires_at,
      maxUses: i.max_uses,
      useCount: i.use_count,
      createdBy: i.created_by,
      createdAt: i.created_at
    }));
  },

  async remove(id) {
    const { error } = await supabase.from('invite_tokens').delete().eq('id', id);
    if (error) throw new Error('Kunde inte ta bort inbjudan');
    return { success: true };
  }
};

// -------- Team Admin API --------
export const teamAdminApi = {
  async uploadThumbnail(teamId, file) {
    const path = `teams/${teamId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from('thumbnails')
      .upload(path, file);
    if (uploadErr) throw new Error('Kunde inte ladda upp thumbnail');

    const { data, error } = await supabase
      .from('teams')
      .update({ thumbnail_path: path })
      .eq('id', parseInt(teamId))
      .select()
      .single();
    if (error) throw new Error('Kunde inte uppdatera lag-thumbnail');
    return data;
  }
};

// ============================================================
// Helpers: snake_case → camelCase mapping
// ============================================================

function mapVideoRow(v) {
  if (!v) return v;
  return {
    id: v.id,
    title: v.title,
    opponent: v.opponent,
    matchDate: v.match_date,
    description: v.description,
    fileName: v.file_name,
    filePath: v.file_path,
    fileSize: v.file_size,
    mimeType: v.mime_type,
    thumbnailPath: v.thumbnail_path,
    dvwPath: v.dvw_path,
    matchType: v.match_type,
    videoOffset: v.video_offset,
    deletedAt: v.deleted_at,
    deletedById: v.deleted_by_id,
    uploadedById: v.uploaded_by_id,
    teamId: v.team_id,
    seasonId: v.season_id,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
    // Joined data
    uploadedBy: v.profiles || undefined,
    team: v.teams || undefined,
    season: v.seasons || undefined,
    // Pass through any extra fields
    ...(v.dvwRaw !== undefined && { dvwRaw: v.dvwRaw }),
    ...(v.scout !== undefined && { scout: v.scout })
  };
}

function mapProfileRow(p) {
  if (!p) return p;
  return {
    id: p.id,
    email: p.email,
    username: p.username,
    name: p.name,
    role: p.role,
    jerseyNumber: p.jersey_number,
    preferences: p.preferences,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  };
}

function mapReviewRow(r) {
  if (!r) return r;
  return {
    id: r.id,
    videoId: r.video_id,
    actionIndex: r.action_index,
    comment: r.comment,
    createdAt: r.created_at,
    acknowledgedAt: r.acknowledged_at,
    coach: r.coach,
    player: r.player
  };
}
