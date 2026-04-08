import { useState, useEffect, useCallback } from 'react';
import { supabaseKvittra } from '../../utils/supabaseClient.js';
import { supabase } from '../../utils/supabaseClient.js';
import { useOrg } from '../../context/OrgContext.jsx';
import './UploaderPanel.css';

export default function UploaderPanel() {
  const { org } = useOrg();

  // --- State: matches ---
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [videoCounts, setVideoCounts] = useState({});

  // --- State: create match form ---
  const [newMatch, setNewMatch] = useState({
    title: '',
    match_date: '',
    match_type: 'match',
    team_id: '',
  });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);

  // --- State: upload ---
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [dvwFile, setDvwFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMsg, setUploadMsg] = useState(null);

  // --- Load matches & teams ---
  const loadMatches = useCallback(async () => {
    if (!org?.id) return;
    setLoadingMatches(true);
    try {
      const { data, error } = await supabaseKvittra
        .from('matches')
        .select('*, team:teams(name)')
        .eq('org_id', org.id)
        .order('match_date', { ascending: false });
      if (error) throw error;
      setMatches(data || []);
    } catch (err) {
      console.error('Failed to load matches:', err);
    } finally {
      setLoadingMatches(false);
    }
  }, [org?.id]);

  const loadTeams = useCallback(async () => {
    if (!org?.id) return;
    try {
      const { data, error } = await supabaseKvittra
        .from('teams')
        .select('id, name')
        .eq('org_id', org.id)
        .order('name');
      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  }, [org?.id]);

  useEffect(() => {
    loadMatches();
    loadTeams();
  }, [loadMatches, loadTeams]);

  // --- Load video count for expanded match ---
  useEffect(() => {
    if (!expandedMatchId || videoCounts[expandedMatchId] !== undefined) return;
    let cancelled = false;
    async function fetchCount() {
      try {
        const { count, error } = await supabaseKvittra
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('match_id', expandedMatchId);
        if (!cancelled && !error) {
          setVideoCounts(prev => ({ ...prev, [expandedMatchId]: count }));
        }
      } catch (err) {
        console.error('Failed to load video count:', err);
      }
    }
    fetchCount();
    return () => { cancelled = true; };
  }, [expandedMatchId, videoCounts]);

  // --- Create match ---
  async function handleCreateMatch(e) {
    e.preventDefault();
    if (!newMatch.title.trim()) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      const row = {
        org_id: org.id,
        title: newMatch.title.trim(),
        match_date: newMatch.match_date || null,
        match_type: newMatch.match_type,
        team_id: newMatch.team_id || null,
        visibility: 'internal',
      };
      const { error } = await supabaseKvittra.from('matches').insert(row);
      if (error) throw error;
      setCreateMsg({ type: 'success', text: 'Match skapad!' });
      setNewMatch({ title: '', match_date: '', match_type: 'match', team_id: '' });
      await loadMatches();
    } catch (err) {
      console.error('Create match error:', err);
      setCreateMsg({ type: 'error', text: `Kunde inte skapa match: ${err.message}` });
    } finally {
      setCreating(false);
    }
  }

  // --- Upload ---
  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedMatchId) return;
    if (!videoFile && !dvwFile) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadMsg(null);

    try {
      const totalSteps = (videoFile ? 2 : 0) + (dvwFile ? 2 : 0);
      let completedSteps = 0;
      const tick = () => {
        completedSteps++;
        setUploadProgress(Math.round((completedSteps / totalSteps) * 100));
      };

      // Upload video
      if (videoFile) {
        const videoPath = `${org.id}/${selectedMatchId}/${videoFile.name}`;
        const { error: storageErr } = await supabase.storage
          .from('videos')
          .upload(videoPath, videoFile, { upsert: true });
        if (storageErr) throw storageErr;
        tick();

        const { data: urlData } = supabase.storage
          .from('videos')
          .getPublicUrl(videoPath);

        const { error: insertErr } = await supabaseKvittra
          .from('videos')
          .insert({
            match_id: selectedMatchId,
            org_id: org.id,
            storage_url: urlData.publicUrl,
          });
        if (insertErr) throw insertErr;
        tick();
      }

      // Upload DVW
      if (dvwFile) {
        const dvwPath = `${org.id}/${selectedMatchId}/${dvwFile.name}`;
        const { error: storageErr } = await supabase.storage
          .from('dvw-files')
          .upload(dvwPath, dvwFile, { upsert: true });
        if (storageErr) throw storageErr;
        tick();

        const { data: urlData } = supabase.storage
          .from('dvw-files')
          .getPublicUrl(dvwPath);

        const { error: updateErr } = await supabaseKvittra
          .from('matches')
          .update({ dvw_file_url: urlData.publicUrl })
          .eq('id', selectedMatchId);
        if (updateErr) throw updateErr;
        tick();
      }

      setUploadMsg({ type: 'success', text: 'Uppladdning klar!' });
      setVideoFile(null);
      setDvwFile(null);
      // Reset file inputs
      const videoInput = document.getElementById('up-video-file');
      const dvwInput = document.getElementById('up-dvw-file');
      if (videoInput) videoInput.value = '';
      if (dvwInput) dvwInput.value = '';
      // Refresh video counts
      setVideoCounts(prev => {
        const copy = { ...prev };
        delete copy[selectedMatchId];
        return copy;
      });
      await loadMatches();
    } catch (err) {
      console.error('Upload error:', err);
      setUploadMsg({ type: 'error', text: `Uppladdning misslyckades: ${err.message}` });
    } finally {
      setUploading(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Datum saknas';
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  if (!org?.id) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <div className="uploader-panel">
      <h1 className="uploader-panel-title">Uppladdningspanel</h1>

      {/* ====== SECTION 1: Matcher ====== */}
      <section className="up-section">
        <h2 className="up-section-title">Matcher</h2>

        {loadingMatches ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : matches.length === 0 ? (
          <p className="up-empty">Inga matcher hittades. Skapa en ny match nedan.</p>
        ) : (
          <ul className="up-match-list">
            {matches.map(m => (
              <li key={m.id} className="up-match-item">
                <button
                  className="up-match-row"
                  onClick={() =>
                    setExpandedMatchId(prev => (prev === m.id ? null : m.id))
                  }
                >
                  <div className="up-match-main">
                    <span className="up-match-title">{m.title}</span>
                    <span className={`badge up-badge-${m.match_type}`}>
                      {m.match_type === 'scout' ? 'Scout' : 'Match'}
                    </span>
                  </div>
                  <div className="up-match-meta">
                    {m.team?.name && (
                      <span className="up-match-team">{m.team.name}</span>
                    )}
                    <span className="up-match-date">{formatDate(m.match_date)}</span>
                  </div>
                  <span className="up-match-chevron">
                    {expandedMatchId === m.id ? '▾' : '▸'}
                  </span>
                </button>

                {expandedMatchId === m.id && (
                  <div className="up-match-detail">
                    <span className="up-match-video-count">
                      Uppladdade videor:{' '}
                      <strong>
                        {videoCounts[m.id] !== undefined ? videoCounts[m.id] : '...'}
                      </strong>
                    </span>
                    {m.dvw_file_url && (
                      <span className="up-match-dvw-tag badge">DVW uppladdad</span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ====== SECTION 2: Skapa match ====== */}
      <section className="up-section">
        <h2 className="up-section-title">Skapa match</h2>

        {createMsg && (
          <div className={`alert alert-${createMsg.type}`}>{createMsg.text}</div>
        )}

        <form className="up-form" onSubmit={handleCreateMatch}>
          <div className="form-group">
            <label htmlFor="cm-title">Titel *</label>
            <input
              id="cm-title"
              type="text"
              required
              placeholder="t.ex. LVC vs Hylte/Halmstad"
              value={newMatch.title}
              onChange={e =>
                setNewMatch(prev => ({ ...prev, title: e.target.value }))
              }
            />
          </div>

          <div className="up-form-row">
            <div className="form-group">
              <label htmlFor="cm-date">Matchdatum</label>
              <input
                id="cm-date"
                type="date"
                value={newMatch.match_date}
                onChange={e =>
                  setNewMatch(prev => ({ ...prev, match_date: e.target.value }))
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="cm-type">Typ</label>
              <select
                id="cm-type"
                value={newMatch.match_type}
                onChange={e =>
                  setNewMatch(prev => ({ ...prev, match_type: e.target.value }))
                }
              >
                <option value="match">Match</option>
                <option value="scout">Scout</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cm-team">Lag</label>
            <select
              id="cm-team"
              value={newMatch.team_id}
              onChange={e =>
                setNewMatch(prev => ({ ...prev, team_id: e.target.value }))
              }
            >
              <option value="">-- Välj lag --</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Skapar...' : 'Skapa match'}
            </button>
          </div>
        </form>
      </section>

      {/* ====== SECTION 3: Ladda upp ====== */}
      <section className="up-section">
        <h2 className="up-section-title">Ladda upp</h2>

        {uploadMsg && (
          <div className={`alert alert-${uploadMsg.type}`}>{uploadMsg.text}</div>
        )}

        <form className="up-form" onSubmit={handleUpload}>
          <div className="form-group">
            <label htmlFor="up-match-select">Välj match</label>
            <select
              id="up-match-select"
              value={selectedMatchId}
              onChange={e => setSelectedMatchId(e.target.value)}
              required
            >
              <option value="">-- Välj match --</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>
                  {m.title} ({formatDate(m.match_date)})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="up-video-file">Video (.mp4, .mov, .mkv)</label>
            <input
              id="up-video-file"
              type="file"
              accept=".mp4,.mov,.mkv"
              onChange={e => setVideoFile(e.target.files[0] || null)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="up-dvw-file">DVW-fil (.dvw)</label>
            <input
              id="up-dvw-file"
              type="file"
              accept=".dvw"
              onChange={e => setDvwFile(e.target.files[0] || null)}
            />
          </div>

          {uploading && (
            <div className="up-progress">
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="up-progress-label">{uploadProgress}%</span>
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={uploading || (!videoFile && !dvwFile)}
            >
              {uploading ? 'Laddar upp...' : 'Ladda upp'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
