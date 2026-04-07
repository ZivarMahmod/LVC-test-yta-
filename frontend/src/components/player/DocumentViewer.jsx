export default function DocumentViewer({ document, onClose }) {
  if (!document) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        marginBottom: '0.5rem', color: '#fff'
      }} onClick={e => e.stopPropagation()}>
        <span style={{ fontSize: '1rem', fontWeight: 600 }}>{document.name}</span>
        <a
          href={`/api/videos/documents/${document.id}/view`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#93c5fd', fontSize: '0.8rem', textDecoration: 'none' }}
        >Öppna i ny flik ↗</a>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid #475569', color: '#fff',
            borderRadius: 6, padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem'
          }}
        >Stäng</button>
      </div>
      <div onClick={e => e.stopPropagation()} style={{ width: '90vw', height: '85vh', borderRadius: 8, overflow: 'hidden' }}>
        {document.filePath?.endsWith('.pdf') ? (
          <iframe
            src={`/api/videos/documents/${document.id}/view`}
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            title={document.name}
          />
        ) : (
          <img
            src={`/api/videos/documents/${document.id}/view`}
            alt={document.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 'auto', display: 'block' }}
          />
        )}
      </div>
    </div>
  );
}
