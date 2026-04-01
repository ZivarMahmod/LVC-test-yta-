// ===========================================
// LVC Media Hub — Historisk Spelarstatistik
// Visar en spelares prestationer över alla matcher
// ===========================================
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { playerStatsApi } from '../utils/api.js';
import './PlayerStatsPage.css';

const pct = (num, den) => den > 0 ? Math.round((num / den) * 100) : 0;

function StatCard({ label, value, sub, color }) {
  return (
    <div className="psp-stat-card">
      <div className="psp-stat-value" style={{ color: color || '#f1f5f9' }}>{value}</div>
      <div className="psp-stat-label">{label}</div>
      {sub && <div className="psp-stat-sub">{sub}</div>}
    </div>
  );
}

function SkillBreakdown({ label, stats, type }) {
  if (type === 'serve') {
    return (
      <div className="psp-skill">
        <h4>{label}</h4>
        <div className="psp-skill-row">
          <span>Totalt: {stats.total}</span>
          <span>Ess: {stats.pts} ({pct(stats.pts, stats.total)}%)</span>
          <span>Fel: {stats.err} ({pct(stats.err, stats.total)}%)</span>
        </div>
      </div>
    );
  }
  if (type === 'attack') {
    return (
      <div className="psp-skill">
        <h4>{label}</h4>
        <div className="psp-skill-row">
          <span>Totalt: {stats.total}</span>
          <span>Kill: {stats.pts} ({pct(stats.pts, stats.total)}%)</span>
          <span>Fel: {stats.err} ({pct(stats.err, stats.total)}%)</span>
          <span>Blockad: {stats.blocked}</span>
        </div>
      </div>
    );
  }
  if (type === 'reception') {
    return (
      <div className="psp-skill">
        <h4>{label}</h4>
        <div className="psp-skill-row">
          <span>Totalt: {stats.total}</span>
          <span>Positiv: {pct(stats.pos, stats.total)}%</span>
          <span>Perfekt: {pct(stats.exc, stats.total)}%</span>
          <span>Fel: {stats.err}</span>
        </div>
      </div>
    );
  }
  if (type === 'dig') {
    return (
      <div className="psp-skill">
        <h4>{label}</h4>
        <div className="psp-skill-row">
          <span>Totalt: {stats.total}</span>
          <span>Positiv: {pct(stats.pos, stats.total)}%</span>
          <span>Fel: {stats.err}</span>
        </div>
      </div>
    );
  }
  return null;
}

function TrendChart({ matches, field, label }) {
  if (matches.length < 2) return null;

  const values = matches.map(m => {
    const s = m.stats;
    if (field === 'points') return s.totalPts;
    if (field === 'killPct') return s.attack.total > 0 ? (s.attack.pts / s.attack.total) * 100 : 0;
    if (field === 'recPct') return s.reception.total > 0 ? (s.reception.pos / s.reception.total) * 100 : 0;
    return 0;
  }).reverse(); // Äldst till nyast

  const max = Math.max(...values, 1);
  const h = 60;
  const w = 280;
  const step = w / (values.length - 1);

  const points = values.map((v, i) => `${i * step},${h - (v / max) * (h - 5)}`).join(' ');

  return (
    <div className="psp-trend">
      <div className="psp-trend-label">{label}</div>
      <svg viewBox={`-5 0 ${w + 10} ${h + 5}`} style={{ width: '100%', maxWidth: 300, height: 70 }}>
        <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {values.map((v, i) => (
          <circle key={i} cx={i * step} cy={h - (v / max) * (h - 5)} r="3" fill="#3b82f6" />
        ))}
      </svg>
    </div>
  );
}

export default function PlayerStatsPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    playerStatsApi.getHistory(playerId)
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [playerId]);

  if (loading) return <div className="psp-loading">Laddar spelarstatistik...</div>;
  if (error) return <div className="psp-error">{error}</div>;
  if (!data || data.matchCount === 0) return <div className="psp-empty">Ingen matchdata hittades för denna spelare.</div>;

  const { player, matches, totals } = data;

  return (
    <div className="psp-container">
      <button className="psp-back" onClick={() => navigate(-1)}>Tillbaka</button>

      <div className="psp-header">
        <h1>
          {player.jerseyNumber && <span className="psp-jersey">#{player.jerseyNumber}</span>}
          {player.name}
        </h1>
        <p>{data.matchCount} matcher analyserade</p>
      </div>

      {/* Sammanfattning */}
      <div className="psp-summary">
        <StatCard label="Totala poäng" value={totals.totalPts} color="#22c55e" />
        <StatCard label="Poäng/match" value={(totals.totalPts / data.matchCount).toFixed(1)} color="#3b82f6" />
        <StatCard label="Kill%" value={`${pct(totals.attack.pts, totals.attack.total)}%`}
          sub={`${totals.attack.pts}/${totals.attack.total}`} />
        <StatCard label="Mottagning+" value={`${pct(totals.reception.pos, totals.reception.total)}%`}
          sub={`${totals.reception.pos}/${totals.reception.total}`} />
        <StatCard label="Ess" value={totals.serve.pts}
          sub={`${pct(totals.serve.pts, totals.serve.total)}%`} />
        <StatCard label="Block" value={totals.block.pts} />
      </div>

      {/* Detaljerad uppdelning */}
      <div className="psp-details">
        <h2>Totaler</h2>
        <SkillBreakdown label="Serve" stats={totals.serve} type="serve" />
        <SkillBreakdown label="Angrepp" stats={totals.attack} type="attack" />
        <SkillBreakdown label="Mottagning" stats={totals.reception} type="reception" />
        <SkillBreakdown label="Försvar" stats={totals.dig} type="dig" />
      </div>

      {/* Trendgrafer */}
      {matches.length >= 2 && (
        <div className="psp-trends">
          <h2>Utveckling</h2>
          <div className="psp-trend-grid">
            <TrendChart matches={matches} field="points" label="Poäng per match" />
            <TrendChart matches={matches} field="killPct" label="Kill%" />
            <TrendChart matches={matches} field="recPct" label="Mottagning+%" />
          </div>
        </div>
      )}

      {/* Matchlista */}
      <div className="psp-matches">
        <h2>Matcher</h2>
        <div className="psp-match-list">
          {matches.map(m => (
            <div key={m.videoId} className="psp-match-row" onClick={() => navigate(`/videos/${m.videoId}`)}>
              <div className="psp-match-info">
                <span className="psp-match-date">{new Date(m.matchDate).toLocaleDateString('sv-SE')}</span>
                <span className="psp-match-opponent">vs {m.opponent}</span>
                {m.team && <span className="psp-match-team">{m.team.name}</span>}
              </div>
              <div className="psp-match-stats">
                <span>{m.stats.totalPts} p</span>
                <span>{m.stats.attack.pts}/{m.stats.attack.total} kill</span>
                <span>{pct(m.stats.reception.pos, m.stats.reception.total)}% mott</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
