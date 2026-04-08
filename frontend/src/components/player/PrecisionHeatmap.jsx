// ===========================================
// LVC Media Hub — Precision Heatmap
// Använder DVW koordinatdata (100x100 grid)
// för exakta placeringar på planen
// ===========================================
import { useMemo } from 'react';

const SKILL_COLORS = {
  S: '#4CAF50', R: '#2196F3', A: '#F44336',
  B: '#9C27B0', D: '#00BCD4',
};

const GRADE_COLORS = {
  '#': '#22c55e', '+': '#3b82f6', '!': '#f59e0b',
  '-': '#ef4444', '/': '#ef4444', '=': '#ef4444',
};

/**
 * Renderar en SVG-baserad heatmap med exakta koordinater
 * @param {Array} actions - Actions med startCoord/endCoord
 * @param {string} coordType - 'start' eller 'end' (vilken koordinat att visa)
 * @param {string} skillFilter - 'A', 'S', 'R', etc. eller 'all'
 * @param {string} title - Rubrik
 * @param {boolean} showTrails - Visa linjer från start→end
 */
export default function PrecisionHeatmap({
  actions,
  coordType = 'start',
  skillFilter = 'all',
  title = 'Placeringar',
  showTrails = false,
  height = 300,
}) {
  const { points, trails, heatGrid, maxHeat } = useMemo(() => {
    if (!actions || actions.length === 0) return { points: [], trails: [], heatGrid: {}, maxHeat: 0 };

    const pts = [];
    const trls = [];
    const grid = {};
    let mh = 0;

    for (const a of actions) {
      if (skillFilter !== 'all' && a.skill !== skillFilter) continue;

      const coord = coordType === 'end' ? a.endCoord : a.startCoord;
      if (!coord) continue;

      pts.push({
        x: coord.x,
        y: 99 - coord.y, // Flippa Y (DVW: 0=nere, vi ritar: 0=uppe)
        grade: a.grade,
        skill: a.skill,
        playerName: a.playerName,
      });

      // Heatgrid: 10x10 celler (varje cell = 10x10 koordinater)
      const gx = Math.floor(coord.x / 10);
      const gy = Math.floor((99 - coord.y) / 10);
      const key = `${gx},${gy}`;
      grid[key] = (grid[key] || 0) + 1;
      if (grid[key] > mh) mh = grid[key];

      // Trails (start→end)
      if (showTrails && a.startCoord && a.endCoord) {
        trls.push({
          x1: a.startCoord.x,
          y1: 99 - a.startCoord.y,
          x2: a.endCoord.x,
          y2: 99 - a.endCoord.y,
          grade: a.grade,
        });
      }
    }

    return { points: pts, trails: trls, heatGrid: grid, maxHeat: mh };
  }, [actions, coordType, skillFilter, showTrails]);

  if (points.length === 0) {
    return (
      <div style={{ background: '#1e293b', borderRadius: 10, padding: 14, textAlign: 'center' }}>
        <h4 style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 8px', fontWeight: 500 }}>{title}</h4>
        <p style={{ color: '#475569', fontSize: 12 }}>Ingen koordinatdata tillgänglig</p>
      </div>
    );
  }

  // Plan-dimensioner (halv volleybollplan)
  const courtW = 300;
  const courtH = height;
  const scaleX = (x) => (x / 100) * courtW;
  const scaleY = (y) => (y / 100) * courtH;

  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ color: '#94a3b8', fontSize: 14, margin: 0, fontWeight: 500 }}>{title}</h4>
        <span style={{ color: '#475569', fontSize: 11 }}>{points.length} punkter</span>
      </div>

      <svg viewBox={`0 0 ${courtW} ${courtH}`} style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto' }}>
        {/* Plan-bakgrund */}
        <rect x="0" y="0" width={courtW} height={courtH} rx="4" fill="#0f172a" />

        {/* Nätlinje */}
        <line x1="0" y1="2" x2={courtW} y2="2" stroke="#94a3b8" strokeWidth="3" />
        <text x={courtW / 2} y="14" textAnchor="middle" fill="#334155" fontSize="10">NÄT</text>

        {/* 3-meterslinje */}
        <line x1="0" y1={courtH * 0.33} x2={courtW} y2={courtH * 0.33} stroke="#334155" strokeWidth="1" strokeDasharray="6,4" />

        {/* Mittlinje (bak) */}
        <line x1="0" y1={courtH * 0.66} x2={courtW} y2={courtH * 0.66} stroke="#334155" strokeWidth="1" strokeDasharray="6,4" />

        {/* Heat grid (bakgrundsfärg) */}
        {maxHeat > 0 && Object.entries(heatGrid).map(([key, count]) => {
          const [gx, gy] = key.split(',').map(Number);
          const intensity = count / maxHeat;
          return (
            <rect
              key={key}
              x={gx * (courtW / 10)}
              y={gy * (courtH / 10)}
              width={courtW / 10}
              height={courtH / 10}
              fill={`rgba(239, 68, 68, ${intensity * 0.35})`}
              rx="2"
            />
          );
        })}

        {/* Trails (start→end linjer) */}
        {trails.map((t, i) => (
          <line
            key={`trail-${i}`}
            x1={scaleX(t.x1)} y1={scaleY(t.y1)}
            x2={scaleX(t.x2)} y2={scaleY(t.y2)}
            stroke={GRADE_COLORS[t.grade] || '#475569'}
            strokeWidth="1"
            opacity="0.4"
          />
        ))}

        {/* Punkter */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r="4"
            fill={GRADE_COLORS[p.grade] || '#94a3b8'}
            opacity="0.8"
            stroke="#0f172a"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        {Object.entries({ '#': 'Perfekt', '+': 'Positiv', '!': 'OK', '-': 'Negativ', '/': 'Fel' }).map(([grade, label]) => {
          const count = points.filter(p => p.grade === grade).length;
          if (count === 0) return null;
          return (
            <span key={grade} style={{ fontSize: 10, color: GRADE_COLORS[grade], display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GRADE_COLORS[grade], display: 'inline-block' }} />
              {label} ({count})
            </span>
          );
        })}
      </div>
    </div>
  );
}
