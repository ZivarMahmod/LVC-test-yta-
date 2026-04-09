import { useState, useEffect } from 'react';
import { getScoreboardSettings, saveScoreboardSettings, resetScoreboardSettings } from '../utils/scoreboardSettings.js';
import { useAuth } from '../context/SupabaseAuthContext.jsx';
import { userApi } from '../utils/apiSwitch.js';

export function useScoreboardSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const [settings, setSettings] = useState(() => getScoreboardSettings(userId));

  useEffect(() => {
    // Update local state when user changes
    setSettings(getScoreboardSettings(userId));

    userApi.getPreferences().then(prefs => {
      if (prefs?.scoreboardSettings) {
        const merged = { ...getScoreboardSettings(userId), ...prefs.scoreboardSettings };
        setSettings(merged);
        saveScoreboardSettings(merged, userId);
      } else {
        const defaults = resetScoreboardSettings(userId);
        setSettings(defaults);
      }
    }).catch(() => {});
  }, [userId]);

  function updateSettings(partial) {
    setSettings(prev => {
      const updated = { ...prev, ...partial };
      saveScoreboardSettings(updated, userId);
      userApi.updatePreferences({ scoreboardSettings: updated }).catch(() => {});
      return updated;
    });
  }

  function resetSettings() {
    const defaults = resetScoreboardSettings(userId);
    setSettings(defaults);
    userApi.updatePreferences({ scoreboardSettings: null }).catch(() => {});
  }

  return { settings, updateSettings, resetSettings };
}
