import { useState, useEffect } from 'react';
import { getScoreboardSettings, saveScoreboardSettings, resetScoreboardSettings } from '../utils/scoreboardSettings.js';
import { userApi } from '../utils/api.js';

export function useScoreboardSettings() {
  const [settings, setSettings] = useState(getScoreboardSettings);

  useEffect(() => {
    userApi.getPreferences().then(prefs => {
      if (prefs?.scoreboardSettings) {
        const merged = { ...getScoreboardSettings(), ...prefs.scoreboardSettings };
        setSettings(merged);
        saveScoreboardSettings(merged);
      } else {
        // Användaren har inga sparade inställningar — återställ till default
        const defaults = resetScoreboardSettings();
        setSettings(defaults);
      }
    }).catch(() => {});
  }, []);

  function updateSettings(partial) {
    setSettings(prev => {
      const updated = { ...prev, ...partial };
      saveScoreboardSettings(updated);
      userApi.updatePreferences({ scoreboardSettings: updated }).catch(() => {});
      return updated;
    });
  }

  function resetSettings() {
    const defaults = resetScoreboardSettings();
    setSettings(defaults);
    userApi.updatePreferences({ scoreboardSettings: null }).catch(() => {});
  }

  return { settings, updateSettings, resetSettings };
}
