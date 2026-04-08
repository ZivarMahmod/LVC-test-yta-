// ===========================================
// Kvittra — Feature Flag Hook
// Kollar om en feature är aktiverad för aktuell org
// ===========================================
import { useState, useEffect } from 'react';
import { useOrg } from '../context/OrgContext.jsx';

// Cache för feature-flags (laddas en gång per session)
let featuresCache = null;
let featuresCacheOrg = null;

export function useFeature(featureKey) {
  const { orgSlug } = useOrg();
  const [enabled, setEnabled] = useState(true); // Default: enabled tills vi vet

  useEffect(() => {
    // Om ingen org, visa allt (bakåtkompatibelt med LVC-läge)
    if (!orgSlug) {
      setEnabled(true);
      return;
    }

    // Kolla cache
    if (featuresCache && featuresCacheOrg === orgSlug) {
      const feature = featuresCache[featureKey];
      setEnabled(feature !== undefined ? feature : true);
      return;
    }

    // Hämta features från API
    fetch(`/api/kvittra/features/${orgSlug}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : { features: {} })
      .then(data => {
        featuresCache = data.features || {};
        featuresCacheOrg = orgSlug;
        const feature = featuresCache[featureKey];
        setEnabled(feature !== undefined ? feature : true);
      })
      .catch(() => setEnabled(true));
  }, [featureKey, orgSlug]);

  return enabled;
}

// Lista av alla features för admin-visning
export function useAllFeatures() {
  const { orgSlug } = useOrg();
  const [features, setFeatures] = useState({});

  useEffect(() => {
    if (!orgSlug) return;
    fetch(`/api/kvittra/features/${orgSlug}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : { features: {} })
      .then(data => setFeatures(data.features || {}))
      .catch(() => {});
  }, [orgSlug]);

  return features;
}
