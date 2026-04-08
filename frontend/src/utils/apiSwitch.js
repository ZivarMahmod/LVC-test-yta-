// ===========================================
// LVC Media Hub — API Switchover
// Automatically selects Supabase or Express API based on env vars.
// Import from this file instead of api.js or supabaseApi.js directly.
// ===========================================

const useSupabase = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Dynamic re-export: Supabase when configured, Express otherwise
const apiModule = useSupabase
  ? await import('./supabaseApi.js')
  : await import('./api.js');

export const authApi = apiModule.authApi;
export const videoApi = apiModule.videoApi;
export const adminApi = apiModule.adminApi;
export const reviewApi = apiModule.reviewApi;
export const changelogApi = apiModule.changelogApi;
export const multiScoutApi = apiModule.multiScoutApi;
export const teamApi = apiModule.teamApi;
export const settingsApi = apiModule.settingsApi;
export const userApi = apiModule.userApi;
export const playerStatsApi = apiModule.playerStatsApi;
export const documentApi = apiModule.documentApi;
export const scoutApi = apiModule.scoutApi;
export const inviteApi = apiModule.inviteApi;
export const teamAdminApi = apiModule.teamAdminApi;
