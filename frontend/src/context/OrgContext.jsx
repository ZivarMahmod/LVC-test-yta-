// ===========================================
// CorevoSports — Org Context
// Reads slug from URL path /app/:slug
// Fetches org from kvittra.organizations
// ===========================================
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient.js';

const OrgContext = createContext(null);

// Extract slug from path: /app/lvc → "lvc", /app/lvc/team/123 → "lvc"
function getSlugFromPath(pathname) {
  const match = pathname.match(/^\/app\/([^/]+)/);
  return match ? match[1] : null;
}

function isSuperadminHostname() {
  return window.location.hostname.startsWith('filipadmin.');
}

export function OrgProvider({ children }) {
  const [org, setOrg] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  const slug = useMemo(() => getSlugFromPath(location.pathname), [location.pathname]);
  const isSuperadmin = isSuperadminHostname();
  const isLandingPage = !slug && !isSuperadmin;

  useEffect(() => {
    if (!slug || isSuperadmin) {
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
  }, [slug, isSuperadmin]);

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
