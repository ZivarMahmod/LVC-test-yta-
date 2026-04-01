// ===========================================
// LVC Media Hub — DvwSearchPanel
// Draggbar DVW-kodsökning (Ctrl+Q)
// ===========================================
import React, { useEffect, useRef } from 'react';
import { formatVideoTime } from '../../utils/format.js';

const SKILL_COLORS = {
  S: '#4CAF50', R: '#2196F3', E: '#FF9800',
  A: '#F44336', B: '#9C27B0', D: '#00BCD4',
  F: '#607D8B', O: '#795548'
};

export default function DvwSearchPanel({
  searchQuery,
  onSearchChange,
  onClose,
  searchResults,
  activeActionId,
  onJumpToAction
}) {
  const inputRef = useRef(null);
  const [pos, setPos] = React.useState({ x: 60, y: 120 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y,
      zIndex: 10000, width: 300, userSelect: 'none'
    }}>
      <div style={{
        background: 'rgba(15, 15, 30, 0.95)', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(8px)', overflow: 'hidden'
      }}>
        {/* Drag-bar */}
        <div
          onMouseDown={(e) => {
            dragging.current = true;
            dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            e.preventDefault();
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px', cursor: 'grab',
            background: 'rgba(99,102,241,0.2)',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 13 }}>DVW-sökning</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ctrl+Q</span>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, padding: '0 4px' }}
            >x</button>
          </div>
        </div>

        {/* Sökfält */}
        <div style={{ padding: '10px 14px' }}>
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && searchResults.length > 0) {
                onJumpToAction(searchResults[0]);
              }
            }}
            placeholder="Sök DVW-kod, t.ex. *20S#"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface-raised)',
              color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-mono)',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {searchResults.length} träff{searchResults.length !== 1 ? 'ar' : ''}
            </div>
          )}
        </div>

        {/* Resultat */}
        {searchResults.length > 0 && (
          <div style={{ maxHeight: 250, overflowY: 'auto', padding: '0 8px 8px' }}>
            {searchResults.slice(0, 50).map(action => (
              <div
                key={action.id}
                onClick={() => onJumpToAction(action)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                  marginBottom: 2,
                  background: activeActionId === action.id ? 'var(--accent-subtle, rgba(99,102,241,0.15))' : 'transparent',
                  border: activeActionId === action.id ? '1px solid var(--accent)' : '1px solid transparent',
                  transition: 'background 0.1s'
                }}
                onMouseOver={e => { if (activeActionId !== action.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseOut={e => { if (activeActionId !== action.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                  background: SKILL_COLORS[action.skill] || '#666',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 'bold', color: '#fff'
                }}>{action.skill}</span>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--lvc-gold)', minWidth: 55 }}>
                  {action.rawCode}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    #{action.playerNumber} {action.playerName}
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  S{action.set} {formatVideoTime(action.videoTime)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
