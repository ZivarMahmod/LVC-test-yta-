// ===========================================
// LVC Media Hub — Uppladdningssida (Chunked Upload)
// ===========================================
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { videoApi, teamApi } from '../utils/api.js';
import { formatFileSize } from '../utils/format.js';
import './UploadPage.css';

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
const MAX_SIZE = 10 * 1024 * 1024 * 1024;
const CHUNK_SIZE = 95 * 1024 * 1024;

export default function UploadPage() {
  const navigate = useNavigate();
  const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);
  const fileRef = useRef(null);
  const dvwRef = useRef(null);
  const secondaryRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dvwFile, setDvwFile] = useState(null);
  const [secondaryFile, setSecondaryFile] = useState(null);
  const [opponent, setOpponent] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [secProgress, setSecProgress] = useState(0);
  const [secStatus, setSecStatus] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [teams, setTeams] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const uploadStart = useRef(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [selectedThumb, setSelectedThumb] = useState(null);
  const [opponents, setOpponents] = useState([]);

  useEffect(() => {
    teamApi.listTeams().then(data => setTeams(data.teams || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      teamApi.listSeasons(selectedTeam).then(data => setSeasons(data.seasons || [])).catch(() => {});
      fetch('/api/thumbnail-library?teamId=' + selectedTeam, { credentials: 'include' })
        .then(r => r.json()).then(d => {
          const thumbs = d.thumbnails || [];
          setThumbnails(thumbs);
          setOpponents(thumbs.filter(t => t.name.toLowerCase() !== 'standard').map(t => t.name).sort());
        }).catch(() => {});
      setSelectedSeason('');
      setOpponent('');
      setSelectedThumb(null);
    } else {
      setSeasons([]);
      setSelectedSeason('');
      setThumbnails([]);
      setOpponents([]);
      setOpponent('');
      setSelectedThumb(null);
    }
  }, [selectedTeam]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setError('');
    if (!selected) { setFile(null); return; }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Otillåten filtyp. Använd MP4, MOV eller MKV.');
      setFile(null);
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError('Filen är för stor. Max 10 GB.');
      setFile(null);
      return;
    }
    setFile(selected);
  };

  useEffect(() => {
    if (!opponent || thumbnails.length === 0) { setSelectedThumb(null); return; }
    const match = thumbnails.find(t => t.name.toLowerCase() === opponent.toLowerCase());
    if (match) {
      setSelectedThumb(match.filePath);
    } else {
      const standard = thumbnails.find(t => t.name.toLowerCase() === 'standard');
      setSelectedThumb(standard ? standard.filePath : null);
    }
  }, [opponent, thumbnails]);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange({ target: { files: [dropped] } });
  };

  const getCsrfToken = async () => {
    const res = await fetch('/api/auth/csrf-token', { credentials: 'include' });
    const data = await res.json();
    return data.csrfToken;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!file || !opponent || !matchDate) {
      setError('Fyll i alla obligatoriska fält och välj en fil.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const csrfToken = await getCsrfToken();
      const uploadId = generateId();
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        if (i === 0) uploadStart.current = Date.now();
        const elapsed = (Date.now() - uploadStart.current) / 1000;
        const bytesUploaded = i * CHUNK_SIZE;
        const speed = bytesUploaded > 0 ? bytesUploaded / elapsed : 0;
        const bytesLeft = file.size - bytesUploaded;
        const secsLeft = speed > 0 ? Math.round(bytesLeft / speed) : 0;
        const timeStr = secsLeft > 60 ? `${Math.floor(secsLeft / 60)}m ${secsLeft % 60}s` : `${secsLeft}s`;
        setStatus(i === 0 ? `Del 1 av ${totalChunks}` : `Del ${i + 1} av ${totalChunks} — ~${timeStr} kvar`);
        const formData = new FormData();
        formData.append('chunk', chunk, 'chunk');
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(i));
        formData.append('totalChunks', String(totalChunks));
        formData.append('fileName', file.name);
        const res = await fetch('/api/videos/upload/chunk', {
          method: 'POST', credentials: 'include',
          headers: { 'X-CSRF-Token': csrfToken },
          body: formData
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Uppladdning misslyckades');
        }
        setProgress(Math.round(((i + 1) / totalChunks) * 90));
      }
      setStatus('Sätter ihop filen...');
      const completeRes = await fetch('/api/videos/upload/complete', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ uploadId, fileName: file.name, opponent, matchDate, description: description || null, teamId: selectedTeam || null, seasonId: selectedSeason || null, thumbnailId: selectedThumb || null })
      });
      if (!completeRes.ok) {
        const data = await completeRes.json();
        throw new Error(data.error || 'Kunde inte slutföra uppladdningen');
      }
      const result = await completeRes.json();
      setProgress(95);
      if (secondaryFile && result.video?.id) {
        const secUploadId = generateId();
        const secTotalChunks = Math.ceil(secondaryFile.size / CHUNK_SIZE);
        const secUploadStart = Date.now();
        setSecProgress(0);
        for (let i = 0; i < secTotalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, secondaryFile.size);
          const chunk = secondaryFile.slice(start, end);
          const elapsed = (Date.now() - secUploadStart) / 1000;
          const bytesUploaded = i * CHUNK_SIZE;
          const speed = bytesUploaded > 0 ? bytesUploaded / elapsed : 0;
          const bytesLeft = secondaryFile.size - bytesUploaded;
          const secsLeft = speed > 0 ? Math.round(bytesLeft / speed) : 0;
          const timeStr = secsLeft > 60 ? `${Math.floor(secsLeft / 60)}m ${secsLeft % 60}s` : `${secsLeft}s`;
          setSecStatus(i === 0 ? `Del 1 av ${secTotalChunks}` : `Del ${i + 1} av ${secTotalChunks} — ~${timeStr} kvar`);
          const formData = new FormData();
          formData.append('chunk', chunk, 'chunk');
          formData.append('uploadId', secUploadId);
          formData.append('chunkIndex', String(i));
          formData.append('totalChunks', String(secTotalChunks));
          formData.append('fileName', secondaryFile.name);
          const secRes = await fetch(`/api/videos/${result.video.id}/secondary/chunk`, {
            method: 'POST', credentials: 'include',
            headers: { 'X-CSRF-Token': csrfToken },
            body: formData
          });
          if (!secRes.ok) throw new Error('Vinkel 2 chunk-uppladdning misslyckades');
          setSecProgress(Math.round(((i + 1) / secTotalChunks) * 95));
        }
        setSecStatus('Sätter ihop vinkel 2...');
        setSecProgress(98);
        await fetch(`/api/videos/${result.video.id}/secondary/complete`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ uploadId: secUploadId, fileName: secondaryFile.name })
        });
        setSecProgress(100);
        setSecStatus('');
      }
      if (dvwFile && result.video?.id) {
        setStatus('Laddar upp scout-fil...');
        const dvwForm = new FormData();
        dvwForm.append('dvw', dvwFile);
        await fetch(`/api/videos/${result.video.id}/dvw`, {
          method: 'POST', credentials: 'include',
          headers: { 'X-CSRF-Token': csrfToken },
          body: dvwForm
        });
      }
      setProgress(100);
      setStatus('');
      setSuccess('Videon har laddats upp!');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.message || 'Uppladdningen misslyckades.');
      setStatus('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-page">
      <div className="upload-card card">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {/* Drop zone */}
          <div
            className={`drop-zone ${file ? 'has-file' : ''} ${uploading ? 'uploading' : ''}`}
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="drop-zone-file">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
                <div className="drop-zone-file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                {!uploading && (
                  <button type="button" className="drop-zone-remove" onClick={(e) => { e.stopPropagation(); setFile(null); }}>×</button>
                )}
              </div>
            ) : (
              <div className="drop-zone-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.4}}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p>Dra och släpp en videofil här</p>
                <span>MP4, MOV, MKV — max 10 GB</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".mp4,.mov,.mkv,video/mp4,video/quicktime,video/x-matroska" onChange={handleFileChange} hidden disabled={uploading} />
          </div>

          {/* Vinkel 2 */}
          <div className="upload-dvw-row">
            <span className="upload-section-label">VINKEL 2</span>
            <button type="button" className="btn-dvw" onClick={() => secondaryRef.current?.click()} disabled={uploading}>Välj fil (valfritt)</button>
            <span className="upload-dvw-name">{secondaryFile ? secondaryFile.name : 'Ingen fil vald'}</span>
            {secondaryFile && !uploading && (
              <button type="button" className="drop-zone-remove" onClick={() => setSecondaryFile(null)} style={{marginLeft: 'auto'}}>×</button>
            )}
            <input ref={secondaryRef} type="file" accept="video/*" onChange={(e) => setSecondaryFile(e.target.files[0] || null)} hidden disabled={uploading} />
          </div>
          {/* DVW */}
          <div className="upload-dvw-row">
            <span className="upload-section-label">SCOUT-FIL</span>
            <button type="button" className="btn-dvw" onClick={() => dvwRef.current?.click()} disabled={uploading}>Välj DVW</button>
            <span className="upload-dvw-name">{dvwFile ? dvwFile.name : 'Ingen fil vald'}</span>
            {dvwFile && !uploading && (
              <button type="button" className="drop-zone-remove" onClick={() => setDvwFile(null)} style={{marginLeft: 'auto'}}>×</button>
            )}
            <input ref={dvwRef} type="file" accept=".dvw" onChange={(e) => setDvwFile(e.target.files[0] || null)} hidden disabled={uploading} />
          </div>

          {/* Thumbnail preview */}
          {selectedThumb && (
            <div style={{ marginBottom: '1.5rem' }}>
              <p className="upload-section-label" style={{ marginBottom: '0.6rem' }}>THUMBNAIL</p>
              <div style={{ maxWidth: '220px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--lvc-blue-light)' }}>
                <img
                  src={`/api/thumbnail-library/image/${selectedThumb}`}
                  alt="Vald thumbnail"
                  style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                />
              </div>
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div className="upload-progress">
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Huvudvideo</p>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                <span className="progress-text">{progress}%</span>
                {status && <span style={{ color: 'var(--text-muted)' }}>{status}</span>}
              </div>
              {secondaryFile && (
                <>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Vinkel 2</p>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${secProgress}%`, background: 'var(--accent-secondary, #6366f1)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span className="progress-text">{secProgress}%</span>
                    {secStatus && <span style={{ color: 'var(--text-muted)' }}>{secStatus}</span>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Placering */}
          <p className="upload-section-label" style={{marginBottom: '0.75rem'}}>PLACERING</p>
          <div className="form-row" style={{marginBottom: '1rem'}}>
            <div className="form-group">
              <label htmlFor="team">Lag</label>
              <select id="team" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} disabled={uploading}>
                <option value="">Välj lag</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="season">Säsong</label>
              <select id="season" value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} disabled={uploading || !selectedTeam}>
                <option value="">Välj säsong</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Matchinfo */}
          <p className="upload-section-label" style={{marginBottom: '0.75rem'}}>MATCHINFO</p>
          <div className="form-row" style={{marginBottom: '1rem'}}>
            <div className="form-group">
              <label htmlFor="opponent">Motståndare</label>
              <input
                id="opponent"
                list="opponent-list"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Skriv eller välj motståndare"
                required
                disabled={uploading || !selectedTeam}
              />
              <datalist id="opponent-list">
                {opponents.map(o => <option key={o} value={o} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label htmlFor="matchDate">Datum</label>
              <input id="matchDate" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required disabled={uploading} />
            </div>
          </div>



          {/* Beskrivning */}
          <div className="form-group" style={{marginBottom: '1.75rem'}}>
            <label htmlFor="description">Beskrivning <span style={{color: 'var(--text-muted)', fontWeight: 400}}>valfri</span></label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="t.ex. Kvartsfinal, hemmaplan, vinst 3-1" rows={2} disabled={uploading} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/')} disabled={uploading}>Avbryt</button>
            <button type="submit" className="btn-gold" disabled={uploading || !file || !opponent || !matchDate}>
              {uploading ? 'Laddar upp...' : 'Ladda upp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
