import { GRADE_SYMBOLS } from './scoutConstants.js';

const STORAGE_KEY = 'gradeSymbolSettings';

export function getGradeSymbols() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...GRADE_SYMBOLS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...GRADE_SYMBOLS };
}

export function saveGradeSymbols(symbols) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
}

export function resetGradeSymbols() {
  localStorage.removeItem(STORAGE_KEY);
  return { ...GRADE_SYMBOLS };
}
