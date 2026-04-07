// ===========================================
// LVC Media Hub — Videospelare med Scout-panel
// ===========================================
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { videoApi, scoutApi, settingsApi, documentApi, reviewApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DEFAULT_SKILL_NAMES } from '../utils/scoutConstants.js';
import { useGradeSymbols } from '../hooks/useGradeSymbols.js';
import MatchReport from '../components/player/MatchReport.jsx';
import CourtHeatmap from '../components/player/CourtHeatmap.jsx';
import ReviewPanel from '../components/player/ReviewPanel.jsx';
import DvwSearchPanel from '../components/player/DvwSearchPanel.jsx';
import DraggableScoreboard from '../components/player/DraggableScoreboard.jsx';
import VideoTitleBar from '../components/player/VideoTitleBar.jsx';
import ScoutFilters from '../components/player/ScoutFilters.jsx';
import ScoutActionsList from '../components/player/ScoutActionsList.jsx';
import DocumentsTab from '../components/player/DocumentsTab.jsx';
import DocumentViewer from '../components/player/DocumentViewer.jsx';
import HeatmapOverlay from '../components/player/HeatmapOverlay.jsx';
import './VideoPlayerPage.css';

export default function VideoPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, isUploader, isCoach } = useAuth();
  const { gradeSymbols } = useGradeSymbols();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const { scoreboardSettings, updateScoreboardSettings } = useOutletContext();

  // Skill-namn och bokstäver från inställningar
  const [SKILL_NAMES, setSkillNames] = useState(DEFAULT_SKILL_NAMES);
  const [SKILL_LETTERS, setSkillLetters] = useState({});
  useEffect(() => {
    settingsApi.getSkillNames().then(data => {
      if (data?.names) setSkillNames(data.names);
      if (data?.letters) setSkillLetters(data.letters);
    }).catch(() => {});
  }, []);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [viewingDoc, setViewingDoc] = useState(null);

  // Scout state
  const [scout, setScout] = useState(null);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [filterSkill, setFilterSkill] = useState('ALL');
  const [filterPlayer, setFilterPlayer] = useState('ALL');
  const [filterSet, setFilterSet] = useState('ALL');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [filterStartZone, setFilterStartZone] = useState('ALL');
  const [filterEndZone, setFilterEndZone] = useState('ALL');
  const [_offset, setOffset] = useState(0);
  const [offsetInput, setOffsetInput] = useState('0');
  const [activeActionId, setActiveActionId] = useState(null);
  const [skipSeconds, setSkipSeconds] = useState(5);
  const [preRoll, setPreRoll] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [autoAction, setAutoAction] = useState(false);
  const [dvwUploading, setDvwUploading] = useState(false);
  const [dvwMsg, setDvwMsg] = useState('');
  const dvwInputRef = useRef(null);
  // Heatmap overlay (Ctrl+Z)
  const [heatmapOverlay, setHeatmapOverlay] = useState(false);
  const overlayPosRef = useRef({ x: 20, y: 80 });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    documentApi.list(id).then(d => setDocuments(d.documents || [])).catch(() => {});
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, id]);

  // Hämta spelarens reviews för denna video
  useEffect(() => {
    if (!user || !id) return;
    reviewApi.getVideoReviews(id)
      .then(d => setMyReviews(d.reviews || []))
      .catch(() => {});
  }, [user, id]);

  // Bygg map: actionIndex → reviews (filtrera bort bekräftade om toggle är av)
  const reviewsByAction = useMemo(() => {
    const map = {};
    for (const r of myReviews) {
      if (r.acknowledgedAt && !showAcknowledged) continue;
      if (!map[r.actionIndex]) map[r.actionIndex] = [];
      map[r.actionIndex].push(r);
    }
    return map;
  }, [myReviews, showAcknowledged]);

  const handleAcknowledge = async (reviewId) => {
    if (!ackPassword.trim()) return setAckError('Ange ditt lösenord');
    setAckLoading(true);
    setAckError('');
    try {
      await reviewApi.acknowledge(reviewId, ackPassword);
      // Markera som bekräftad i lokal state (behåll)
      setMyReviews(prev => prev.map(r => r.id === reviewId ? { ...r, acknowledgedAt: new Date().toISOString() } : r));
      setAckPassword('');
      setAckError('');
    } catch (err) {
      setAckError(err.message || 'Serverfel');
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
      // Ctrl+Z toggle heatmap overlay
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        setHeatmapOverlay(prev => !prev);
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
      else if (e.key === ',') { e.preventDefault(); vid.pause(); vid.currentTime = Math.max(vid.currentTime - 1/30, 0); }
      else if (e.key === '.') { e.preventDefault(); vid.pause(); vid.currentTime = Math.min(vid.currentTime + 1/30, vid.duration); }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipSeconds, activeActionId, dvwSearchOpen]);

  const dvwSearchResults = dvwSearchOpen && dvwSearchQuery.length > 0 && scout
    ? scout.actions.filter(a => a.rawCode.toLowerCase().includes(dvwSearchQuery.toLowerCase()))
    : [];

  // Auto-hoppa till nästa action efter delay
  const autoJumpTimer = useRef(null);
  const autoPlayListRef = useRef(null); // custom action list for zone auto-play

  const jumpToAction = useCallback((action, actionList) => {
    if (videoRef.current && action.videoTime !== null) {
      videoRef.current.currentTime = Math.max(0, action.videoTime - preRoll);
      videoRef.current.play().catch(() => {});
      setActiveActionId(action.id);

      // Rensa eventuell tidigare timer
      if (autoJumpTimer.current) clearTimeout(autoJumpTimer.current);

      // Om en specifik action-lista skickats (t.ex. från zon), spara den
      if (actionList) autoPlayListRef.current = actionList;

      // Bestäm vilken lista att kedja igenom
      const list = autoPlayListRef.current || (autoAction ? getFilteredActions() : null);
      if (!list) return;

      const currentIdx = list.findIndex(a => a.id === action.id);
      const next = list[currentIdx + 1];

      if (next && next.videoTime !== null) {
        const rate = videoRef.current.playbackRate || 1;
        const baseDelay = next.videoTime > action.videoTime
          ? Math.min((next.videoTime - action.videoTime) * 1000, 8000)
          : 5000;
        const delay = baseDelay / rate;
        autoJumpTimer.current = setTimeout(() => {
          if (videoRef.current && !videoRef.current.paused) {
            jumpToAction(next);
          }
        }, delay);
      } else {
        // Sista actionen — rensa listan
        autoPlayListRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scout, filterSkill, filterPlayer, filterSet, filterTeam, filterGrade, filterStartZone, filterEndZone, autoAction, preRoll]);

  // Rensa auto-play vid paus eller unmount
  useEffect(() => {
    const vid = videoRef.current;
    const handlePause = () => {
      if (autoJumpTimer.current) clearTimeout(autoJumpTimer.current);
      autoPlayListRef.current = null;
    };
    if (vid) vid.addEventListener('pause', handlePause);
    return () => {
      if (vid) vid.removeEventListener('pause', handlePause);
      if (autoJumpTimer.current) clearTimeout(autoJumpTimer.current);
    };
  }, [video]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scout, activeActionId, filterSkill, filterPlayer, filterSet, filterTeam, filterGrade, filterStartZone, filterEndZone]);

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
      await videoApi.uploadDvw(id, file);
      setDvwMsg('Scout-fil uppladdad!');
      const data = await scoutApi.getScout(id);
      setScout(data);
      setTimeout(() => setDvwMsg(''), 3000);
    } catch (err) {
      setDvwMsg(err.message || 'Serverfel');
    } finally {
      setDvwUploading(false);
      if (dvwInputRef.current) dvwInputRef.current.value = '';
    }
  };

  // Hämta lagspelare för coach
  useEffect(() => {
    if (!isCoach) return;
    reviewApi.getTeamPlayers()
      .then(d => setReviewPlayers(d.teams || []))
      .catch(() => {});
  }, [isCoach]);

  async function sendReview({ actionIndex, playerIds, comment }) {
    setReviewLoading(true);
    try {
      await reviewApi.create({ videoId: id, actionIndex, playerIds, comment });
      return { success: true };
    } catch (err) {
      return { error: err.message || 'Serverfel' };
    } finally {
      setReviewLoading(false);
    }
  }

  const getFilteredActions = useCallback(() => {
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
      if (filterStartZone !== 'ALL' && String(a.startZone) !== filterStartZone) return false;
      if (filterEndZone !== 'ALL' && String(a.endZone) !== filterEndZone) return false;
      return true;
    });
  }, [scout, filterSkill, filterPlayer, filterSet, filterTeam, filterGrade, filterStartZone, filterEndZone]);

  const filteredActionsMemo = useMemo(() => getFilteredActions(), [getFilteredActions]);

  const matchStats = useMemo(() => {
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
  }, [scout]);

  const handleDelete = async () => {
    if (!confirm(`Är du säker på att du vill ta bort "${video.title}"?`)) return;
    try {
      await videoApi.remove(id);
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  // Scoreboard — nuvarande ställning baserat på aktiv action (måste vara före early returns)
  const currentScore = useMemo(() => {
    if (!scout?.scoreboard || scout.scoreboard.length === 0) return null;
    if (!activeActionId) {
      // Visa sista ställningen
      return scout.scoreboard[scout.scoreboard.length - 1];
    }
    const entry = scout.scoreboard.find(s => s.id === activeActionId);
    if (entry) return entry;
    // Fallback: närmaste innan
    for (let i = scout.scoreboard.length - 1; i >= 0; i--) {
      if (scout.scoreboard[i].id <= activeActionId) return scout.scoreboard[i];
    }
    return { set: 1, setScore: { H: 0, V: 0 } };
  }, [scout, activeActionId]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (error || !video) {
    return (
      <div className="empty-state">
        <h3>{error || 'Videon kunde inte hittas'}</h3>
        <Link to="/" className="btn-secondary" style={{ marginTop: '1rem', display: 'inline-flex' }}>← Tillbaka</Link>
      </div>
    );
  }

  const filteredActions = filteredActionsMemo;
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
          <VideoTitleBar video={video} isAdmin={isAdmin} isUploader={isUploader} onUpdate={(data) => setVideo(prev => ({ ...prev, ...data }))} onDelete={handleDelete} />
          <div className="player-wrapper" ref={playerWrapperRef}>
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

            <DraggableScoreboard
              currentScore={currentScore}
              homeTeam={scout?.teams?.H}
              awayTeam={scout?.teams?.V}
              containerRef={playerWrapperRef}
              settings={scoreboardSettings}
              onUpdateSettings={updateScoreboardSettings}
            />
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
                  <button onClick={() => setScoutTab('docs')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: scoutTab === 'docs' ? '1px solid var(--lvc-blue, #1a5fb4)' : '1px solid var(--border-default, #333)', background: scoutTab === 'docs' ? 'rgba(26,95,180,0.15)' : 'transparent', color: scoutTab === 'docs' ? 'var(--lvc-blue-light, #3584e4)' : 'var(--text-muted)', cursor: 'pointer', position: 'relative' }}>
                    Dok {documents.length > 0 && <span style={{ fontSize: '0.65rem', background: 'var(--lvc-blue)', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}>{documents.length}</span>}
                  </button>
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
                <ScoutFilters
                  isAdmin={isAdmin}
                  scout={scout}
                  filtersOpen={filtersOpen}
                  offsetInput={offsetInput}
                  setOffsetInput={setOffsetInput}
                  onSaveOffset={handleSaveOffset}
                  filterSet={filterSet}
                  setFilterSet={setFilterSet}
                  uniqueSets={uniqueSets}
                  filterTeam={filterTeam}
                  setFilterTeam={setFilterTeam}
                  filterStartZone={filterStartZone}
                  setFilterStartZone={setFilterStartZone}
                  filterEndZone={filterEndZone}
                  setFilterEndZone={setFilterEndZone}
                  filterPlayer={filterPlayer}
                  setFilterPlayer={setFilterPlayer}
                  uniquePlayers={uniquePlayers}
                  preRoll={preRoll}
                  setPreRoll={setPreRoll}
                  skipSeconds={skipSeconds}
                  setSkipSeconds={setSkipSeconds}
                  filterSkill={filterSkill}
                  setFilterSkill={setFilterSkill}
                  uniqueSkills={uniqueSkills}
                  filterGrade={filterGrade}
                  setFilterGrade={setFilterGrade}
                  SKILL_NAMES={SKILL_NAMES}
                  SKILL_LETTERS={SKILL_LETTERS}
                  gradeSymbols={gradeSymbols}
                />
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

            {/* Action-lista + Footer */}
            {scoutTab === 'actions' && hasScout && (
              <ScoutActionsList
                scout={scout}
                filteredActions={filteredActions}
                activeActionId={activeActionId}
                jumpToAction={jumpToAction}
                reviewsByAction={reviewsByAction}
                expandedReviewAction={expandedReviewAction}
                setExpandedReviewAction={setExpandedReviewAction}
                isCoach={isCoach}
                setReviewModal={setReviewModal}
                ackPassword={ackPassword}
                setAckPassword={setAckPassword}
                ackLoading={ackLoading}
                ackError={ackError}
                setAckError={setAckError}
                handleAcknowledge={handleAcknowledge}
                SKILL_LETTERS={SKILL_LETTERS}
                gradeSymbols={gradeSymbols}
                myReviews={myReviews}
                showAcknowledged={showAcknowledged}
                setShowAcknowledged={setShowAcknowledged}
                actionListRef={actionListRef}
                scoutLoading={scoutLoading}
              />
            )}

            {/* Rapport-vy */}
            {scoutTab === 'rapport' && (
              <MatchReport stats={matchStats} onJumpToActions={jumpToPlayerActions} matchType={video?.matchType || 'own'} />
            )}

            {/* Heatmap-vy */}
            {scoutTab === 'heatmap' && scout?.actions && (
              <div style={{ padding: '0.75rem', overflowY: 'auto', flex: 1 }}>
                <CourtHeatmap actions={scout.actions} team="H" teamName={scout.teams?.H}
                  highlightZone={filterStartZone !== 'ALL' ? parseInt(filterStartZone, 10) : null}
                  onZoneSelect={(z) => setFilterStartZone(z ? String(z) : 'ALL')}
                  onActionClick={(a) => jumpToAction(a)}
                  onAutoPlay={(a, list) => jumpToAction(a, list)}
                  gradeSymbols={gradeSymbols} />
                <div style={{ height: 12 }} />
                <CourtHeatmap actions={scout.actions} team="V" teamName={scout.teams?.V}
                  highlightZone={filterStartZone !== 'ALL' ? parseInt(filterStartZone, 10) : null}
                  onZoneSelect={(z) => setFilterStartZone(z ? String(z) : 'ALL')}
                  onActionClick={(a) => jumpToAction(a)}
                  onAutoPlay={(a, list) => jumpToAction(a, list)}
                  gradeSymbols={gradeSymbols} />
              </div>
            )}

            {scoutTab === 'docs' && (
              <DocumentsTab
                videoId={id}
                isUploader={isUploader}
                isCoach={isCoach}
                isAdmin={isAdmin}
                onViewDoc={setViewingDoc}
                documents={documents}
                setDocuments={setDocuments}
              />
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

      {/* Draggable heatmap overlay (Ctrl+Z) */}
      {heatmapOverlay && scout?.actions && (
        <HeatmapOverlay
          scout={scout}
          filterTeam={filterTeam}
          filterPlayer={filterPlayer}
          filterStartZone={filterStartZone}
          setFilterStartZone={setFilterStartZone}
          jumpToAction={jumpToAction}
          gradeSymbols={gradeSymbols}
          overlayPosRef={overlayPosRef}
          onClose={() => setHeatmapOverlay(false)}
        />
      )}

      {/* Dokument-visare overlay */}
      <DocumentViewer document={viewingDoc} onClose={() => setViewingDoc(null)} />
    </div>
  );
}

