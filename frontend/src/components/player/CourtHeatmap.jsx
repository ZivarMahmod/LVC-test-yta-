// ===========================================
// LVC Media Hub — Volleybollplan Heatmap
// Visar var aktioner sker på planen
// Zoner klickbara, gradient-heatmap vy
// ===========================================
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';

// Zon-layout på volleybollplan (standard DataVolley numrering)
// Nät uppe, baklinje nere
// 4 | 3 | 2    (framrad)
// 7 | 8 | 9    (3m-zon)
// 5 | 6 | 1    (bakrad)
const ZONES = [
  { id: 4, x: 0,   y: 0,   w: 33, h: 33, label: '4' },
  { id: 3, x: 33,  y: 0,   w: 34, h: 33, label: '3' },
  { id: 2, x: 67,  y: 0,   w: 33, h: 33, label: '2' },
  { id: 7, x: 0,   y: 33,  w: 33, h: 34, label: '7' },
  { id: 8, x: 33,  y: 33,  w: 34, h: 34, label: '8' },
  { id: 9, x: 67,  y: 33,  w: 33, h: 34, label: '9' },
  { id: 5, x: 0,   y: 67,  w: 33, h: 33, label: '5' },
  { id: 6, x: 33,  y: 67,  w: 34, h: 33, label: '6' },
  { id: 1, x: 67,  y: 67,  w: 33, h: 33, label: '1' },
];

// Zon-centra för gradient-heatmap (i 300x300 koordinater, offset 10 för nät)
const ZONE_CENTERS = {
  4: { x: 50,  y: 60  },
  3: { x: 150, y: 60  },
  2: { x: 250, y: 60  },
  7: { x: 50,  y: 160 },
  8: { x: 150, y: 160 },
  9: { x: 250, y: 160 },
  5: { x: 50,  y: 260 },
  6: { x: 150, y: 260 },
  1: { x: 250, y: 260 },
};

const SKILL_OPTIONS = [
  { key: 'all', label: 'Alla' },
  { key: 'S', label: 'Serve' },
  { key: 'A', label: 'Anfall' },
  { key: 'R', label: 'Mottagning' },
  { key: 'B', label: 'Block' },
  { key: 'D', label: 'Försvar' },
];

const SKILL_LABELS = { S: 'Serve', A: 'Anfall', R: 'Mottagning', B: 'Block', D: 'Försvar', E: 'Passning' };
const GRADE_LABELS = { '#': 'Perfekt', '+': 'Bra', '!': 'OK', '-': 'Dålig', '/': 'Över', '=': 'Fel' };

const getHeatColor = (ratio) => {
  if (ratio === 0) return 'rgba(59, 130, 246, 0.08)';
  if (ratio < 0.2) return 'rgba(59, 130, 246, 0.2)';
  if (ratio < 0.4) return 'rgba(59, 130, 246, 0.35)';
  if (ratio < 0.6) return 'rgba(245, 158, 11, 0.4)';
  if (ratio < 0.8) return 'rgba(239, 68, 68, 0.45)';
  return 'rgba(239, 68, 68, 0.6)';
};

const getSuccessColor = (rate) => {
  if (rate >= 0.6) return '#22c55e';
  if (rate >= 0.4) return '#eab308';
  return '#ef4444';
};

// Gradient heatmap rendering using Canvas
function GradientHeatmap({ zoneData, width = 280, height = 280 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;

    // Clear
    ctx.clearRect(0, 0, cw, ch);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cw, ch);

    // Find max count for normalization
    let maxCount = 0;
    for (const z of Object.values(zoneData)) {
      if (z.count > maxCount) maxCount = z.count;
    }
    if (maxCount === 0) return;

    // Draw radial gradients for each zone
    for (const [zoneId, center] of Object.entries(ZONE_CENTERS)) {
      const data = zoneData[parseInt(zoneId)];
      if (!data || data.count === 0) continue;

      const intensity = data.count / maxCount;
      // Map zone centers from 300x300 space to canvas space
      const cx = (center.x / 300) * cw;
      const cy = ((center.y - 10) / 300) * ch;
      const radius = Math.max(cw, ch) * 0.45;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

      // Color: from hot (red) at center to transparent at edge
      const alpha = 0.3 + intensity * 0.55;
      grad.addColorStop(0, `rgba(239, 68, 68, ${alpha})`);
      grad.addColorStop(0.15, `rgba(245, 158, 11, ${alpha * 0.8})`);
      grad.addColorStop(0.35, `rgba(245, 158, 11, ${alpha * 0.4})`);
      grad.addColorStop(0.6, `rgba(59, 130, 246, ${alpha * 0.15})`);
      grad.addColorStop(1, 'rgba(59, 130, 246, 0)');

      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
    }

    // Reset composite
    ctx.globalCompositeOperation = 'source-over';

    // Draw zone lines (subtle)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(cw / 3, 0); ctx.lineTo(cw / 3, ch);
    ctx.moveTo(2 * cw / 3, 0); ctx.lineTo(2 * cw / 3, ch);
    // Horizontal lines
    ctx.moveTo(0, ch / 3); ctx.lineTo(cw, ch / 3);
    ctx.moveTo(0, 2 * ch / 3); ctx.lineTo(cw, 2 * ch / 3);
    ctx.stroke();

    // 3-meter line (dashed)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, ch / 3);
    ctx.lineTo(cw, ch / 3);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zone count labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [zoneId, center] of Object.entries(ZONE_CENTERS)) {
      const data = zoneData[parseInt(zoneId)];
      if (!data || data.count === 0) continue;
      const cx = (center.x / 300) * cw;
      const cy = ((center.y - 10) / 300) * ch;

      ctx.font = 'bold 16px system-ui';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(data.count, cx, cy);
      ctx.shadowBlur = 0;
    }
  }, [zoneData]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Nätlinje */}
      <div style={{
        textAlign: 'center', color: '#64748b', fontSize: 10,
        borderBottom: '3px solid #94a3b8', paddingBottom: 2, marginBottom: 2
      }}>
        NÄT
      </div>
      <canvas
        ref={canvasRef}
        width={560}
        height={560}
        style={{ width, height, borderRadius: 4, border: '2px solid #334155' }}
      />
    </div>
  );
}

// Zone detail popup
function ZoneDetail({ zone, actions, team, selectedSkill, onClose }) {
  const zoneActions = useMemo(() => {
    return actions.filter(a => {
      if (team && a.team !== team) return false;
      if (selectedSkill !== 'all' && a.skill !== selectedSkill) return false;
      const z = a.startZone || a.endZone;
      return z === zone.id;
    });
  }, [actions, team, selectedSkill, zone.id]);

  // Group by skill
  const grouped = useMemo(() => {
    const g = {};
    for (const a of zoneActions) {
      const sk = a.skill || '?';
      if (!g[sk]) g[sk] = [];
      g[sk].push(a);
    }
    return g;
  }, [zoneActions]);

  return (
    <div style={{
      background: '#1e293b', border: '1px solid #475569', borderRadius: 8,
      padding: 12, marginTop: 8
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#f1f5f9', fontWeight: 'bold', fontSize: 14 }}>
          Zon {zone.label} — {zoneActions.length} aktioner
        </span>
        <button
          onClick={onClose}
          style={{
            background: '#334155', border: 'none', color: '#94a3b8', borderRadius: 4,
            width: 24, height: 24, cursor: 'pointer', fontSize: 14
          }}
        >
          ✕
        </button>
      </div>

      {Object.entries(grouped).map(([skill, acts]) => {
        const good = acts.filter(a => a.grade === '#' || a.grade === '+').length;
        const bad = acts.filter(a => a.grade === '/' || a.grade === '=').length;
        return (
          <div key={skill} style={{ marginBottom: 8 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, fontWeight: 'bold', marginBottom: 2 }}>
              {SKILL_LABELS[skill] || skill} ({acts.length})
            </div>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>
              ✓ {good} lyckade · ✗ {bad} fel · {Math.round(acts.length > 0 ? (good / acts.length) * 100 : 0)}% effektivitet
            </div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
              {acts.slice(0, 20).map((a, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 5px', borderRadius: 3,
                  background: a.grade === '#' || a.grade === '+' ? '#166534'
                    : a.grade === '/' || a.grade === '=' ? '#7f1d1d' : '#334155',
                  color: '#e2e8f0'
                }}>
                  #{a.jersey} {GRADE_LABELS[a.grade] || a.grade}
                </span>
              ))}
              {acts.length > 20 && (
                <span style={{ fontSize: 10, color: '#64748b' }}>+{acts.length - 20} till</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CourtHeatmap({ actions, team, teamName }) {
  const [selectedSkill, setSelectedSkill] = useState('all');
  const [showSuccess, setShowSuccess] = useState(false);
  const [viewMode, setViewMode] = useState('zones'); // 'zones' or 'gradient'
  const [selectedZone, setSelectedZone] = useState(null);

  const zoneData = useMemo(() => {
    if (!actions || actions.length === 0) return {};

    const filtered = actions.filter(a => {
      if (team && a.team !== team) return false;
      if (selectedSkill !== 'all' && a.skill !== selectedSkill) return false;
      return true;
    });

    const counts = {};
    const success = {};
    let maxCount = 0;

    for (const a of filtered) {
      const zone = a.startZone || a.endZone;
      if (!zone || zone < 1 || zone > 9) continue;
      counts[zone] = (counts[zone] || 0) + 1;
      if (!success[zone]) success[zone] = { good: 0, total: 0 };
      success[zone].total++;
      if (a.grade === '#' || a.grade === '+') success[zone].good++;
      if (counts[zone] > maxCount) maxCount = counts[zone];
    }

    const result = {};
    for (const z of ZONES) {
      const count = counts[z.id] || 0;
      const succ = success[z.id] || { good: 0, total: 0 };
      result[z.id] = {
        count,
        ratio: maxCount > 0 ? count / maxCount : 0,
        successRate: succ.total > 0 ? succ.good / succ.total : 0,
        successTotal: succ.total
      };
    }
    return result;
  }, [actions, team, selectedSkill]);

  const totalFiltered = Object.values(zoneData).reduce((sum, z) => sum + z.count, 0);

  const handleZoneClick = useCallback((zone) => {
    setSelectedZone(prev => prev && prev.id === zone.id ? null : zone);
  }, []);

  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ color: '#f1f5f9', margin: 0, fontSize: 14 }}>{teamName || (team === 'H' ? 'Hemmalag' : 'Bortalag')}</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setViewMode(viewMode === 'zones' ? 'gradient' : 'zones')}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
              background: viewMode === 'gradient' ? '#7c3aed' : '#334155', color: '#f1f5f9'
            }}
          >
            {viewMode === 'zones' ? '🔥 Heatmap' : '▦ Zoner'}
          </button>
          {viewMode === 'zones' && (
            <button
              onClick={() => setShowSuccess(!showSuccess)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
                background: showSuccess ? '#3b82f6' : '#334155', color: '#f1f5f9'
              }}
            >
              {showSuccess ? 'Frekvens' : 'Effektivitet'}
            </button>
          )}
        </div>
      </div>

      {/* Skill filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {SKILL_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => { setSelectedSkill(opt.key); setSelectedZone(null); }}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
              background: selectedSkill === opt.key ? '#3b82f6' : '#334155',
              color: selectedSkill === opt.key ? '#fff' : '#94a3b8'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {viewMode === 'gradient' ? (
        <GradientHeatmap zoneData={zoneData} />
      ) : (
        /* Volleybollplan SVG — Zoner */
        <svg viewBox="0 0 300 310" style={{ width: '100%', maxWidth: 280 }}>
          {/* Nätlinje */}
          <line x1="0" y1="8" x2="300" y2="8" stroke="#94a3b8" strokeWidth="3" />
          <text x="150" y="6" textAnchor="middle" fill="#64748b" fontSize="10">NÄT</text>

          {/* Planens bakgrund */}
          <rect x="0" y="10" width="300" height="300" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />

          {/* 3-meterslinje */}
          <line x1="0" y1="110" x2="300" y2="110" stroke="#334155" strokeWidth="1" strokeDasharray="6,4" />

          {/* Zoner */}
          {ZONES.map(z => {
            const data = zoneData[z.id] || { count: 0, ratio: 0, successRate: 0 };
            const zx = z.x * 3;
            const zy = z.y * 3 + 10;
            const zw = z.w * 3;
            const zh = z.h * 3;
            const color = showSuccess && data.count > 0
              ? getSuccessColor(data.successRate)
              : getHeatColor(data.ratio);
            const opacity = showSuccess ? (data.count > 0 ? 0.35 : 0.05) : 1;
            const isSelected = selectedZone && selectedZone.id === z.id;

            return (
              <g key={z.id} style={{ cursor: data.count > 0 ? 'pointer' : 'default' }} onClick={() => data.count > 0 && handleZoneClick(z)}>
                <rect
                  x={zx + 1} y={zy + 1} width={zw - 2} height={zh - 2} rx="3"
                  fill={color} opacity={opacity}
                  stroke={isSelected ? '#f1f5f9' : '#475569'}
                  strokeWidth={isSelected ? 2.5 : 0.5}
                />
                <text
                  x={zx + zw / 2} y={zy + zh / 2 - 8}
                  textAnchor="middle" fill="#94a3b8" fontSize="11"
                >
                  Zon {z.label}
                </text>
                <text
                  x={zx + zw / 2} y={zy + zh / 2 + 8}
                  textAnchor="middle" fill="#f1f5f9" fontSize="16" fontWeight="bold"
                >
                  {data.count}
                </text>
                {showSuccess && data.count > 0 && (
                  <text
                    x={zx + zw / 2} y={zy + zh / 2 + 24}
                    textAnchor="middle" fill={getSuccessColor(data.successRate)} fontSize="12"
                  >
                    {Math.round(data.successRate * 100)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      <div style={{ color: '#64748b', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
        {totalFiltered} aktioner med zondata
      </div>

      {/* Zone detail panel */}
      {selectedZone && viewMode === 'zones' && (
        <ZoneDetail
          zone={selectedZone}
          actions={actions}
          team={team}
          selectedSkill={selectedSkill}
          onClose={() => setSelectedZone(null)}
        />
      )}
    </div>
  );
}
