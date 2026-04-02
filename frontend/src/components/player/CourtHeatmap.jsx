// ===========================================
// LVC Media Hub — Volleybollplan Heatmap
// 9 zoner (DVW standard), klickbara
// ===========================================
import { useState, useMemo, useCallback } from 'react';

// DVW 9-zoners layout:
// 4 | 3 | 2    (framrad, nät)
// 7 | 8 | 9    (mittrad)
// 5 | 6 | 1    (bakrad)
const ZONES = [
  { id: 4, x: 0,  y: 0,  w: 33, h: 33, label: '4' },
  { id: 3, x: 33, y: 0,  w: 34, h: 33, label: '3' },
  { id: 2, x: 67, y: 0,  w: 33, h: 33, label: '2' },
  { id: 7, x: 0,  y: 33, w: 33, h: 34, label: '7' },
  { id: 8, x: 33, y: 33, w: 34, h: 34, label: '8' },
  { id: 9, x: 67, y: 33, w: 33, h: 34, label: '9' },
  { id: 5, x: 0,  y: 67, w: 33, h: 33, label: '5' },
  { id: 6, x: 33, y: 67, w: 34, h: 33, label: '6' },
  { id: 1, x: 67, y: 67, w: 33, h: 33, label: '1' },
];

// 1:1 mapping — no merging needed with 9 zones
const ZONE_MAP = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
};

const SKILL_OPTIONS = [
  { key: 'all', label: 'Alla' },
  { key: 'S', label: 'Serve' },
  { key: 'A', label: 'Anfall' },
  { key: 'R', label: 'Mottagning' },
  { key: 'B', label: 'Block' },
  { key: 'D', label: 'Försvar' },
];

const SKILL_LABELS = { S: 'Serve', A: 'Anfall', R: 'Mottagning', B: 'Block', D: 'Försvar', P: 'Pass', G: 'Gratisboll' };

const GRADE_FILTERS = [
  { key: 'all', label: 'Alla', color: '#f1f5f9', symbol: '' },
  { key: '#', label: 'Perfekt', color: '#22c55e', symbol: '●' },
  { key: '+', label: 'Positiv', color: '#22c55e', symbol: '▲' },
  { key: '!', label: 'OK', color: '#f59e0b', symbol: '■' },
  { key: '-', label: 'Negativ', color: '#ef4444', symbol: '▼' },
  { key: '=', label: 'Error', color: '#ef4444', symbol: '✕' },
];

const getHeatColor = (ratio) => {
  if (ratio === 0) return 'rgba(59, 130, 246, 0.08)';
  if (ratio < 0.2) return 'rgba(59, 130, 246, 0.2)';
  if (ratio < 0.4) return 'rgba(59, 130, 246, 0.35)';
  if (ratio < 0.6) return 'rgba(245, 158, 11, 0.4)';
  if (ratio < 0.8) return 'rgba(239, 68, 68, 0.45)';
  return 'rgba(239, 68, 68, 0.6)';
};

// Zone detail panel with grade filters
function ZoneDetail({ zone, actions, team, selectedSkill, onClose, onActionClick }) {
  const [gradeFilter, setGradeFilter] = useState('all');

  const zoneActions = useMemo(() => {
    return actions.filter(a => {
      if (team && a.team !== team) return false;
      if (selectedSkill !== 'all' && a.skill !== selectedSkill) return false;
      const rawZone = a.startZone || a.endZone;
      if (!rawZone || rawZone < 1 || rawZone > 9) return false;
      return ZONE_MAP[rawZone] === zone.id;
    });
  }, [actions, team, selectedSkill, zone.id]);

  const filteredActions = useMemo(() => {
    if (gradeFilter === 'all') return zoneActions;
    return zoneActions.filter(a => a.grade === gradeFilter);
  }, [zoneActions, gradeFilter]);

  // Group by skill
  const grouped = useMemo(() => {
    const g = {};
    for (const a of filteredActions) {
      const sk = a.skill || '?';
      if (!g[sk]) g[sk] = [];
      g[sk].push(a);
    }
    return g;
  }, [filteredActions]);

  // Count per grade for summary
  const gradeCounts = useMemo(() => {
    const c = {};
    for (const a of zoneActions) {
      c[a.grade] = (c[a.grade] || 0) + 1;
    }
    return c;
  }, [zoneActions]);

  return (
    <div style={{
      background: '#0f172a', border: '1px solid #475569', borderRadius: 8,
      padding: 10, marginTop: 8
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#f1f5f9', fontWeight: 'bold', fontSize: 13 }}>
          Zon {zone.label} — {zoneActions.length} aktioner
        </span>
        <button
          onClick={onClose}
          style={{
            background: '#334155', border: 'none', color: '#94a3b8', borderRadius: 4,
            width: 22, height: 22, cursor: 'pointer', fontSize: 12, lineHeight: '22px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Grade filters */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {GRADE_FILTERS.map(gf => (
          <button
            key={gf.key}
            onClick={() => setGradeFilter(gf.key)}
            style={{
              padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: 11, cursor: 'pointer',
              background: gradeFilter === gf.key ? '#334155' : 'transparent',
              color: gf.color,
              fontWeight: gradeFilter === gf.key ? '700' : '400',
              opacity: gradeFilter === gf.key ? 1 : 0.7
            }}
          >
            {gf.symbol && <span style={{ marginRight: 3 }}>{gf.symbol}</span>}
            {gf.label}
            {gf.key !== 'all' && gradeCounts[gf.key] ? ` (${gradeCounts[gf.key]})` : ''}
          </button>
        ))}
      </div>

      {/* Actions grouped by skill */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 11, textAlign: 'center', padding: 8 }}>
          Inga aktioner med denna filtrering
        </div>
      ) : (
        Object.entries(grouped).map(([skill, acts]) => {
          const good = acts.filter(a => a.grade === '#' || a.grade === '+').length;
          const bad = acts.filter(a => a.grade === '/' || a.grade === '=').length;
          return (
            <div key={skill} style={{ marginBottom: 6 }}>
              <div style={{ color: '#93c5fd', fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>
                {SKILL_LABELS[skill] || skill} ({acts.length})
                <span style={{ color: '#64748b', fontWeight: '400', marginLeft: 6 }}>
                  {good} lyckade · {bad} fel
                </span>
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {acts.slice(0, 30).map((a, i) => {
                  const gradeInfo = GRADE_FILTERS.find(g => g.key === a.grade);
                  return (
                    <span key={i} onClick={() => onActionClick && onActionClick(a)} style={{
                      fontSize: 10, padding: '2px 5px', borderRadius: 3,
                      background: '#1e293b', border: `1px solid ${gradeInfo?.color || '#475569'}33`,
                      color: gradeInfo?.color || '#e2e8f0',
                      cursor: onActionClick ? 'pointer' : 'default'
                    }}>
                      {gradeInfo?.symbol || '?'} #{a.playerNumber} {a.playerName ? a.playerName.split(' ').pop() : ''}
                    </span>
                  );
                })}
                {acts.length > 30 && (
                  <span style={{ fontSize: 10, color: '#64748b' }}>+{acts.length - 30} till</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function CourtHeatmap({ actions, team, teamName, highlightZone, onZoneSelect, onActionClick, compact }) {
  const [selectedSkill, setSelectedSkill] = useState('all');
  const [selectedZone, setSelectedZone] = useState(null);

  // Synka highlightZone från parent (t.ex. zonfilter)
  const effectiveSelectedZone = highlightZone
    ? ZONES.find(z => z.id === highlightZone) || null
    : selectedZone;

  const zoneData = useMemo(() => {
    if (!actions || actions.length === 0) return {};

    const filtered = actions.filter(a => {
      if (team && a.team !== team) return false;
      if (selectedSkill !== 'all' && a.skill !== selectedSkill) return false;
      return true;
    });

    const counts = {};
    let maxCount = 0;

    for (const a of filtered) {
      const rawZone = a.startZone || a.endZone;
      if (!rawZone || rawZone < 1 || rawZone > 9) continue;
      const zone = ZONE_MAP[rawZone];
      counts[zone] = (counts[zone] || 0) + 1;
      if (counts[zone] > maxCount) maxCount = counts[zone];
    }

    const result = {};
    for (const z of ZONES) {
      const count = counts[z.id] || 0;
      result[z.id] = {
        count,
        ratio: maxCount > 0 ? count / maxCount : 0,
      };
    }
    return result;
  }, [actions, team, selectedSkill]);

  const totalFiltered = Object.values(zoneData).reduce((sum, z) => sum + z.count, 0);

  const handleZoneClick = useCallback((zone) => {
    const newZone = (effectiveSelectedZone && effectiveSelectedZone.id === zone.id) ? null : zone;
    setSelectedZone(newZone);
    if (onZoneSelect) onZoneSelect(newZone ? newZone.id : null);
  }, [effectiveSelectedZone, onZoneSelect]);

  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 10 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ color: '#f1f5f9', margin: '0 0 8px 0', fontSize: 14 }}>
          {teamName || (team === 'H' ? 'Hemmalag' : 'Bortalag')}
        </h3>
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

      {/* Volleybollplan SVG — 9 zoner */}
      <svg viewBox="0 0 300 320" style={{ width: '100%', maxWidth: 280 }}>
        {/* Nätlinje */}
        <line x1="0" y1="8" x2="300" y2="8" stroke="#94a3b8" strokeWidth="3" />
        <text x="150" y="6" textAnchor="middle" fill="#64748b" fontSize="10">NÄT</text>

        {/* Planens bakgrund */}
        <rect x="0" y="10" width="300" height="300" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />

        {/* 3-meterslinjer */}
        <line x1="0" y1="110" x2="300" y2="110" stroke="#334155" strokeWidth="1" strokeDasharray="6,4" />
        <line x1="0" y1="210" x2="300" y2="210" stroke="#334155" strokeWidth="1" strokeDasharray="6,4" />

        {/* Zoner */}
        {ZONES.map(z => {
          const data = zoneData[z.id] || { count: 0, ratio: 0 };
          const zx = (z.x / 100) * 300;
          const zy = (z.y / 100) * 300 + 10;
          const zw = (z.w / 100) * 300;
          const zh = (z.h / 100) * 300;
          const color = getHeatColor(data.ratio);
          const isSelected = effectiveSelectedZone && effectiveSelectedZone.id === z.id;

          return (
            <g key={z.id} style={{ cursor: data.count > 0 ? 'pointer' : 'default' }} onClick={() => data.count > 0 && handleZoneClick(z)}>
              <rect
                x={zx + 1} y={zy + 1} width={zw - 2} height={zh - 2} rx="3"
                fill={color}
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
                x={zx + zw / 2} y={zy + zh / 2 + 10}
                textAnchor="middle" fill="#f1f5f9" fontSize="18" fontWeight="bold"
              >
                {data.count}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ color: '#64748b', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
        {totalFiltered} aktioner med zondata
      </div>

      {/* Zone detail panel */}
      {effectiveSelectedZone && (
        <ZoneDetail
          zone={effectiveSelectedZone}
          actions={actions}
          team={team}
          selectedSkill={selectedSkill}
          onClose={() => { setSelectedZone(null); if (onZoneSelect) onZoneSelect(null); }}
          onActionClick={onActionClick}
        />
      )}
    </div>
  );
}
