// ===========================================
// Kvittra — Drag & Drop File Zone
// ===========================================
import { useState, useRef } from 'react';

export default function DragDropZone({ onFiles, accept, label, multiple = false }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    if (files.length > 0 && onFiles) {
      onFiles(multiple ? files : [files[0]]);
    }
  };

  const handleClick = () => inputRef.current?.click();

  const handleInput = (e) => {
    const files = [...e.target.files];
    if (files.length > 0 && onFiles) {
      onFiles(multiple ? files : [files[0]]);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? '#3b82f6' : '#334155'}`,
        borderRadius: 12,
        padding: '32px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: dragging ? 'rgba(59,130,246,0.08)' : 'transparent',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInput}
        style={{ display: 'none' }}
      />
      <div style={{ fontSize: 32, marginBottom: 8 }}>
        {dragging ? '📂' : '📁'}
      </div>
      <p style={{ color: dragging ? '#93c5fd' : '#94a3b8', fontSize: 14, margin: '0 0 4px' }}>
        {dragging ? 'Släpp filen här' : (label || 'Dra och släpp fil här')}
      </p>
      <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>
        eller klicka för att välja
      </p>
    </div>
  );
}
