// ===========================================
// LVC Media Hub — Volleybollplan Heatmap
// Visar var aktioner sker på planen
// ===========================================
import { useState, useMemo } from 'react';

// Zon-layout på volleybollplan (standard numrering)
// Nät uppe, baklinje nere
// 4 | 3 | 2
// 5 | 6 | 1
const ZONES = [
  { id: 4, x: 0,   y: 0,   w: 33, h: 50, label: '4' },
  { id: 3, x: 33,  y: 0,   w: 34, h: 50, label: '3' },
  { id: 2, x: 67,  y: 0,   w: 33, h: 50, label: '2' },
  { id: 5, x: 0,   y: 50,  w: 33, h: 50, label: '5' },
  { id: 6, x: 33,  y: 50,  w: 34, h: 50, label: '6' },
  { id: 1, x: 67,  y: 50,  w: 33, h: 50, label: '1' },
];

const SKILL_OPTIONS = [
  { key: 'all', label: 'Alla' },
  { key: 'S', label: 'Serve' },
  { key: 'A', label: 'Angrepp' },
  { key: 'R', label: 'Mottagning' },
  { key: 'B', label: 'Block' },
  { key: 'D', label: 'Försvar' },
];

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

export default function CourtHeatmap({ actions, team }) {
  const [selectedSkill, setSelectedSkill] = useState('all');
  const [showSuccess, setShowSuccess] = useState(false);

  const zoneData = useMemo(() => {
    if (!actions || actions.length === 0) return {};

    const filtered = actions.filter(a => {
      if (team && a.team !== team) return false;
      if (selectedSkill !== 'all' && a.skill !== selectedSkill) return false;
      return true;
    });

    // Räkna aktioner per startzon
    const counts = {};
    const success = {};
    let maxCount = 0;

    for (const a of filtered) {
      const zone = a.startZone || a.endZone;
      if (!zone || zone < 1 || zone > 6) continue;
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

  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ color: '#f1f5f9', margin: 0, fontSize: 15 }}>Planvy</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setShowSuccess(!showSuccess)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
              background: showSuccess ? '#3b82f6' : '#334155', color: '#f1f5f9'
            }}
          >
            {showSuccess ? 'Frekvens' : 'Effektivitet'}
          </button>
        </div>
      </div>

      {/* Skill filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {SKILL_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSelectedSkill(opt.key)}
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

      {/* Volleybollplan SVG */}
      <svg viewBox="0 0 300 220" style={{ width: '100%', maxWidth: 360 }}>
        {/* Nätlinje */}
        <line x1="0" y1="8" x2="300" y2="8" stroke="#94a3b8" strokeWidth="3" />
        <text x="150" y="6" textAnchor="middle" fill="#64748b" fontSize="10">NÄT</text>

        {/* Planens bakgrund */}
        <rect x="0" y="10" width="300" height="200" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />

        {/* 3-meterslinje */}
        <line x1="0" y1="110" x2="300" y2="110" stroke="#334155" strokeWidth="1" strokeDasharray="6,4" />

        {/* Zoner */}
        {ZONES.map(z => {
          const data = zoneData[z.id] || { count: 0, ratio: 0, successRate: 0 };
          const zx = z.x * 3;
          const zy = z.y * 2 + 10;
          const zw = z.w * 3;
          const zh = z.h * 2;
          const color = showSuccess && data.count > 0
            ? getSuccessColor(data.successRate)
            : getHeatColor(data.ratio);
          const opacity = showSuccess ? (data.count > 0 ? 0.35 : 0.05) : 1;

          return (
            <g key={z.id}>
              <rect
                x={zx + 1} y={zy + 1} width={zw - 2} height={zh - 2} rx="3"
                fill={color} opacity={opacity}
                stroke="#475569" strokeWidth="0.5"
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

      <div style={{ color: '#64748b', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
        {totalFiltered} aktioner med zondata
      </div>
    </div>
  );
}
