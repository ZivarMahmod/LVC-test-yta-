import { useState, useRef, useEffect } from 'react';
import { documentApi } from '../../utils/apiSwitch.js';

export default function DocumentsTab({ videoId, isUploader, isCoach, isAdmin, onViewDoc, documents, setDocuments }) {
  const [docUploading, setDocUploading] = useState(false);
  const docFileRef = useRef(null);

  return (
    <div style={{ padding: '0.75rem', overflowY: 'auto', flex: 1 }}>
      {(isUploader || isCoach || isAdmin) && (
        <>
          <input ref={docFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            setDocUploading(true);
            try {
              const res = await documentApi.upload(videoId, f, f.name.replace(/\.[^.]+$/, ''));
              setDocuments(prev => [res.document, ...prev]);
            } catch { alert('Kunde inte ladda upp dokumentet.'); }
            setDocUploading(false);
            if (docFileRef.current) docFileRef.current.value = '';
          }} />
          <button
            onClick={() => docFileRef.current?.click()}
            disabled={docUploading}
            style={{
              width: '100%', padding: '0.5rem', borderRadius: 6, fontSize: '0.8rem',
              border: '1px dashed var(--border)', background: 'var(--surface-2)',
              color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '0.5rem'
            }}
          >{docUploading ? 'Laddar upp...' : '+ Ladda upp PDF / bild'}</button>
        </>
      )}
      {documents.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem 0' }}>
          Inga dokument uppladdade.
        </div>
      ) : (
        documents.map(doc => (
          <div key={doc.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.5rem', marginBottom: 2, borderRadius: 6,
            background: 'var(--surface-2)', fontSize: '0.8rem'
          }}>
            <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>
              {doc.filePath?.endsWith('.pdf') ? '📄' : '🖼️'}
            </span>
            <button
              onClick={() => onViewDoc(doc)}
              style={{ flex: 1, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={doc.name}
            >{doc.name}</button>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
              {Math.round(doc.fileSize / 1024)} KB
            </span>
            {isAdmin && (
              <button
                onClick={async () => {
                  if (!confirm(`Ta bort "${doc.name}"?`)) return;
                  try {
                    await documentApi.remove(doc.id);
                    setDocuments(prev => prev.filter(d => d.id !== doc.id));
                  } catch { alert('Kunde inte ta bort.'); }
                }}
                style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}
              >x</button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
