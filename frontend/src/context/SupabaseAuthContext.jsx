// ===========================================
// LVC Media Hub — Supabase Auth Context
// Replaces the old Express JWT-based AuthContext.
// Same API surface so the rest of the app works unchanged.
// ===========================================
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile data from the profiles table
  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, username, name, role, jersey_number, preferences, is_active')
      .eq('id', authUser.id)
      .single();

    if (error || !data || !data.is_active) {
      setUser(null);
      return null;
    }

    // Map snake_case to camelCase to match existing app expectations
    const profile = {
      id: data.id,
      email: data.email,
      username: data.username,
      name: data.name,
      role: data.role,
      jerseyNumber: data.jersey_number,
      preferences: data.preferences,
      isActive: data.is_active
    };

    setUser(profile);
    return profile;
  }, []);

  // Listen to auth state changes (login, logout, token refresh)
  useEffect(() => {
    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user).finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            await fetchProfile(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Login: supports both username and email (looks up email via RPC if needed)
  const login = useCallback(async (identifier, password) => {
    try {
      let email = identifier;

      // If identifier doesn't look like an email, look up via RPC
      if (!identifier.includes('@')) {
        const { data, error } = await supabase.rpc('get_email_for_login', {
          identifier
        });

        if (error || !data) {
          return { success: false, error: 'Felaktigt användarnamn eller lösenord.' };
        }
        email = data;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: 'Felaktigt användarnamn eller lösenord.' };
      }

      const profile = await fetchProfile(data.user);
      if (!profile) {
        await supabase.auth.signOut();
        return { success: false, error: 'Kontot är inaktiverat.' };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Ett nätverksfel uppstod. Försök igen.' };
    }
  }, [fetchProfile]);

  // Logout
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    // Supabase Auth: verify current password by re-signing in,
    // then update to new password
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) throw new Error('Ej inloggad');

    // Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword
    });
    if (verifyError) throw new Error('Nuvarande lösenord är felaktigt');

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (updateError) throw new Error(updateError.message || 'Kunde inte byta lösenord');

    return { success: true };
  }, []);

  const value = useMemo(() => ({
    user,
    setUser,
    loading,
    login,
    logout,
    changePassword,
    checkAuth: () => supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) return fetchProfile(session.user);
      setUser(null);
      return null;
    }),
    isAdmin: user?.role === 'admin',
    isUploader: user?.role === 'admin' || user?.role === 'uploader' || user?.role === 'coach',
    isCoach: user?.role === 'admin' || user?.role === 'coach',
    isAuthenticated: !!user
  }), [user, loading, login, logout, changePassword, fetchProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth måste användas inom AuthProvider');
  return ctx;
}
