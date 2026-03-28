// ===========================================
// LVC Media Hub \u2014 Uppladdningssida
// ===========================================
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { videoApi, teamApi } from '../utils/api.js';
import './UploadPage.css';

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

export default function UploadPage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const dvwRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dvwFile, setDvwFile] = useState(null);
  const [opponent, setOpponent] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Lag & sasong
  const [teams, setTeams] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');

  useEffect(() => {
    teamApi.listTeams().then(data => setTeams(data.teams || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      teamApi.listSeasons(selectedTeam).then(data => setSeasons(data.seasons || [])).catch(() => {});
      setSelectedSeason('');
    } else {
      setSeasons([]);
      setSelectedSeason('');
    }
  }, [selectedTeam]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setError('');
    if (!selected) { setFile(null); return; }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Otillaten filtyp. Anvand MP4, MOV eller MKV.');
      setFile(null);
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError('Filen ar for stor. Maximal storlek ar 10 GB.');
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange({ target: { files: [dropped] } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!file || !opponent || !matchDate) {
      setError('Fyll i alla obligatoriska falt och valj en fil.');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('opponent', opponent);
    formData.append('matchDate', matchDate);
    if (description) formData.append('description', description);
    if (dvwFile) formData.append('dvw', dvwFile);
    if (selectedTeam) formData.append('teamId', selectedTeam);
    if (selectedSeason) formData.append('seasonId', selectedSeason);

    setUploading(true);
    setProgress(0);

    try {
      await videoApi.upload(formData, setProgress);
      setSuccess('Videon har laddats upp!');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.message || 'Uppladdningen misslyckades.');
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="upload-page">
      <div className="page-header">
        <h1>Ladda upp match</h1>
        <p>Ladda upp en matchvideo till klubbens arkiv</p>
      </div>

      <div className="upload-card card">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {/* Filval */}
          <div
            className={`drop-zone ${file ? 'has-file' : ''} ${uploading ? 'uploading' : ''}`}
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="drop-zone-file">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
                <div className="drop-zone-file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatSize(file.size)}</span>
                </div>
                {!uploading && (
                  <button type="button" className="drop-zone-remove" onClick={(e) => { e.stopPropagation(); setFile(null); }}>x</button>
                )}
              </div>
            ) : (
              <div className="drop-zone-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p>Dra och slapp en videofil har</p>
                <span>eller klicka for att valja \u2014 MP4, MOV, MKV (max 10 GB)</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".mp4,.mov,.mkv,video/mp4,video/quicktime,video/x-matroska"
              onChange={handleFileChange}
              hidden
              disabled={uploading}
            />
          </div>

          {/* DVW-fil */}
          <div style={{ marginTop: '0.75rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.4rem', display: 'block' }}>
              Scout-fil (DVW) \u2014 valfri
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.6rem 0.75rem', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface-2)'
            }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => dvwRef.current?.click()}
                disabled={uploading}
              >
                Valj DVW-fil
              </button>
              <span style={{ fontSize: '0.85rem', color: dvwFile ? 'var(--text)' : 'var(--text-muted)' }}>
                {dvwFile ? dvwFile.name : 'Ingen fil vald'}
              </span>
              {dvwFile && !uploading && (
                <button type="button" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }} onClick={() => setDvwFile(null)}>x</button>
              )}
              <input
                ref={dvwRef}
                type="file"
                accept=".dvw"
                onChange={(e) => setDvwFile(e.target.files[0] || null)}
                hidden
                disabled={uploading}
              />
            </div>
          </div>

          {/* Progressbar */}
          {uploading && (
            <div className="upload-progress">
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="progress-text">{progress}%</span>
            </div>
          )}

          {/* Matchinfo */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="opponent">Motstandare *</label>
              <input id="opponent" type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="t.ex. Norrkoping" required disabled={uploading} />
            </div>
            <div className="form-group">
              <label htmlFor="matchDate">Matchdatum *</label>
              <input id="matchDate" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required disabled={uploading} />
            </div>
          </div>

          {/* Lag & Sasong */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="team">Lag</label>
              <select id="team" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} disabled={uploading}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.9rem' }}>
                <option value="">Valj lag (valfritt)</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="season">Sasong</label>
              <select id="season" value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} disabled={uploading || !selectedTeam}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.9rem' }}>
                <option value="">Valj sasong (valfritt)</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Beskrivning (valfri)</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="t.ex. Kvartsfinal, hemmaplan, vinst 3-1" rows={3} disabled={uploading} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/')} disabled={uploading}>Avbryt</button>
            <button type="submit" className="btn-gold" disabled={uploading || !file || !opponent || !matchDate}>
              {uploading ? 'Laddar upp...' : 'Ladda upp video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
