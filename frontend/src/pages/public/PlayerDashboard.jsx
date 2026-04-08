// ===========================================
// LVC Media Hub — Spelar-Dashboard (Kvikta)
// Visar en spelares profil och statistik inom sin organisation
// ===========================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabaseKvittra } from '../../utils/supabaseClient.js';
import './PlayerDashboard.css';

// ── Helpers ──────────────────────────────────────────

const RESULT_LABELS = {
  '#': 'Perfekt',
  '+': 'Positiv',
  '!': 'OK',
  '-': 'Negativ',
  '/': 'Fel',
};

const ACTION_LABELS = {
  S: 'Serve',
  R: 'Mottagning',
  P: 'Passning',
  A: 'Anfall',
  D: 'Försvar',
  B: 'Block',
  G: 'Upplägg',
};

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

function formatTimestamp(sec) {
  if (sec == null) return '–';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getMonthLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' });
}

// ── Animated count-up hook ───────────────────────────

function useCountUp(target, duration = 1000) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null || target === 0) {
      setValue(0);
      return;
    }

    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

// ── Sub-components ───────────────────────────────────

function StatCard({ label, value, suffix = '', color }) {
  const displayed = useCountUp(value);
  return (
    <div className="pd-stat-card">
      <div className="pd-stat-value" style={color ? { color } : undefined}>
        {displayed}{suffix}
      </div>
      <div className="pd-stat-label">{label}</div>
    </div>
  );
}

function SeasonChart({ actions }) {
  // Group actions by month
  const monthCounts = {};
  actions.forEach((a) => {
    // Use match created_at or fall back to action id ordering
    // We derive month from match_id context; since we only have actions,
    // we group by created_at if available, otherwise skip
    const key = a.month_key;
    if (key) {
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    }
  });

  const entries = Object.entries(monthCounts).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return <p className="pd-empty-text">Ingen säsongsdata att visa.</p>;
  }

  const max = Math.max(...entries.map(([, v]) => v));

  return (
    <div className="pd-chart">
      <div className="pd-chart-bars">
        {entries.map(([month, count]) => (
          <div key={month} className="pd-chart-col">
            <span className="pd-chart-count">{count}</span>
            <div
              className="pd-chart-bar"
              style={{ height: `${max > 0 ? (count / max) * 100 : 0}%` }}
            />
            <span className="pd-chart-label">{month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentActionsTable({ actions }) {
  if (actions.length === 0) {
    return <p className="pd-empty-text">Inga aktioner att visa.</p>;
  }

  return (
    <div className="pd-table-wrap">
      <table className="pd-table">
        <thead>
          <tr>
            <th>Typ</th>
            <th>Resultat</th>
            <th>Set</th>
            <th>Tid</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.id}>
              <td>{ACTION_LABELS[a.action_type] || a.action_type}</td>
              <td>
                <span className={`pd-result pd-result-${resultClass(a.result)}`}>
                  {RESULT_LABELS[a.result] || a.result}
                </span>
              </td>
              <td>{a.set_number ?? '–'}</td>
              <td>{formatTimestamp(a.timestamp_sec)}</td>
              <td>
                {a.match_id && (
                  <Link to={`/match/${a.match_id}`} className="pd-video-link">
                    Se video
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function resultClass(result) {
  switch (result) {
    case '#': return 'perfect';
    case '+': return 'positive';
    case '!': return 'ok';
    case '-': return 'negative';
    case '/': return 'error';
    default: return 'unknown';
  }
}

// ── Main component ───────────────────────────────────

export default function PlayerDashboard() {
  const { playerId } = useParams();
  const [player, setPlayer] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch player profile
      const { data: profileData, error: profileErr } = await supabaseKvittra
        .from('player_profiles')
        .select('*')
        .eq('id', playerId)
        .single();

      if (profileErr) throw profileErr;
      if (!profileData) throw new Error('Spelaren hittades inte.');

      setPlayer(profileData);

      // Fetch all actions for this player
      const { data: actionsData, error: actionsErr } = await supabaseKvittra
        .from('actions')
        .select('*')
        .eq('player_id', playerId)
        .order('id', { ascending: false });

      if (actionsErr) throw actionsErr;
      setActions(actionsData || []);
    } catch (err) {
      console.error('PlayerDashboard fetch error:', err);
      setError(err.message || 'Kunde inte ladda spelardata.');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    if (playerId) fetchData();
  }, [playerId, fetchData]);

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="pd-loading">
        <div className="spinner" />
        <p>Laddar spelardata...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pd-error">
        <h2>Något gick fel</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="pd-error">
        <h2>Spelaren hittades inte</h2>
        <p>Kontrollera länken och försök igen.</p>
      </div>
    );
  }

  // ── Compute stats ──
  const totalActions = actions.length;
  const attacks = actions.filter((a) => a.action_type === 'A');
  const kills = attacks.filter((a) => a.result === '#').length;
  const killPct = pct(kills, attacks.length);

  const positiveResults = actions.filter((a) => a.result === '#' || a.result === '+').length;
  const positivePct = pct(positiveResults, totalActions);

  const errors = actions.filter((a) => a.result === '/').length;
  const errorRate = pct(errors, totalActions);

  // Recent 5 actions
  const recent5 = actions.slice(0, 5);

  // Season data: group by month using action id-based ordering
  // We derive approximate months from match_id grouping
  // Since actions don't have a direct date, we build month keys from created_at if available
  const actionsWithMonth = actions.map((a) => ({
    ...a,
    month_key: a.created_at ? getMonthLabel(a.created_at) : null,
  }));

  return (
    <div className="pd-container">
      {/* ── Hero Section ── */}
      <section className="pd-hero">
        <div className="pd-hero-photo-wrap">
          {player.photo_url ? (
            <img
              src={player.photo_url}
              alt={player.display_name}
              className="pd-hero-photo"
            />
          ) : (
            <div className="pd-hero-photo-placeholder">
              <span>{player.display_name?.charAt(0) || '?'}</span>
            </div>
          )}
        </div>
        <div className="pd-hero-info">
          <h1 className="pd-hero-name">{player.display_name}</h1>
          <div className="pd-hero-meta">
            {player.jersey_number != null && (
              <span className="pd-hero-jersey">#{player.jersey_number}</span>
            )}
            {player.position && (
              <span className="pd-hero-position">{player.position}</span>
            )}
          </div>
          {player.bio && <p className="pd-hero-bio">{player.bio}</p>}
        </div>
      </section>

      {/* ── Stats Cards ── */}
      <section className="pd-section">
        <h2 className="pd-section-title">Statistik</h2>
        <div className="pd-stats-grid">
          <StatCard
            label="Totalt aktioner"
            value={totalActions}
            color="var(--lvc-blue-light)"
          />
          <StatCard
            label="Kill %"
            value={killPct}
            suffix="%"
            color="var(--lvc-gold)"
          />
          <StatCard
            label="Positiv %"
            value={positivePct}
            suffix="%"
            color="#4ade80"
          />
          <StatCard
            label="Felfrekvens"
            value={errorRate}
            suffix="%"
            color="#f87171"
          />
        </div>
      </section>

      {/* ── Season Chart ── */}
      <section className="pd-section">
        <h2 className="pd-section-title">Säsongsöversikt</h2>
        <div className="pd-card">
          <SeasonChart actions={actionsWithMonth} />
        </div>
      </section>

      {/* ── Radar Chart Placeholder ── */}
      <section className="pd-section">
        <h2 className="pd-section-title">Kompetensöversikt</h2>
        <div className="pd-card pd-radar-placeholder">
          <div className="pd-radar-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <line x1="12" y1="22" x2="12" y2="15.5" />
              <line x1="22" y1="8.5" x2="15.5" y2="12" />
              <line x1="2" y1="8.5" x2="8.5" y2="12" />
            </svg>
          </div>
          <p>Radarchart kommer snart</p>
        </div>
      </section>

      {/* ── Recent Actions ── */}
      <section className="pd-section">
        <h2 className="pd-section-title">Senaste aktioner</h2>
        <div className="pd-card">
          <RecentActionsTable actions={recent5} />
        </div>
      </section>
    </div>
  );
}
