import { useState, useEffect } from 'react';
import { GRADE_SYMBOLS } from '../utils/scoutConstants.js';
import { getGradeSymbols, saveGradeSymbols, resetGradeSymbols } from '../utils/gradeSettings.js';
import { useAuth } from '../context/AuthContext.jsx';
import { userApi } from '../utils/api.js';

export function useGradeSymbols() {
  const { user } = useAuth();
  const userId = user?.id;
  const [gradeSymbols, setGradeSymbols] = useState(() => getGradeSymbols(userId));

  useEffect(() => {
    // Update local state when user changes
    setGradeSymbols(getGradeSymbols(userId));

    userApi.getPreferences().then(prefs => {
      if (prefs?.gradeSymbols) {
        const merged = { ...GRADE_SYMBOLS, ...prefs.gradeSymbols };
        setGradeSymbols(merged);
        saveGradeSymbols(prefs.gradeSymbols, userId);
      } else {
        const defaults = resetGradeSymbols(userId);
        setGradeSymbols(defaults);
      }
    }).catch(() => {});
  }, [userId]);

  function updateSymbol(dvwCode, displaySymbol) {
    setGradeSymbols(prev => {
      const updated = { ...prev, [dvwCode]: displaySymbol };
      saveGradeSymbols(updated, userId);
      userApi.updatePreferences({ gradeSymbols: updated }).catch(() => {});
      return updated;
    });
  }

  function reset() {
    const defaults = resetGradeSymbols(userId);
    setGradeSymbols(defaults);
    userApi.updatePreferences({ gradeSymbols: null }).catch(() => {});
  }

  return { gradeSymbols, updateSymbol, reset };
}
