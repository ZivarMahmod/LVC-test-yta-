import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi } from '../../utils/apiSwitch.js';

export default function AdminThumbsTab() {
  const [thumbLibrary, setThumbLibrary] = useState([]);
  const [thumbTeamId, setThumbTeamId] = useState('');
  const [thumbFilterTeam, setThumbFilterTeam] = useState('');
  const [teams, setTeams] = useState([]);
  const thumbInputRef = useRef(null);

  const fetchThumbLibrary = useCallback(async () => {
    try {
      const data = await adminApi.getThumbnailLibrary();
      setThumbLibrary(data.thumbnails || []);
    } catch {}
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const teamsData = await adminApi.listTeams();
      setTeams(teamsData.teams);
    } catch {}
  }, []);

  useEffect(() => {
    fetchThumbLibrary();
    fetchTeams();
  }, [fetchThumbLibrary, fetchTeams]);

  const handleUploadThumb = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !thumbTeamId) return;
    try {
      for (const file of files) {
        await adminApi.uploadThumbnailLibrary(file, thumbTeamId);
      }
      fetchThumbLibrary();
    } catch {}
    e.target.value = '';
  };

  const handleDeleteThumb = async (id) => {
    if (!confirm('Ta bort denna thumbnail?')) return;
    try {
      await adminApi.deleteThumbnailLibrary(id);
      fetchThumbLibrary();
    } catch {}
  };

  return (
    <div className="admin-section">
      <h2 style={{ marginBottom: '1rem' }}>Thumbnail-bibliotek</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Ladda upp thumbnails per lag. Filnamnet blir motståndarnamnet (t.ex. Gislaved.jpg).
      </p>

      {/* Upload */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select
          id="thumbTeam"
          value={thumbTeamId}
          onChange={(e) => { setThumbTeamId(e.target.value); }}
          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.88rem' }}
        >
          <option value="">Välj lag</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn-primary btn-sm" disabled={!thumbTeamId} onClick={() => thumbInputRef.current?.click()}>
          + Ladda upp bilder
        </button>
        <input ref={thumbInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={handleUploadThumb} hidden />
      </div>

      {/* Filter per lag */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setThumbFilterTeam('')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: !thumbFilterTeam ? '1px solid var(--lvc-blue)' : '1px solid var(--border)', background: !thumbFilterTeam ? 'rgba(26,95,180,0.15)' : 'transparent', color: !thumbFilterTeam ? 'var(--lvc-blue-light)' : 'var(--text-muted)', cursor: 'pointer' }}>Alla</button>
        {teams.map(t => (
          <button key={t.id} onClick={() => setThumbFilterTeam(String(t.id))} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: thumbFilterTeam === String(t.id) ? '1px solid var(--lvc-blue)' : '1px solid var(--border)', background: thumbFilterTeam === String(t.id) ? 'rgba(26,95,180,0.15)' : 'transparent', color: thumbFilterTeam === String(t.id) ? 'var(--lvc-blue-light)' : 'var(--text-muted)', cursor: 'pointer' }}>{t.name}</button>
        ))}
      </div>

      {/* Grid */}
      {thumbLibrary.filter(t => !thumbFilterTeam || String(t.teamId) === thumbFilterTeam).length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Inga thumbnails.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
          {thumbLibrary.filter(t => !thumbFilterTeam || String(t.teamId) === thumbFilterTeam).map(t => (
            <div key={t.id} style={{
              borderRadius: '8px', overflow: 'hidden',
              border: '1px solid var(--border)', background: 'var(--surface)'
            }}>
              <img
                src={`/api/thumbnail-library/image/${t.filePath}`}
                alt={t.name}
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ padding: '0.4rem 0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.78rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.team?.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteThumb(t.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--lvc-red)', cursor: 'pointer', fontSize: '0.9rem', padding: '0.1rem 0.3rem' }}
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
