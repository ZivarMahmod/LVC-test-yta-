import { useState, useRef, useCallback } from 'react';
import './DraggableScoreboard.css';

const fontSizeMap = { small: '0.65rem', medium: '0.8rem', large: '1rem' };

export default function DraggableScoreboard({
  currentScore,
  homeTeam,
  awayTeam,
  containerRef,
  settings,
  onUpdateSettings,
}) {
  const [minimized, setMinimized] = useState(false);
  const [dragPos, setDragPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e) => {
    if (settings.pinned || minimized) return;
    const container = containerRef?.current;
    if (!container) return;

    const rect = e.currentTarget.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.target.setPointerCapture(e.pointerId);
    setDragging(true);
  }, [settings.pinned, minimized, containerRef]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    const container = containerRef?.current;
    const el = e.currentTarget;
    if (!container || !el) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const maxX = ((containerRect.width - elRect.width) / containerRect.width) * 100;
    const maxY = ((containerRect.height - elRect.height) / containerRect.height) * 100;

    let x = ((e.clientX - containerRect.left - offsetRef.current.x) / containerRect.width) * 100;
    let y = ((e.clientY - containerRect.top - offsetRef.current.y) / containerRect.height) * 100;

    x = Math.max(0, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));

    setDragPos({ x, y });
  }, [dragging, containerRef]);

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (dragPos) {
      onUpdateSettings({ position: { x: dragPos.x, y: dragPos.y } });
      setDragPos(null);
    }
  }, [dragging, dragPos, onUpdateSettings]);

  if (!settings.visible || !currentScore || settings.opacity === 0) return null;

  const pos = dragPos || settings.position;
  const computedStyle = {
    position: 'absolute',
    left: pos ? `${pos.x}%` : '50%',
    top: pos ? `${pos.y}%` : '8px',
    transform: pos ? 'none' : 'translateX(-50%)',
    opacity: settings.opacity,
    fontSize: fontSizeMap[settings.fontSize] || '0.8rem',
    cursor: settings.pinned ? 'default' : (dragging ? 'grabbing' : 'grab'),
    touchAction: 'none',
    userSelect: 'none',
    zIndex: 10,
  };

  if (minimized) {
    return (
      <div className="draggable-scoreboard draggable-scoreboard-minimized" style={computedStyle}>
        <span className="scoreboard-score-mini">
          {currentScore.setScore?.H ?? 0} - {currentScore.setScore?.V ?? 0}
        </span>
        <button onClick={() => setMinimized(false)} title="Visa scoreboard">+</button>
      </div>
    );
  }

  return (
    <div
      className="draggable-scoreboard"
      style={computedStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="scoreboard-controls">
        <button onClick={() => onUpdateSettings({ pinned: !settings.pinned })} title={settings.pinned ? 'Lås upp' : 'Lås'}>
          {settings.pinned ? '🔒' : '🔓'}
        </button>
        <button onClick={() => setMinimized(true)} title="Minimera">−</button>
      </div>
      <span className="scoreboard-set">Set {currentScore.set || '?'}</span>
      <span className="scoreboard-home">{homeTeam}</span>
      <span className="scoreboard-score">
        {currentScore.setScore?.H ?? 0} - {currentScore.setScore?.V ?? 0}
      </span>
      <span className="scoreboard-away">{awayTeam}</span>
    </div>
  );
}
