import { useState, useEffect } from 'react';
import { settingsApi } from '../../utils/apiSwitch.js';

export default function AdminScoutTab() {
  const [skillNames, setSkillNames] = useState({});
  const [skillLetters, setSkillLetters] = useState({});
  const [skillSaving, setSkillSaving] = useState(false);
  const [skillMsg, setSkillMsg] = useState('');

  const fetchSkillNames = async () => {
    try {
      const data = await settingsApi.getSkillNames();
      if (data?.names) setSkillNames(data.names);
      if (data?.letters) setSkillLetters(data.letters);
    } catch {}
  };

  useEffect(() => {
    fetchSkillNames();
  }, []);

  const handleSaveSkillNames = async () => {
    setSkillSaving(true);
    setSkillMsg('');
    try {
      await settingsApi.updateSkillNames({ names: skillNames, letters: skillLetters });
      setSkillMsg('Sparat!');
      setTimeout(() => setSkillMsg(''), 2000);
    } catch { setSkillMsg('Kunde inte spara'); }
    setSkillSaving(false);
  };

  return (
    <div className="admin-section">
      <h2>Scout — Skill-namn</h2>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Ändra bokstav och visningsnamn. Alla användare ser ändringarna.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '30px 45px 1fr', gap: '0.5rem 0.5rem', alignItems: 'center', maxWidth: 360 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>Kod</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bokstav</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Namn</span>
        {Object.entries(skillNames).map(([key, name]) => (
          <label key={key} style={{ display: 'contents' }}>
            <span style={{ fontWeight: 600, fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>{key}</span>
            <input
              type="text"
              value={skillLetters[key] || key}
              onChange={e => setSkillLetters(prev => ({ ...prev, [key]: e.target.value.toUpperCase().slice(0, 3) }))}
              maxLength={3}
              style={{
                padding: '0.3rem 0.4rem', borderRadius: '6px', textAlign: 'center',
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: '0.85rem', fontWeight: 700
              }}
            />
            <input
              type="text"
              value={name}
              onChange={e => setSkillNames(prev => ({ ...prev, [key]: e.target.value }))}
              style={{
                padding: '0.3rem 0.5rem', borderRadius: '6px',
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: '0.85rem'
              }}
            />
          </label>
        ))}
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn-gold" onClick={handleSaveSkillNames} disabled={skillSaving}>
          {skillSaving ? 'Sparar...' : 'Spara'}
        </button>
        {skillMsg && <span style={{ fontSize: '0.85rem', color: skillMsg === 'Sparat!' ? '#22c55e' : '#ef4444' }}>{skillMsg}</span>}
      </div>
    </div>
  );
}
