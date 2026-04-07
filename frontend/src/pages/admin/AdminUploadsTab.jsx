import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../utils/api.js';

export default function AdminUploadsTab() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.uploadHistory();
      setUploads(data.videos);
    } catch {
      setError('Kunde inte hämta uppladdningshistorik.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  return (
    <div className="admin-section">
      {error && <div className="alert alert-error">{error}</div>}
      <h2>Senaste uppladdningar</h2>
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : uploads.length === 0 ? (
        <div className="empty-state">
          <h3>Inga uppladdningar ännu</h3>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Match</th>
                <th>Uppladdad av</th>
                <th>Storlek</th>
                <th>Uppladdad</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map(v => (
                <tr key={v.id}>
                  <td>{new Date(v.matchDate).toLocaleDateString('sv-SE')}</td>
                  <td>{v.title}</td>
                  <td className="text-muted">{v.uploadedBy?.name} ({v.uploadedBy?.email})</td>
                  <td className="text-muted">
                    {(v.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </td>
                  <td className="text-muted">
                    {new Date(v.createdAt).toLocaleString('sv-SE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
