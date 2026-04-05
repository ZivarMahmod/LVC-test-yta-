const BASE_KEY = 'scoreboardSettings';

const DEFAULTS = {
  visible: true,
  fontSize: 'medium',
  opacity: 0.85,
  position: null,
  pinned: false,
};

function storageKey(userId) {
  return userId ? `${BASE_KEY}_${userId}` : BASE_KEY;
}

export function getScoreboardSettings(userId) {
  try {
    const saved = localStorage.getItem(storageKey(userId));
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveScoreboardSettings(settings, userId) {
  localStorage.setItem(storageKey(userId), JSON.stringify(settings));
}

export function resetScoreboardSettings(userId) {
  localStorage.removeItem(storageKey(userId));
  return { ...DEFAULTS };
}

export { DEFAULTS as SCOREBOARD_DEFAULTS };
