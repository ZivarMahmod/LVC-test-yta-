// ===========================================
// LVC Media Hub — API (Supabase-only)
// Re-exports all APIs from supabaseApi.js
// ===========================================
export {
  authApi,
  videoApi,
  adminApi,
  reviewApi,
  changelogApi,
  multiScoutApi,
  teamApi,
  settingsApi,
  userApi,
  playerStatsApi,
  documentApi,
  scoutApi,
  inviteApi,
  teamAdminApi,
} from './supabaseApi.js';

// Kvittra multi-tenant API for public pages
import { supabaseKvittra } from './supabaseClient.js';

export const kvittraApi = {
  async getPublicMatches(orgId) {
    const { data, error } = await supabaseKvittra
      .from('matches')
      .select('id, title, match_date, match_type, visibility, teams:team_id(name)')
      .eq('org_id', orgId)
      .eq('visibility', 'public')
      .order('match_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getPublicMatch(matchId) {
    const { data, error } = await supabaseKvittra
      .from('matches')
      .select('id, title, match_date, match_type, visibility, teams:team_id(name), videos(id, storage_url, duration_sec)')
      .eq('id', matchId)
      .eq('visibility', 'public')
      .single();
    if (error) throw error;
    return data;
  },
};
