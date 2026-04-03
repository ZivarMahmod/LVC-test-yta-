// ===========================================
// LVC Media Hub — Auth Context
// ===========================================
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authApi } from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Kontrollera om vi är inloggade vid app-start
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier, password) => {
    const data = await authApi.login(identifier, password);
    if (data.user) {
      setUser(data.user);
      return { success: true };
    }
    return { success: false, error: data.error };
  };

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch { /* ignorera */ }
    setUser(null);
  }, []);

  // Automatisk token-refresh var 13:e minut
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const ok = await authApi.refresh();
      if (!ok) {
        setUser(null);
      }
    }, 13 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const value = useMemo(() => ({
    user,
    setUser,
    checkAuth,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    isUploader: user?.role === 'admin' || user?.role === 'uploader' || user?.role === 'coach',
    isCoach: user?.role === 'admin' || user?.role === 'coach',
    isAuthenticated: !!user
  }), [user, loading, logout]);

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
