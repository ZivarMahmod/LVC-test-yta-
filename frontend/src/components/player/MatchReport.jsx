// ===========================================
// LVC Media Hub — MatchReport
// Rapport-vy med lagstatistik och spelardetaljer
// ===========================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const pct = (n, d) => d > 0 ? Math.round(n / d * 100) + '%' : '-';

function StatBar({ label, home, away, higherIsBetter = true }) {
  const hVal = parseFloat(home) || 0;
  const aVal = parseFloat(away) || 0;
  const hBetter = higherIsBetter ? hVal >= aVal : hVal <= aVal;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0', fontSize: '0.8rem' }}>
      <span style={{ width: '45px', textAlign: 'right', fontWeight: hBetter ? '700' : '400', color: hBetter ? 'var(--lvc-green, #3fb950)' : 'var(--text-muted)' }}>{home}</span>
      <span style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ width: '45px', textAlign: 'left', fontWeight: !hBetter ? '700' : '400', color: !hBetter ? 'var(--lvc-green, #3fb950)' : 'var(--text-muted)' }}>{away}</span>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: '500' }}>{value}</span>
    </div>
  );
}

function PlayerStatsCard({ player, team, teamName, color, onJumpToActions, onShowHistory }) {
  return (
    <div style={{ background: `rgba(${color}, 0.08)`, borderRadius: '6px', padding: '0.4rem', marginBottom: '0.3rem' }}>
      {team === 'H' && (
        <button
          onClick={() => onShowHistory(player.number)}
          style={{ width: '100%', padding: '4px 8px', marginBottom: '0.3rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '4px', color: '#93c5fd', fontSize: '0.7rem', cursor: 'pointer' }}
        >
          Visa historik alla matcher
        </button>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem' }}>
          <div onClick={() => onJumpToActions(team, player.number, 'S')} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem', cursor: 'pointer' }}>Serve ▶</div>
          <StatRow label="Tot" value={player.serve.total} />
          <StatRow label="Ace" value={player.serve.pts} />
          <StatRow label="Err" value={player.serve.err} />
          <StatRow label="Ace%" value={pct(player.serve.pts, player.serve.total)} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer' }} onClick={() => onJumpToActions(team, player.number, 'A')}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Anfall ▶</div>
          <StatRow label="Tot" value={player.attack.total} />
          <StatRow label="Kill" value={player.attack.pts} />
          <StatRow label="Err" value={player.attack.err} />
          <StatRow label="K%" value={pct(player.attack.pts, player.attack.total)} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer' }} onClick={() => onJumpToActions(team, player.number, 'R')}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Mottagning ▶</div>
          <StatRow label="Tot" value={player.reception.total} />
          <StatRow label="Pos" value={player.reception.pos} />
          <StatRow label="Exc" value={player.reception.exc} />
          <StatRow label="Pos%" value={pct(player.reception.pos, player.reception.total)} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer' }} onClick={() => onJumpToActions(team, player.number, 'D')}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Block & Försvar ▶</div>
          <StatRow label="Block" value={player.block.pts} />
          <StatRow label="Dig" value={player.dig.total} />
          <StatRow label="Dig+" value={player.dig.pos} />
          <StatRow label="D%" value={pct(player.dig.pos, player.dig.total)} />
        </div>
      </div>
    </div>
  );
}

function TeamPlayerList({ players, team, teamName, color, titleColor, selectedPlayer, setSelectedPlayer, onJumpToActions, onShowHistory }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: '600', marginBottom: '0.3rem', color: titleColor }}>{teamName}</div>
      <div style={{ display: 'flex', gap: '0.4rem', padding: '0.2rem 0.2rem', fontSize: '0.65rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ width: '28px' }}></span>
        <span style={{ flex: 1 }}>Spelare</span>
        <span style={{ width: '35px', textAlign: 'right' }}>Pts</span>
        <span style={{ width: '55px', textAlign: 'right' }}>Anfall</span>
      </div>
      {players.map(p => (
        <React.Fragment key={team + '-' + p.number}>
          <div
            onClick={() => setSelectedPlayer(prev => prev && prev.team === team && prev.number === p.number ? null : { ...p, team, teamName })}
            style={{ display: 'flex', gap: '0.4rem', padding: '0.3rem 0.2rem', fontSize: '0.78rem', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ width: '28px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>#{p.number}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ width: '35px', textAlign: 'right', fontWeight: '700' }}>{p.pts}</span>
            <span style={{ width: '55px', textAlign: 'right', fontSize: '0.75rem' }}>{p.attack.total > 0 ? pct(p.attack.pts, p.attack.total) : '-'}</span>
          </div>
          {selectedPlayer && selectedPlayer.team === team && selectedPlayer.number === p.number && (
            <PlayerStatsCard player={selectedPlayer} team={team} teamName={teamName} color={color} onJumpToActions={onJumpToActions} onShowHistory={onShowHistory} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const STAT_SECTIONS = [
  { key: 'points', label: 'Poäng' },
  { key: 'serve', label: 'Serve' },
  { key: 'attack', label: 'Anfall' },
  { key: 'reception', label: 'Mottagning' },
  { key: 'defense', label: 'Försvar' },
];

function StatSection({ section, stats }) {
  switch (section) {
    case 'points':
      return (
        <>
          <StatBar label="Totalt" home={stats.H.totalPts} away={stats.V.totalPts} />
          <StatBar label="Serve ace" home={stats.H.serve.pts} away={stats.V.serve.pts} />
          <StatBar label="Anfall" home={stats.H.attack.pts} away={stats.V.attack.pts} />
          <StatBar label="Block" home={stats.H.block.pts} away={stats.V.block.pts} />
        </>
      );
    case 'serve':
      return (
        <>
          <StatBar label="Totalt" home={stats.H.serve.total} away={stats.V.serve.total} />
          <StatBar label="Aces" home={stats.H.serve.pts} away={stats.V.serve.pts} />
          <StatBar label="Errors" home={stats.H.serve.err} away={stats.V.serve.err} higherIsBetter={false} />
          <StatBar label="Miss %" home={pct(stats.H.serve.err, stats.H.serve.total)} away={pct(stats.V.serve.err, stats.V.serve.total)} higherIsBetter={false} />
          <StatBar label="Ace %" home={pct(stats.H.serve.pts, stats.H.serve.total)} away={pct(stats.V.serve.pts, stats.V.serve.total)} />
        </>
      );
    case 'attack':
      return (
        <>
          <StatBar label="Totalt" home={stats.H.attack.total} away={stats.V.attack.total} />
          <StatBar label="Kill" home={stats.H.attack.pts} away={stats.V.attack.pts} />
          <StatBar label="Kill %" home={pct(stats.H.attack.pts, stats.H.attack.total)} away={pct(stats.V.attack.pts, stats.V.attack.total)} />
          <StatBar label="Errors" home={stats.H.attack.err} away={stats.V.attack.err} higherIsBetter={false} />
          <StatBar label="Blocked" home={stats.H.attack.blocked} away={stats.V.attack.blocked} higherIsBetter={false} />
        </>
      );
    case 'reception':
      return (
        <>
          <StatBar label="Totalt" home={stats.H.reception.total} away={stats.V.reception.total} />
          <StatBar label="Positiv %" home={pct(stats.H.reception.pos, stats.H.reception.total)} away={pct(stats.V.reception.pos, stats.V.reception.total)} />
          <StatBar label="Excellent %" home={pct(stats.H.reception.exc, stats.H.reception.total)} away={pct(stats.V.reception.exc, stats.V.reception.total)} />
          <StatBar label="Errors" home={stats.H.reception.err} away={stats.V.reception.err} higherIsBetter={false} />
        </>
      );
    case 'defense':
      return (
        <>
          <StatBar label="Totalt" home={stats.H.dig.total} away={stats.V.dig.total} />
          <StatBar label="Positiv %" home={pct(stats.H.dig.pos, stats.H.dig.total)} away={pct(stats.V.dig.pos, stats.V.dig.total)} />
        </>
      );
    default:
      return null;
  }
}

export default function MatchReport({ stats, onJumpToActions }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [statPage, setStatPage] = useState(0);
  const navigate = useNavigate();
  const handleShowHistory = (jerseyNumber) => navigate(`/player/${jerseyNumber}`);

  if (!stats) return <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Ingen data</div>;

  const hPlayers = Object.values(stats.H.players).sort((a, b) => b.pts - a.pts);
  const vPlayers = Object.values(stats.V.players).sort((a, b) => b.pts - a.pts);

  const handleExport = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const buildPlayerTable = (players, teamName) => {
      const rows = players.map(p =>
        `<tr>
          <td class="num">#${p.number}</td>
          <td>${p.name}</td>
          <td class="num">${p.pts}</td>
          <td class="num">${p.serve.total} (${p.serve.pts}A, ${p.serve.err}E)</td>
          <td class="num">${p.attack.total} (${p.attack.pts}K, ${p.attack.err}E)</td>
          <td class="num">${p.reception.total > 0 ? p.reception.total + ' (' + pct(p.reception.pos, p.reception.total) + ' pos)' : '0 (- pos)'}</td>
          <td class="num">${p.dig.total} (${p.dig.pos} pos)</td>
          <td class="num">${p.block.pts}</td>
        </tr>`
      ).join('');
      return `<h3>${teamName}</h3>
        <table>
          <thead><tr>
            <th></th><th>Spelare</th><th>Pts</th>
            <th>Serve</th><th>Anfall</th><th>Mottagning</th><th>Försvar</th><th>Block</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Matchrapport</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1e293b; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; color: #64748b; font-size: 11px; }
  h1 { font-size: 20px; margin: 0 0 4px 0; }
  h2 { font-size: 15px; border-bottom: 2px solid #334155; padding-bottom: 4px; margin: 16px 0 8px 0; }
  h3 { font-size: 14px; font-weight: 700; margin: 14px 0 6px 0; }
  .summary { margin-bottom: 12px; }
  .summary .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f1f5f9; }
  .summary .label { color: #64748b; }
  .summary .val { font-weight: 600; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
  thead th { background: #f8fafc; font-weight: 700; text-align: left; padding: 5px 6px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
  tbody td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }
  tbody tr:hover { background: #f8fafc; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .footer { color: #94a3b8; font-size: 10px; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  @media print { body { margin: 0; padding: 10px; } }
</style></head><body>
<div class="header">
  <span>${dateStr}</span>
  <span>Matchrapport</span>
</div>
<h1>${stats.H.name} vs ${stats.V.name}</h1>

<h2>Sammanfattning</h2>
<div class="summary">
  <div class="row"><span class="label">Totala poäng</span><span class="val">${stats.H.totalPts} - ${stats.V.totalPts}</span></div>
  <div class="row"><span class="label">Serve (ess/fel)</span><span class="val">${stats.H.serve.pts}/${stats.H.serve.err} - ${stats.V.serve.pts}/${stats.V.serve.err}</span></div>
  <div class="row"><span class="label">Anfall (kill/tot)</span><span class="val">${stats.H.attack.pts}/${stats.H.attack.total} - ${stats.V.attack.pts}/${stats.V.attack.total}</span></div>
  <div class="row"><span class="label">Mottagning pos%</span><span class="val">${pct(stats.H.reception.pos, stats.H.reception.total)} - ${pct(stats.V.reception.pos, stats.V.reception.total)}</span></div>
  <div class="row"><span class="label">Block</span><span class="val">${stats.H.block.pts} - ${stats.V.block.pts}</span></div>
</div>

<h2>Spelarstatistik</h2>
${buildPlayerTable(hPlayers, stats.H.name)}
${buildPlayerTable(vPlayers, stats.V.name)}
<div class="footer">Genererad av LVC Media Hub</div>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const currentSection = STAT_SECTIONS[statPage];
  const prevPage = () => setStatPage(p => (p - 1 + STAT_SECTIONS.length) % STAT_SECTIONS.length);
  const nextPage = () => setStatPage(p => (p + 1) % STAT_SECTIONS.length);

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem' }}>
      {/* Export-knapp */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button onClick={handleExport} style={{ padding: '4px 12px', background: '#334155', border: 'none', borderRadius: '6px', color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer' }}>
          Exportera / Skriv ut
        </button>
      </div>
      {/* Lagnamn */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: '600' }}>
        <span>{stats.H.name}</span>
        <span>{stats.V.name}</span>
      </div>

      {/* Navigerbar statistik-sektion */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem', marginBottom: '0.75rem' }}>
        {/* Navigation header — bara aktiv titel med pilar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: '0.4rem' }}>
          <button
            onClick={prevPage}
            style={{
              background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem',
              cursor: 'pointer', padding: '4px 10px', borderRadius: 4
            }}
          >
            ‹
          </button>
          <span style={{
            fontSize: '0.85rem', fontWeight: '700', color: '#f1f5f9',
            minWidth: 90, textAlign: 'center',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            {currentSection.label}
          </span>
          <button
            onClick={nextPage}
            style={{
              background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem',
              cursor: 'pointer', padding: '4px 10px', borderRadius: 4
            }}
          >
            ›
          </button>
        </div>

        {/* Section content */}
        <StatSection section={currentSection.key} stats={stats} />

        {/* Page indicator dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: '0.4rem' }}>
          {STAT_SECTIONS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === statPage ? 12 : 5, height: 5, borderRadius: 3,
                background: i === statPage ? '#3b82f6' : '#475569',
                transition: 'all 0.2s'
              }}
            />
          ))}
        </div>
      </div>

      {/* Hemmalag */}
      <TeamPlayerList
        players={hPlayers}
        team="H"
        teamName={stats.H.name}
        color="26,95,180"
        titleColor="var(--lvc-blue-light, #3584e4)"
        selectedPlayer={selectedPlayer}
        setSelectedPlayer={setSelectedPlayer}
        onJumpToActions={onJumpToActions}
        onShowHistory={handleShowHistory}
      />

      {/* Bortalag */}
      <TeamPlayerList
        players={vPlayers}
        team="V"
        teamName={stats.V.name}
        color="232,168,37"
        titleColor="var(--lvc-gold, #e8a825)"
        selectedPlayer={selectedPlayer}
        setSelectedPlayer={setSelectedPlayer}
        onJumpToActions={onJumpToActions}
        onShowHistory={handleShowHistory}
      />

    </div>
  );
}
