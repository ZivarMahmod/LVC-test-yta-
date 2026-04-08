// ===========================================
// Kvittra — Org Context
// Reads slug from hostname, fetches org from
// kvittra.organizations, provides org data.
// ===========================================
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const OrgContext = createContext(null);

// The main site hostname — this shows the landing page, not an org.
// Set via env or fallback to known values.
const MAIN_HOSTNAMES = [
  'lvcmediahub.corevo.se',
  'kvittra.se',
  'www.kvittra.se',
  import.meta.env.VITE_MAIN_HOSTNAME,
].filter(Boolean);

// Extract slug from hostname: "lvc.corevo.se" → "lvc"
function getSlugFromHostname() {
  const hostname = window.location.hostname;

  // Dev: localhost or IP → use query param ?org=lvc or default
  if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const params = new URLSearchParams(window.location.search);
    return params.get('org') || null;
  }

  // filipadmin.corevo.se or filipadmin.kvittra.se → superadmin
  if (hostname.startsWith('filipadmin.')) {
    return '__superadmin__';
  }

  // Main site hostname → landing page (not an org)
  if (MAIN_HOSTNAMES.includes(hostname)) {
    return null;
  }

  // Bare domain (no subdomain) → landing page
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return null;
  }

  // lvc.corevo.se → "lvc"
  return parts[0];
}

export function OrgProvider({ children }) {
  const [org, setOrg] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const slug = useMemo(() => getSlugFromHostname(), []);
  const isSuperadmin = slug === '__superadmin__';
  const isLandingPage = slug === null;

  useEffect(() => {
    if (!slug || isSuperadmin || isLandingPage) {
      setLoading(false);
      return;
    }

    async function fetchOrg() {
      try {
        const { data, error: fetchError } = await supabase
          .schema('kvittra')
          .from('organizations')
          .select('id, name, slug, branding_config, features_config, is_active')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (fetchError || !data) {
          setError('Organisationen hittades inte');
          setLoading(false);
          return;
        }

        setOrg(data);

        // Fetch current user's membership in this org
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: member } = await supabase
            .schema('kvittra')
            .from('organization_members')
            .select('id, roles, is_active')
            .eq('org_id', data.id)
            .eq('user_id', session.user.id)
            .eq('is_active', true)
            .single();

          setMembership(member || null);
        }
      } catch {
        setError('Kunde inte ladda organisationen');
      } finally {
        setLoading(false);
      }
    }

    fetchOrg();
  }, [slug, isSuperadmin, isLandingPage]);

  // Refresh membership when auth state changes
  useEffect(() => {
    if (!org) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: member } = await supabase
            .schema('kvittra')
            .from('organization_members')
            .select('id, roles, is_active')
            .eq('org_id', org.id)
            .eq('user_id', session.user.id)
            .eq('is_active', true)
            .single();

          setMembership(member || null);
        } else if (event === 'SIGNED_OUT') {
          setMembership(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [org]);

  const value = useMemo(() => ({
    org,
    membership,
    slug,
    loading,
    error,
    isSuperadmin,
    isLandingPage,
    orgId: org?.id || null,
    roles: membership?.roles || [],
    hasRole: (role) => membership?.roles?.includes(role) || false,
    isOrgAdmin: membership?.roles?.includes('admin') || false,
    isOrgCoach: membership?.roles?.includes('admin') || membership?.roles?.includes('coach') || false,
    canUpload: membership?.roles?.includes('admin') || membership?.roles?.includes('coach') || membership?.roles?.includes('uploader') || false,
    isPlayer: membership?.roles?.includes('player') || false,
  }), [org, membership, slug, loading, error, isSuperadmin, isLandingPage]);

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
