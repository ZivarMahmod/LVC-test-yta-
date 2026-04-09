// ===========================================
// LVC Media Hub — Uppladdningssida (Chunked Upload)
// ===========================================
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { videoApi, teamApi, documentApi, adminApi } from '../utils/apiSwitch.js';
import { formatFileSize } from '../utils/format.js';
import './UploadPage.css';

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
const MAX_SIZE = 10 * 1024 * 1024 * 1024;
const CHUNK_SIZE = 95 * 1024 * 1024;

export default function UploadPage() {
  const navigate = useNavigate();
  const generateId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  const fileRef = useRef(null);
  const dvwRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dvwFile, setDvwFile] = useState(null);
  const [pdfFiles, setPdfFiles] = useState([]);
  const pdfRef = useRef(null);
  const [opponent, setOpponent] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const abortRef = useRef(null);
  const [teams, setTeams] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const uploadStart = useRef(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [selectedThumb, setSelectedThumb] = useState(null);
  const [opponents, setOpponents] = useState([]);
  const [matchType, setMatchType] = useState('own');
  const [homeTeam, setHomeTeam] = useState('');

  useEffect(() => {
    teamApi.listTeams().then(data => setTeams(data.teams || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      teamApi.listSeasons(selectedTeam).then(data => setSeasons(data.seasons || [])).catch(() => {});
      adminApi.getThumbnailLibrary(selectedTeam).then(d => {
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
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const uploadId = generateId();
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        if (controller.signal.aborted) throw new Error('Uppladdningen avbröts.');
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
        const chunkFormData = new FormData();
        chunkFormData.append('chunk', chunk, 'chunk');
        chunkFormData.append('uploadId', uploadId);
        chunkFormData.append('chunkIndex', String(i));
        chunkFormData.append('totalChunks', String(totalChunks));
        chunkFormData.append('fileName', file.name);
        await videoApi.uploadChunk(chunkFormData);
        setProgress(Math.round(((i + 1) / totalChunks) * 90));
      }
      setStatus('Sätter ihop filen...');
      const result = await videoApi.uploadComplete({ uploadId, fileName: file.name, opponent, matchDate, description: description || null, teamId: selectedTeam || null, seasonId: selectedSeason || null, thumbnailId: selectedThumb || null, matchType, homeTeam: matchType === 'opponent' && homeTeam ? homeTeam : null });
      setProgress(95);
      if (dvwFile && result.video?.id) {
        setStatus('Laddar upp scout-fil...');
        await videoApi.uploadDvw(result.video.id, dvwFile);
      }
      if (pdfFiles.length > 0 && result.video?.id) {
        setStatus('Laddar upp dokument...');
        for (const pf of pdfFiles) {
          await documentApi.upload(result.video.id, pf, pf.name.replace(/\.[^.]+$/, '')).catch(() => {});
        }
      }
      setProgress(100);
      setStatus('');
      setSuccess('Videon har laddats upp!');
      setTimeout(() => navigate(''), 1500);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        setError('Uppladdningen avbröts.');
      } else {
        setError(err.message || 'Uppladdningen misslyckades.');
      }
      setStatus('');
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    if (abortRef.current) {
      abortRef.current.abort();
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

          {/* PDF / Dokument */}
          <div className="upload-dvw-row">
            <span className="upload-section-label">DOKUMENT</span>
            <button type="button" className="btn-dvw" onClick={() => pdfRef.current?.click()} disabled={uploading}>{pdfFiles.length > 0 ? '+ Lägg till' : 'Välj PDF'}</button>
            <span className="upload-dvw-name">
              {pdfFiles.length > 0 ? `${pdfFiles.length} fil${pdfFiles.length > 1 ? 'er' : ''}` : 'Inga filer valda'}
            </span>
            {pdfFiles.length > 0 && !uploading && (
              <button type="button" className="drop-zone-remove" onClick={() => setPdfFiles([])} style={{marginLeft: 'auto'}}>×</button>
            )}
            <input ref={pdfRef} type="file" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={(e) => { const files = [...e.target.files]; if (files.length > 0) setPdfFiles(prev => [...prev, ...files]); if (pdfRef.current) pdfRef.current.value = ''; }} hidden disabled={uploading} />
          </div>
          {pdfFiles.length > 0 && (
            <div style={{ marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
              {pdfFiles.map((f, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span>📄 {f.name}</span>
                  {!uploading && (
                    <button type="button" onClick={() => setPdfFiles(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: '0.7rem' }}>×</button>
                  )}
                </div>
              ))}
            </div>
          )}

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                <span className="progress-text">{progress}%</span>
                {status && <span style={{ color: 'var(--text-muted)', flex: 1, textAlign: 'right', marginRight: '0.5rem' }}>{status}</span>}
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  style={{
                    padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem',
                    border: '1px solid var(--lvc-red, #f44336)', background: 'rgba(244,67,54,0.1)',
                    color: 'var(--lvc-red, #f44336)', cursor: 'pointer', fontWeight: 600, flexShrink: 0
                  }}
                >Avbryt</button>
              </div>
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
          <div className="form-row" style={{marginBottom: '0.5rem'}}>
            <div className="form-group">
              <label htmlFor="matchType">Matchtyp</label>
              <select id="matchType" value={matchType} onChange={(e) => setMatchType(e.target.value)} disabled={uploading}>
                <option value="own">Egen match</option>
                <option value="opponent">Motståndaranalys</option>
              </select>
            </div>
            {matchType === 'opponent' && (
              <div className="form-group">
                <label htmlFor="homeTeam">Hemmalag</label>
                <input
                  id="homeTeam"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  placeholder="t.ex. Hästhagen"
                  disabled={uploading}
                />
              </div>
            )}
          </div>
          <div className="form-row" style={{marginBottom: '1rem'}}>
            <div className="form-group">
              <label htmlFor="opponent">{matchType === 'opponent' ? 'Bortalag' : 'Motståndare'}</label>
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
            <button type="button" className="btn-secondary" onClick={() => navigate('')} disabled={uploading}>Avbryt</button>
            <button type="submit" className="btn-gold" disabled={uploading || !file || !opponent || !matchDate}>
              {uploading ? 'Laddar upp...' : 'Ladda upp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
