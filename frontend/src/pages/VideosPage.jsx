// ===========================================
// LVC Media Hub — Videobibliotek
// ===========================================
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { videoApi, teamApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatFileSize } from '../utils/format.js';
import './VideosPage.css';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

export default function VideosPage() {
  const { isAdmin } = useAuth();
  const { teamId, seasonId } = useParams();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [deleting, setDeleting] = useState(null);
  const [groupByOpponent, setGroupByOpponent] = useState(false);
  const [filterMatchType, setFilterMatchType] = useState('own');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (window.innerWidth <= 768) setViewMode('list');
  }, []);
  const thumbnailInputRef = React.useRef(null);
  const [thumbnailVideoId, setThumbnailVideoId] = useState(null);

  const handleThumbnailUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !thumbnailVideoId) return;
    try {
      await videoApi.uploadThumbnail(thumbnailVideoId, file);
      fetchVideos(pagination.page);
    } catch (err) {
      alert('Kunde inte ladda upp thumbnail: ' + err.message);
    }
    setThumbnailVideoId(null);
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
  };
  const [teamName, setTeamName] = useState('');
  const [seasonName, setSeasonName] = useState('');

  useEffect(() => {
    async function fetchMeta() {
      if (!teamId) return;
      try {
        const teamsData = await teamApi.listTeams();
        const team = teamsData.teams.find(t => t.id === parseInt(teamId));
        if (team) setTeamName(team.name);
        if (seasonId) {
          const seasonsData = await teamApi.listSeasons(teamId);
          const season = seasonsData.seasons.find(s => s.id === parseInt(seasonId));
          if (season) setSeasonName(season.name);
        }
      } catch {}
    }
    fetchMeta();
  }, [teamId, seasonId]);

  const fetchVideos = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await videoApi.list(page, 20, search, teamId || null, seasonId || null);
      setVideos(data.videos);
      setPagination(data.pagination);
    } catch {
      setError('Kunde inte hämta videor.');
    } finally {
      setLoading(false);
    }
  }, [search, teamId, seasonId]);

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

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openMultiScout = (ids) => {
    if (ids.length < 1) return;
    navigate('/multi-scout?ids=' + ids.join(','));
  };

  const filteredVideos = filterMatchType === 'all' ? videos : videos.filter(v => (v.matchType || 'own') === filterMatchType);

  const groupedVideos = groupByOpponent
    ? Object.entries(filteredVideos.reduce((acc, v) => {
        const key = v.opponent || 'Okänd';
        if (!acc[key]) acc[key] = [];
        acc[key].push(v);
        return acc;
      }, {})).sort(([a], [b]) => a.localeCompare(b, 'sv'))
    : null;

  const videoTitle = (video) => {
    if ((video.matchType || 'own') === 'opponent') {
      return video.opponent;
    }
    return `LVC vs ${video.opponent}`;
  };

  const matchTypeIcon = (video) => {
    if ((video.matchType || 'own') === 'opponent') {
      return <span title="Motståndaranalys" style={{ fontSize: '0.65rem', background: '#f59e0b', color: '#000', borderRadius: 3, padding: '1px 4px', marginRight: 4, fontWeight: 600 }}>SCOUT</span>;
    }
    return null;
  };

  const renderVideoList = (videosList) => {
    const handleCardClick = (e, video) => {
      if (compareMode) {
        e.preventDefault();
        toggleSelect(video.id);
      }
    };

    if (viewMode === 'grid') {
      return (
        <div className="video-grid">
          {videosList.map(video => (
            <Link key={video.id} to={compareMode ? '#' : `/video/${video.id}`} className="video-card-overlay" onClick={(e) => handleCardClick(e, video)}>
              <div className="video-card-overlay-thumb">
                {compareMode && (
                  <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 5 }}>
                    <input type="checkbox" checked={selectedIds.has(video.id)} readOnly style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                  </div>
                )}
                {video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl + "?t=" + new Date(video.updatedAt).getTime()} alt={video.title} onError={(e) => { e.target.style.display = 'none'; }} />
                ) : null}
                <div className="video-card-overlay-gradient" />
                <div className="video-card-overlay-text">
                  <div className="video-card-overlay-title">{matchTypeIcon(video)}{videoTitle(video)}</div>
                  <div className="video-card-overlay-date">{formatDate(video.matchDate)}</div>
                </div>
                {!compareMode && isAdmin && (
                  <>
                    <button className="video-card-delete" onClick={(e) => { e.preventDefault(); handleDelete(video.id, video.title); }} disabled={deleting === video.id} title="Ta bort">x</button>
                    <button className="video-card-thumb-btn" onClick={(e) => { e.preventDefault(); setThumbnailVideoId(video.id); thumbnailInputRef.current?.click(); }} title="Byt thumbnail">📷</button>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      );
    }
    return (
      <div className="video-list">
        {videosList.map(video => (
          <Link key={video.id} to={compareMode ? '#' : `/video/${video.id}`} className="video-list-item" onClick={(e) => handleCardClick(e, video)}
            style={compareMode && selectedIds.has(video.id) ? { outline: '2px solid var(--primary)', borderRadius: 8 } : {}}
          >
            {compareMode && (
              <div style={{ display: 'flex', alignItems: 'center', marginRight: '0.4rem' }}>
                <input type="checkbox" checked={selectedIds.has(video.id)} readOnly style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
              </div>
            )}
            <div className="video-list-thumb">
              {video.thumbnailUrl ? (
                <img src={video.thumbnailUrl + "?t=" + new Date(video.updatedAt).getTime()} alt={video.title} />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </div>
            <div className="video-list-info">
              <div className="video-list-title">{matchTypeIcon(video)}{videoTitle(video)}</div>
              <div className="video-list-date">{formatDate(video.matchDate)}</div>
            </div>
            {!compareMode && isAdmin && (
              <button className="video-list-delete" onClick={(e) => { e.preventDefault(); handleDelete(video.id, video.title); }} disabled={deleting === video.id}>x</button>
            )}
          </Link>
        ))}
      </div>
    );
  };

  return (
    <>
      <input type="file" ref={thumbnailInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleThumbnailUpload} />
    <div className="videos-page">
      <div className="page-header">
        {teamId && (
          <nav className="videos-breadcrumb">
            <Link to="/">Lag</Link>
            <span className="breadcrumb-sep">›</span>
            {seasonId ? (
              <>
                <Link to={`/team/${teamId}`}>{teamName}</Link>
                <span className="breadcrumb-sep">›</span>
                <span>{seasonName}</span>
              </>
            ) : (
              <span>{teamName}</span>
            )}
          </nav>
        )}
        <div className="page-header-row">
          <div>
            <h1>{seasonId ? seasonName : teamId ? teamName : 'Alla matcher'}</h1>
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

      {seasonId && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`btn-sm ${filterMatchType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMatchType('all')}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6 }}
          >Alla</button>
          <button
            className={`btn-sm ${filterMatchType === 'own' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMatchType('own')}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6 }}
          >Egna matcher</button>
          <button
            className={`btn-sm ${filterMatchType === 'opponent' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMatchType('opponent')}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6 }}
          >Motståndaranalys</button>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
            <button
              className={`btn-sm ${groupByOpponent ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setGroupByOpponent(!groupByOpponent)}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6 }}
            >Gruppera</button>
          </span>
        </div>
      )}

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
      ) : groupByOpponent && groupedVideos ? (
        groupedVideos.map(([opponentName, opponentVideos]) => (
          <div key={opponentName} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: '0.4rem 0.6rem', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{opponentName}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({opponentVideos.length} {opponentVideos.length === 1 ? 'match' : 'matcher'})</span>
              <button
                className="btn-sm btn-secondary"
                onClick={() => openMultiScout(opponentVideos.map(v => v.id))}
                style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: 5 }}
              >Visa alla</button>
            </div>
            {renderVideoList(opponentVideos)}
          </div>
        ))
      ) : (
        renderVideoList(filteredVideos)
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
    </>
  );
}
