// ===========================================
// LVC Media Hub — Videospelare med Scout-panel
// ===========================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { videoApi } from '../utils/api.js';
import { scoutApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './VideoPlayerPage.css';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatVideoTime(seconds) {
  if (seconds === null || seconds === undefined) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SKILL_COLORS = {
  S: '#4CAF50', R: '#2196F3', E: '#FF9800',
  A: '#F44336', B: '#9C27B0', D: '#00BCD4',
  F: '#607D8B', O: '#795548'
};

const SKILL_NAMES = {
  S: 'Serve', R: 'Mottagning', E: 'Lyftning',
  A: 'Anfall', B: 'Block', D: 'Försvar',
  F: 'Fritt', O: 'Övrigt'
};

const GRADE_SYMBOLS = {
  '#': '●', '+': '▲', '!': '■', '-': '▼', '/': '✕', '=': '✕'
};

export default function VideoPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  // Scout state
  const [scout, setScout] = useState(null);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [filterSkill, setFilterSkill] = useState('ALL');
  const [filterPlayer, setFilterPlayer] = useState('ALL');
  const [filterSet, setFilterSet] = useState('ALL');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [offset, setOffset] = useState(0);
  const [offsetInput, setOffsetInput] = useState('0');
  const [activeActionId, setActiveActionId] = useState(null);
  const [skipSeconds, setSkipSeconds] = useState(5);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [autoAction, setAutoAction] = useState(false);
  const [scoutTab, setScoutTab] = useState('actions');
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const pendingJump = useRef(false);

  const jumpToPlayerActions = (team, number, skill) => {
    setFilterTeam(team);
    setFilterPlayer(team + '-' + number);
    if (skill) setFilterSkill(skill);
    else setFilterSkill('ALL');
    setScoutTab('actions');
    setAutoAction(true);
    pendingJump.current = true;
  };

  useEffect(() => {
    pendingJump.current = false;
    const filtered = getFilteredActions();
    if (filtered.length > 0) {
      jumpToAction(filtered[0]);
    }
  }, [filterTeam, filterPlayer, filterSkill]);
  const actionListRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await videoApi.getOne(id);
        setVideo(data.video);
        setOffset(data.video.videoOffset || 0);
        setOffsetInput(String(data.video.videoOffset || 0));
      } catch {
        setError('Kunde inte ladda videon.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!video) return;
    async function loadScout() {
      setScoutLoading(true);
      try {
        const data = await scoutApi.getScout(id);
        setScout(data);
      } catch {
        setScout(null);
      } finally {
        setScoutLoading(false);
      }
    }
    loadScout();
  }, [video, id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const vid = videoRef.current;
      if (!vid) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); vid.currentTime = Math.min(vid.currentTime + skipSeconds, vid.duration); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); vid.currentTime = Math.max(vid.currentTime - skipSeconds, 0); }
      else if (e.key === ' ') { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [skipSeconds]);

  // Auto-hoppa till nästa filtrerad action efter delay
  const autoJumpTimer = useRef(null);

  const jumpToAction = useCallback((action) => {
    if (videoRef.current && action.videoTime !== null) {
      videoRef.current.currentTime = action.videoTime;
      videoRef.current.play().catch(() => {});
      setActiveActionId(action.id);

      // Rensa eventuell tidigare timer
      if (autoJumpTimer.current) clearTimeout(autoJumpTimer.current);

      // Hitta nästa action i filtrerad lista
      const filtered = getFilteredActions();
      const currentIdx = filtered.findIndex(a => a.id === action.id);
      const next = filtered[currentIdx + 1];

      if (autoAction && next && next.videoTime !== null) {
        autoJumpTimer.current = setTimeout(() => {
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.currentTime = next.videoTime;
            videoRef.current.play().catch(() => {});
            setActiveActionId(next.id);
            // Starta kedjan vidare
            jumpToAction(next);
          }
        }, 5000);
      }
    }
  }, [scout, filterSkill, filterPlayer, filterSet, filterTeam, autoAction]);

  // Rensa timer vid unmount
  useEffect(() => {
    return () => {
      if (autoJumpTimer.current) clearTimeout(autoJumpTimer.current);
    };
  }, []);

  // Uppdatera aktiv action baserat på videons position (utan auto-hopp)
  useEffect(() => {
    if (!scout || !videoRef.current) return;
    const interval = setInterval(() => {
      const currentTime = videoRef.current?.currentTime;
      if (currentTime === undefined) return;
      const filtered = getFilteredActions();
      let closest = null;
      for (const action of filtered) {
        if (action.videoTime !== null && action.videoTime <= currentTime) {
          closest = action;
        }
      }
      if (closest && closest.id !== activeActionId) {
        setActiveActionId(closest.id);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [scout, activeActionId, filterSkill, filterPlayer, filterSet, filterTeam]);

  const handleSaveOffset = async () => {
    const newOffset = parseInt(offsetInput, 10);
    if (isNaN(newOffset)) return;
    try {
      await scoutApi.updateOffset(id, newOffset);
      setOffset(newOffset);
      // Ladda om scout med ny offset
      const data = await scoutApi.getScout(id);
      setScout(data);
    } catch {}
  };

  const getFilteredActions = () => {
    if (!scout) return [];
    return scout.actions.filter(a => {
      if (filterSkill !== 'ALL' && a.skill !== filterSkill) return false;
      if (filterPlayer !== 'ALL' && (a.team + '-' + a.playerNumber) !== filterPlayer) return false;
      if (filterSet !== 'ALL' && String(a.set) !== filterSet) return false;
      if (filterTeam !== 'ALL' && a.team !== filterTeam) return false;
      return true;
    });
  };

  const getMatchStats = () => {
    if (!scout || !scout.actions.length) return null;
    const stats = { H: { name: scout.teams?.H || 'Hemma', serve: { total: 0, err: 0, pts: 0 }, attack: { total: 0, err: 0, blocked: 0, pts: 0 }, reception: { total: 0, pos: 0, exc: 0, err: 0 }, block: { pts: 0 }, dig: { total: 0, pos: 0, err: 0 }, totalPts: 0, players: {} }, V: { name: scout.teams?.V || 'Borta', serve: { total: 0, err: 0, pts: 0 }, attack: { total: 0, err: 0, blocked: 0, pts: 0 }, reception: { total: 0, pos: 0, exc: 0, err: 0 }, block: { pts: 0 }, dig: { total: 0, pos: 0, err: 0 }, totalPts: 0, players: {} } };

    for (const a of scout.actions) {
      const t = stats[a.team];
      if (!t) continue;
      const pKey = a.team + '-' + a.playerNumber;
      if (!t.players[pKey]) t.players[pKey] = { number: a.playerNumber, name: a.playerName, pts: 0, serve: { total: 0, err: 0, pts: 0 }, attack: { total: 0, err: 0, blocked: 0, pts: 0 }, reception: { total: 0, pos: 0, exc: 0, err: 0 }, block: { pts: 0 }, dig: { total: 0, pos: 0, err: 0 } };
      const p = t.players[pKey];

      if (a.skill === 'S') {
        t.serve.total++; p.serve.total++;
        if (a.grade === '=') { t.serve.err++; p.serve.err++; }
        if (a.grade === '#') { t.serve.pts++; p.serve.pts++; p.pts++; t.totalPts++; }
      } else if (a.skill === 'A') {
        t.attack.total++; p.attack.total++;
        if (a.grade === '=') { t.attack.err++; p.attack.err++; }
        if (a.grade === '#') { t.attack.pts++; p.attack.pts++; p.pts++; t.totalPts++; }
        if (a.grade === '/') { t.attack.blocked++; p.attack.blocked++; }
      } else if (a.skill === 'R') {
        t.reception.total++; p.reception.total++;
        if (a.grade === '#' || a.grade === '+') { t.reception.pos++; p.reception.pos++; }
        if (a.grade === '#') { t.reception.exc++; p.reception.exc++; }
        if (a.grade === '=') { t.reception.err++; p.reception.err++; }
      } else if (a.skill === 'D') {
        t.dig.total++; p.dig.total++;
        if (a.grade === '#' || a.grade === '+') { t.dig.pos++; p.dig.pos++; }
        if (a.grade === '=') { t.dig.err++; p.dig.err++; }
      } else if (a.skill === 'B') {
        if (a.grade === '#') { t.block.pts++; p.block.pts++; p.pts++; t.totalPts++; }
      }
    }
    return stats;
  };

  const handleDelete = async () => {
    if (!confirm(`Är du säker på att du vill ta bort "${video.title}"?`)) return;
    try {
      await videoApi.remove(id);
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (error || !video) {
    return (
      <div className="empty-state">
        <h3>{error || 'Videon kunde inte hittas'}</h3>
        <Link to="/" className="btn-secondary" style={{ marginTop: '1rem', display: 'inline-flex' }}>← Tillbaka</Link>
      </div>
    );
  }

  const filteredActions = getFilteredActions();
  const uniqueSkills = scout ? [...new Set(scout.actions.map(a => a.skill))] : [];
  const uniquePlayers = scout ? [...new Map(scout.actions.filter(a => filterTeam === 'ALL' || a.team === filterTeam).map(a => [a.team + '-' + a.playerNumber, { number: a.playerNumber, team: a.team }])).values()].sort((a, b) => a.number - b.number) : [];
  const uniqueSets = scout ? [...new Set(scout.actions.map(a => a.set))].sort() : [];

  const hasScout = scout && scout.actions.length > 0;

  return (
    <div className="player-page">
      <button onClick={() => navigate(-1)} className="back-link">← Tillbaka</button>

      <div className="player-layout">

        {/* VIDEO + INFO */}
        <div className="player-main">
          <div className="video-title-bar">
            <h1>{video.title}</h1>
            {isAdmin && (
              <button className="btn-danger btn-sm" onClick={handleDelete}>Ta bort</button>
            )}
          </div>
          <div className="player-wrapper">
            <video
              ref={videoRef}
              controls
              autoPlay={true}
              playsInline
              preload="metadata"
              className="video-player"
              key={video.streamUrl}
            >
              <source src={video.streamUrl} type={video.mimeType} />
              Din webbläsare stöder inte videouppspelning.
            </video>
          </div>
        </div>

        {/* SCOUT PANEL */}
        {(hasScout || scoutLoading) && (
          <div style={{
            flex: '0 0 280px',
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column'
          }}>

            {/* Header */}
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button onClick={() => setScoutTab('actions')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: scoutTab === 'actions' ? '1px solid var(--lvc-blue, #1a5fb4)' : '1px solid var(--border-default, #333)', background: scoutTab === 'actions' ? 'rgba(26,95,180,0.15)' : 'transparent', color: scoutTab === 'actions' ? 'var(--lvc-blue-light, #3584e4)' : 'var(--text-muted)', cursor: 'pointer' }}>Actions</button>
                  <button onClick={() => setScoutTab('rapport')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: scoutTab === 'rapport' ? '1px solid var(--lvc-blue, #1a5fb4)' : '1px solid var(--border-default, #333)', background: scoutTab === 'rapport' ? 'rgba(26,95,180,0.15)' : 'transparent', color: scoutTab === 'rapport' ? 'var(--lvc-blue-light, #3584e4)' : 'var(--text-muted)', cursor: 'pointer' }}>Rapport</button>

                </div>
                <button
                  onClick={() => setAutoAction(!autoAction)}
                  style={{
                    padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px',
                    border: autoAction ? '1px solid var(--lvc-green, #3fb950)' : '1px solid var(--border-default)',
                    background: autoAction ? 'rgba(63, 185, 80, 0.15)' : 'var(--surface-raised)',
                    color: autoAction ? 'var(--lvc-green, #3fb950)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {autoAction ? '▶ Auto' : '■ Auto'}
                </button>
                <button
                  className="scout-filter-toggle"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  {filtersOpen ? '▲ Dölj filter' : '▼ Visa filter'}
                </button>
              </div>

              {scoutTab === 'actions' && (
              <div className={filtersOpen ? 'scout-filters scout-filters-open' : 'scout-filters'}>

              {/* Offset (admin) */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Offset (sek):</span>
                  <input
                    type="number"
                    value={offsetInput}
                    onChange={e => setOffsetInput(e.target.value)}
                    style={{
                      width: '70px', padding: '0.25rem 0.5rem', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--surface-2)',
                      color: 'var(--text)', fontSize: '0.85rem'
                    }}
                  />
                  <button
                    onClick={handleSaveOffset}
                    style={{
                      padding: '0.25rem 0.75rem', borderRadius: '6px',
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      cursor: 'pointer', fontSize: '0.8rem'
                    }}
                  >
                    Spara
                  </button>
                </div>
              )}

              {/* Filter: Set */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                <button onClick={() => setFilterSet('ALL')} style={filterBtnStyle(filterSet === 'ALL')}>Alla set</button>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {uniqueSets.map(s => (
                  <button key={s} onClick={() => setFilterSet(String(s))} style={filterBtnStyle(filterSet === String(s))}>{s}</button>
                ))}
              </div>

              {/* Filter: Team */}
              {scout && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <button onClick={() => setFilterTeam('ALL')} style={filterBtnStyle(filterTeam === 'ALL')}>Båda lag</button>
                  <button onClick={() => setFilterTeam('H')} style={filterBtnStyle(filterTeam === 'H')}>{scout.teams?.H || 'Hemma'}</button>
                  <button onClick={() => setFilterTeam('V')} style={filterBtnStyle(filterTeam === 'V')}>{scout.teams?.V || 'Borta'}</button>
                </div>
              )}

              {/* Filter: Skill */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem', alignItems: 'center' }}>
                <button onClick={() => setFilterSkill('ALL')} style={filterBtnStyle(filterSkill === 'ALL')}>Alla</button>
                {uniqueSkills.map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterSkill(s)}
                    title={SKILL_NAMES[s] || s}
                    style={{...filterBtnStyle(filterSkill === s), borderColor: SKILL_COLORS[s] || '#666'}}
                  >
                    {filterSkill === s ? SKILL_NAMES[s] || s : s}
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Skip</span>
                  <select
                    value={skipSeconds}
                    onChange={e => setSkipSeconds(Number(e.target.value))}
                    style={{ padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.78rem' }}
                  >
                    {[1,5,10,30].map(s => <option key={s} value={s}>{s}s</option>)}
                  </select>
                </div>
              </div>

              {/* Filter: Spelare */}
              <select
                value={filterPlayer}
                onChange={e => setFilterPlayer(e.target.value)}
                style={{
                  width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px',
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text)', fontSize: '0.82rem'
                }}
              >
                <option value="ALL">Alla spelare</option>
                {uniquePlayers.map(({ number, team }) => {
                  const key = team + '-' + number;
                  const p = scout.players.find(pl => parseInt(pl.number, 10) === number && pl.team === team);
                  const teamName = scout.teams?.[team] || team;
                  return <option key={key} value={key}>#{number} {p ? p.name : ''} ({teamName})</option>;
                })}
              </select>
              </div>
            )}
            </div>

            {/* Action-lista */}
            {scoutTab === 'actions' && (
            <div ref={actionListRef} style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
              {scoutLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Laddar scout...</div>
              ) : filteredActions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Inga actions</div>
              ) : (
                filteredActions.map(action => (
                  <div
                    key={action.id}
                    onClick={() => jumpToAction(action)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer',
                      marginBottom: '2px',
                      background: activeActionId === action.id ? 'var(--accent-subtle, rgba(99,102,241,0.15))' : 'transparent',
                      border: activeActionId === action.id ? '1px solid var(--accent)' : '1px solid transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* Skill badge */}
                    <span style={{
                      width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0,
                      background: SKILL_COLORS[action.skill] || '#666',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 'bold', color: '#fff'
                    }}>{action.skill}</span>

                    {/* Grade */}
                    <span style={{ fontSize: '0.85rem', width: '16px', textAlign: 'center', color: gradeColor(action.grade) }}>
                      {GRADE_SYMBOLS[action.grade] || action.grade}
                    </span>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        #{action.playerNumber} {action.playerName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Set {action.set} · {action.teamName}
                      </div>
                    </div>

                    {/* Tid */}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatVideoTime(action.videoTime)}
                    </span>
                  </div>
                ))
              )}
            </div>
            )}

            {/* Footer */}
            {hasScout && scoutTab === 'actions' && (
              <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {filteredActions.length} actions
              </div>
            )}

            {/* Rapport-vy */}
            {scoutTab === 'rapport' && (() => {
              const stats = getMatchStats();
              if (!stats) return <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Ingen data</div>;
              const pct = (n, d) => d > 0 ? Math.round(n / d * 100) + '%' : '-';
              const StatBar = ({ label, home, away, higherIsBetter = true }) => {
                const hVal = parseFloat(home) || 0;
                const aVal = parseFloat(away) || 0;
                const hBetter = higherIsBetter ? hVal >= aVal : hVal <= aVal;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0', fontSize: '0.8rem' }}>
                    <span style={{ width: '45px', textAlign: 'right', fontWeight: hBetter ? '700' : '400', color: hBetter ? 'var(--lvc-green, #3fb950)' : 'var(--text-muted)' }}>{home}</span>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ width: '45px', textAlign: 'left', fontWeight: !hBetter ? '700' : '400', color: !hBetter ? 'var(--lvc-green, #3fb950)' : 'var(--text-muted)' }}>{away}</span>
                  </div>
                );
              };

              const hPlayers = Object.values(stats.H.players).sort((a, b) => b.pts - a.pts);
              const vPlayers = Object.values(stats.V.players).sort((a, b) => b.pts - a.pts);

              return (
                <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem' }}>
                  {/* Lagnamn */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: '600' }}>
                    <span>{stats.H.name}</span>
                    <span>{stats.V.name}</span>
                  </div>

                  {/* Nyckeltal */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Poäng</div>
                    <StatBar label="Totalt" home={stats.H.totalPts} away={stats.V.totalPts} />
                    <StatBar label="Serve ace" home={stats.H.serve.pts} away={stats.V.serve.pts} />
                    <StatBar label="Attack" home={stats.H.attack.pts} away={stats.V.attack.pts} />
                    <StatBar label="Block" home={stats.H.block.pts} away={stats.V.block.pts} />

                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Serve</div>
                    <StatBar label="Totalt" home={stats.H.serve.total} away={stats.V.serve.total} />
                    <StatBar label="Aces" home={stats.H.serve.pts} away={stats.V.serve.pts} />
                    <StatBar label="Errors" home={stats.H.serve.err} away={stats.V.serve.err} higherIsBetter={false} />
                    <StatBar label="Miss %" home={pct(stats.H.serve.err, stats.H.serve.total)} away={pct(stats.V.serve.err, stats.V.serve.total)} higherIsBetter={false} />
                    <StatBar label="Ace %" home={pct(stats.H.serve.pts, stats.H.serve.total)} away={pct(stats.V.serve.pts, stats.V.serve.total)} />

                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anfall</div>
                    <StatBar label="Totalt" home={stats.H.attack.total} away={stats.V.attack.total} />
                    <StatBar label="Kill" home={stats.H.attack.pts} away={stats.V.attack.pts} />
                    <StatBar label="Kill %" home={pct(stats.H.attack.pts, stats.H.attack.total)} away={pct(stats.V.attack.pts, stats.V.attack.total)} />
                    <StatBar label="Errors" home={stats.H.attack.err} away={stats.V.attack.err} higherIsBetter={false} />
                    <StatBar label="Blocked" home={stats.H.attack.blocked} away={stats.V.attack.blocked} higherIsBetter={false} />

                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mottagning</div>
                    <StatBar label="Totalt" home={stats.H.reception.total} away={stats.V.reception.total} />
                    <StatBar label="Positiv %" home={pct(stats.H.reception.pos, stats.H.reception.total)} away={pct(stats.V.reception.pos, stats.V.reception.total)} />
                    <StatBar label="Excellent %" home={pct(stats.H.reception.exc, stats.H.reception.total)} away={pct(stats.V.reception.exc, stats.V.reception.total)} />
                    <StatBar label="Errors" home={stats.H.reception.err} away={stats.V.reception.err} higherIsBetter={false} />

                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Försvar</div>
                    <StatBar label="Totalt" home={stats.H.dig.total} away={stats.V.dig.total} />
                    <StatBar label="Positiv %" home={pct(stats.H.dig.pos, stats.H.dig.total)} away={pct(stats.V.dig.pos, stats.V.dig.total)} />
                  </div>

                  {/* Hemmalag spelare */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', marginBottom: '0.3rem', color: 'var(--lvc-blue-light, #3584e4)' }}>{stats.H.name}</div>
                    <div style={{ display: 'flex', gap: '0.4rem', padding: '0.2rem 0.2rem', fontSize: '0.65rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ width: '28px' }}></span>
                      <span style={{ flex: 1 }}>Spelare</span>
                      <span style={{ width: '35px', textAlign: 'right' }}>Pts</span>
                      <span style={{ width: '55px', textAlign: 'right' }}>Anfall</span>
                    </div>
                    {hPlayers.map(p => (
                      <React.Fragment key={'H-' + p.number}>
                        <div onClick={() => setSelectedPlayer(prev => prev && prev.team === 'H' && prev.number === p.number ? null : { ...p, team: 'H', teamName: stats.H.name })} style={{ display: 'flex', gap: '0.4rem', padding: '0.3rem 0.2rem', fontSize: '0.78rem', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                          <span style={{ width: '28px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>#{p.number}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          <span style={{ width: '35px', textAlign: 'right', fontWeight: '700' }}>{p.pts}</span>
                          <span style={{ width: '55px', textAlign: 'right', fontSize: '0.75rem' }}>{p.attack.total > 0 ? pct(p.attack.pts, p.attack.total) : '-'}</span>
                        </div>
                        {selectedPlayer && selectedPlayer.team === 'H' && selectedPlayer.number === p.number && (() => {
                          const sp = selectedPlayer;
                          const StatRow = ({ label, value }) => (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                              <span style={{ fontWeight: '500' }}>{value}</span>
                            </div>
                          );
                          return (
                            <div style={{ background: 'rgba(26,95,180,0.08)', borderRadius: '6px', padding: '0.4rem', marginBottom: '0.3rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem' }}>
                                  <div onClick={() => jumpToPlayerActions(sp.team, sp.number, 'S')} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem', cursor: 'pointer' }}>Serve ▶</div>
                                  <StatRow label="Tot" value={sp.serve.total} />
                                  <StatRow label="Ace" value={sp.serve.pts} />
                                  <StatRow label="Err" value={sp.serve.err} />
                                  <StatRow label="Ace%" value={pct(sp.serve.pts, sp.serve.total)} />
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer' }} onClick={() => jumpToPlayerActions(sp.team, sp.number, 'A')}>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Anfall ▶</div>
                                  <StatRow label="Tot" value={sp.attack.total} />
                                  <StatRow label="Kill" value={sp.attack.pts} />
                                  <StatRow label="Err" value={sp.attack.err} />
                                  <StatRow label="K%" value={pct(sp.attack.pts, sp.attack.total)} />
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer' }} onClick={() => jumpToPlayerActions(sp.team, sp.number, 'R')}>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Mottagning ▶</div>
                                  <StatRow label="Tot" value={sp.reception.total} />
                                  <StatRow label="Pos" value={sp.reception.pos} />
                                  <StatRow label="Exc" value={sp.reception.exc} />
                                  <StatRow label="Pos%" value={pct(sp.reception.pos, sp.reception.total)} />
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer' }} onClick={() => jumpToPlayerActions(sp.team, sp.number, 'D')}>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Block & Försvar ▶</div>
                                  <StatRow label="Block" value={sp.block.pts} />
                                  <StatRow label="Dig" value={sp.dig.total} />
                                  <StatRow label="Dig+" value={sp.dig.pos} />
                                  <StatRow label="D%" value={pct(sp.dig.pos, sp.dig.total)} />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Bortalag spelare */}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', marginBottom: '0.3rem', color: 'var(--lvc-gold, #e8a825)' }}>{stats.V.name}</div>
                    <div style={{ display: 'flex', gap: '0.4rem', padding: '0.2rem 0.2rem', fontSize: '0.65rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ width: '28px' }}></span>
                      <span style={{ flex: 1 }}>Spelare</span>
                      <span style={{ width: '35px', textAlign: 'right' }}>Pts</span>
                      <span style={{ width: '55px', textAlign: 'right' }}>Anfall</span>
                    </div>
                    {vPlayers.map(p => (
                      <React.Fragment key={'V-' + p.number}>
                        <div onClick={() => setSelectedPlayer(prev => prev && prev.team === 'V' && prev.number === p.number ? null : { ...p, team: 'V', teamName: stats.V.name })} style={{ display: 'flex', gap: '0.4rem', padding: '0.3rem 0.2rem', fontSize: '0.78rem', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                          <span style={{ width: '28px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>#{p.number}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          <span style={{ width: '35px', textAlign: 'right', fontWeight: '700' }}>{p.pts}</span>
                          <span style={{ width: '55px', textAlign: 'right', fontSize: '0.75rem' }}>{p.attack.total > 0 ? pct(p.attack.pts, p.attack.total) : '-'}</span>
                        </div>
                        {selectedPlayer && selectedPlayer.team === 'V' && selectedPlayer.number === p.number && (() => {
                          const sp = selectedPlayer;
                          const StatRow = ({ label, value }) => (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                              <span style={{ fontWeight: '500' }}>{value}</span>
                            </div>
                          );
                          return (
                            <div style={{ background: 'rgba(232,168,37,0.08)', borderRadius: '6px', padding: '0.4rem', marginBottom: '0.3rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem' }}>
                                  <div onClick={() => jumpToPlayerActions(sp.team, sp.number, 'S')} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem', cursor: 'pointer' }}>Serve ▶</div>
                                  <StatRow label="Tot" value={sp.serve.total} />
                                  <StatRow label="Ace" value={sp.serve.pts} />
                                  <StatRow label="Err" value={sp.serve.err} />
                                  <StatRow label="Ace%" value={pct(sp.serve.pts, sp.serve.total)} />
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer' }} onClick={() => jumpToPlayerActions(sp.team, sp.number, 'A')}>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Anfall ▶</div>
                                  <StatRow label="Tot" value={sp.attack.total} />
                                  <StatRow label="Kill" value={sp.attack.pts} />
                                  <StatRow label="Err" value={sp.attack.err} />
                                  <StatRow label="K%" value={pct(sp.attack.pts, sp.attack.total)} />
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer' }} onClick={() => jumpToPlayerActions(sp.team, sp.number, 'R')}>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Mottagning ▶</div>
                                  <StatRow label="Tot" value={sp.reception.total} />
                                  <StatRow label="Pos" value={sp.reception.pos} />
                                  <StatRow label="Exc" value={sp.reception.exc} />
                                  <StatRow label="Pos%" value={pct(sp.reception.pos, sp.reception.total)} />
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer' }} onClick={() => jumpToPlayerActions(sp.team, sp.number, 'D')}>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Block & Försvar ▶</div>
                                  <StatRow label="Block" value={sp.block.pts} />
                                  <StatRow label="Dig" value={sp.dig.total} />
                                  <StatRow label="Dig+" value={sp.dig.pos} />
                                  <StatRow label="D%" value={pct(sp.dig.pos, sp.dig.total)} />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function filterBtnStyle(active) {
  return {
    padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'var(--surface-2)',
    color: active ? '#fff' : 'var(--text-muted)',
    cursor: 'pointer', fontSize: '0.78rem'
  };
}

function gradeColor(grade) {
  if (grade === '#' || grade === '+') return '#4CAF50';
  if (grade === '!') return '#FF9800';
  if (grade === '-' || grade === '/' || grade === '=') return '#F44336';
  return 'var(--text-muted)';
}
