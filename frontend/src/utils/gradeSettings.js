import { GRADE_SYMBOLS } from './scoutConstants.js';

const BASE_KEY = 'gradeSymbolSettings';

function storageKey(userId) {
  return userId ? `${BASE_KEY}_${userId}` : BASE_KEY;
}

export function getGradeSymbols(userId) {
  try {
    const saved = localStorage.getItem(storageKey(userId));
    if (saved) return { ...GRADE_SYMBOLS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...GRADE_SYMBOLS };
}

export function saveGradeSymbols(symbols, userId) {
  localStorage.setItem(storageKey(userId), JSON.stringify(symbols));
}

export function resetGradeSymbols(userId) {
  localStorage.removeItem(storageKey(userId));
  return { ...GRADE_SYMBOLS };
}
