// ===========================================
// LVC Media Hub — Flermatchsvy (Multi-Scout)
// ===========================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { multiScoutApi, videoApi, settingsApi } from '../utils/api.js';
import { SKILL_COLORS, DEFAULT_SKILL_NAMES } from '../utils/scoutConstants.js';
import { useGradeSymbols } from '../hooks/useGradeSymbols.js';
import CourtHeatmap from '../components/player/CourtHeatmap.jsx';
import './VideoPlayerPage.css';

const GRADE_COLORS = {
  '#': '#4CAF50', '+': '#8BC34A', '!': '#FF9800', '-': '#FF5722', '/': '#f44336', '=': '#f44336'
};

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

export default function MultiScoutPage() {
  const { gradeSymbols } = useGradeSymbols();
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').filter(Boolean);

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
  const [preRoll, setPreRoll] = useState(0);
  const [skipSeconds, setSkipSeconds] = useState(5);
  const [autoPlay, setAutoPlay] = useState(false);
  const videoRef = useRef(null);
  const videoCache = useRef({}); // videoId → { streamUrl, mimeType }

  // Tab
  const [activeTab, setActiveTab] = useState('actions');

  // Heatmap overlay (Ctrl+Z)
  const [heatmapOverlay, setHeatmapOverlay] = useState(false);
  const overlayPosRef = useRef({ x: 20, y: 60 });
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
  }, [idsParam]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Drag logic for overlay — direct DOM manipulation, no re-renders
  const handleDragStart = (e) => {
    e.preventDefault();
    const el = dragRef.current;
    if (!el) return;
    const startX = e.clientX - overlayPosRef.current.x;
    const startY = e.clientY - overlayPosRef.current.y;
    const onMove = (ev) => {
      ev.preventDefault();
      overlayPosRef.current = { x: ev.clientX - startX, y: ev.clientY - startY };
      el.style.transform = `translate(${overlayPosRef.current.x}px, ${overlayPosRef.current.y}px)`;
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
      if (filterTeam !== 'ALL' && a.teamName !== filterTeam) return false;
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
          videoRef.current.currentTime = Math.max(0, action.videoTime - preRoll);
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
        videoRef.current.currentTime = Math.max(0, activeAction.videoTime - preRoll);
        videoRef.current.play().catch(() => {});
      };
      if (videoRef.current.readyState >= 1) {
        seekAndPlay();
      } else {
        videoRef.current.addEventListener('loadedmetadata', seekAndPlay, { once: true });
      }
    }
  }, [videoData, activeAction, preRoll]);

  // Auto-play: hoppa till nästa action efter ~5 sek från actionens starttid
  useEffect(() => {
    if (!autoPlay || !activeAction || !videoRef.current) return;
    const vid = videoRef.current;
    const actionStart = activeAction.videoTime || 0;
    const actionEnd = actionStart + 5; // Visa ~5 sek per action

    const onTimeUpdate = () => {
      if (vid.currentTime >= actionEnd && !vid.paused) {
        const idx = filteredActions.findIndex(a => a.id === activeAction.id && a.videoId === activeAction.videoId);
        if (idx >= 0 && idx < filteredActions.length - 1) {
          handleActionClick(filteredActions[idx + 1]);
        } else {
          setAutoPlay(false); // Sista action — stäng av auto-play
        }
      }
    };

    vid.addEventListener('timeupdate', onTimeUpdate);
    return () => vid.removeEventListener('timeupdate', onTimeUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, activeAction, filteredActions]);

  // Keyboard: piltangenter skip, N/P nästa/föregående action
  useEffect(() => {
    const handler = (e) => {
      const vid = videoRef.current;
      if (!vid) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); vid.currentTime = Math.min(vid.currentTime + skipSeconds, vid.duration); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); vid.currentTime = Math.max(vid.currentTime - skipSeconds, 0); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = filteredActions.findIndex(a => a.id === activeAction?.id && a.videoId === activeAction?.videoId);
        if (idx >= 0 && idx < filteredActions.length - 1) handleActionClick(filteredActions[idx + 1]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = filteredActions.findIndex(a => a.id === activeAction?.id && a.videoId === activeAction?.videoId);
        if (idx > 0) handleActionClick(filteredActions[idx - 1]);
      } else if (e.key === ' ') { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipSeconds, activeAction, filteredActions]);

  // Unika spelare & skills
  const uniquePlayers = data ? [...new Map(data.actions
    .filter(a => filterTeam === 'ALL' || a.teamName === filterTeam)
    .map(a => [a.playerNumber + '-' + a.playerName, { number: a.playerNumber, team: a.team, name: a.playerName }])
  ).values()].sort((a, b) => a.number - b.number) : [];

  const uniqueSkills = data ? [...new Set(data.actions.map(a => a.skill))] : [];

  const skills = ['S', 'R', 'P', 'A', 'B', 'D', 'G', 'O'].filter(s => uniqueSkills.includes(s));

  const selectStyle = {
    flex: 1, padding: '0.25rem 0.3rem', borderRadius: '5px',
    border: '1px solid var(--border)', background: 'var(--surface-2)',
    color: 'var(--text)', fontSize: '0.75rem'
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
                style={{ width: '100%', maxHeight: '75vh', display: 'block' }}
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
                {activeAction.matchOpponent} — {formatDateShort(activeAction.matchDate)}
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

        </div>

        {/* Höger: Filter + Actions */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '0.6rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

            {/* Match + Lag */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.3rem' }}>
              <select value={filterMatch} onChange={e => setFilterMatch(e.target.value)} style={selectStyle}>
                <option value="ALL">Alla matcher</option>
                {data.matches.map(m => (
                  <option key={m.videoId} value={m.videoId}>
                    {m.opponent} {formatDateShort(m.matchDate)}
                  </option>
                ))}
              </select>
              <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={selectStyle}>
                <option value="ALL">Lag</option>
                {[...new Map(data.actions.map(a => [a.teamName, a.team])).entries()]
                  .sort(([a], [b]) => a.localeCompare(b, 'sv'))
                  .map(([name, code]) => (
                    <option key={code + '-' + name} value={name}>{name}</option>
                  ))
                }
              </select>
            </div>

            {/* Spelare + Från/Till */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.3rem' }}>
              <select value={filterPlayer} onChange={e => setFilterPlayer(e.target.value)} style={selectStyle}>
                <option value="ALL">Spelare</option>
                {uniquePlayers.map(({ number, name }) => (
                  <option key={number + '-' + name} value={number + '-' + name}>#{number} {name}</option>
                ))}
              </select>
              <select value={filterStartZone} onChange={e => setFilterStartZone(e.target.value)} style={{ ...selectStyle, flex: 'none', width: 52 }}>
                <option value="ALL">Från</option>
                {[1,2,3,4,5,6,7,8,9].map(z => <option key={z} value={String(z)}>Z{z}</option>)}
              </select>
              <select value={filterEndZone} onChange={e => setFilterEndZone(e.target.value)} style={{ ...selectStyle, flex: 'none', width: 48 }}>
                <option value="ALL">Till</option>
                {[1,2,3,4,5,6,7,8,9].map(z => <option key={z} value={String(z)}>Z{z}</option>)}
              </select>
            </div>

            {/* Pre/Skip */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.3rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Pre</span>
              <select value={preRoll} onChange={e => setPreRoll(Number(e.target.value))}
                style={{ ...selectStyle, flex: 'none', width: 'auto', padding: '0.1rem 0.2rem', fontSize: '0.7rem' }}>
                {[0,2,3,5].map(s => <option key={s} value={s}>{s}s</option>)}
              </select>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>Skip</span>
              <select value={skipSeconds} onChange={e => setSkipSeconds(Number(e.target.value))}
                style={{ ...selectStyle, flex: 'none', width: 'auto', padding: '0.1rem 0.2rem', fontSize: '0.7rem' }}>
                {[1,2,5,10,30].map(s => <option key={s} value={s}>{s}s</option>)}
              </select>
              <button
                onClick={() => { setAutoPlay(prev => !prev); if (!autoPlay && filteredActions.length > 0 && !activeAction) handleActionClick(filteredActions[0]); }}
                style={{
                  marginLeft: '0.25rem', padding: '0.1rem 0.5rem', fontSize: '0.7rem', borderRadius: 4,
                  border: autoPlay ? '1px solid var(--lvc-blue, #1a5fb4)' : '1px solid var(--border-default, #333)',
                  background: autoPlay ? 'rgba(26,95,180,0.2)' : 'transparent',
                  color: autoPlay ? 'var(--lvc-blue-light, #3584e4)' : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: autoPlay ? 600 : 400
                }}
              >
                {autoPlay ? '⏸ Auto' : '▶ Auto'}
              </button>
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
                    {isActive ? SKILL_NAMES[sk] || sk : SKILL_LETTERS[sk] || sk}
                  </button>
                );
              })}
            </div>

            {/* Grades */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {[
                { key: '#', symbol: gradeSymbols['#'], label: 'Perfekt', color: '#4CAF50' },
                { key: '+', symbol: gradeSymbols['+'], label: 'Positiv', color: '#8BC34A' },
                { key: '!', symbol: gradeSymbols['!'], label: 'OK', color: '#FF9800' },
                { key: '-', symbol: gradeSymbols['-'], label: 'Negativ', color: '#FF5722' },
                { key: 'ERR', symbol: gradeSymbols['/'], label: 'Error', color: '#f44336' }
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

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
              {['actions', 'heatmap'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '0.25rem 0.6rem', borderRadius: 5, fontSize: '0.75rem', cursor: 'pointer',
                    border: activeTab === tab ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: activeTab === tab ? 'var(--primary)' : 'var(--surface-2)',
                    color: activeTab === tab ? '#fff' : 'var(--text)'
                  }}
                >
                  {tab === 'actions' ? 'Actions' : 'Heatmap'}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {filteredActions.length}
              </span>
            </div>

            {/* Actions / Heatmap */}
            {activeTab === 'heatmap' ? (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <CourtHeatmap actions={filteredActions} highlightZone={highlightZone} onZoneSelect={handleHeatmapZoneSelect} onActionClick={handleActionClick} gradeSymbols={gradeSymbols} />
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredActions.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Inga actions matchar filtren.</div>
                ) : (
                  filteredActions.map(action => {
                    const isActive = activeAction?.id === action.id && activeAction?.videoId === action.videoId;
                    return (
                      <div
                        key={`${action.videoId}-${action.id}`}
                        onClick={() => handleActionClick(action)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.35rem 0.5rem', marginBottom: 2, borderRadius: 5, cursor: 'pointer',
                          background: isActive ? 'var(--primary-alpha, rgba(59,130,246,0.15))' : 'transparent',
                          border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                        }}
                      >
                        <span style={{
                          fontWeight: 600, fontSize: '0.75rem', minWidth: 14,
                          color: SKILL_COLORS[action.skill] || 'var(--text)'
                        }}>
                          {SKILL_LETTERS[action.skill] || action.skill}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          color: GRADE_COLORS[action.grade] || 'var(--text-muted)'
                        }}>
                          {gradeSymbols[action.grade] || action.grade}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          #{action.playerNumber} {action.playerName.split(' ').pop()}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {action.matchOpponent}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draggable heatmap overlay (Ctrl+Z) */}
      {heatmapOverlay && (
        <div
          ref={dragRef}
          style={{
            position: 'fixed', left: 0, top: 0,
            transform: `translate(${overlayPosRef.current.x}px, ${overlayPosRef.current.y}px)`,
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
            <CourtHeatmap actions={filteredActions} teamName="" highlightZone={highlightZone} onZoneSelect={handleHeatmapZoneSelect} onActionClick={handleActionClick} gradeSymbols={gradeSymbols} compact />
          </div>
        </div>
      )}
    </div>
  );
}
