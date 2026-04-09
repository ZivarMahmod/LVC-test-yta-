// ===========================================
// Compatibility layer — re-exports useAuth from KvittraAuthContext
// with the same API surface the old pages expect.
// Old pages import { useAuth } from './SupabaseAuthContext' — this makes them work.
// ===========================================
import { createContext, useContext, useMemo } from 'react';
import { useAuth as useKvittraAuth } from './KvittraAuthContext.jsx';
import { useOrg } from './OrgContext.jsx';

// Re-export AuthProvider from Kvittra (main.jsx already uses it)
export { AuthProvider } from './KvittraAuthContext.jsx';

export function useAuth() {
  const kvittraAuth = useKvittraAuth();
  const org = useOrgSafe();

  // Map KvittraAuth + OrgContext to the old API surface
  const roles = org?.roles || [];
  const highestRole = roles.includes('admin') ? 'admin'
    : roles.includes('coach') ? 'coach'
    : roles.includes('uploader') ? 'uploader'
    : roles.includes('player') ? 'viewer'
    : 'viewer';

  // Build a user object that matches what old pages expect
  const user = kvittraAuth.user ? {
    id: kvittraAuth.user.id,
    email: kvittraAuth.user.email,
    name: kvittraAuth.user.name || kvittraAuth.user.email?.split('@')[0] || '',
    username: kvittraAuth.user.username || kvittraAuth.user.email?.split('@')[0] || '',
    role: highestRole,
    jerseyNumber: null,
    preferences: null,
    isActive: true,
  } : null;

  return useMemo(() => ({
    user,
    setUser: () => {},
    loading: kvittraAuth.loading,
    login: kvittraAuth.signInWithPassword,
    logout: kvittraAuth.logout,
    changePassword: kvittraAuth.changePassword,
    checkAuth: () => Promise.resolve(user),
    isAdmin: roles.includes('admin'),
    isUploader: roles.includes('admin') || roles.includes('uploader') || roles.includes('coach'),
    isCoach: roles.includes('admin') || roles.includes('coach'),
    isAuthenticated: !!kvittraAuth.user,
  }), [kvittraAuth, user, roles]);
}

// Safe version of useOrg that doesn't throw if outside OrgProvider
function useOrgSafe() {
  try {
    return useOrg();
  } catch {
    return { roles: [], membership: null };
  }
}
