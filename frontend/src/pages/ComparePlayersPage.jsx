// ===========================================
// LVC Media Hub — Spelarjämförelse
// Head-to-head jämförelse mellan 2-4 spelare
// ===========================================
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerStatsApi, teamApi } from '../utils/api.js';
import './ComparePlayersPage.css';

const METRICS = [
  { key: 'ptsPerMatch', label: 'Poäng/match', max: 20, unit: '', color: '#22c55e' },
  { key: 'killPct', label: 'Kill%', max: 60, unit: '%', color: '#ef4444' },
  { key: 'attackEff', label: 'Angrepp eff.', max: 50, unit: '%', color: '#f59e0b' },
  { key: 'recPosPct', label: 'Mottagning+', max: 80, unit: '%', color: '#3b82f6' },
  { key: 'efficiency', label: 'Total eff.', max: 50, unit: '%', color: '#8b5cf6' },
  { key: 'serveErrPct', label: 'Servfel%', max: 30, unit: '%', color: '#64748b', inverted: true },
];

const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];

// Radardiagram
function RadarChart({ players, metrics }) {
  if (players.length === 0) return null;

  const cx = 150, cy = 150, r = 120;
  const angleStep = (2 * Math.PI) / metrics.length;

  // Bakgrundslinjer
  const levels = [0.25, 0.5, 0.75, 1.0];
  const axisPoints = metrics.map((_, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  return (
    <svg viewBox="0 0 300 300" className="cp-radar">
      {/* Bakgrundsnivåer */}
      {levels.map(level => (
        <polygon
          key={level}
          points={metrics.map((_, i) => {
            const angle = -Math.PI / 2 + i * angleStep;
            return `${cx + r * level * Math.cos(angle)},${cy + r * level * Math.sin(angle)}`;
          }).join(' ')}
          fill="none"
          stroke="#334155"
          strokeWidth="0.5"
        />
      ))}

      {/* Axlar */}
      {axisPoints.map((p, i) => (
        <g key={i}>
          <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#334155" strokeWidth="0.5" />
          <text
            x={cx + (r + 18) * Math.cos(-Math.PI / 2 + i * angleStep)}
            y={cy + (r + 18) * Math.sin(-Math.PI / 2 + i * angleStep)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#94a3b8"
            fontSize="10"
          >
            {metrics[i].label}
          </text>
        </g>
      ))}

      {/* Spelarpolygoner */}
      {players.map((player, pi) => {
        const points = metrics.map((m, i) => {
          let val = player[m.key] || 0;
          if (m.inverted) val = m.max - val; // Lägre = bättre för inverterade
          const norm = Math.max(0, Math.min(1, val / m.max));
          const angle = -Math.PI / 2 + i * angleStep;
          return `${cx + r * norm * Math.cos(angle)},${cy + r * norm * Math.sin(angle)}`;
        }).join(' ');

        return (
          <g key={pi}>
            <polygon
              points={points}
              fill={`${PLAYER_COLORS[pi]}22`}
              stroke={PLAYER_COLORS[pi]}
              strokeWidth="2"
            />
            {metrics.map((m, i) => {
              let val = player[m.key] || 0;
              if (m.inverted) val = m.max - val;
              const norm = Math.max(0, Math.min(1, val / m.max));
              const angle = -Math.PI / 2 + i * angleStep;
              return (
                <circle
                  key={i}
                  cx={cx + r * norm * Math.cos(angle)}
                  cy={cy + r * norm * Math.sin(angle)}
                  r="3"
                  fill={PLAYER_COLORS[pi]}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// Jämförelsebar
function CompareBar({ metric, players }) {
  const values = players.map(p => p[metric.key] || 0);
  const best = metric.inverted ? Math.min(...values) : Math.max(...values);

  return (
    <div className="cp-bar-row">
      <div className="cp-bar-label">{metric.label}</div>
      <div className="cp-bar-values">
        {players.map((p, i) => {
          const val = p[metric.key] || 0;
          const isBest = val === best && players.length > 1;
          const width = Math.max(5, (Math.abs(val) / metric.max) * 100);
          return (
            <div key={i} className="cp-bar-player">
              <div className="cp-bar-bg">
                <div
                  className="cp-bar-fill"
                  style={{ width: `${width}%`, background: PLAYER_COLORS[i] }}
                />
              </div>
              <span className={`cp-bar-val ${isBest ? 'cp-bar-val--best' : ''}`} style={{ color: PLAYER_COLORS[i] }}>
                {val}{metric.unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ComparePlayersPage() {
  const navigate = useNavigate();
  const [roster, setRoster] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teamApi.listTeams().then(t => setTeams(t.teams || t || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    playerStatsApi.getTeamRoster(selectedTeam)
      .then(d => { setRoster(d.roster || []); setSelected([]); })
      .finally(() => setLoading(false));
  }, [selectedTeam]);

  const selectedPlayers = useMemo(() =>
    roster.filter(p => selected.includes(p.playerName)),
    [roster, selected]
  );

  const togglePlayer = (name) => {
    setSelected(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : prev.length >= 4 ? prev : [...prev, name]
    );
  };

  if (loading) return <div className="cp-loading">Laddar spelardata...</div>;

  return (
    <div className="cp-container">
      <div className="cp-header">
        <h1>Jämför spelare</h1>
        <select className="cp-select" value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
          <option value="all">Alla lag</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Spelarväljare */}
      <div className="cp-picker">
        <p className="cp-picker-hint">Välj 2-4 spelare att jämföra</p>
        <div className="cp-picker-grid">
          {roster.map(p => {
            const idx = selected.indexOf(p.playerName);
            const isSelected = idx >= 0;
            return (
              <button
                key={p.playerName}
                className={`cp-picker-btn ${isSelected ? 'cp-picker-btn--selected' : ''}`}
                style={isSelected ? { borderColor: PLAYER_COLORS[idx], background: `${PLAYER_COLORS[idx]}15` } : {}}
                onClick={() => togglePlayer(p.playerName)}
              >
                <span className="cp-picker-number" style={isSelected ? { color: PLAYER_COLORS[idx] } : {}}>#{p.playerNumber}</span>
                <span className="cp-picker-name">{p.playerName}</span>
                <span className="cp-picker-meta">{p.matchCount}m · {p.totalPts}p</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Jämförelsevy */}
      {selectedPlayers.length >= 2 && (
        <>
          {/* Legend */}
          <div className="cp-legend">
            {selectedPlayers.map((p, i) => (
              <span key={p.playerName} className="cp-legend-item" style={{ color: PLAYER_COLORS[i] }}>
                <span className="cp-legend-dot" style={{ background: PLAYER_COLORS[i] }} />
                #{p.playerNumber} {p.playerName}
              </span>
            ))}
          </div>

          {/* Radar */}
          <div className="cp-section">
            <h2>Profil</h2>
            <div className="cp-radar-wrap">
              <RadarChart players={selectedPlayers} metrics={METRICS} />
            </div>
          </div>

          {/* Bars */}
          <div className="cp-section">
            <h2>Detaljerad jämförelse</h2>
            <div className="cp-bars">
              {METRICS.map(m => (
                <CompareBar key={m.key} metric={m} players={selectedPlayers} />
              ))}
              <CompareBar metric={{ key: 'totalPts', label: 'Totala poäng', max: Math.max(...selectedPlayers.map(p => p.totalPts), 1), unit: '' }} players={selectedPlayers} />
              <CompareBar metric={{ key: 'servePts', label: 'Ess', max: Math.max(...selectedPlayers.map(p => p.servePts), 1), unit: '' }} players={selectedPlayers} />
              <CompareBar metric={{ key: 'blockPts', label: 'Block', max: Math.max(...selectedPlayers.map(p => p.blockPts), 1), unit: '' }} players={selectedPlayers} />
              <CompareBar metric={{ key: 'matchCount', label: 'Matcher', max: Math.max(...selectedPlayers.map(p => p.matchCount), 1), unit: '' }} players={selectedPlayers} />
            </div>
          </div>

          {/* Nyckeltal-tabell */}
          <div className="cp-section">
            <h2>Alla nyckeltal</h2>
            <div className="cp-table-wrap">
              <table className="cp-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {selectedPlayers.map((p, i) => (
                      <th key={p.playerName} style={{ color: PLAYER_COLORS[i] }}>#{p.playerNumber}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Matcher', key: 'matchCount' },
                    { label: 'Totala poäng', key: 'totalPts' },
                    { label: 'Poäng/match', key: 'ptsPerMatch' },
                    { label: 'Kill%', key: 'killPct', unit: '%' },
                    { label: 'Angrepp eff.', key: 'attackEff', unit: '%' },
                    { label: 'Mottagning+', key: 'recPosPct', unit: '%' },
                    { label: 'Mottagning perf.', key: 'recExcPct', unit: '%' },
                    { label: 'Ess', key: 'servePts' },
                    { label: 'Servfel%', key: 'serveErrPct', unit: '%' },
                    { label: 'Block', key: 'blockPts' },
                    { label: 'Försvar+', key: 'digPosPct', unit: '%' },
                    { label: 'Total eff.', key: 'efficiency', unit: '%' },
                  ].map(row => {
                    const vals = selectedPlayers.map(p => p[row.key] || 0);
                    const best = row.key === 'serveErrPct' ? Math.min(...vals) : Math.max(...vals);
                    return (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        {selectedPlayers.map((p, i) => {
                          const val = p[row.key] || 0;
                          return (
                            <td key={i} className={val === best && selectedPlayers.length > 1 ? 'cp-cell-best' : ''}>
                              {val}{row.unit || ''}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
