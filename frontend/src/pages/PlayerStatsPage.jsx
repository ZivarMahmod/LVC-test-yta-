// ===========================================
// LVC Media Hub — Avancerad Spelare Dashboard
// Individuell statistik med zonanalys, trender och pressning
// ===========================================
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { playerStatsApi } from '../utils/api.js';
import PrecisionHeatmap from '../components/player/PrecisionHeatmap.jsx';
import PlayerHero from '../components/player/PlayerHero.jsx';
import SeasonGraph from '../components/player/SeasonGraph.jsx';
import RecentActions from '../components/player/RecentActions.jsx';
import StatsExport from '../components/player/StatsExport.jsx';
import './PlayerStatsPage.css';

const pct = (num, den) => den > 0 ? Math.round((num / den) * 100) : 0;

// ===== Stat Card =====
function StatCard({ label, value, sub, color, big }) {
  return (
    <div className={`psp-stat-card ${big ? 'psp-stat-card--big' : ''}`}>
      <div className="psp-stat-value" style={{ color: color || '#f1f5f9' }}>{value}</div>
      <div className="psp-stat-label">{label}</div>
      {sub && <div className="psp-stat-sub">{sub}</div>}
    </div>
  );
}

// ===== Zonheatmap — visar effektivitet per zon =====
function ZoneHeatmap({ zones, type, title }) {
  if (!zones || Object.keys(zones).length === 0) return null;

  // DVW-zoner layout: 4|3|2 (nät), 5|6|1 (bak)
  const layout = [[4, 3, 2], [5, 6, 1]];
  const labels = { 1: 'Z1', 2: 'Z2', 3: 'Z3', 4: 'Z4', 5: 'Z5', 6: 'Z6' };

  const getColor = (value) => {
    if (value >= 60) return '#22c55e';
    if (value >= 40) return '#eab308';
    if (value >= 20) return '#f97316';
    return '#ef4444';
  };

  const getMetric = (zone) => {
    const z = zones[zone];
    if (!z || z.total === 0) return null;
    if (type === 'attack') return { value: z.killPct, label: `${z.kills}/${z.total}`, metric: 'Kill%' };
    if (type === 'serve') return { value: z.acePct, label: `${z.aces}/${z.total}`, metric: 'Ess%' };
    return { value: z.positivePct, label: `${z.positive}/${z.total}`, metric: 'Pos%' };
  };

  return (
    <div className="psp-zone-heatmap">
      <h4>{title}</h4>
      <div className="psp-court">
        <div className="psp-court-net">Nät</div>
        {layout.map((row, ri) => (
          <div key={ri} className="psp-court-row">
            {row.map(zone => {
              const data = getMetric(zone);
              return (
                <div key={zone} className="psp-court-zone" style={{ background: data ? `${getColor(data.value)}22` : '#1e293b', borderColor: data ? getColor(data.value) : '#334155' }}>
                  <span className="psp-zone-id">{labels[zone]}</span>
                  {data ? (
                    <>
                      <span className="psp-zone-pct" style={{ color: getColor(data.value) }}>{data.value}%</span>
                      <span className="psp-zone-count">{data.label}</span>
                    </>
                  ) : (
                    <span className="psp-zone-empty">—</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Trendgraf (SVG) =====
function TrendChart({ data, field, label, color = '#3b82f6', unit = '' }) {
  if (!data || data.length < 2) return null;

  const values = data.map(d => d[field] ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const h = 70;
  const w = 300;
  const step = w / (values.length - 1);

  const points = values.map((v, i) => `${i * step},${h - 5 - ((v - min) / range) * (h - 15)}`).join(' ');
  const latest = values[values.length - 1];
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return (
    <div className="psp-trend">
      <div className="psp-trend-header">
        <span className="psp-trend-label">{label}</span>
        <span className="psp-trend-current" style={{ color }}>{latest}{unit}</span>
      </div>
      <svg viewBox={`-8 -2 ${w + 16} ${h + 10}`} style={{ width: '100%', maxWidth: 320, height: 80 }}>
        {/* Medelvärdeslinje */}
        <line x1="0" y1={h - 5 - ((avg - min) / range) * (h - 15)} x2={w} y2={h - 5 - ((avg - min) / range) * (h - 15)} stroke="#475569" strokeWidth="1" strokeDasharray="4,4" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => (
          <g key={i}>
            <circle cx={i * step} cy={h - 5 - ((v - min) / range) * (h - 15)} r="3.5" fill={color} />
            {i === values.length - 1 && (
              <circle cx={i * step} cy={h - 5 - ((v - min) / range) * (h - 15)} r="6" fill="none" stroke={color} strokeWidth="1.5" />
            )}
          </g>
        ))}
        <text x={w + 4} y={h - 5 - ((avg - min) / range) * (h - 15) + 4} fill="#64748b" fontSize="10">snitt {avg}{unit}</text>
      </svg>
      <div className="psp-trend-labels">
        {data.length > 0 && <span>{data[0].opponent?.substring(0, 8)}</span>}
        {data.length > 1 && <span>{data[data.length - 1].opponent?.substring(0, 8)}</span>}
      </div>
    </div>
  );
}

// ===== Pressningsstatistik =====
function PressurePanel({ pressure }) {
  if (!pressure) return null;
  const { clutch, trailing, leading } = pressure;

  return (
    <div className="psp-section">
      <h2>Prestanda under press</h2>
      <p className="psp-section-desc">Hur spelaren presterar i kritiska situationer</p>
      <div className="psp-pressure-grid">
        <div className="psp-pressure-card">
          <div className="psp-pressure-icon">🔥</div>
          <div className="psp-pressure-title">Avgörande bollar</div>
          <div className="psp-pressure-desc">Båda lag 20+ poäng</div>
          <div className="psp-pressure-stat">
            <span className="psp-pressure-value" style={{ color: clutch.positivePct >= 50 ? '#22c55e' : '#ef4444' }}>{clutch.positivePct}%</span>
            <span className="psp-pressure-label">positiv</span>
          </div>
          <div className="psp-pressure-sub">{clutch.actions} aktioner</div>
        </div>

        <div className="psp-pressure-card">
          <div className="psp-pressure-icon">📉</div>
          <div className="psp-pressure-title">Ligger under</div>
          <div className="psp-pressure-desc">2+ poäng bakom</div>
          <div className="psp-pressure-stat">
            <span className="psp-pressure-value" style={{ color: trailing.positivePct >= 45 ? '#22c55e' : '#eab308' }}>{trailing.positivePct}%</span>
            <span className="psp-pressure-label">positiv</span>
          </div>
          <div className="psp-pressure-sub">{trailing.actions} aktioner</div>
        </div>

        <div className="psp-pressure-card">
          <div className="psp-pressure-icon">📈</div>
          <div className="psp-pressure-title">Ligger över</div>
          <div className="psp-pressure-desc">2+ poäng framför</div>
          <div className="psp-pressure-stat">
            <span className="psp-pressure-value" style={{ color: '#3b82f6' }}>{leading.positivePct}%</span>
            <span className="psp-pressure-label">positiv</span>
          </div>
          <div className="psp-pressure-sub">{leading.actions} aktioner</div>
        </div>
      </div>
    </div>
  );
}

// ===== Lagjämförelse =====
function TeamComparison({ comparison }) {
  if (!comparison) return null;

  const metrics = [
    { key: 'killPct', label: 'Kill%', unit: '%', color: '#ef4444' },
    { key: 'recPosPct', label: 'Mottagning+', unit: '%', color: '#3b82f6' },
    { key: 'ptsPerMatch', label: 'Poäng/match', unit: '', color: '#22c55e' },
  ];

  return (
    <div className="psp-section">
      <h2>Jämfört med laget</h2>
      <div className="psp-comparison-grid">
        {metrics.map(m => {
          const data = comparison[m.key];
          if (!data) return null;
          const barWidth = Math.min(data.percentile, 100);
          return (
            <div key={m.key} className="psp-comparison-item">
              <div className="psp-comparison-header">
                <span className="psp-comparison-label">{m.label}</span>
                <span className="psp-comparison-values">
                  <strong style={{ color: m.color }}>{data.player}{m.unit}</strong>
                  <span className="psp-comparison-vs">vs lagets {data.teamAvg}{m.unit}</span>
                </span>
              </div>
              <div className="psp-comparison-bar-bg">
                <div className="psp-comparison-bar" style={{ width: `${barWidth}%`, background: m.color }} />
                <div className="psp-comparison-median" />
              </div>
              <div className="psp-comparison-percentile">Topp {100 - data.percentile}% i laget</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Skill-detaljer =====
function SkillDetailPanel({ skillDetails }) {
  if (!skillDetails) return null;

  const skillOrder = ['A', 'S', 'R', 'B', 'D', 'P', 'G'];
  const skillColors = { A: '#ef4444', S: '#f59e0b', R: '#3b82f6', B: '#8b5cf6', D: '#10b981', P: '#06b6d4', G: '#6366f1' };

  return (
    <div className="psp-section">
      <h2>Detaljerad statistik</h2>
      <div className="psp-skill-grid">
        {skillOrder.map(code => {
          const s = skillDetails[code];
          if (!s || s.total === 0) return null;
          return (
            <div key={code} className="psp-skill-card">
              <div className="psp-skill-header">
                <span className="psp-skill-badge" style={{ background: skillColors[code] || '#64748b' }}>{s.skillName}</span>
                <span className="psp-skill-total">{s.total} st</span>
              </div>
              <div className="psp-skill-bars">
                <div className="psp-skill-bar-row">
                  <span className="psp-skill-bar-label"># Perfekt</span>
                  <div className="psp-skill-bar-bg">
                    <div className="psp-skill-bar" style={{ width: `${pct(s.perfect, s.total)}%`, background: '#22c55e' }} />
                  </div>
                  <span className="psp-skill-bar-val">{s.perfect} ({pct(s.perfect, s.total)}%)</span>
                </div>
                <div className="psp-skill-bar-row">
                  <span className="psp-skill-bar-label">+ Positiv</span>
                  <div className="psp-skill-bar-bg">
                    <div className="psp-skill-bar" style={{ width: `${pct(s.positive - s.perfect, s.total)}%`, background: '#3b82f6' }} />
                  </div>
                  <span className="psp-skill-bar-val">{s.positive - s.perfect} ({pct(s.positive - s.perfect, s.total)}%)</span>
                </div>
                <div className="psp-skill-bar-row">
                  <span className="psp-skill-bar-label">! / - Övriga</span>
                  <div className="psp-skill-bar-bg">
                    <div className="psp-skill-bar" style={{ width: `${pct(s.ok + s.negative, s.total)}%`, background: '#64748b' }} />
                  </div>
                  <span className="psp-skill-bar-val">{s.ok + s.negative} ({pct(s.ok + s.negative, s.total)}%)</span>
                </div>
                <div className="psp-skill-bar-row">
                  <span className="psp-skill-bar-label">Fel</span>
                  <div className="psp-skill-bar-bg">
                    <div className="psp-skill-bar" style={{ width: `${pct(s.error, s.total)}%`, background: '#ef4444' }} />
                  </div>
                  <span className="psp-skill-bar-val">{s.error} ({pct(s.error, s.total)}%)</span>
                </div>
              </div>
              <div className="psp-skill-footer">
                Effektivitet: <strong style={{ color: s.efficiency >= 30 ? '#22c55e' : s.efficiency >= 0 ? '#eab308' : '#ef4444' }}>{s.efficiency}%</strong>
                {s.points > 0 && <span> | {s.points} poäng</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== HUVUDKOMPONENT =====
export default function PlayerStatsPage() {
  const { playerId } = useParams();
  const [searchParams] = useSearchParams();
  const playerName = searchParams.get('name');
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setLoading(true);
    playerStatsApi.getHistory(playerId, { name: playerName })
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [playerId, playerName]);

  if (loading) return <div className="psp-loading">Laddar spelarstatistik...</div>;
  if (error) return <div className="psp-error">{error}</div>;
  if (!data || data.matchCount === 0) return <div className="psp-empty">Ingen matchdata hittades för denna spelare.</div>;

  const { player, matches, totals, advanced, coordActions } = data;
  const tabs = [
    { id: 'overview', label: 'Översikt' },
    { id: 'zones', label: 'Zonanalys' },
    { id: 'trends', label: 'Utveckling' },
    { id: 'sets', label: 'Set' },
    { id: 'opponents', label: 'Motståndare' },
    { id: 'pressure', label: 'Press' },
    { id: 'matches', label: 'Matcher' },
  ];

  return (
    <div className="psp-container">
      <div className="psp-topbar">
        <button className="psp-back" onClick={() => navigate(-1)}>Tillbaka</button>
        <StatsExport player={player} totals={totals} matchCount={data.matchCount} advanced={advanced} />
      </div>

      {/* Hero Section */}
      <PlayerHero player={player} totals={totals} matchCount={data.matchCount} />

      {/* Tabs */}
      <div className="psp-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`psp-tab ${activeTab === t.id ? 'psp-tab--active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Översikt */}
      {activeTab === 'overview' && (
        <>
          <div className="psp-summary">
            <StatCard label="Totala poäng" value={totals.totalPts} color="#22c55e" big />
            <StatCard label="Poäng/match" value={(totals.totalPts / data.matchCount).toFixed(1)} color="#3b82f6" big />
            <StatCard label="Kill%" value={`${pct(totals.attack.pts, totals.attack.total)}%`} sub={`${totals.attack.pts}/${totals.attack.total}`} />
            <StatCard label="Angrepp eff." value={`${totals.attack.total > 0 ? Math.round(((totals.attack.pts - totals.attack.err - totals.attack.blocked) / totals.attack.total) * 100) : 0}%`} sub="kills-errors-blocked/total" />
            <StatCard label="Mottagning+" value={`${pct(totals.reception.pos, totals.reception.total)}%`} sub={`${totals.reception.pos}/${totals.reception.total}`} />
            <StatCard label="Ess" value={totals.serve.pts} sub={`${pct(totals.serve.pts, totals.serve.total)}%`} />
            <StatCard label="Block" value={totals.block.pts} />
            <StatCard label="Felfrekvens" value={`${advanced?.overview?.errorRate || 0}%`} color={advanced?.overview?.errorRate > 20 ? '#ef4444' : '#94a3b8'} />
          </div>

          {/* Säsongsgraf */}
          <SeasonGraph trends={advanced?.trends} />

          {/* Senaste matcher */}
          <RecentActions matches={matches} />

          <SkillDetailPanel skillDetails={advanced?.skillDetails} />

          {/* Konsistens & Form */}
          {advanced?.consistency && (
            <div className="psp-section">
              <h2>Konsistens & Form</h2>
              <div className="psp-consistency-grid">
                <div className="psp-cons-card">
                  <div className="psp-cons-label">Formkurva</div>
                  <div className="psp-cons-value" style={{
                    color: advanced.consistency.formTrend > 10 ? '#22c55e' : advanced.consistency.formTrend < -10 ? '#ef4444' : '#eab308'
                  }}>
                    {advanced.consistency.formTrend > 0 ? '+' : ''}{advanced.consistency.formTrend}%
                  </div>
                  <div className="psp-cons-desc">{advanced.consistency.formLabel} (senaste 3 matcher vs snitt)</div>
                </div>
                <div className="psp-cons-card">
                  <div className="psp-cons-label">Poäng/match</div>
                  <div className="psp-cons-value">{advanced.consistency.points.avg}</div>
                  <div className="psp-cons-desc">
                    Bäst: {advanced.consistency.points.best} | Sämst: {advanced.consistency.points.worst} | Spridning: {advanced.consistency.points.stdDev}
                  </div>
                </div>
                {advanced.consistency.killPct && (
                  <div className="psp-cons-card">
                    <div className="psp-cons-label">Kill% variation</div>
                    <div className="psp-cons-value">{advanced.consistency.killPct.stdDev}</div>
                    <div className="psp-cons-desc">
                      Bäst: {advanced.consistency.killPct.best}% | Sämst: {advanced.consistency.killPct.worst}% | Diff: {advanced.consistency.killPct.diff}%
                    </div>
                  </div>
                )}
                {advanced.consistency.recPosPct && (
                  <div className="psp-cons-card">
                    <div className="psp-cons-label">Mottagning variation</div>
                    <div className="psp-cons-value">{advanced.consistency.recPosPct.stdDev}</div>
                    <div className="psp-cons-desc">
                      Bäst: {advanced.consistency.recPosPct.best}% | Sämst: {advanced.consistency.recPosPct.worst}% | Diff: {advanced.consistency.recPosPct.diff}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <TeamComparison comparison={advanced?.teamComparison} />
        </>
      )}

      {/* Zonanalys */}
      {activeTab === 'zones' && (
        <>
          <div className="psp-section">
            <h2>Zonanalys</h2>
            <p className="psp-section-desc">Var på planen presterar spelaren bäst?</p>
            <div className="psp-zone-grid">
              <ZoneHeatmap zones={advanced?.zoneAnalysis?.attack} type="attack" title="Angrepp per zon (Kill%)" />
              <ZoneHeatmap zones={advanced?.zoneAnalysis?.serve} type="serve" title="Serve landning (Ess%)" />
              <ZoneHeatmap zones={advanced?.zoneAnalysis?.reception} type="reception" title="Mottagning per zon (Pos%)" />
              <ZoneHeatmap zones={advanced?.zoneAnalysis?.dig} type="dig" title="Försvar per zon (Pos%)" />
            </div>
          </div>

          {coordActions && coordActions.length > 0 && (
            <div className="psp-section">
              <h2>Exakta placeringar</h2>
              <p className="psp-section-desc">Varje prick = en aktion. Grönt = lyckad, rött = fel. Baserat på DVW-koordinater.</p>
              <div className="psp-zone-grid">
                <PrecisionHeatmap actions={coordActions} skillFilter="A" coordType="start" title="Angrepp (startposition)" />
                <PrecisionHeatmap actions={coordActions} skillFilter="S" coordType="end" title="Serve (landning)" showTrails />
                <PrecisionHeatmap actions={coordActions} skillFilter="R" coordType="start" title="Mottagning (position)" />
                <PrecisionHeatmap actions={coordActions} skillFilter="D" coordType="start" title="Försvar (position)" />
              </div>
            </div>
          )}
        </>
      )}

      {/* Utveckling */}
      {activeTab === 'trends' && advanced?.trends && (
        <div className="psp-section">
          <h2>Utveckling över tid</h2>
          <p className="psp-section-desc">Senaste matcherna — äldst till vänster, nyast till höger</p>
          <div className="psp-trend-grid">
            <TrendChart data={advanced.trends} field="points" label="Poäng" color="#22c55e" />
            <TrendChart data={advanced.trends} field="killPct" label="Kill%" color="#ef4444" unit="%" />
            <TrendChart data={advanced.trends} field="attackEff" label="Angrepp eff." color="#f59e0b" unit="%" />
            <TrendChart data={advanced.trends} field="recPosPct" label="Mottagning+" color="#3b82f6" unit="%" />
            <TrendChart data={advanced.trends} field="servePts" label="Ess" color="#8b5cf6" />
            <TrendChart data={advanced.trends} field="actionCount" label="Aktioner" color="#64748b" />
          </div>
        </div>
      )}

      {/* Set-analys */}
      {activeTab === 'sets' && advanced?.setAnalysis && (
        <div className="psp-section">
          <h2>Prestanda per set</h2>
          <p className="psp-section-desc">Hur spelaren presterar i varje set — tappar formen i set 4?</p>
          <div className="psp-set-grid">
            {advanced.setAnalysis.map(s => (
              <div key={s.set} className="psp-set-card">
                <div className="psp-set-number">Set {s.set}</div>
                <div className="psp-set-stats">
                  <div className="psp-set-main">
                    <span className="psp-set-eff" style={{ color: s.efficiency >= 30 ? '#22c55e' : s.efficiency >= 0 ? '#eab308' : '#ef4444' }}>{s.efficiency}%</span>
                    <span className="psp-set-eff-label">eff.</span>
                  </div>
                  <div className="psp-set-details">
                    <span>{s.total} aktioner</span>
                    <span>{s.points} poäng</span>
                    <span style={{ color: '#22c55e' }}>{s.positivePct}% pos</span>
                    <span style={{ color: '#ef4444' }}>{s.errorPct}% fel</span>
                  </div>
                </div>
                <div className="psp-set-bar-bg">
                  <div className="psp-set-bar-pos" style={{ width: `${s.positivePct}%` }} />
                  <div className="psp-set-bar-err" style={{ width: `${s.errorPct}%`, marginLeft: `${100 - s.errorPct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motståndaranalys */}
      {activeTab === 'opponents' && advanced?.opponentAnalysis && (
        <div className="psp-section">
          <h2>Mot varje motståndare</h2>
          <p className="psp-section-desc">Hur spelaren presterar mot specifika lag</p>
          <div className="psp-opp-list">
            {advanced.opponentAnalysis.map(o => (
              <div key={o.opponent} className="psp-opp-row">
                <div className="psp-opp-info">
                  <span className="psp-opp-name">{o.opponent}</span>
                  <span className="psp-opp-meta">{o.matchCount} {o.matchCount === 1 ? 'match' : 'matcher'} | {o.total} akt</span>
                </div>
                <div className="psp-opp-stats">
                  <span className="psp-opp-pts">{o.points}p</span>
                  <span style={{ color: o.killPct >= 40 ? '#22c55e' : o.killPct >= 25 ? '#eab308' : '#ef4444' }}>{o.killPct}% kill</span>
                  <span style={{ color: o.efficiency >= 20 ? '#22c55e' : o.efficiency >= 0 ? '#eab308' : '#ef4444' }}>{o.efficiency}% eff</span>
                  <span style={{ color: '#ef4444' }}>{o.errorPct}% fel</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pressningsstatistik */}
      {activeTab === 'pressure' && (
        <PressurePanel pressure={advanced?.pressureStats} />
      )}

      {/* Matchlista */}
      {activeTab === 'matches' && (
        <div className="psp-section">
          <h2>Matcher</h2>
          <div className="psp-match-list">
            {matches.map(m => (
              <div key={m.videoId} className="psp-match-row" onClick={() => navigate(`/video/${m.videoId}`)}>
                <div className="psp-match-info">
                  <span className="psp-match-date">{new Date(m.matchDate).toLocaleDateString('sv-SE')}</span>
                  <span className="psp-match-opponent">vs {m.opponent}</span>
                  {m.team && <span className="psp-match-team">{m.team.name}</span>}
                </div>
                <div className="psp-match-stats">
                  <span className="psp-match-pts">{m.stats.totalPts}p</span>
                  <span>{m.stats.attack.pts}/{m.stats.attack.total} kill</span>
                  <span>{pct(m.stats.reception.pos, m.stats.reception.total)}% mott</span>
                  <span>{m.actionCount} akt</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
