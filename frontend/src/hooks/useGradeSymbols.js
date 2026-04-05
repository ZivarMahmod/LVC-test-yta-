import { useState, useEffect } from 'react';
import { GRADE_SYMBOLS } from '../utils/scoutConstants.js';
import { getGradeSymbols, saveGradeSymbols, resetGradeSymbols } from '../utils/gradeSettings.js';
import { userApi } from '../utils/api.js';

export function useGradeSymbols() {
  const [gradeSymbols, setGradeSymbols] = useState(getGradeSymbols);

  // Sync from backend on mount
  useEffect(() => {
    userApi.getPreferences().then(prefs => {
      if (prefs?.gradeSymbols) {
        const merged = { ...GRADE_SYMBOLS, ...prefs.gradeSymbols };
        setGradeSymbols(merged);
        saveGradeSymbols(prefs.gradeSymbols);
      }
    }).catch(() => {});
  }, []);

  function updateSymbol(dvwCode, displaySymbol) {
    setGradeSymbols(prev => {
      const updated = { ...prev, [dvwCode]: displaySymbol };
      saveGradeSymbols(updated);
      userApi.updatePreferences({ gradeSymbols: updated }).catch(() => {});
      return updated;
    });
  }

  function reset() {
    const defaults = resetGradeSymbols();
    setGradeSymbols(defaults);
    userApi.updatePreferences({ gradeSymbols: null }).catch(() => {});
  }

  return { gradeSymbols, updateSymbol, reset };
}
