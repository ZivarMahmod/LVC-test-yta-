// ===========================================
// Kvittra — Branding Context
// Reads branding_config from org, applies CSS
// variables to :root. Fetched once at load.
// ===========================================
import { createContext, useContext, useEffect, useMemo } from 'react';
import { useOrg } from './OrgContext.jsx';

const BrandingContext = createContext(null);

// Default branding (dark blue — LVC template)
const DEFAULT_BRANDING = {
  logo_url: null,
  primary_color: '#1a5fb4',
  secondary_color: '#e8a825',
  background_color: '#0a1628',
  surface_color: '#111f3a',
  text_color: '#f4f5f7',
  font: "'DM Sans', system-ui, sans-serif",
  org_name: 'Kvittra',
};

function applyBrandingToCSS(branding) {
  const root = document.documentElement;
  const b = { ...DEFAULT_BRANDING, ...branding };

  root.style.setProperty('--brand-primary', b.primary_color);
  root.style.setProperty('--brand-secondary', b.secondary_color);
  root.style.setProperty('--brand-bg', b.background_color);
  root.style.setProperty('--brand-surface', b.surface_color);
  root.style.setProperty('--brand-text', b.text_color);
  root.style.setProperty('--brand-font', b.font);
}

export function BrandingProvider({ children }) {
  const { org } = useOrg();

  const branding = useMemo(() => {
    if (!org?.branding_config) return DEFAULT_BRANDING;
    return { ...DEFAULT_BRANDING, ...org.branding_config };
  }, [org]);

  // Apply CSS variables when branding changes
  useEffect(() => {
    applyBrandingToCSS(branding);
  }, [branding]);

  const value = useMemo(() => ({
    ...branding,
    logoUrl: branding.logo_url,
    primaryColor: branding.primary_color,
    secondaryColor: branding.secondary_color,
    backgroundColor: branding.background_color,
    surfaceColor: branding.surface_color,
    textColor: branding.text_color,
    orgName: org?.name || branding.org_name,
  }), [branding, org]);

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding måste användas inom BrandingProvider');
  return ctx;
}
