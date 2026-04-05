import { useState } from 'react';
import { getGradeSymbols, saveGradeSymbols, resetGradeSymbols } from '../utils/gradeSettings.js';

export function useGradeSymbols() {
  const [gradeSymbols, setGradeSymbols] = useState(getGradeSymbols);

  function updateSymbol(dvwCode, displaySymbol) {
    setGradeSymbols(prev => {
      const updated = { ...prev, [dvwCode]: displaySymbol };
      saveGradeSymbols(updated);
      return updated;
    });
  }

  function reset() {
    const defaults = resetGradeSymbols();
    setGradeSymbols(defaults);
  }

  return { gradeSymbols, updateSymbol, reset };
}
