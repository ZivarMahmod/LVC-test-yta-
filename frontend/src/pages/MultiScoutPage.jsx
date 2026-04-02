// ===========================================
// LVC Media Hub — Flermatchsvy (Multi-Scout)
// ===========================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { multiScoutApi, videoApi, settingsApi } from '../utils/api.js';
import CourtHeatmap from '../components/player/CourtHeatmap.jsx';
import './VideoPlayerPage.css';

const SKILL_COLORS = {
  S: '#4CAF50', R: '#2196F3', P: '#FF9800',
  A: '#F44336', B: '#9C27B0', D: '#00BCD4',
  G: '#607D8B', O: '#795548'
};

const DEFAULT_SKILL_NAMES = {
  S: 'Serve', R: 'Mottagning', P: 'Pass',
  A: 'Anfall', B: 'Block', D: 'Försvar',
  G: 'Gratisboll', O: 'Övrigt'
};

const GRADE_SYMBOLS = {
  '#': '●', '+': '▲', '!': '■', '-': '▼', '/': '✕', '=': '✕'
};

const GRADE_COLORS = {
  '#': '#4CAF50', '+': '#8BC34A', '!': '#FF9800', '-': '#FF5722', '/': '#f44336', '=': '#f44336'
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

export default function MultiScoutPage() {
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterSkill, setFilterSkill] = useState('ALL');
  const [filterPlayer, setFilterPlayer] = useState('ALL');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [filterStartZone, setFilterStartZone] = useState('ALL');
  const [filterEndZone, setFilterEndZone] = useState('ALL');
  const [filterMatch, setFilterMatch] = useState('ALL');

  // Video player
  const [activeAction, setActiveAction] = useState(null);
  const [videoData, setVideoData] = useState(null); // { id, streamUrl, mimeType }
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef(null);
  const videoCache = useRef({}); // videoId → { streamUrl, mimeType }

  // Tab
  const [activeTab, setActiveTab] = useState('actions');

  // Heatmap overlay (Ctrl+Z)
  const [heatmapOverlay, setHeatmapOverlay] = useState(false);
  const [overlayPos, setOverlayPos] = useState({ x: 20, y: 60 });
  const dragRef = useRef(null);

  // Skill names
  const [SKILL_NAMES, setSkillNames] = useState(DEFAULT_SKILL_NAMES);
  const [SKILL_LETTERS, setSkillLetters] = useState({});

  useEffect(() => {
    settingsApi.getSkillNames().then(d => {
      if (d?.names) setSkillNames(d.names);
      if (d?.letters) setSkillLetters(d.letters);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (ids.length === 0) { setError('Inga matcher valda.'); setLoading(false); return; }
    setLoading(true);
    multiScoutApi.fetch(ids).then(d => {
      setData(d);
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, [searchParams.get('ids')]);

  // Ctrl+Z toggle heatmap overlay
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        setHeatmapOverlay(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Drag logic for overlay
  const handleDragStart = (e) => {
    e.preventDefault();
    const startX = e.clientX - overlayPos.x;
    const startY = e.clientY - overlayPos.y;
    const onMove = (ev) => {
      ev.preventDefault();
      setOverlayPos({ x: ev.clientX - startX, y: ev.clientY - startY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Koppla zonfilter till heatmap highlight
  const highlightZone = filterStartZone !== 'ALL' ? parseInt(filterStartZone, 10) : null;

  const handleHeatmapZoneSelect = (zoneId) => {
    if (zoneId) {
      setFilterStartZone(String(zoneId));
    } else {
      setFilterStartZone('ALL');
    }
  };

  const getFilteredActions = useCallback(() => {
    if (!data) return [];
    return data.actions.filter(a => {
      if (filterSkill !== 'ALL' && a.skill !== filterSkill) return false;
      if (filterPlayer !== 'ALL' && (a.playerNumber + '-' + a.playerName) !== filterPlayer) return false;
      if (filterTeam !== 'ALL' && a.team !== filterTeam) return false;
      if (filterGrade !== 'ALL') {
        if (filterGrade === 'ERR') { if (a.grade !== '/' && a.grade !== '=') return false; }
        else if (a.grade !== filterGrade) return false;
      }
      if (filterStartZone !== 'ALL' && String(a.startZone) !== filterStartZone) return false;
      if (filterEndZone !== 'ALL' && String(a.endZone) !== filterEndZone) return false;
      if (filterMatch !== 'ALL' && a.videoId !== filterMatch) return false;
      return true;
    });
  }, [data, filterSkill, filterPlayer, filterTeam, filterGrade, filterStartZone, filterEndZone, filterMatch]);

  const filteredActions = getFilteredActions();

  // Klicka action → ladda video och hoppa till rätt tid
  const handleActionClick = async (action) => {
    setActiveAction(action);

    // Kolla om vi redan har video-URL cachad
    if (videoCache.current[action.videoId]) {
      const cached = videoCache.current[action.videoId];
      setVideoData({ id: action.videoId, ...cached });
      // Seek efter att video laddats
      requestAnimationFrame(() => {
        if (videoRef.current && action.videoTime != null) {
          videoRef.current.currentTime = action.videoTime;
          videoRef.current.play().catch(() => {});
        }
      });
      return;
    }

    setVideoLoading(true);
    try {
      const res = await videoApi.getOne(action.videoId);
      const vd = { streamUrl: res.video.streamUrl, mimeType: res.video.mimeType };
      videoCache.current[action.videoId] = vd;
      setVideoData({ id: action.videoId, ...vd });
    } catch {
      setError('Kunde inte ladda video');
    }
    setVideoLoading(false);
  };

  // Seek to action time when video loads or changes
  useEffect(() => {
    if (videoRef.current && activeAction?.videoTime != null && videoData) {
      const seekAndPlay = () => {
        videoRef.current.currentTime = activeAction.videoTime;
        videoRef.current.play().catch(() => {});
      };
      if (videoRef.current.readyState >= 1) {
        seekAndPlay();
      } else {
        videoRef.current.addEventListener('loadedmetadata', seekAndPlay, { once: true });
      }
    }
  }, [videoData, activeAction]);

  // Unika spelare & skills
  const uniquePlayers = data ? [...new Map(data.actions
    .filter(a => filterTeam === 'ALL' || a.team === filterTeam)
    .map(a => [a.playerNumber + '-' + a.playerName, { number: a.playerNumber, team: a.team, name: a.playerName }])
  ).values()].sort((a, b) => a.number - b.number) : [];

  const uniqueSkills = data ? [...new Set(data.actions.map(a => a.skill))] : [];

  const skills = ['S', 'R', 'P', 'A', 'B', 'D', 'G', 'O'].filter(s => uniqueSkills.includes(s));

  const selectStyle = {
    flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
    border: '1px solid var(--border)', background: 'var(--surface-2)',
    color: 'var(--text)', fontSize: '0.78rem'
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  return (
    <div className="video-player-page">
      <nav style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)' }}>Tillbaka</Link>
        <span style={{ color: 'var(--text-muted)', margin: '0 0.5rem' }}>›</span>
        <span>Flermatchsvy ({data.matches.length} matcher)</span>
      </nav>

      <div className="scout-layout" style={{ display: 'flex', gap: '0.75rem', padding: '0 1rem 1rem' }}>
        {/* Vänster: Video + Heatmap */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Inbäddad videospelare */}
          {activeAction && videoData ? (
            <div style={{ marginBottom: '0.75rem', borderRadius: 8, overflow: 'hidden', background: '#000', position: 'relative' }}>
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                style={{ width: '100%', maxHeight: '50vh', display: 'block' }}
                onLoadedMetadata={(e) => { e.target.volume = 0.15; }}
                key={videoData.id}
              >
                <source src={videoData.streamUrl} type={videoData.mimeType} />
              </video>
              <div style={{
                position: 'absolute', top: 8, left: 8,
                background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '2px 8px',
                fontSize: '0.75rem', color: '#fff'
              }}>
                {activeAction.matchOpponent} — {formatDate(activeAction.matchDate)}
              </div>
            </div>
          ) : videoLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Laddar video...</div>
          ) : (
            <div style={{
              padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)',
              background: 'var(--surface-2)', borderRadius: 8, marginBottom: '0.75rem',
              border: '1px dashed var(--border)'
            }}>
              Klicka på en action för att visa videon
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
            {['actions', 'heatmap'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.35rem 0.8rem', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer',
                  border: activeTab === tab ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: activeTab === tab ? 'var(--primary)' : 'var(--surface-2)',
                  color: activeTab === tab ? '#fff' : 'var(--text)'
                }}
              >
                {tab === 'actions' ? 'Actions' : 'Heatmap'}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              {filteredActions.length} actions
            </span>
          </div>

          {activeTab === 'heatmap' && (
            <CourtHeatmap actions={filteredActions} highlightZone={highlightZone} onZoneSelect={handleHeatmapZoneSelect} onActionClick={handleActionClick} />
          )}

          {activeTab === 'actions' && (
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {filteredActions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Inga actions matchar filtren.</div>
              ) : (
                filteredActions.map(action => {
                  const isActive = activeAction?.id === action.id && activeAction?.videoId === action.videoId;
                  return (
                    <div
                      key={`${action.videoId}-${action.id}`}
                      onClick={() => handleActionClick(action)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.45rem 0.6rem', marginBottom: 2, borderRadius: 6, cursor: 'pointer',
                        background: isActive ? 'var(--primary-alpha, rgba(59,130,246,0.15))' : 'var(--surface-2)',
                        border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                        transition: 'background 0.15s'
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: SKILL_COLORS[action.skill] || '#666', flexShrink: 0
                      }} />
                      <span style={{
                        fontWeight: 600, fontSize: '0.8rem', minWidth: 18,
                        color: SKILL_COLORS[action.skill] || 'var(--text)'
                      }}>
                        {SKILL_LETTERS[action.skill] || action.skill}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text)' }}>
                        #{action.playerNumber} {action.playerName}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        color: GRADE_COLORS[action.grade] || 'var(--text-muted)'
                      }}>
                        {GRADE_SYMBOLS[action.grade] || action.grade}
                      </span>
                      {action.startZone && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Z{action.startZone}</span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {action.matchOpponent} {formatDate(action.matchDate)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Höger: Filter */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '0.75rem', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Filter</div>

            {/* Match */}
            <select value={filterMatch} onChange={e => setFilterMatch(e.target.value)} style={{ ...selectStyle, width: '100%', marginBottom: '0.4rem' }}>
              <option value="ALL">Alla matcher</option>
              {data.matches.map(m => (
                <option key={m.videoId} value={m.videoId}>
                  {m.opponent} {formatDate(m.matchDate)}
                </option>
              ))}
            </select>

            {/* Lag */}
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={{ ...selectStyle, width: '100%', marginBottom: '0.4rem' }}>
              <option value="ALL">Lag</option>
              <option value="H">Hemma</option>
              <option value="V">Borta</option>
            </select>

            {/* Spelare */}
            <select value={filterPlayer} onChange={e => setFilterPlayer(e.target.value)} style={{ ...selectStyle, width: '100%', marginBottom: '0.4rem' }}>
              <option value="ALL">Spelare</option>
              {uniquePlayers.map(({ number, name }) => (
                <option key={number + '-' + name} value={number + '-' + name}>#{number} {name}</option>
              ))}
            </select>

            {/* Zoner */}
            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem' }}>
              <select value={filterStartZone} onChange={e => setFilterStartZone(e.target.value)} style={selectStyle}>
                <option value="ALL">Från</option>
                {[1,2,3,4,5,6,7,8,9].map(z => <option key={z} value={String(z)}>Z{z}</option>)}
              </select>
              <select value={filterEndZone} onChange={e => setFilterEndZone(e.target.value)} style={selectStyle}>
                <option value="ALL">Till</option>
                {[1,2,3,4,5,6,7,8,9].map(z => <option key={z} value={String(z)}>Z{z}</option>)}
              </select>
            </div>

            {/* Skills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.4rem' }}>
              {skills.map(sk => {
                const isActive = filterSkill === sk;
                return (
                  <button
                    key={sk}
                    onClick={() => setFilterSkill(isActive ? 'ALL' : sk)}
                    style={{
                      padding: '0.2rem 0.45rem', borderRadius: 5, fontSize: '0.75rem', cursor: 'pointer',
                      border: isActive ? `1px solid ${SKILL_COLORS[sk]}` : '1px solid var(--border)',
                      background: isActive ? SKILL_COLORS[sk] + '22' : 'var(--surface-2)',
                      color: isActive ? SKILL_COLORS[sk] : 'var(--text)'
                    }}
                  >
                    {SKILL_LETTERS[sk] || sk}{isActive ? ` ${SKILL_NAMES[sk] || sk}` : ''}
                  </button>
                );
              })}
            </div>

            {/* Grades */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {[
                { key: '#', symbol: '●', label: 'Perfekt', color: '#4CAF50' },
                { key: '+', symbol: '▲', label: 'Positiv', color: '#8BC34A' },
                { key: '!', symbol: '■', label: 'OK', color: '#FF9800' },
                { key: '-', symbol: '▼', label: 'Negativ', color: '#FF5722' },
                { key: 'ERR', symbol: '✕', label: 'Error', color: '#f44336' }
              ].map(g => {
                const isActive = filterGrade === g.key;
                return (
                  <button
                    key={g.key}
                    onClick={() => setFilterGrade(isActive ? 'ALL' : g.key)}
                    style={{
                      padding: '0.2rem 0.4rem', borderRadius: 5, fontSize: '0.75rem', cursor: 'pointer',
                      border: isActive ? `1px solid ${g.color}` : '1px solid var(--border)',
                      background: isActive ? g.color + '22' : 'var(--surface-2)',
                      color: isActive ? g.color : 'var(--text)'
                    }}
                  >
                    {g.symbol}{isActive ? ` ${g.label}` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Draggable heatmap overlay (Ctrl+Z) */}
      {heatmapOverlay && (
        <div
          ref={dragRef}
          style={{
            position: 'fixed', left: 0, top: 0,
            transform: `translate(${overlayPos.x}px, ${overlayPos.y}px)`,
            width: 300, zIndex: 1000,
            background: '#0f172a', border: '1px solid #334155',
            borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            userSelect: 'none', willChange: 'transform'
          }}
        >
          <div
            onMouseDown={handleDragStart}
            style={{
              padding: '4px 10px', cursor: 'grab',
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
            }}
          >
            <button onClick={() => setHeatmapOverlay(false)} style={{
              background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem'
            }}>x</button>
          </div>
          <div style={{ padding: '0 8px 8px' }}>
            <CourtHeatmap actions={filteredActions} teamName="" highlightZone={highlightZone} onZoneSelect={handleHeatmapZoneSelect} onActionClick={handleActionClick} compact />
          </div>
        </div>
      )}
    </div>
  );
}
