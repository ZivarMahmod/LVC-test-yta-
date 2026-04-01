// ===========================================
// LVC Media Hub — Videospelare med Scout-panel
// ===========================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { videoApi, scoutApi, settingsApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatFileSize, formatDate, formatVideoTime } from '../utils/format.js';
import MatchReport from '../components/player/MatchReport.jsx';
import CourtHeatmap from '../components/player/CourtHeatmap.jsx';
import ReviewPanel from '../components/player/ReviewPanel.jsx';
import DvwSearchPanel from '../components/player/DvwSearchPanel.jsx';
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

export default function VideoPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, isUploader, isCoach } = useAuth();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  // Skill-namn från inställningar
  const [SKILL_NAMES, setSkillNames] = useState(DEFAULT_SKILL_NAMES);
  useEffect(() => {
    settingsApi.getSkillNames().then(names => { if (names) setSkillNames(names); }).catch(() => {});
  }, []);

  // Scout state
  const [scout, setScout] = useState(null);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [filterSkill, setFilterSkill] = useState('ALL');
  const [filterPlayer, setFilterPlayer] = useState('ALL');
  const [filterSet, setFilterSet] = useState('ALL');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [offset, setOffset] = useState(0);
  const [offsetInput, setOffsetInput] = useState('0');
  const [activeActionId, setActiveActionId] = useState(null);
  const [skipSeconds, setSkipSeconds] = useState(5);
  const [preRoll, setPreRoll] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [autoAction, setAutoAction] = useState(false);
  const [dvwUploading, setDvwUploading] = useState(false);
  const [dvwMsg, setDvwMsg] = useState('');
  const dvwInputRef = useRef(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  // DVW-kodsökning
  const [dvwSearchOpen, setDvwSearchOpen] = useState(false);
  const [dvwSearchQuery, setDvwSearchQuery] = useState('');
  const [scoutTab, setScoutTab] = useState('actions');
  const [autoHintDismissed, setAutoHintDismissed] = useState(false);

  // Review state
  const [reviewModal, setReviewModal] = useState(null); // { action, actionIndex }
  const [reviewPlayers, setReviewPlayers] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Viewer review bubbles
  const [myReviews, setMyReviews] = useState([]); // reviews for this video for current user
  const [expandedReviewAction, setExpandedReviewAction] = useState(null); // actionIndex currently expanded
  const [ackPassword, setAckPassword] = useState('');
  const [ackLoading, setAckLoading] = useState(false);
  const [ackError, setAckError] = useState('');
  const [showAcknowledged, setShowAcknowledged] = useState(true); // toggle for acknowledged reviews

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
        // Hoppa till action från inbox-länk
        const jumpIdx = searchParams.get('actionIndex');
        if (jumpIdx !== null && data?.actions) {
          const idx = parseInt(jumpIdx);
          const action = data.actions[idx];
          if (action) {
            setTimeout(() => jumpToAction(action), 500);
          }
        }
      } catch {
        setScout(null);
      } finally {
        setScoutLoading(false);
      }
    }
    loadScout();
  }, [video, id]);

  // Hämta spelarens reviews för denna video
  useEffect(() => {
    if (!user || !id) return;
    fetch(`/api/reviews/video/${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { reviews: [] })
      .then(d => setMyReviews(d.reviews || []))
      .catch(() => {});
  }, [user, id]);

  // Bygg map: actionIndex → reviews (filtrera bort bekräftade om toggle är av)
  const reviewsByAction = {};
  for (const r of myReviews) {
    if (r.acknowledgedAt && !showAcknowledged) continue;
    if (!reviewsByAction[r.actionIndex]) reviewsByAction[r.actionIndex] = [];
    reviewsByAction[r.actionIndex].push(r);
  }

  const handleAcknowledge = async (reviewId) => {
    if (!ackPassword.trim()) return setAckError('Ange ditt lösenord');
    setAckLoading(true);
    setAckError('');
    try {
      const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'include' });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`/api/reviews/${reviewId}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ password: ackPassword })
      });
      const data = await res.json();
      if (!res.ok) return setAckError(data.error || 'Fel uppstod');
      // Markera som bekräftad i lokal state (behåll)
      setMyReviews(prev => prev.map(r => r.id === reviewId ? { ...r, acknowledgedAt: new Date().toISOString() } : r));
      setAckPassword('');
      setAckError('');
    } catch {
      setAckError('Serverfel');
    } finally {
      setAckLoading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Q — öppna/stäng DVW-sökning (fungerar alltid)
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        setDvwSearchOpen(prev => !prev);
        setDvwSearchQuery('');
        return;
      }
      // Escape stänger sökningen om den är öppen
      if (e.key === 'Escape' && dvwSearchOpen) {
        setDvwSearchOpen(false);
        setDvwSearchQuery('');
        return;
      }
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const vid = videoRef.current;
      if (!vid) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); vid.currentTime = Math.min(vid.currentTime + skipSeconds, vid.duration); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); vid.currentTime = Math.max(vid.currentTime - skipSeconds, 0); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const filtered = getFilteredActions();
        const currentIdx = filtered.findIndex(a => a.id === activeActionId);
        const next = filtered[currentIdx + 1];
        if (next) jumpToAction(next);
      }
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const filtered = getFilteredActions();
        const currentIdx = filtered.findIndex(a => a.id === activeActionId);
        const prev = filtered[currentIdx - 1];
        if (prev) jumpToAction(prev);
      }
      else if (e.key === ' ') { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [skipSeconds, activeActionId, dvwSearchOpen]);

  const dvwSearchResults = dvwSearchOpen && dvwSearchQuery.length > 0 && scout
    ? scout.actions.filter(a => a.rawCode.toLowerCase().includes(dvwSearchQuery.toLowerCase()))
    : [];

  // Auto-hoppa till nästa filtrerad action efter delay
  const autoJumpTimer = useRef(null);

  const jumpToAction = useCallback((action) => {
    if (videoRef.current && action.videoTime !== null) {
      videoRef.current.currentTime = Math.max(0, action.videoTime - preRoll);
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
  }, [scout, filterSkill, filterPlayer, filterSet, filterTeam, filterGrade, autoAction, preRoll]);

  // Rensa timer vid unmount
  useEffect(() => {
    return () => {
      if (autoJumpTimer.current) clearTimeout(autoJumpTimer.current);
    };
  }, []);

  // Scrolla till aktiv action i listan
  useEffect(() => {
    if (!activeActionId || !actionListRef.current) return;
    const container = actionListRef.current;
    const el = container.querySelector(`[data-action-id="${activeActionId}"]`);
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Kolla om elementet är utanför synfältet
    if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
      container.scrollTop += elRect.top - containerRect.top - containerRect.height / 3;
    }
  }, [activeActionId]);

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
  }, [scout, activeActionId, filterSkill, filterPlayer, filterSet, filterTeam, filterGrade]);

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

  const handleDvwUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDvwUploading(true);
    setDvwMsg('');
    try {
      const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'include' });
      const csrfData = await csrfRes.json();
      const formData = new FormData();
      formData.append('dvw', file);
      const res = await fetch(`/api/videos/${id}/dvw`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfData.csrfToken },
        body: formData
      });
      if (!res.ok) {
        const data = await res.json();
        setDvwMsg(data.error || 'Uppladdning misslyckades');
        return;
      }
      setDvwMsg('Scout-fil uppladdad!');
      const data = await scoutApi.getScout(id);
      setScout(data);
      setTimeout(() => setDvwMsg(''), 3000);
    } catch {
      setDvwMsg('Serverfel');
    } finally {
      setDvwUploading(false);
      if (dvwInputRef.current) dvwInputRef.current.value = '';
    }
  };

  const handleSaveTitle = async () => {
    if (!titleInput.trim() || titleInput.trim() === video.opponent) {
      setEditingTitle(false);
      return;
    }
    setTitleSaving(true);
    try {
      const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'include' });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`/api/videos/${id}/title`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ opponent: titleInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setVideo(prev => ({ ...prev, title: data.title, opponent: data.opponent }));
      }
    } catch {}
    setTitleSaving(false);
    setEditingTitle(false);
  };

  // Hämta lagspelare för coach
  useEffect(() => {
    if (!isCoach) return;
    fetch('/api/reviews/team-players', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setReviewPlayers(d.teams || []))
      .catch(() => {});
  }, [isCoach]);

  async function sendReview({ actionIndex, playerIds, comment }) {
    setReviewLoading(true);
    try {
      const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'include' });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch('/api/reviews', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ videoId: id, actionIndex, playerIds, comment })
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Fel uppstod' };
      return { success: true };
    } catch {
      return { error: 'Serverfel' };
    } finally {
      setReviewLoading(false);
    }
  }

  const getFilteredActions = () => {
    if (!scout) return [];
    return scout.actions.filter(a => {
      if (filterSkill !== 'ALL' && a.skill !== filterSkill) return false;
      if (filterPlayer !== 'ALL' && (a.team + '-' + a.playerNumber) !== filterPlayer) return false;
      if (filterSet !== 'ALL' && String(a.set) !== filterSet) return false;
      if (filterTeam !== 'ALL' && a.team !== filterTeam) return false;
      if (filterGrade !== 'ALL') {
        if (filterGrade === 'ERR') { if (a.grade !== '/' && a.grade !== '=') return false; }
        else if (a.grade !== filterGrade) return false;
      }
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
            {editingTitle ? (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1 }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>LVC vs</span>
                <input
                  autoFocus
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  placeholder="Motståndarnamn"
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  style={{
                    flex: 1, padding: '0.3rem 0.6rem', fontSize: '1.1rem', fontWeight: 600,
                    borderRadius: '6px', border: '1px solid var(--lvc-blue, #1a5fb4)',
                    background: 'var(--surface-raised)', color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleSaveTitle}
                  disabled={titleSaving}
                  style={{
                    padding: '0.3rem 0.8rem', borderRadius: '6px', border: 'none',
                    background: 'var(--lvc-blue, #1a5fb4)', color: '#fff',
                    fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >{titleSaving ? '...' : 'Spara'}</button>
                <button
                  onClick={() => setEditingTitle(false)}
                  style={{
                    padding: '0.3rem 0.6rem', borderRadius: '6px',
                    border: '1px solid var(--border-default)', background: 'transparent',
                    color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer'
                  }}
                >Avbryt</button>
              </div>
            ) : (
              <h1
                onClick={() => { if (isAdmin) { setTitleInput(video.opponent || ''); setEditingTitle(true); } }}
                style={isAdmin ? { cursor: 'pointer', borderBottom: '1px dashed var(--border-default)' } : {}}
                title={isAdmin ? 'Klicka för att ändra titel' : undefined}
              >{video.title}</h1>
            )}
            {(isAdmin || isUploader) && (
              <button className="btn-danger btn-sm" onClick={handleDelete}>Ta bort</button>
            )}
          </div>
          <div className="player-wrapper">
            <video
              ref={videoRef}
              controls
              autoPlay={true}
              muted={false}
              playsInline
              preload="metadata"
              className="video-player"
              onLoadedMetadata={(e) => { e.target.volume = 0.15; }}
              key={video.streamUrl}
            >
              <source src={video.streamUrl} type={video.mimeType} />
              Din webbläsare stöder inte videouppspelning.
            </video>
          </div>
        </div>

        {/* SCOUT PANEL */}
        {(hasScout || scoutLoading || isUploader || isCoach) && (
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
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem', position: 'relative' }}>
                  <button onClick={() => setScoutTab('actions')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: scoutTab === 'actions' ? '1px solid var(--lvc-blue, #1a5fb4)' : '1px solid var(--border-default, #333)', background: scoutTab === 'actions' ? 'rgba(26,95,180,0.15)' : 'transparent', color: scoutTab === 'actions' ? 'var(--lvc-blue-light, #3584e4)' : 'var(--text-muted)', cursor: 'pointer' }}>Actions</button>
                  <button onClick={() => setScoutTab('rapport')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: scoutTab === 'rapport' ? '1px solid var(--lvc-blue, #1a5fb4)' : '1px solid var(--border-default, #333)', background: scoutTab === 'rapport' ? 'rgba(26,95,180,0.15)' : 'transparent', color: scoutTab === 'rapport' ? 'var(--lvc-blue-light, #3584e4)' : 'var(--text-muted)', cursor: 'pointer' }}>Rapport</button>
                  {hasScout && <button onClick={() => setScoutTab('heatmap')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: scoutTab === 'heatmap' ? '1px solid var(--lvc-blue, #1a5fb4)' : '1px solid var(--border-default, #333)', background: scoutTab === 'heatmap' ? 'rgba(26,95,180,0.15)' : 'transparent', color: scoutTab === 'heatmap' ? 'var(--lvc-blue-light, #3584e4)' : 'var(--text-muted)', cursor: 'pointer' }}>Heatmap</button>}
                  {hasScout && isAdmin && (
                    <a
                      href={`/api/videos/${id}/dvw/download`}
                      title="Ladda ner scout-fil"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--border-default, #333)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                    >↓</a>
                  )}
                  {(isUploader || isCoach) && hasScout && (
                    <button
                      onClick={() => dvwInputRef.current?.click()}
                      disabled={dvwUploading}
                      title="Byt scout-fil"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--border-default, #333)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >{dvwUploading ? '...' : '↻'}</button>
                  )}
                  <button
                    onClick={() => { setAutoAction(!autoAction); setAutoHintDismissed(false); }}
                    style={{
                      padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px',
                      border: autoAction ? '1px solid var(--lvc-green, #3fb950)' : '1px solid var(--border-default)',
                      background: autoAction ? 'rgba(63, 185, 80, 0.15)' : 'var(--surface-raised)',
                      color: autoAction ? 'var(--lvc-green, #3fb950)' : 'var(--text-muted)',
                      cursor: 'pointer', marginLeft: 'auto'
                    }}
                  >
                    {autoAction ? '▶ Auto' : '■ Auto'}
                  </button>
                  {autoAction && !autoHintDismissed && filterSkill === 'ALL' && filterPlayer === 'ALL' && filterSet === 'ALL' && filterTeam === 'ALL' && filterGrade === 'ALL' && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                      background: 'rgba(232,168,37,0.15)', border: '1px solid rgba(232,168,37,0.3)',
                      borderRadius: '6px', padding: '0.35rem 0.5rem', fontSize: '0.7rem',
                      color: 'var(--lvc-gold)', whiteSpace: 'nowrap', zIndex: 10,
                      display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}>
                      <span>Välj filter för auto-uppspelning</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAutoHintDismissed(true); }}
                        style={{ background: 'none', border: 'none', color: 'var(--lvc-gold)', cursor: 'pointer', fontSize: '0.8rem', padding: 0, lineHeight: 1 }}
                      >×</button>
                    </div>
                  )}
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

              {/* Filter: Set + Lag — kompakt rad */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <select
                  value={filterSet}
                  onChange={e => setFilterSet(e.target.value)}
                  style={{
                    flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                    color: 'var(--text)', fontSize: '0.78rem'
                  }}
                >
                  <option value="ALL">Set</option>
                  {uniqueSets.map(s => <option key={s} value={String(s)}>Set {s}</option>)}
                </select>
                {scout && (
                  <select
                    value={filterTeam}
                    onChange={e => setFilterTeam(e.target.value)}
                    style={{
                      flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--surface-2)',
                      color: 'var(--text)', fontSize: '0.78rem'
                    }}
                  >
                    <option value="ALL">Lag</option>
                    <option value="H">{scout.teams?.H || 'Hemma'}</option>
                    <option value="V">{scout.teams?.V || 'Borta'}</option>
                  </select>
                )}
              </div>

              {/* Pre/Skip + Spelare */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                <select
                  value={filterPlayer}
                  onChange={e => setFilterPlayer(e.target.value)}
                  style={{
                    flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                    color: 'var(--text)', fontSize: '0.78rem'
                  }}
                >
                  <option value="ALL">Spelare</option>
                  {uniquePlayers.map(({ number, team }) => {
                    const key = team + '-' + number;
                    const p = scout.players.find(pl => parseInt(pl.number, 10) === number && pl.team === team);
                    const teamName = scout.teams?.[team] || team;
                    return <option key={key} value={key}>#{number} {p ? p.name : ''} ({teamName})</option>;
                  })}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pre</span>
                  <select
                    value={preRoll}
                    onChange={e => setPreRoll(Number(e.target.value))}
                    style={{ padding: '0.15rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.75rem' }}
                  >
                    {[0,2,3,5].map(s => <option key={s} value={s}>{s}s</option>)}
                  </select>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Skip</span>
                  <select
                    value={skipSeconds}
                    onChange={e => setSkipSeconds(Number(e.target.value))}
                    style={{ padding: '0.15rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.75rem' }}
                  >
                    {[1,2,5,10,30].map(s => <option key={s} value={s}>{s}s</option>)}
                  </select>
                </div>
              </div>

              {/* Filter: Skill — pill-knappar */}
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.25rem', alignItems: 'center' }}>
                {[{ key: 'ALL', label: 'Alla', color: '#94a3b8' }, ...uniqueSkills.map(s => ({ key: s, label: SKILL_NAMES[s] || s, color: SKILL_COLORS[s] || '#666' }))].map(sk => {
                  const isActive = filterSkill === sk.key;
                  return (
                    <button
                      key={sk.key}
                      onClick={() => setFilterSkill(sk.key)}
                      title={sk.label}
                      style={{
                        padding: '0.25rem 0.55rem',
                        borderRadius: '12px',
                        border: `1.5px solid ${isActive ? sk.color : 'transparent'}`,
                        background: isActive ? `${sk.color}22` : 'var(--surface-2)',
                        color: isActive ? sk.color : 'var(--text-muted)',
                        fontSize: '0.72rem',
                        fontWeight: isActive ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {isActive ? sk.label : (sk.key === 'ALL' ? 'Alla' : sk.key)}
                    </button>
                  );
                })}
              </div>

              {/* Filter: Grade — symboler, text visas vid vald */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem', alignItems: 'center' }}>
                <button onClick={() => setFilterGrade('ALL')} style={{...filterBtnStyle(filterGrade === 'ALL'), minWidth: 'auto', padding: '0.25rem 0.4rem'}} title="Alla">◆{filterGrade === 'ALL' ? ' Alla' : ''}</button>
                {[
                  { key: '#', symbol: '●', label: 'Perfekt', color: '#4CAF50' },
                  { key: '+', symbol: '▲', label: 'Positiv', color: '#4CAF50' },
                  { key: '!', symbol: '■', label: 'OK', color: '#FF9800' },
                  { key: '-', symbol: '▼', label: 'Negativ', color: '#F44336' },
                  { key: 'ERR', symbol: '✕', label: 'Error', color: '#F44336' },
                ].map(g => (
                  <button
                    key={g.key}
                    onClick={() => setFilterGrade(filterGrade === g.key ? 'ALL' : g.key)}
                    title={g.label}
                    style={{
                      ...filterBtnStyle(filterGrade === g.key),
                      color: g.color,
                      minWidth: 'auto',
                      padding: '0.25rem 0.4rem',
                    }}
                  >
                    {g.symbol}{filterGrade === g.key ? ` ${g.label}` : ''}
                  </button>
                ))}
              </div>

              </div>
            )}
            </div>

            {/* Dold filinput för DVW-upload */}
            <input
              ref={dvwInputRef}
              type="file"
              accept=".dvw"
              style={{ display: 'none' }}
              onChange={handleDvwUpload}
            />
            {dvwMsg && (
              <div style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', color: dvwMsg.includes('!') ? '#4CAF50' : '#F44336', background: dvwMsg.includes('!') ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)' }}>
                {dvwMsg}
              </div>
            )}

            {/* Ingen scout-data — visa upload-prompt */}
            {!hasScout && !scoutLoading && (isUploader || isCoach) && (
              <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Ingen scout-fil kopplad till denna video</p>
                <button
                  onClick={() => dvwInputRef.current?.click()}
                  disabled={dvwUploading}
                  style={{
                    padding: '0.5rem 1.2rem', borderRadius: '8px', border: '1px solid var(--lvc-blue, #1a5fb4)',
                    background: 'rgba(26,95,180,0.15)', color: 'var(--lvc-blue-light, #3584e4)',
                    cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
                  }}
                >
                  {dvwUploading ? 'Laddar upp...' : 'Ladda upp scout-fil (.dvw)'}
                </button>
              </div>
            )}

            {/* Action-lista */}
            {scoutTab === 'actions' && hasScout && (
            <div ref={actionListRef} style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
              {scoutLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Laddar scout...</div>
              ) : filteredActions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Inga actions</div>
              ) : (
                filteredActions.map(action => {
                  const actionIdx = scout?.actions?.indexOf(action) ?? filteredActions.indexOf(action);
                  const actionReviews = reviewsByAction[actionIdx] || [];
                  const hasReview = actionReviews.length > 0;
                  const isExpanded = expandedReviewAction === actionIdx;

                  return (
                  <div key={action.id} data-action-id={action.id}>
                  <div
                    onClick={() => jumpToAction(action)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4rem 0.6rem', borderRadius: isExpanded ? '6px 6px 0 0' : '6px', cursor: 'pointer',
                      marginBottom: isExpanded ? '0' : '2px',
                      background: activeActionId === action.id ? 'var(--accent-subtle, rgba(99,102,241,0.15))' : hasReview ? 'rgba(255, 183, 77, 0.08)' : 'transparent',
                      border: activeActionId === action.id ? '1px solid var(--accent)' : hasReview ? '1px solid rgba(255, 183, 77, 0.3)' : '1px solid transparent',
                      borderBottom: isExpanded ? '1px solid rgba(255, 183, 77, 0.15)' : undefined,
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
                    {/* Review-bubbla för spelare */}
                    {hasReview && (() => {
                      const unread = actionReviews.filter(r => !r.acknowledgedAt);
                      const allAcked = unread.length === 0;
                      return (
                      <span
                        onClick={e => {
                          e.stopPropagation();
                          setExpandedReviewAction(isExpanded ? null : actionIdx);
                          setAckPassword('');
                          setAckError('');
                        }}
                        title={allAcked ? 'Bekräftad kommentar' : 'Ny coach-kommentar'}
                        className="review-bubble-icon"
                        style={{
                          fontSize: '0.85rem', cursor: 'pointer', flexShrink: 0,
                          position: 'relative',
                          opacity: allAcked ? 0.6 : 1,
                          animation: !allAcked && !isExpanded ? 'reviewPulse 2s ease-in-out infinite' : 'none'
                        }}
                      >
                        {allAcked ? '✅' : '💬'}
                        {unread.length > 1 && (
                          <span style={{
                            position: 'absolute', top: '-4px', right: '-6px',
                            background: '#F44336', color: '#fff', borderRadius: '50%',
                            width: '14px', height: '14px', fontSize: '0.6rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700
                          }}>{unread.length}</span>
                        )}
                      </span>
                      );
                    })()}
                    {/* Review-knapp för coach */}
                    {isCoach && (
                      <span
                        onClick={e => {
                          e.stopPropagation();
                          setReviewModal({ action, actionIndex: actionIdx });
                        }}
                        title="Skicka till spelare"
                        style={{
                          fontSize: '0.85rem', cursor: 'pointer', flexShrink: 0,
                          opacity: 0.6, transition: 'opacity 0.15s'
                        }}
                        onMouseEnter={e => e.target.style.opacity = 1}
                        onMouseLeave={e => e.target.style.opacity = 0.6}
                      >📤</span>
                    )}
                  </div>

                  {/* Expanderad kommentarsbubbla */}
                  {isExpanded && (
                    <div className="review-bubble-container">
                      {actionReviews.map(review => (
                        <div key={review.id} className={review.acknowledgedAt ? 'review-bubble review-bubble-acked' : 'review-bubble'}>
                          <div className="review-bubble-header">
                            <span className="review-bubble-coach">{review.coach?.name || 'Coach'}</span>
                            <span className="review-bubble-date">
                              {review.acknowledgedAt
                                ? `✓ Bekräftad ${new Date(review.acknowledgedAt).toLocaleDateString('sv-SE')}`
                                : new Date(review.createdAt).toLocaleDateString('sv-SE')
                              }
                            </span>
                          </div>
                          <div className="review-bubble-comment">{review.comment}</div>
                          {!review.acknowledgedAt && (
                            <>
                              <div className="review-bubble-actions">
                                <input
                                  type="password"
                                  placeholder="Ditt lösenord..."
                                  value={ackPassword}
                                  onChange={e => { setAckPassword(e.target.value); setAckError(''); }}
                                  onKeyDown={e => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') handleAcknowledge(review.id);
                                  }}
                                  className="review-bubble-pw"
                                />
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAcknowledge(review.id); }}
                                  disabled={ackLoading}
                                  className="review-bubble-confirm"
                                >
                                  {ackLoading ? '...' : 'Bekräfta'}
                                </button>
                              </div>
                              {ackError && <div className="review-bubble-error">{ackError}</div>}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                  );
                })
              )}
            </div>
            )}

            {/* Footer */}
            {hasScout && scoutTab === 'actions' && (
              <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{filteredActions.length} actions</span>
                {myReviews.some(r => r.acknowledgedAt) && (
                  <button
                    onClick={() => setShowAcknowledged(v => !v)}
                    style={{
                      padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem',
                      border: showAcknowledged ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid var(--border-default)',
                      background: showAcknowledged ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                      color: showAcknowledged ? '#4CAF50' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {showAcknowledged ? '✅ Bekräftade' : '○ Bekräftade'}
                  </button>
                )}
              </div>
            )}

            {/* Rapport-vy */}
            {scoutTab === 'rapport' && (
              <MatchReport stats={getMatchStats()} onJumpToActions={jumpToPlayerActions} />
            )}

            {/* Heatmap-vy */}
            {scoutTab === 'heatmap' && scout?.actions && (
              <div style={{ padding: '0.75rem', overflowY: 'auto', flex: 1 }}>
                <CourtHeatmap actions={scout.actions} team="H" teamName={scout.teams?.H} />
                <div style={{ height: 12 }} />
                <CourtHeatmap actions={scout.actions} team="V" teamName={scout.teams?.V} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* DVW-kodsökning — Ctrl+Q */}
      {dvwSearchOpen && scout && (isCoach || isUploader || isAdmin) && (
        <DvwSearchPanel
          searchQuery={dvwSearchQuery}
          onSearchChange={setDvwSearchQuery}
          onClose={() => { setDvwSearchOpen(false); setDvwSearchQuery(''); }}
          searchResults={dvwSearchResults}
          activeActionId={activeActionId}
          onJumpToAction={(action) => { jumpToAction(action); setActiveActionId(action.id); }}
        />
      )}

      {/* Review Panel — draggbar */}
      <ReviewPanel
        reviewModal={reviewModal}
        onClose={() => setReviewModal(null)}
        reviewPlayers={reviewPlayers}
        onSendReview={sendReview}
        reviewLoading={reviewLoading}
      />
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
