// ===========================================
// LVC Media Hub — MatchReport
// Rapport-vy med lagstatistik och spelardetaljer
// ===========================================
import React, { useState } from 'react';

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

function PlayerStatsCard({ player, team, teamName, color, onJumpToActions }) {
  return (
    <div style={{ background: `rgba(${color}, 0.08)`, borderRadius: '6px', padding: '0.4rem', marginBottom: '0.3rem' }}>
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

function TeamPlayerList({ players, team, teamName, color, titleColor, selectedPlayer, setSelectedPlayer, onJumpToActions }) {
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
            <PlayerStatsCard player={selectedPlayer} team={team} teamName={teamName} color={color} onJumpToActions={onJumpToActions} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function MatchReport({ stats, onJumpToActions }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  if (!stats) return <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Ingen data</div>;

  const hPlayers = Object.values(stats.H.players).sort((a, b) => b.pts - a.pts);
  const vPlayers = Object.values(stats.V.players).sort((a, b) => b.pts - a.pts);

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem' }}>
      {/* Lagnamn */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: '600' }}>
        <span>{stats.H.name}</span>
        <span>{stats.V.name}</span>
      </div>

      {/* Nyckeltal */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Poäng</div>
        <StatBar label="Totalt" home={stats.H.totalPts} away={stats.V.totalPts} />
        <StatBar label="Serve ace" home={stats.H.serve.pts} away={stats.V.serve.pts} />
        <StatBar label="Attack" home={stats.H.attack.pts} away={stats.V.attack.pts} />
        <StatBar label="Block" home={stats.H.block.pts} away={stats.V.block.pts} />

        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Serve</div>
        <StatBar label="Totalt" home={stats.H.serve.total} away={stats.V.serve.total} />
        <StatBar label="Aces" home={stats.H.serve.pts} away={stats.V.serve.pts} />
        <StatBar label="Errors" home={stats.H.serve.err} away={stats.V.serve.err} higherIsBetter={false} />
        <StatBar label="Miss %" home={pct(stats.H.serve.err, stats.H.serve.total)} away={pct(stats.V.serve.err, stats.V.serve.total)} higherIsBetter={false} />
        <StatBar label="Ace %" home={pct(stats.H.serve.pts, stats.H.serve.total)} away={pct(stats.V.serve.pts, stats.V.serve.total)} />

        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anfall</div>
        <StatBar label="Totalt" home={stats.H.attack.total} away={stats.V.attack.total} />
        <StatBar label="Kill" home={stats.H.attack.pts} away={stats.V.attack.pts} />
        <StatBar label="Kill %" home={pct(stats.H.attack.pts, stats.H.attack.total)} away={pct(stats.V.attack.pts, stats.V.attack.total)} />
        <StatBar label="Errors" home={stats.H.attack.err} away={stats.V.attack.err} higherIsBetter={false} />
        <StatBar label="Blocked" home={stats.H.attack.blocked} away={stats.V.attack.blocked} higherIsBetter={false} />

        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mottagning</div>
        <StatBar label="Totalt" home={stats.H.reception.total} away={stats.V.reception.total} />
        <StatBar label="Positiv %" home={pct(stats.H.reception.pos, stats.H.reception.total)} away={pct(stats.V.reception.pos, stats.V.reception.total)} />
        <StatBar label="Excellent %" home={pct(stats.H.reception.exc, stats.H.reception.total)} away={pct(stats.V.reception.exc, stats.V.reception.total)} />
        <StatBar label="Errors" home={stats.H.reception.err} away={stats.V.reception.err} higherIsBetter={false} />

        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Försvar</div>
        <StatBar label="Totalt" home={stats.H.dig.total} away={stats.V.dig.total} />
        <StatBar label="Positiv %" home={pct(stats.H.dig.pos, stats.H.dig.total)} away={pct(stats.V.dig.pos, stats.V.dig.total)} />
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
      />
    </div>
  );
}
