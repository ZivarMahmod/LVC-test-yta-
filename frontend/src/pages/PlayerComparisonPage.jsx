// ===========================================
// Kvittra — Player Comparison Page
// Side-by-side comparison of two players with
// radar chart (SVG) and season bar charts.
// ===========================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient.js';
import { useOrg } from '../context/OrgContext.jsx';
import './PlayerComparisonPage.css';

// ─── DVW grade helpers ───────────────────────
const POSITIVE_RESULTS = ['#', '+'];
const ERROR_RESULTS = ['/', '='];

// ─── RadarChart (reusable, pure SVG) ─────────
// Accepts two datasets (arrays of numbers 0-100),
// a labels array, and player names. Renders a
// hexagonal radar overlay comparing them.
function RadarChart({
  labels,
  dataA,
  dataB,
  nameA = 'Spelare A',
  nameB = 'Spelare B',
  size = 300,
}) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.36;
  const levels = 4;
  const count = labels.length;
  const angleStep = (2 * Math.PI) / count;

  // Get (x, y) for a given axis index and value 0–100
  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (Math.min(value, 100) / 100) * maxRadius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // Build polygon points string from values array
  const polygonPoints = (values) =>
    values
      .map((v, i) => {
        const p = getPoint(i, v);
        return `${p.x},${p.y}`;
      })
      .join(' ');

  // Grid rings
  const gridRings = Array.from({ length: levels }, (_, i) => {
    const frac = ((i + 1) / levels) * maxRadius;
    return Array.from({ length: count }, (__, j) => {
      const angle = angleStep * j - Math.PI / 2;
      return `${cx + frac * Math.cos(angle)},${cy + frac * Math.sin(angle)}`;
    }).join(' ');
  });

  // Label positions (pushed further out for readability)
  const labelPositions = labels.map((text, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const labelRadius = maxRadius + 24;
    return {
      x: cx + labelRadius * Math.cos(angle),
      y: cy + labelRadius * Math.sin(angle),
      text,
    };
  });

  return (
    <div className="pc-radar-wrapper">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="pc-radar-svg"
        role="img"
        aria-label="Radardiagram spelarjämförelse"
      >
        {/* Grid rings */}
        {gridRings.map((pts, i) => (
          <polygon
            key={`ring-${i}`}
            points={pts}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {Array.from({ length: count }, (_, i) => {
          const end = getPoint(i, 100);
          return (
            <line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          );
        })}

        {/* Player A polygon */}
        <polygon
          points={polygonPoints(dataA)}
          fill="rgba(26, 95, 180, 0.25)"
          stroke="var(--lvc-blue-light)"
          strokeWidth="2"
        />

        {/* Player B polygon */}
        <polygon
          points={polygonPoints(dataB)}
          fill="rgba(232, 168, 37, 0.2)"
          stroke="var(--lvc-gold)"
          strokeWidth="2"
        />

        {/* Data dots A */}
        {dataA.map((v, i) => {
          const p = getPoint(i, v);
          return (
            <circle
              key={`dA-${i}`}
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill="var(--lvc-blue-light)"
              stroke="var(--lvc-navy)"
              strokeWidth="1"
            />
          );
        })}

        {/* Data dots B */}
        {dataB.map((v, i) => {
          const p = getPoint(i, v);
          return (
            <circle
              key={`dB-${i}`}
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill="var(--lvc-gold)"
              stroke="var(--lvc-navy)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis labels */}
        {labelPositions.map((lp, i) => (
          <text
            key={`lbl-${i}`}
            x={lp.x}
            y={lp.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="var(--font-body)"
          >
            {lp.text}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="pc-radar-legend">
        <span className="pc-legend-item">
          <span className="pc-legend-dot pc-dot-a" />
          {nameA}
        </span>
        <span className="pc-legend-item">
          <span className="pc-legend-dot pc-dot-b" />
          {nameB}
        </span>
      </div>
    </div>
  );
}

// ─── Stat computation from raw actions ───────
function computeStats(actions) {
  const total = actions.length;

  const attacks = actions.filter((a) => a.action_type === 'A');
  const attackKills = attacks.filter((a) => a.result === '#').length;
  const attackErrors = attacks.filter((a) => ERROR_RESULTS.includes(a.result)).length;
  const attackEff = attacks.length > 0
    ? Math.round(((attackKills - attackErrors) / attacks.length) * 100)
    : 0;

  const recs = actions.filter((a) => a.action_type === 'R');
  const recPos = recs.filter((a) => POSITIVE_RESULTS.includes(a.result)).length;
  const recErr = recs.filter((a) => ERROR_RESULTS.includes(a.result)).length;
  const recAvg = recs.length > 0 ? Math.round((recPos / recs.length) * 100) : 0;

  const serves = actions.filter((a) => a.action_type === 'S');
  const serveAces = serves.filter((a) => a.result === '#').length;
  const serveErrors = serves.filter((a) => ERROR_RESULTS.includes(a.result)).length;
  const servePrec = serves.length > 0
    ? Math.round(((serves.length - serveErrors) / serves.length) * 100)
    : 0;

  const blocks = actions.filter((a) => a.action_type === 'B');
  const blockOk = blocks.filter((a) => POSITIVE_RESULTS.includes(a.result)).length;
  const blockRate = blocks.length > 0 ? Math.round((blockOk / blocks.length) * 100) : 0;

  const digs = actions.filter((a) => a.action_type === 'D');

  return {
    total,
    attackEff,
    attackKills,
    attackTotal: attacks.length,
    attackErrors,
    recAvg,
    recPos,
    recTotal: recs.length,
    recErr,
    servePrec,
    serveAces,
    serveTotal: serves.length,
    serveErrors,
    blockRate,
    blockOk,
    blockTotal: blocks.length,
    digCount: digs.length,
  };
}

// Normalize a count value against a max for radar display
function norm(value, max) {
  if (max <= 0) return 0;
  return Math.min(Math.round((value / max) * 100), 100);
}

// ─── CSS bar chart row ───────────────────────
function BarRow({ label, valueA, valueB, unit = '', maxVal }) {
  const ceiling = maxVal || Math.max(valueA, valueB, 1);
  const pctA = Math.max(4, Math.round((Math.abs(valueA) / ceiling) * 100));
  const pctB = Math.max(4, Math.round((Math.abs(valueB) / ceiling) * 100));

  return (
    <div className="pc-bar-row">
      <span className="pc-bar-val pc-val-a">{valueA}{unit}</span>
      <div className="pc-bar-track">
        <div className="pc-bar-fill pc-fill-a" style={{ width: `${pctA}%` }} />
        <span className="pc-bar-label">{label}</span>
        <div className="pc-bar-fill pc-fill-b" style={{ width: `${pctB}%` }} />
      </div>
      <span className="pc-bar-val pc-val-b">{valueB}{unit}</span>
    </div>
  );
}

// ─── Small stat card for split summary ───────
function StatMini({ label, value, sub }) {
  return (
    <div className="pc-stat-mini">
      <div className="pc-stat-mini-val">{value}</div>
      <div className="pc-stat-mini-lbl">{label}</div>
      {sub && <div className="pc-stat-mini-sub">{sub}</div>}
    </div>
  );
}

// ─── Main Page ───────────────────────────────
export default function PlayerComparisonPage() {
  const { orgId } = useOrg();

  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [playerAId, setPlayerAId] = useState('');
  const [playerBId, setPlayerBId] = useState('');
  const [actionsA, setActionsA] = useState(null);
  const [actionsB, setActionsB] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState(null);

  // Fetch player list for this org
  useEffect(() => {
    if (!orgId) return;

    setLoadingPlayers(true);
    supabase
      .schema('kvittra')
      .from('player_profiles')
      .select('id, display_name, jersey_number, position')
      .eq('org_id', orgId)
      .order('display_name', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) {
          setError('Kunde inte ladda spelare');
          console.error('player_profiles fetch:', err);
        } else {
          setPlayers(data || []);
        }
        setLoadingPlayers(false);
      });
  }, [orgId]);

  // Fetch actions for a player
  const fetchActions = useCallback(
    async (playerId) => {
      if (!playerId || !orgId) return [];
      const { data, error: err } = await supabase
        .schema('kvittra')
        .from('actions')
        .select('action_type, result')
        .eq('org_id', orgId)
        .eq('player_id', playerId);
      if (err) {
        console.error('actions fetch:', err);
        return [];
      }
      return data || [];
    },
    [orgId],
  );

  // Load both players' actions when selection changes
  useEffect(() => {
    if (!playerAId || !playerBId) {
      setActionsA(null);
      setActionsB(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadingStats(true);
      setError(null);
      try {
        const [a, b] = await Promise.all([
          fetchActions(playerAId),
          fetchActions(playerBId),
        ]);
        if (!cancelled) {
          setActionsA(a);
          setActionsB(b);
        }
      } catch {
        if (!cancelled) setError('Kunde inte ladda statistik');
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [playerAId, playerBId, fetchActions]);

  // Compute stats
  const statsA = useMemo(() => (actionsA ? computeStats(actionsA) : null), [actionsA]);
  const statsB = useMemo(() => (actionsB ? computeStats(actionsB) : null), [actionsB]);

  // Player info
  const infoA = players.find((p) => p.id === playerAId);
  const infoB = players.find((p) => p.id === playerBId);

  const label = (p) => {
    if (!p) return '';
    const num = p.jersey_number != null ? `#${p.jersey_number} ` : '';
    return `${num}${p.display_name || 'Okänd'}`;
  };

  // Radar data
  const radarLabels = ['Angrepp %', 'Mottagning %', 'Serve %', 'Block %', 'Försvar', 'Totalt'];

  const radarData = useMemo(() => {
    if (!statsA || !statsB) return { a: [0, 0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0, 0] };

    const maxDig = Math.max(statsA.digCount, statsB.digCount, 1);
    const maxTot = Math.max(statsA.total, statsB.total, 1);

    return {
      a: [
        Math.max(0, statsA.attackEff),
        statsA.recAvg,
        statsA.servePrec,
        statsA.blockRate,
        norm(statsA.digCount, maxDig),
        norm(statsA.total, maxTot),
      ],
      b: [
        Math.max(0, statsB.attackEff),
        statsB.recAvg,
        statsB.servePrec,
        statsB.blockRate,
        norm(statsB.digCount, maxDig),
        norm(statsB.total, maxTot),
      ],
    };
  }, [statsA, statsB]);

  const ready = statsA && statsB && infoA && infoB && !loadingStats;

  return (
    <div className="pc-page">
      <div className="page-header">
        <h1>Spelarjämförelse</h1>
        <p>Jämför två spelare sida vid sida</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Selectors ── */}
      <div className="pc-selectors">
        <div className="pc-sel-group">
          <label htmlFor="pc-sel-a">Spelare A</label>
          <select
            id="pc-sel-a"
            value={playerAId}
            onChange={(e) => setPlayerAId(e.target.value)}
            disabled={loadingPlayers}
          >
            <option value="">Välj spelare...</option>
            {players
              .filter((p) => p.id !== playerBId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}{p.position ? ` (${p.position})` : ''}
                </option>
              ))}
          </select>
        </div>

        <span className="pc-vs">vs</span>

        <div className="pc-sel-group">
          <label htmlFor="pc-sel-b">Spelare B</label>
          <select
            id="pc-sel-b"
            value={playerBId}
            onChange={(e) => setPlayerBId(e.target.value)}
            disabled={loadingPlayers}
          >
            <option value="">Välj spelare...</option>
            {players
              .filter((p) => p.id !== playerAId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}{p.position ? ` (${p.position})` : ''}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {(loadingPlayers || loadingStats) && (
        <div className="loading-container">
          <div className="spinner" />
        </div>
      )}

      {/* Empty state */}
      {!loadingPlayers && !loadingStats && !ready && (
        <div className="pc-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p>Välj två spelare ovan för att jämföra deras statistik</p>
        </div>
      )}

      {/* ── Comparison ── */}
      {ready && (
        <>
          {/* Player name headers */}
          <div className="pc-headers">
            <div className="pc-header pc-header-a">
              <div className="pc-header-name">{label(infoA)}</div>
              {infoA.position && <span className="pc-header-pos">{infoA.position}</span>}
              <div className="pc-header-count">{statsA.total} aktioner</div>
            </div>
            <div className="pc-header pc-header-b">
              <div className="pc-header-name">{label(infoB)}</div>
              {infoB.position && <span className="pc-header-pos">{infoB.position}</span>}
              <div className="pc-header-count">{statsB.total} aktioner</div>
            </div>
          </div>

          {/* Radar chart */}
          <div className="pc-section">
            <h2>Översikt</h2>
            <RadarChart
              labels={radarLabels}
              dataA={radarData.a}
              dataB={radarData.b}
              nameA={label(infoA)}
              nameB={label(infoB)}
            />
          </div>

          {/* Season bar comparison */}
          <div className="pc-section">
            <h2>Säsongsjämförelse</h2>
            <div className="pc-bars">
              <BarRow label="Angreppseffektivitet" valueA={statsA.attackEff} valueB={statsB.attackEff} unit="%" maxVal={100} />
              <BarRow label="Angrepp (kill)" valueA={statsA.attackKills} valueB={statsB.attackKills} />
              <BarRow label="Angrepp (totalt)" valueA={statsA.attackTotal} valueB={statsB.attackTotal} />
              <BarRow label="Mottagning (positiv)" valueA={statsA.recAvg} valueB={statsB.recAvg} unit="%" maxVal={100} />
              <BarRow label="Mottagningar (totalt)" valueA={statsA.recTotal} valueB={statsB.recTotal} />
              <BarRow label="Serveprecision" valueA={statsA.servePrec} valueB={statsB.servePrec} unit="%" maxVal={100} />
              <BarRow label="Serveess" valueA={statsA.serveAces} valueB={statsB.serveAces} />
              <BarRow label="Block (lyckade)" valueA={statsA.blockOk} valueB={statsB.blockOk} />
              <BarRow label="Blockfrekvens" valueA={statsA.blockRate} valueB={statsB.blockRate} unit="%" maxVal={100} />
              <BarRow label="Försvar (antal)" valueA={statsA.digCount} valueB={statsB.digCount} />
              <BarRow label="Totalt aktioner" valueA={statsA.total} valueB={statsB.total} />
            </div>
          </div>

          {/* Split summary cards */}
          <div className="pc-section">
            <h2>Sammanfattning</h2>
            <div className="pc-split">
              <div className="pc-split-col">
                <h3 className="pc-split-name pc-color-a">{label(infoA)}</h3>
                <div className="pc-stat-grid">
                  <StatMini label="Angrepp" value={`${statsA.attackKills}/${statsA.attackTotal}`} sub={`${statsA.attackEff}% eff.`} />
                  <StatMini label="Mottagning" value={`${statsA.recPos}/${statsA.recTotal}`} sub={`${statsA.recAvg}% pos.`} />
                  <StatMini label="Serve" value={`${statsA.serveAces} ess`} sub={`${statsA.servePrec}% prec.`} />
                  <StatMini label="Block" value={`${statsA.blockOk}/${statsA.blockTotal}`} sub={`${statsA.blockRate}%`} />
                  <StatMini label="Försvar" value={statsA.digCount} sub="aktioner" />
                  <StatMini label="Totalt" value={statsA.total} sub="aktioner" />
                </div>
              </div>

              <div className="pc-split-divider" />

              <div className="pc-split-col">
                <h3 className="pc-split-name pc-color-b">{label(infoB)}</h3>
                <div className="pc-stat-grid">
                  <StatMini label="Angrepp" value={`${statsB.attackKills}/${statsB.attackTotal}`} sub={`${statsB.attackEff}% eff.`} />
                  <StatMini label="Mottagning" value={`${statsB.recPos}/${statsB.recTotal}`} sub={`${statsB.recAvg}% pos.`} />
                  <StatMini label="Serve" value={`${statsB.serveAces} ess`} sub={`${statsB.servePrec}% prec.`} />
                  <StatMini label="Block" value={`${statsB.blockOk}/${statsB.blockTotal}`} sub={`${statsB.blockRate}%`} />
                  <StatMini label="Försvar" value={statsB.digCount} sub="aktioner" />
                  <StatMini label="Totalt" value={statsB.total} sub="aktioner" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
