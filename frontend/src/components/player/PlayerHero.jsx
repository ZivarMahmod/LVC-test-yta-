// ===========================================
// Kvittra — Player Hero Section
// Profilbild, namn, nummer, animerade stats-kort
// ===========================================
import { useState, useEffect, useRef } from 'react';
import './PlayerHero.css';

// Animerad räknare
function AnimatedNumber({ value, duration = 1200, suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const target = typeof value === 'number' ? value : parseFloat(value) || 0;
    const start = 0;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      setDisplay(current);
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };

    ref.current = requestAnimationFrame(animate);
    return () => ref.current && cancelAnimationFrame(ref.current);
  }, [value, duration]);

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display)}{suffix}</>;
}

// Stats-kort med animation
function HeroStatCard({ label, value, suffix, color, delay = 0, decimals = 0 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className={`ph-stat ${visible ? 'ph-stat--visible' : ''}`}>
      <div className="ph-stat-value" style={{ color }}>
        {visible ? <AnimatedNumber value={value} suffix={suffix} decimals={decimals} /> : '—'}
      </div>
      <div className="ph-stat-label">{label}</div>
    </div>
  );
}

export default function PlayerHero({ player, totals, matchCount }) {
  if (!player || !totals) return null;

  const killPct = totals.attack.total > 0 ? Math.round((totals.attack.pts / totals.attack.total) * 100) : 0;
  const recPct = totals.reception.total > 0 ? Math.round((totals.reception.pos / totals.reception.total) * 100) : 0;
  const ptsPerMatch = matchCount > 0 ? Math.round((totals.totalPts / matchCount) * 10) / 10 : 0;

  return (
    <div className="ph-container">
      {/* Bakgrund med gradient */}
      <div className="ph-bg" />

      <div className="ph-content">
        {/* Profilbild / initialer */}
        <div className="ph-avatar">
          {player.photoUrl ? (
            <img src={player.photoUrl} alt={player.name} />
          ) : (
            <span className="ph-initials">
              {(player.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Namn och info */}
        <div className="ph-info">
          <div className="ph-number">#{player.jerseyNumber || '—'}</div>
          <h1 className="ph-name">{player.name}</h1>
          <div className="ph-meta">
            {player.position && <span className="ph-position">{player.position}</span>}
            <span>{matchCount} matcher denna säsong</span>
          </div>
        </div>
      </div>

      {/* Animerade stats */}
      <div className="ph-stats">
        <HeroStatCard label="Poäng/match" value={ptsPerMatch} color="#22c55e" delay={100} decimals={1} />
        <HeroStatCard label="Kill%" value={killPct} suffix="%" color="#ef4444" delay={250} />
        <HeroStatCard label="Mottagning+" value={recPct} suffix="%" color="#3b82f6" delay={400} />
        <HeroStatCard label="Ess" value={totals.serve.pts} color="#f59e0b" delay={550} />
        <HeroStatCard label="Block" value={totals.block.pts} color="#8b5cf6" delay={700} />
        <HeroStatCard label="Aktioner" value={totals.totalPts + (totals.attack.err || 0) + (totals.serve.err || 0)} color="#64748b" delay={850} />
      </div>
    </div>
  );
}
