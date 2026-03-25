// ===========================================
// LVC Media Hub — Uppladdningssida
// ===========================================
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { videoApi } from '../utils/api.js';
import './UploadPage.css';

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

export default function UploadPage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [opponent, setOpponent] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setError('');

    if (!selected) {
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Otillåten filtyp. Använd MP4, MOV eller MKV.');
      setFile(null);
      return;
    }

    if (selected.size > MAX_SIZE) {
      setError('Filen är för stor. Maximal storlek är 10 GB.');
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      const fakeEvent = { target: { files: [dropped] } };
      handleFileChange(fakeEvent);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!file || !opponent || !matchDate) {
      setError('Fyll i alla obligatoriska fält och välj en fil.');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('opponent', opponent);
    formData.append('matchDate', matchDate);
    if (description) formData.append('description', description);

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
                  <button
                    type="button"
                    className="drop-zone-remove"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    ×
                  </button>
                )}
              </div>
            ) : (
              <div className="drop-zone-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p>Dra och släpp en videofil här</p>
                <span>eller klicka för att välja — MP4, MOV, MKV (max 10 GB)</span>
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
              <label htmlFor="opponent">Motståndare *</label>
              <input
                id="opponent"
                type="text"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="t.ex. Norrköping"
                required
                disabled={uploading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="matchDate">Matchdatum *</label>
              <input
                id="matchDate"
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                required
                disabled={uploading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Beskrivning (valfri)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="t.ex. Kvartsfinal, hemmaplan, vinst 3-1"
              rows={3}
              disabled={uploading}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/')}
              disabled={uploading}
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="btn-gold"
              disabled={uploading || !file || !opponent || !matchDate}
            >
              {uploading ? 'Laddar upp...' : 'Ladda upp video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
