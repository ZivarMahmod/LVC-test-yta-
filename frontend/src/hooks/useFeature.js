// ===========================================
// Kvittra — useFeature hook
// Checks features_config for the current org.
// Returns isEnabled(featureKey) function.
// ===========================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient.js';
import { useOrg } from '../context/OrgContext.jsx';

// Cache features in memory to avoid re-fetching on every component mount
let featuresCache = null;
let featuresCacheOrgId = null;

export function useFeature() {
  const { orgId } = useOrg();
  const [features, setFeatures] = useState(featuresCache || {});
  const [loading, setLoading] = useState(!featuresCache);

  useEffect(() => {
    // Return cached if same org
    if (featuresCache && featuresCacheOrgId === orgId) {
      setFeatures(featuresCache);
      setLoading(false);
      return;
    }

    async function fetchFeatures() {
      try {
        // Fetch global features (org_id IS NULL) + org-specific features
        const { data, error } = await supabase
          .schema('kvittra')
          .from('features_config')
          .select('org_id, feature_key, is_enabled, config')
          .or(`org_id.is.null,org_id.eq.${orgId}`);

        if (error) {
          console.error('Could not fetch features:', error);
          setLoading(false);
          return;
        }

        // Build lookup: org-specific overrides global
        const lookup = {};
        // First, set global features
        for (const f of (data || [])) {
          if (f.org_id === null) {
            lookup[f.feature_key] = {
              enabled: f.is_enabled,
              config: f.config || {},
            };
          }
        }
        // Then, override with org-specific
        for (const f of (data || [])) {
          if (f.org_id === orgId) {
            lookup[f.feature_key] = {
              enabled: f.is_enabled,
              config: f.config || {},
            };
          }
        }

        featuresCache = lookup;
        featuresCacheOrgId = orgId;
        setFeatures(lookup);
      } catch {
        console.error('Feature fetch failed');
      } finally {
        setLoading(false);
      }
    }

    if (orgId) {
      fetchFeatures();
    } else {
      setLoading(false);
    }
  }, [orgId]);

  const isEnabled = useCallback((featureKey) => {
    const feature = features[featureKey];
    if (!feature) return false;
    return feature.enabled;
  }, [features]);

  const getConfig = useCallback((featureKey) => {
    const feature = features[featureKey];
    if (!feature) return {};
    return feature.config;
  }, [features]);

  return useMemo(() => ({
    isEnabled,
    getConfig,
    loading,
    features,
  }), [isEnabled, getConfig, loading, features]);
}
