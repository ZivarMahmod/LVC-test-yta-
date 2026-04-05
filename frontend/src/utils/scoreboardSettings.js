const STORAGE_KEY = 'scoreboardSettings';

const DEFAULTS = {
  visible: true,
  fontSize: 'medium',
  opacity: 0.85,
  position: null,
  pinned: false,
};

export function getScoreboardSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveScoreboardSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetScoreboardSettings() {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULTS };
}

export { DEFAULTS as SCOREBOARD_DEFAULTS };
