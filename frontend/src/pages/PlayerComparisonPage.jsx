// ===========================================
// Kvittra — Player Comparison (split-view + radar chart)
// ===========================================
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient.js';
import { useOrg } from '../context/OrgContext.jsx';
import './PlayerComparisonPage.css';

// SVG Radar Chart — pure SVG, no libs
function RadarChart({ dataA, dataB, labels, nameA, nameB }) {
  const size = 300;
  const center = size / 2;
  const radius = 110;
  const levels = 5;

  const angleStep = (2 * Math.PI) / labels.length;

  const getPoint = (value, index) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const makePath = (data) => {
    return data
      .map((v, i) => {
        const p = getPoint(v, i);
        return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
      })
      .join(' ') + ' Z';
  };

  return (
    <div className="radar-container">
      <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg">
        {/* Grid levels */}
        {Array.from({ length: levels }, (_, lvl) => {
          const r = (radius / levels) * (lvl + 1);
          const points = labels.map((_, i) => {
            const angle = angleStep * i - Math.PI / 2;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
          }).join(' ');
          return <polygon key={lvl} points={points} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
        })}

        {/* Axis lines */}
        {labels.map((_, i) => {
          const p = getPoint(100, i);
          return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
        })}

        {/* Data areas */}
        <path d={makePath(dataA)} fill="rgba(26,95,180,0.3)" stroke="#1a5fb4" strokeWidth="2" />
        <path d={makePath(dataB)} fill="rgba(232,168,37,0.3)" stroke="#e8a825" strokeWidth="2" />

        {/* Data points */}
        {dataA.map((v, i) => {
          const p = getPoint(v, i);
          return <circle key={`a${i}`} cx={p.x} cy={p.y} r="4" fill="#1a5fb4" />;
        })}
        {dataB.map((v, i) => {
          const p = getPoint(v, i);
          return <circle key={`b${i}`} cx={p.x} cy={p.y} r="4" fill="#e8a825" />;
        })}

        {/* Labels */}
        {labels.map((label, i) => {
          const p = getPoint(120, i);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-body)">
              {label}
            </text>
          );
        })}
      </svg>

      <div className="radar-legend">
        <span className="radar-legend-item"><span className="dot" style={{ background: '#1a5fb4' }} />{nameA}</span>
        <span className="radar-legend-item"><span className="dot" style={{ background: '#e8a825' }} />{nameB}</span>
      </div>
    </div>
  );
}

function calcStats(actions) {
  const attacks = actions.filter(a => a.action_type === 'A');
  const serves = actions.filter(a => a.action_type === 'S');
  const receptions = actions.filter(a => a.action_type === 'R');
  const blocks = actions.filter(a => a.action_type === 'B');
  const digs = actions.filter(a => a.action_type === 'D');

  const efficiency = (arr) => {
    if (!arr.length) return 0;
    const good = arr.filter(a => a.result === '#' || a.result === '+').length;
    return Math.round((good / arr.length) * 100);
  };

  return {
    attackEff: efficiency(attacks),
    servePrec: efficiency(serves),
    receptionAvg: efficiency(receptions),
    blockSuccess: efficiency(blocks),
    defenseActions: digs.length,
    totalActions: actions.length,
  };
}

export default function PlayerComparisonPage() {
  const { orgId } = useOrg();
  const [players, setPlayers] = useState([]);
  const [playerA, setPlayerA] = useState('');
  const [playerB, setPlayerB] = useState('');
  const [statsA, setStatsA] = useState(null);
  const [statsB, setStatsB] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch players
  useEffect(() => {
    if (!orgId) return;
    supabase
      .schema('kvittra')
      .from('player_profiles')
      .select('id, display_name, jersey_number, position')
      .eq('org_id', orgId)
      .order('jersey_number')
      .then(({ data }) => setPlayers(data || []));
  }, [orgId]);

  // Fetch stats when both players selected
  useEffect(() => {
    if (!playerA || !playerB || !orgId) return;
    setLoading(true);

    Promise.all([
      supabase.schema('kvittra').from('actions').select('action_type, result').eq('org_id', orgId).eq('player_id', playerA),
      supabase.schema('kvittra').from('actions').select('action_type, result').eq('org_id', orgId).eq('player_id', playerB),
    ]).then(([resA, resB]) => {
      setStatsA(calcStats(resA.data || []));
      setStatsB(calcStats(resB.data || []));
      setLoading(false);
    });
  }, [playerA, playerB, orgId]);

  const nameA = players.find(p => p.id === playerA)?.display_name || 'Spelare A';
  const nameB = players.find(p => p.id === playerB)?.display_name || 'Spelare B';

  const radarLabels = ['Attack', 'Serve', 'Mottagning', 'Block', 'Försvar', 'Totalt'];
  const maxActions = Math.max(statsA?.totalActions || 1, statsB?.totalActions || 1);

  const radarA = statsA ? [statsA.attackEff, statsA.servePrec, statsA.receptionAvg, statsA.blockSuccess, Math.min(100, (statsA.defenseActions / maxActions) * 200), Math.min(100, (statsA.totalActions / maxActions) * 100)] : [0, 0, 0, 0, 0, 0];
  const radarB = statsB ? [statsB.attackEff, statsB.servePrec, statsB.receptionAvg, statsB.blockSuccess, Math.min(100, (statsB.defenseActions / maxActions) * 200), Math.min(100, (statsB.totalActions / maxActions) * 100)] : [0, 0, 0, 0, 0, 0];

  return (
    <div className="comparison-page">
      <h1>Spelarjämförelse</h1>

      <div className="comparison-selectors">
        <select value={playerA} onChange={e => setPlayerA(e.target.value)}>
          <option value="">Välj spelare A</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>#{p.jersey_number} {p.display_name}</option>
          ))}
        </select>

        <span className="vs">vs</span>

        <select value={playerB} onChange={e => setPlayerB(e.target.value)}>
          <option value="">Välj spelare B</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>#{p.jersey_number} {p.display_name}</option>
          ))}
        </select>
      </div>

      {loading && <div className="loading-container"><div className="spinner" /></div>}

      {statsA && statsB && !loading && (
        <>
          <RadarChart dataA={radarA} dataB={radarB} labels={radarLabels} nameA={nameA} nameB={nameB} />

          <div className="comparison-bars">
            {[
              { label: 'Attackeffektivitet', a: statsA.attackEff, b: statsB.attackEff, suffix: '%' },
              { label: 'Serveprecision', a: statsA.servePrec, b: statsB.servePrec, suffix: '%' },
              { label: 'Mottagningssnitt', a: statsA.receptionAvg, b: statsB.receptionAvg, suffix: '%' },
              { label: 'Blockframgång', a: statsA.blockSuccess, b: statsB.blockSuccess, suffix: '%' },
              { label: 'Försvarsaktioner', a: statsA.defenseActions, b: statsB.defenseActions, suffix: '' },
              { label: 'Totala actions', a: statsA.totalActions, b: statsB.totalActions, suffix: '' },
            ].map(({ label, a, b, suffix }) => (
              <div key={label} className="bar-row">
                <span className="bar-value left">{a}{suffix}</span>
                <div className="bar-track">
                  <div className="bar-fill a" style={{ width: `${Math.max(5, (a / Math.max(a, b, 1)) * 100)}%` }} />
                  <span className="bar-label">{label}</span>
                  <div className="bar-fill b" style={{ width: `${Math.max(5, (b / Math.max(a, b, 1)) * 100)}%` }} />
                </div>
                <span className="bar-value right">{b}{suffix}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
