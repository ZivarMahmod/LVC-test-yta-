// ===========================================
// LVC Media Hub — Analyssida
// Välj matcher att analysera i flermatchsvy
// ===========================================
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { videoApi, teamApi } from '../utils/api.js';
import './VideosPage.css';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [filterTeam, setFilterTeam] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterMatchType, setFilterMatchType] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [groupByOpponent, setGroupByOpponent] = useState(false);

  useEffect(() => {
    teamApi.listTeams().then(d => setTeams(d.teams || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (filterTeam) {
      teamApi.listSeasons(filterTeam).then(d => setSeasons(d.seasons || [])).catch(() => {});
    } else {
      setSeasons([]);
      setFilterSeason('');
    }
  }, [filterTeam]);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      // Hämta alla sidor (max 50 per sida pga backend-validering)
      let allVideos = [];
      let page = 1;
      let totalPages = 1;
      do {
        const data = await videoApi.list(page, 50, search, filterTeam || null, filterSeason || null);
        allVideos = allVideos.concat(data.videos || []);
        totalPages = data.pagination?.totalPages || 1;
        page++;
      } while (page <= totalPages);
      setVideos(allVideos);
    } catch {
      setVideos([]);
    }
    setLoading(false);
  }, [search, filterTeam, filterSeason]);

  useEffect(() => {
    const timer = setTimeout(fetchVideos, 300);
    return () => clearTimeout(timer);
  }, [fetchVideos]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const filtered = getFilteredVideos();
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(v => v.id)));
    }
  };

  const openAnalysis = (ids) => {
    if (ids.length < 1) return;
    navigate('/multi-scout?ids=' + ids.join(','));
  };

  const getFilteredVideos = () => {
    let filtered = videos;
    if (filterMatchType !== 'all') {
      filtered = filtered.filter(v => (v.matchType || 'own') === filterMatchType);
    }
    return filtered;
  };

  const filteredVideos = getFilteredVideos();

  const groupedVideos = groupByOpponent
    ? Object.entries(filteredVideos.reduce((acc, v) => {
        const key = v.opponent || 'Okänd';
        if (!acc[key]) acc[key] = [];
        acc[key].push(v);
        return acc;
      }, {})).sort(([a], [b]) => a.localeCompare(b, 'sv'))
    : null;

  const selectStyle = {
    padding: '0.4rem 0.6rem', borderRadius: 6, fontSize: '0.82rem',
    border: '1px solid var(--border)', background: 'var(--surface-2)',
    color: 'var(--text)'
  };

  return (
    <div className="videos-page">
      <div className="page-header">
        <h1>Analys</h1>
        <p>Välj matcher att analysera tillsammans</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterTeam} onChange={e => { setFilterTeam(e.target.value); setFilterSeason(''); }} style={selectStyle}>
          <option value="">Alla lag</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {seasons.length > 0 && (
          <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)} style={selectStyle}>
            <option value="">Alla säsonger</option>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select value={filterMatchType} onChange={e => setFilterMatchType(e.target.value)} style={selectStyle}>
          <option value="all">Alla typer</option>
          <option value="own">Egna matcher</option>
          <option value="opponent">Motståndaranalys</option>
        </select>

        <div className="search-bar" style={{ flex: 1, minWidth: 150 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Sök motståndare..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: '0.82rem' }}
          />
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn-sm btn-secondary"
          onClick={selectAll}
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6 }}
        >{selectedIds.size === filteredVideos.length && filteredVideos.length > 0 ? 'Avmarkera alla' : 'Välj alla'}</button>
        <button
          className={`btn-sm ${groupByOpponent ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setGroupByOpponent(!groupByOpponent)}
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6 }}
        >Gruppera</button>

        {selectedIds.size > 0 && (
          <button
            className="btn-sm btn-primary"
            onClick={() => openAnalysis([...selectedIds])}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6 }}
          >Analysera {selectedIds.size} matcher</button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {filteredVideos.length} matcher
        </span>
      </div>

      {/* Video list */}
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : filteredVideos.length === 0 ? (
        <div className="empty-state">
          <h3>Inga matcher hittades</h3>
          <p>Prova att ändra filter eller ladda upp matcher med DVW-filer.</p>
        </div>
      ) : groupByOpponent && groupedVideos ? (
        groupedVideos.map(([opponent, vids]) => (
          <div key={opponent} style={{ marginBottom: '1.25rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem',
              padding: '0.4rem 0.6rem', background: 'var(--surface-2)', borderRadius: 8,
              border: '1px solid var(--border)'
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{opponent}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ({vids.length} {vids.length === 1 ? 'match' : 'matcher'})
              </span>
              <button
                className="btn-sm btn-secondary"
                onClick={() => openAnalysis(vids.map(v => v.id))}
                style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: 5 }}
              >Analysera alla</button>
            </div>
            {renderList(vids)}
          </div>
        ))
      ) : (
        renderList(filteredVideos)
      )}
    </div>
  );

  function renderList(list) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {list.map(video => {
          const selected = selectedIds.has(video.id);
          const title = (video.matchType || 'own') === 'opponent'
            ? video.opponent
            : `LVC vs ${video.opponent}`;
          return (
            <div
              key={video.id}
              onClick={() => toggleSelect(video.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.5rem 0.6rem', borderRadius: 6, cursor: 'pointer',
                background: selected ? 'rgba(59,130,246,0.1)' : 'var(--surface-2)',
                border: selected ? '1px solid var(--primary)' : '1px solid transparent',
                transition: 'background 0.15s'
              }}
            >
              <input type="checkbox" checked={selected} readOnly
                style={{ width: 16, height: 16, accentColor: 'var(--primary)', flexShrink: 0 }} />
              {video.thumbnailUrl && (
                <img src={video.thumbnailUrl} alt="" style={{
                  width: 48, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0
                }} onError={(e) => { e.target.style.display = 'none'; }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(video.matchType || 'own') === 'opponent' && (
                    <span style={{ fontSize: '0.6rem', background: '#f59e0b', color: '#000', borderRadius: 3, padding: '1px 4px', marginRight: 4, fontWeight: 600 }}>SCOUT</span>
                  )}
                  {title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatDate(video.matchDate)}
                  {video.team && <span> · {video.team.name}</span>}
                  {video.season && <span> · {video.season.name}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}
