// ===========================================
// Kvittra — Säsongsgrafer
// Animerade linjegrafer som ritar upp sig
// ===========================================
import { useState, useEffect, useMemo } from 'react';
import './SeasonGraph.css';

function AnimatedPath({ points, color, width, delay = 0 }) {
  const [length, setLength] = useState(0);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDrawn(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  // Beräkna path-längd via ref
  const pathRef = (el) => {
    if (el && !length) {
      setLength(el.getTotalLength());
    }
  };

  return (
    <path
      ref={pathRef}
      d={points}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        strokeDasharray: length || 1000,
        strokeDashoffset: drawn ? 0 : (length || 1000),
        transition: `stroke-dashoffset 1.5s ease-out ${delay}ms`,
      }}
    />
  );
}

export default function SeasonGraph({ trends, height = 200 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const metrics = useMemo(() => [
    { key: 'killPct', label: 'Kill%', color: '#ef4444', suffix: '%' },
    { key: 'recPosPct', label: 'Mottagning+', color: '#3b82f6', suffix: '%' },
    { key: 'attackEff', label: 'Angrepp eff.', color: '#f59e0b', suffix: '%' },
  ], []);

  const [activeMetric, setActiveMetric] = useState('killPct');

  if (!trends || trends.length < 2) {
    return (
      <div className="sg-container">
        <div className="sg-empty">Minst 2 matcher krävs för säsongsgraf</div>
      </div>
    );
  }

  const data = trends;
  const metric = metrics.find(m => m.key === activeMetric) || metrics[0];
  const values = data.map(d => d[metric.key] ?? 0);
  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const padding = { top: 20, right: 40, bottom: 40, left: 45 };
  const w = 600;
  const h = height;
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  const getX = (i) => padding.left + (i / (data.length - 1)) * plotW;
  const getY = (v) => padding.top + plotH - ((v - min) / range) * plotH;

  // SVG path
  const pathD = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(v).toFixed(1)}`).join(' ');

  // Area fill
  const areaD = pathD + ` L${getX(data.length - 1).toFixed(1)},${getY(min).toFixed(1)} L${getX(0).toFixed(1)},${getY(min).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks = 5;
  const yStep = range / yTicks;

  // Medelvärde
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <div className="sg-container">
      <div className="sg-header">
        <h3>Säsongsöversikt</h3>
        <div className="sg-metric-tabs">
          {metrics.map(m => (
            <button
              key={m.key}
              className={`sg-metric-tab ${activeMetric === m.key ? 'sg-metric-tab--active' : ''}`}
              style={activeMetric === m.key ? { background: m.color, borderColor: m.color } : {}}
              onClick={() => setActiveMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="sg-svg">
        {/* Grid lines */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = min + i * yStep;
          const y = getY(val);
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={w - padding.right} y2={y} stroke="#1e293b" strokeWidth="1" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="#475569" fontSize="11">
                {Math.round(val)}{metric.suffix}
              </text>
            </g>
          );
        })}

        {/* Medelvärdeslinje */}
        <line
          x1={padding.left} y1={getY(avg)}
          x2={w - padding.right} y2={getY(avg)}
          stroke="#475569" strokeWidth="1" strokeDasharray="6,4"
        />
        <text x={w - padding.right + 4} y={getY(avg) + 4} fill="#64748b" fontSize="10">
          snitt {Math.round(avg)}{metric.suffix}
        </text>

        {/* Area fill (gradient) */}
        <defs>
          <linearGradient id={`sg-grad-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={metric.color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={metric.color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#sg-grad-${metric.key})`} />

        {/* Animerad linje */}
        <AnimatedPath points={pathD} color={metric.color} width={2.5} delay={200} />

        {/* Datapunkter */}
        {values.map((v, i) => (
          <g key={i}>
            <circle
              cx={getX(i)} cy={getY(v)} r={hoveredIdx === i ? 6 : 4}
              fill={metric.color}
              stroke="#0f172a" strokeWidth="2"
              style={{ transition: 'r 0.15s' }}
            />
            {/* Hover-area */}
            <rect
              x={getX(i) - plotW / data.length / 2}
              y={padding.top}
              width={plotW / data.length}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'crosshair' }}
            />
          </g>
        ))}

        {/* Tooltip */}
        {hoveredIdx !== null && (
          <g>
            <line x1={getX(hoveredIdx)} y1={padding.top} x2={getX(hoveredIdx)} y2={h - padding.bottom} stroke="#475569" strokeWidth="1" strokeDasharray="4,4" />
            <rect
              x={getX(hoveredIdx) - 50} y={getY(values[hoveredIdx]) - 36}
              width={100} height={30} rx={6}
              fill="#1e293b" stroke="#334155" strokeWidth="1"
            />
            <text x={getX(hoveredIdx)} y={getY(values[hoveredIdx]) - 18} textAnchor="middle" fill="#f1f5f9" fontSize="12" fontWeight="600">
              {values[hoveredIdx]}{metric.suffix}
            </text>
            <text x={getX(hoveredIdx)} y={h - padding.bottom + 16} textAnchor="middle" fill="#94a3b8" fontSize="10">
              {data[hoveredIdx]?.opponent?.substring(0, 12) || ''}
            </text>
          </g>
        )}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)} y={h - padding.bottom + 16}
            textAnchor="middle" fill="#475569" fontSize="9"
            style={{ display: hoveredIdx === i ? 'none' : 'block' }}
          >
            {data.length <= 10 ? (d.opponent?.substring(0, 6) || '') : (i % 2 === 0 ? (d.opponent?.substring(0, 4) || '') : '')}
          </text>
        ))}
      </svg>
    </div>
  );
}
