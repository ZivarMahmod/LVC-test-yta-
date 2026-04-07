import { useRef } from 'react';
import CourtHeatmap from './CourtHeatmap.jsx';

export default function HeatmapOverlay({
  scout, filterTeam, filterPlayer, filterStartZone,
  setFilterStartZone, jumpToAction, gradeSymbols,
  overlayPosRef, onClose,
}) {
  const heatmapDragRef = useRef(null);

  const teamName = filterPlayer !== 'ALL'
    ? (() => { const [t, n] = filterPlayer.split('-'); const p = scout.players.find(pl => parseInt(pl.number, 10) === parseInt(n, 10) && pl.team === t); return p ? p.name : ''; })()
    : '';

  return (
    <div
      ref={heatmapDragRef}
      style={{
        position: 'fixed', left: 0, top: 0,
        transform: `translate(${overlayPosRef.current.x}px, ${overlayPosRef.current.y}px)`,
        width: 300, zIndex: 1000,
        background: '#0f172a', border: '1px solid #334155',
        borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        userSelect: 'none', willChange: 'transform'
      }}
    >
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          const el = heatmapDragRef.current;
          if (!el) return;
          const startX = e.clientX - overlayPosRef.current.x;
          const startY = e.clientY - overlayPosRef.current.y;
          const onMove = (ev) => {
            ev.preventDefault();
            overlayPosRef.current = { x: ev.clientX - startX, y: ev.clientY - startY };
            el.style.transform = `translate(${overlayPosRef.current.x}px, ${overlayPosRef.current.y}px)`;
          };
          const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
        style={{
          padding: '4px 10px', cursor: 'grab',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
        }}
      >
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem'
        }}>x</button>
      </div>
      <div style={{ padding: '0 8px 8px' }}>
        <CourtHeatmap actions={scout.actions} team={filterTeam !== 'ALL' ? filterTeam : undefined}
          teamName={teamName}
          highlightZone={filterStartZone !== 'ALL' ? parseInt(filterStartZone, 10) : null}
          onZoneSelect={(z) => setFilterStartZone(z ? String(z) : 'ALL')}
          onActionClick={(a) => jumpToAction(a)}
          onAutoPlay={(a, list) => jumpToAction(a, list)}
          gradeSymbols={gradeSymbols}
          compact />
      </div>
    </div>
  );
}
