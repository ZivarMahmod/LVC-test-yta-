import { useState, useEffect } from 'react';
import { settingsApi } from '../../utils/api.js';

export default function AdminMusicTab() {
  const [musicUrl, setMusicUrl] = useState('');
  const [musicSaving, setMusicSaving] = useState(false);
  const [musicMsg, setMusicMsg] = useState('');

  const fetchMusicUrl = async () => {
    try {
      const data = await settingsApi.getMusicUrl();
      if (data?.url) setMusicUrl(data.url);
    } catch {}
  };

  useEffect(() => {
    fetchMusicUrl();
  }, []);

  const handleSaveMusicUrl = async () => {
    setMusicSaving(true);
    setMusicMsg('');
    try {
      await settingsApi.updateMusicUrl(musicUrl);
      setMusicMsg('Sparat!');
      setTimeout(() => setMusicMsg(''), 2000);
    } catch { setMusicMsg('Kunde inte spara'); }
    setMusicSaving(false);
  };

  return (
    <div className="admin-section">
      <h2>Musik — Spelliste-länk</h2>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Ange URL till musikspellistan (t.ex. Suno). Länken visas som &quot;Musik&quot; i navigeringsmenyn.
      </p>
      <div style={{ maxWidth: 500 }}>
        <input
          type="url"
          placeholder="https://suno.com/playlist/..."
          value={musicUrl}
          onChange={e => setMusicUrl(e.target.value)}
          style={{
            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px',
            border: '1px solid var(--border-default)', background: 'var(--surface-raised)',
            color: 'var(--text-primary)', fontSize: '0.9rem'
          }}
        />
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn-gold" onClick={handleSaveMusicUrl} disabled={musicSaving}>
          {musicSaving ? 'Sparar...' : 'Spara'}
        </button>
        {musicMsg && <span style={{ fontSize: '0.85rem', color: musicMsg === 'Sparat!' ? '#22c55e' : '#ef4444' }}>{musicMsg}</span>}
      </div>
      {musicUrl && (
        <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Nuvarande länk: <a href={musicUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lvc-blue-light)' }}>{musicUrl}</a>
        </p>
      )}
    </div>
  );
}
