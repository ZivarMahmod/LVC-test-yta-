// ===========================================
// Kvittra — Organization Context
// Hanterar vilken org användaren är i + roller + branding
// ===========================================
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';

const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [currentOrg, setCurrentOrg] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  // Bestäm org från URL (subdomän) eller localStorage
  const detectOrgSlug = useCallback(() => {
    // Kolla subdomän: lvc.kvittra.se → "lvc"
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'filipadmin') {
      return parts[0];
    }
    // Fallback: kolla localStorage
    return localStorage.getItem('kvittra_org_slug') || null;
  }, []);

  // Hämta org-data från API
  const loadOrg = useCallback(async (slug) => {
    if (!slug || !isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/kvittra/org/${slug}`, { credentials: 'include' });
      if (!res.ok) {
        setCurrentOrg(null);
        setMembership(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCurrentOrg(data.organization);
      setMembership(data.membership);
      localStorage.setItem('kvittra_org_slug', slug);
    } catch {
      setCurrentOrg(null);
      setMembership(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentOrg(null);
      setMembership(null);
      setLoading(false);
      return;
    }
    const slug = detectOrgSlug();
    if (slug) {
      loadOrg(slug);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, detectOrgSlug, loadOrg]);

  // Byt organisation
  const switchOrg = useCallback(async (slug) => {
    setLoading(true);
    await loadOrg(slug);
  }, [loadOrg]);

  const value = useMemo(() => {
    const roles = membership?.roles || [];
    return {
      currentOrg,
      membership,
      loading,
      switchOrg,
      // Roll-hjälpare
      roles,
      isOrgAdmin: roles.includes('admin'),
      isCoach: roles.includes('admin') || roles.includes('coach'),
      isUploader: roles.includes('admin') || roles.includes('coach') || roles.includes('uploader'),
      isPlayer: roles.includes('player'),
      // Högsta rollen (för panel-val)
      primaryRole: roles.includes('admin') ? 'admin'
        : roles.includes('coach') ? 'coach'
        : roles.includes('uploader') ? 'uploader'
        : roles.includes('player') ? 'player'
        : 'viewer',
      // Branding
      branding: currentOrg?.branding_config || {},
      orgName: currentOrg?.name || 'Kvittra',
      orgSlug: currentOrg?.slug || null,
    };
  }, [currentOrg, membership, loading, switchOrg]);

  return (
    <OrgContext.Provider value={value}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg måste användas inom OrgProvider');
  return ctx;
}
