// ===========================================
// LVC Media Hub — Team Roster / Lagöversikt
// Alla spelares nyckeltal på ett ställe
// ===========================================
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { playerStatsApi, teamApi } from '../utils/api.js';
import './TeamRosterPage.css';

const SORT_OPTIONS = [
  { key: 'totalPts', label: 'Poäng', desc: true },
  { key: 'ptsPerMatch', label: 'P/match', desc: true },
  { key: 'killPct', label: 'Kill%', desc: true },
  { key: 'attackEff', label: 'Angrepp eff.', desc: true },
  { key: 'recPosPct', label: 'Mott+%', desc: true },
  { key: 'efficiency', label: 'Total eff.', desc: true },
  { key: 'servePts', label: 'Ess', desc: true },
  { key: 'matchCount', label: 'Matcher', desc: true },
];

function EfficiencyBar({ value, max = 60, color }) {
  const width = Math.max(0, Math.min(100, ((value + 30) / max) * 100));
  return (
    <div className="tr-eff-bar-bg">
      <div className="tr-eff-bar" style={{ width: `${width}%`, background: color || (value >= 25 ? '#22c55e' : value >= 0 ? '#eab308' : '#ef4444') }} />
    </div>
  );
}

function PlayerRow({ player, rank, onClick }) {
  const effColor = player.efficiency >= 25 ? '#22c55e' : player.efficiency >= 0 ? '#eab308' : '#ef4444';
  const killColor = player.killPct >= 40 ? '#22c55e' : player.killPct >= 25 ? '#eab308' : '#ef4444';
  const recColor = player.recPosPct >= 55 ? '#22c55e' : player.recPosPct >= 40 ? '#eab308' : '#ef4444';

  return (
    <div className="tr-player-row" onClick={onClick}>
      <div className="tr-player-rank">{rank}</div>
      <div className="tr-player-info">
        <span className="tr-player-number">#{player.playerNumber}</span>
        <span className="tr-player-name">{player.playerName}</span>
        <span className="tr-player-matches">{player.matchCount}m</span>
      </div>
      <div className="tr-player-stats">
        <div className="tr-stat-cell tr-stat-pts">
          <span className="tr-stat-value">{player.totalPts}</span>
          <span className="tr-stat-sub">{player.ptsPerMatch}/m</span>
        </div>
        <div className="tr-stat-cell">
          <span className="tr-stat-value" style={{ color: killColor }}>{player.killPct}%</span>
          <span className="tr-stat-sub">{player.attack.pts}/{player.attack.total}</span>
        </div>
        <div className="tr-stat-cell">
          <span className="tr-stat-value" style={{ color: recColor }}>{player.recPosPct}%</span>
          <span className="tr-stat-sub">{player.reception.pos}/{player.reception.total}</span>
        </div>
        <div className="tr-stat-cell">
          <span className="tr-stat-value">{player.servePts}</span>
          <span className="tr-stat-sub">ess</span>
        </div>
        <div className="tr-stat-cell">
          <span className="tr-stat-value">{player.blockPts}</span>
          <span className="tr-stat-sub">block</span>
        </div>
        <div className="tr-stat-cell tr-stat-eff">
          <span className="tr-stat-value" style={{ color: effColor }}>{player.efficiency}%</span>
          <EfficiencyBar value={player.efficiency} />
        </div>
      </div>
    </div>
  );
}

export default function TeamRosterPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(teamId || 'all');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('totalPts');
  const [viewMode, setViewMode] = useState('list');
  const [error, setError] = useState(null);

  useEffect(() => {
    teamApi.listTeams().then(t => setTeams(t.teams || t || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    playerStatsApi.getTeamRoster(selectedTeam)
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedTeam]);

  const sortedRoster = useMemo(() => {
    if (!data?.roster) return [];
    const opt = SORT_OPTIONS.find(o => o.key === sortBy);
    return [...data.roster].sort((a, b) => opt?.desc ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]);
  }, [data, sortBy]);

  // Lagsammanfattning
  const teamSummary = useMemo(() => {
    if (!data?.roster || data.roster.length === 0) return null;
    const r = data.roster;
    const attackers = r.filter(p => p.attack.total >= 10);
    const receivers = r.filter(p => p.reception.total >= 10);
    return {
      players: r.length,
      totalPts: r.reduce((s, p) => s + p.totalPts, 0),
      avgKill: attackers.length > 0 ? Math.round(attackers.reduce((s, p) => s + p.killPct, 0) / attackers.length) : 0,
      avgRec: receivers.length > 0 ? Math.round(receivers.reduce((s, p) => s + p.recPosPct, 0) / receivers.length) : 0,
      totalAces: r.reduce((s, p) => s + p.servePts, 0),
      totalBlocks: r.reduce((s, p) => s + p.blockPts, 0),
    };
  }, [data]);

  if (loading) return <div className="tr-loading">Laddar lagöversikt...</div>;
  if (error) return <div className="tr-error">{error}</div>;

  return (
    <div className="tr-container">
      <div className="tr-header">
        <h1>Lagöversikt</h1>
        <div className="tr-controls">
          <button className="tr-compare-btn" onClick={() => navigate('/compare')}>Jämför spelare</button>
          <select className="tr-select" value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
            <option value="all">Alla lag</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lagsammanfattning */}
      {teamSummary && (
        <div className="tr-summary">
          <div className="tr-summary-card">
            <span className="tr-summary-value">{teamSummary.players}</span>
            <span className="tr-summary-label">Spelare</span>
          </div>
          <div className="tr-summary-card">
            <span className="tr-summary-value" style={{ color: '#22c55e' }}>{teamSummary.totalPts}</span>
            <span className="tr-summary-label">Totala poäng</span>
          </div>
          <div className="tr-summary-card">
            <span className="tr-summary-value" style={{ color: teamSummary.avgKill >= 35 ? '#22c55e' : '#eab308' }}>{teamSummary.avgKill}%</span>
            <span className="tr-summary-label">Snitt kill%</span>
          </div>
          <div className="tr-summary-card">
            <span className="tr-summary-value" style={{ color: teamSummary.avgRec >= 50 ? '#22c55e' : '#eab308' }}>{teamSummary.avgRec}%</span>
            <span className="tr-summary-label">Snitt mott+%</span>
          </div>
          <div className="tr-summary-card">
            <span className="tr-summary-value">{teamSummary.totalAces}</span>
            <span className="tr-summary-label">Ess</span>
          </div>
          <div className="tr-summary-card">
            <span className="tr-summary-value">{teamSummary.totalBlocks}</span>
            <span className="tr-summary-label">Block</span>
          </div>
        </div>
      )}

      {/* Sortering + view toggle */}
      <div className="tr-sort">
        <span className="tr-sort-label">Sortera:</span>
        {SORT_OPTIONS.map(opt => (
          <button key={opt.key} className={`tr-sort-btn ${sortBy === opt.key ? 'tr-sort-btn--active' : ''}`} onClick={() => setSortBy(opt.key)}>
            {opt.label}
          </button>
        ))}
        <div className="tr-view-toggle">
          <button className={`tr-view-btn ${viewMode === 'list' ? 'tr-view-btn--active' : ''}`} onClick={() => setViewMode('list')} title="Listvy">☰</button>
          <button className={`tr-view-btn ${viewMode === 'cards' ? 'tr-view-btn--active' : ''}`} onClick={() => setViewMode('cards')} title="Kortvy">⊞</button>
        </div>
      </div>

      {/* Tabellhuvud */}
      <div className="tr-table-header">
        <span className="tr-th-rank">#</span>
        <span className="tr-th-name">Spelare</span>
        <span className="tr-th-stat">Poäng</span>
        <span className="tr-th-stat">Kill%</span>
        <span className="tr-th-stat">Mott+%</span>
        <span className="tr-th-stat">Ess</span>
        <span className="tr-th-stat">Block</span>
        <span className="tr-th-stat">Eff%</span>
      </div>

      {/* Spelarlista */}
      {sortedRoster.length === 0 ? (
        <div className="tr-empty">Ingen spelardata hittades. Ladda upp matcher med DVW-filer.</div>
      ) : viewMode === 'cards' ? (
        <div className="tr-cards-grid">
          {sortedRoster.map((player, i) => {
            const killColor = player.killPct >= 40 ? '#22c55e' : player.killPct >= 25 ? '#eab308' : '#ef4444';
            const effColor = player.efficiency >= 25 ? '#22c55e' : player.efficiency >= 0 ? '#eab308' : '#ef4444';
            return (
              <div
                key={player.playerName}
                className="tr-card"
                onClick={() => navigate(`/player/${player.playerNumber}?name=${encodeURIComponent(player.playerName)}`)}
              >
                <div className="tr-card-header">
                  <div className="tr-card-avatar">
                    {(player.playerName || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="tr-card-number">#{player.playerNumber}</span>
                    <span className="tr-card-name">{player.playerName}</span>
                  </div>
                </div>
                <div className="tr-card-stats">
                  <div className="tr-card-stat">
                    <span className="tr-card-stat-val" style={{ color: '#22c55e' }}>{player.totalPts}</span>
                    <span className="tr-card-stat-lbl">Poäng</span>
                  </div>
                  <div className="tr-card-stat">
                    <span className="tr-card-stat-val" style={{ color: killColor }}>{player.killPct}%</span>
                    <span className="tr-card-stat-lbl">Kill</span>
                  </div>
                  <div className="tr-card-stat">
                    <span className="tr-card-stat-val" style={{ color: effColor }}>{player.efficiency}%</span>
                    <span className="tr-card-stat-lbl">Eff.</span>
                  </div>
                </div>
                <div className="tr-card-footer">
                  {player.matchCount} matcher · {player.ptsPerMatch} p/m
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tr-player-list">
          {sortedRoster.map((player, i) => (
            <PlayerRow
              key={player.playerName}
              player={player}
              rank={i + 1}
              onClick={() => navigate(`/player/${player.playerNumber}?name=${encodeURIComponent(player.playerName)}`)}
            />
          ))}
        </div>
      )}

      <div className="tr-footer">
        {data?.videoCount || 0} matcher analyserade
      </div>
    </div>
  );
}
