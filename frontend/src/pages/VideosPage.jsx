// ===========================================
// LVC Media Hub — Videobibliotek
// ===========================================
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { videoApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './VideosPage.css';

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

export default function VideosPage() {
  const { isAdmin } = useAuth();
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [deleting, setDeleting] = useState(null);

  const fetchVideos = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await videoApi.list(page, 20, search);
      setVideos(data.videos);
      setPagination(data.pagination);
    } catch {
      setError('Kunde inte hämta videor.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchVideos(1), 300);
    return () => clearTimeout(timer);
  }, [fetchVideos]);

  const handleDelete = async (id, title) => {
    if (!confirm(`Är du säker på att du vill ta bort "${title}"?`)) return;
    setDeleting(id);
    try {
      await videoApi.remove(id);
      setVideos(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="videos-page">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Matcher</h1>
            <p>Matchvideor för Linköpings Volleybollklubb</p>
          </div>
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Rutnät"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Lista"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Sök motståndare, datum..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : videos.length === 0 ? (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <h3>Inga videor {search ? 'hittades' : 'uppladdade ännu'}</h3>
          <p>{search ? 'Prova en annan sökning.' : 'Videor visas här när de laddas upp.'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="video-grid">
          {videos.map(video => (
            <Link key={video.id} to={`/video/${video.id}`} className="video-card card">
              <div className="video-card-thumb">
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div style={{ display: video.thumbnailUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </div>
              </div>
              <div className="video-card-info">
                <div className="video-card-date">{formatDate(video.matchDate)}</div>
                <h3 className="video-card-title">LVC vs {video.opponent}</h3>
                {video.description && (
                  <p className="video-card-desc">{video.description}</p>
                )}
                <div className="video-card-meta">
                  <span>{formatFileSize(video.fileSize)}</span>
                  <span>•</span>
                  <span>{video.uploadedBy?.name}</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  className="video-card-delete"
                  onClick={(e) => { e.preventDefault(); handleDelete(video.id, video.title); }}
                  disabled={deleting === video.id}
                  title="Ta bort"
                >
                  ×
                </button>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Match</th>
                <th>Beskrivning</th>
                <th>Storlek</th>
                <th>Uppladdad av</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {videos.map(video => (
                <tr key={video.id}>
                  <td>{formatDate(video.matchDate)}</td>
                  <td>
                    <Link to={`/video/${video.id}`} className="list-link">
                      LVC vs {video.opponent}
                    </Link>
                  </td>
                  <td className="text-muted">{video.description || '—'}</td>
                  <td className="text-muted">{formatFileSize(video.fileSize)}</td>
                  <td className="text-muted">{video.uploadedBy?.name}</td>
                  {isAdmin && (
                    <td>
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => handleDelete(video.id, video.title)}
                        disabled={deleting === video.id}
                      >
                        Ta bort
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn-secondary btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => fetchVideos(pagination.page - 1)}
          >
            ← Föregående
          </button>
          <span className="pagination-info">
            Sida {pagination.page} av {pagination.totalPages}
          </span>
          <button
            className="btn-secondary btn-sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchVideos(pagination.page + 1)}
          >
            Nästa →
          </button>
        </div>
      )}
    </div>
  );
}
