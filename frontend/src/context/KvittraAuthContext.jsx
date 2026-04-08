// ===========================================
// Kvittra — Auth Context
// Flow: email → password → OTP → org picker → redirect
// Single auth portal at kvittra.se/login
// ===========================================
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const AuthContext = createContext(null);

// Auth steps
const STEP_EMAIL = 'email';
const STEP_PASSWORD = 'password';
const STEP_OTP = 'otp';
const STEP_ORG_PICKER = 'org_picker';
const STEP_DONE = 'done';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile from organization_members for current org
  const fetchUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      return null;
    }

    // Get basic user info — we store minimal data on the user object
    // Org-specific data (roles, membership) comes from OrgContext
    const profile = {
      id: authUser.id,
      email: authUser.email,
      createdAt: authUser.created_at,
    };

    // Try to get display name from user metadata
    if (authUser.user_metadata) {
      profile.name = authUser.user_metadata.name || authUser.user_metadata.display_name || '';
      profile.username = authUser.user_metadata.username || '';
    }

    setUser(profile);
    return profile;
  }, []);

  // Check session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user).finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            await fetchUserProfile(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  // Step 1: Check if email exists
  const checkEmail = useCallback(async (email) => {
    // We can't check auth.users directly from frontend.
    // Try to sign in with a dummy password — if "Invalid login credentials"
    // the user might exist. Instead, we use a more reliable approach:
    // just proceed to password step. If the user doesn't exist,
    // signInWithPassword will fail with a generic error.
    return { exists: true }; // Always proceed to password step
  }, []);

  // Step 2: Sign in with password
  const signInWithPassword = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: 'Felaktig e-post eller lösenord.' };
    }

    return { success: true, userId: data.user.id, email: data.user.email };
  }, []);

  // Step 3: Request OTP
  const requestOtp = useCallback(async (userId, email) => {
    const { data, error } = await supabase.functions.invoke('generate-otp', {
      body: { userId, email },
    });

    if (error) {
      return { success: false, error: 'Kunde inte skicka verifieringskod.' };
    }

    return { success: true };
  }, []);

  // Step 4: Verify OTP
  const verifyOtp = useCallback(async (userId, code) => {
    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: { userId, code },
    });

    if (error || !data?.success) {
      return { success: false, error: 'Ogiltig eller utgången kod.' };
    }

    return {
      success: true,
      organizations: data.organizations || [],
    };
  }, []);

  // Step 5: Redirect to org subdomain
  const redirectToOrg = useCallback((orgSlug) => {
    const protocol = window.location.protocol;
    // In dev, use query param. In prod, use subdomain.
    if (window.location.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)) {
      window.location.href = `${protocol}//${window.location.host}/?org=${orgSlug}`;
    } else {
      const baseDomain = window.location.hostname.split('.').slice(-2).join('.');
      window.location.href = `${protocol}//${orgSlug}.${baseDomain}`;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) throw new Error('Ej inloggad');

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (verifyError) throw new Error('Nuvarande lösenord är felaktigt');

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) throw new Error(updateError.message || 'Kunde inte byta lösenord');

    return { success: true };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    logout,
    changePassword,
    checkEmail,
    signInWithPassword,
    requestOtp,
    verifyOtp,
    redirectToOrg,
    isAuthenticated: !!user,
    // Auth step constants
    STEP_EMAIL,
    STEP_PASSWORD,
    STEP_OTP,
    STEP_ORG_PICKER,
    STEP_DONE,
  }), [user, loading, logout, changePassword, checkEmail, signInWithPassword, requestOtp, verifyOtp, redirectToOrg]);

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
