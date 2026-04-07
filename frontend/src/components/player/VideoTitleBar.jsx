import { useState } from 'react';
import { videoApi } from '../../utils/api.js';

export default function VideoTitleBar({ video, isAdmin, isUploader, onUpdate, onDelete }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);

  const handleSaveTitle = async () => {
    if (!titleInput.trim() || titleInput.trim() === video.title) {
      setEditingTitle(false);
      return;
    }
    setTitleSaving(true);
    try {
      const data = await videoApi.updateTitle(video.id, titleInput.trim());
      onUpdate({ title: data.title, opponent: data.opponent });
    } catch {}
    setTitleSaving(false);
    setEditingTitle(false);
  };

  return (
    <div className="video-title-bar">
      {editingTitle ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1 }}>
          <input
            autoFocus
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            placeholder="Videotitel"
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
          onClick={() => { if (isAdmin) { setTitleInput(video.title || ''); setEditingTitle(true); } }}
          style={isAdmin ? { cursor: 'pointer', borderBottom: '1px dashed var(--border-default)' } : {}}
          title={isAdmin ? 'Klicka för att ändra titel' : undefined}
        >{video.title}</h1>
      )}
      {(isAdmin || isUploader) && (
        <button className="btn-danger btn-sm" onClick={onDelete}>Ta bort</button>
      )}
    </div>
  );
}
