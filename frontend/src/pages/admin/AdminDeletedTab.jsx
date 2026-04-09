import { useState, useEffect, useCallback } from 'react';
import { adminApi, videoApi } from '../../utils/apiSwitch.js';

export default function AdminDeletedTab() {
  const [deletedVideos, setDeletedVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDeletedVideos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getDeletedVideos();
      setDeletedVideos(data.videos || []);
    } catch {
      setError('Kunde inte hamta borttagna videor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeletedVideos();
  }, [fetchDeletedVideos]);

  return (
    <div className="admin-section">
      {error && <div className="alert alert-error">{error}</div>}
      <h2>Borttagna videor</h2>
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : deletedVideos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Inga borttagna videor.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {deletedVideos.map(v => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.75rem 1rem', borderRadius: '8px',
              background: 'var(--surface)', border: '1px solid var(--border)'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{v.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Borttagen {new Date(v.deletedAt).toLocaleDateString('sv-SE')} av {v.uploadedBy?.name || 'okand'}
                </div>
              </div>
              <button className="btn-primary btn-sm" onClick={async () => {
                try {
                  await videoApi.restore(v.id);
                  fetchDeletedVideos();
                } catch (err) { alert(err.message); }
              }}>Återställ</button>
              <button className="btn-danger btn-sm" onClick={async () => {
                if (!confirm('Radera permanent? Filen tas bort fran NAS.')) return;
                try {
                  await videoApi.permanentDelete(v.id);
                  fetchDeletedVideos();
                } catch (err) { alert(err.message); }
              }}>Radera</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
