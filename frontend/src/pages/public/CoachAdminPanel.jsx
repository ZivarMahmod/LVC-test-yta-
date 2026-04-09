import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabaseKvittra } from '../../utils/supabaseClient.js';
import { useOrg } from '../../context/OrgContext.jsx';
import './CoachAdminPanel.css';

/* ─── Tab: Videobibliotek ─── */
function VideoLibraryTab({ orgId }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabaseKvittra
          .from('matches')
          .select('id, title, match_date, visibility, match_type, teams(name), videos(id, storage_url, duration_sec)')
          .eq('org_id', orgId)
          .order('match_date', { ascending: false });
        if (error) throw error;
        if (!cancelled) setMatches(data || []);
      } catch (err) {
        console.error('Failed to load matches:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  if (loading) return <div className="cap-loading"><div className="spinner" /></div>;

  if (matches.length === 0) {
    return <p className="cap-empty">Inga matcher hittades för denna organisation.</p>;
  }

  return (
    <div className="cap-video-library">
      <table className="cap-table">
        <thead>
          <tr>
            <th>Titel</th>
            <th>Datum</th>
            <th>Lag</th>
            <th>Synlighet</th>
            <th>Videor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {matches.map(m => (
            <tr key={m.id}>
              <td className="cap-cell-title">{m.title || '—'}</td>
              <td>
                {m.match_date
                  ? new Date(m.match_date).toLocaleDateString('sv-SE')
                  : '—'}
              </td>
              <td>{m.teams?.name || '—'}</td>
              <td>
                <span className={`cap-badge cap-badge--${m.visibility}`}>
                  {m.visibility === 'public' ? 'Publik' : 'Intern'}
                </span>
              </td>
              <td>{m.videos?.length || 0}</td>
              <td>
                <Link to={`match/${m.id}`} className="cap-link-btn">Visa</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Tab: Spelarjämförelse ─── */
function PlayerComparisonTab({ orgId }) {
  const [players, setPlayers] = useState([]);
  const [playerA, setPlayerA] = useState('');
  const [playerB, setPlayerB] = useState('');
  const [statsA, setStatsA] = useState(null);
  const [statsB, setStatsB] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabaseKvittra
          .from('player_profiles')
          .select('id, display_name, jersey_number, position')
          .eq('org_id', orgId)
          .order('display_name');
        if (error) throw error;
        if (!cancelled) setPlayers(data || []);
      } catch (err) {
        console.error('Failed to load players:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  const computeStats = useCallback(async (playerId) => {
    if (!playerId) return null;
    const { data, error } = await supabaseKvittra
      .from('actions')
      .select('action_type, result')
      .eq('player_id', playerId);
    if (error) { console.error(error); return null; }

    const actions = data || [];
    const total = actions.length;
    if (total === 0) return { total: 0, killPct: 0, positivePct: 0, errorRate: 0 };

    const kills = actions.filter(a => a.result === '#').length;
    const positive = actions.filter(a => ['#', '+'].includes(a.result)).length;
    const errors = actions.filter(a => ['/', '='].includes(a.result)).length;

    return {
      total,
      killPct: ((kills / total) * 100).toFixed(1),
      positivePct: ((positive / total) * 100).toFixed(1),
      errorRate: ((errors / total) * 100).toFixed(1),
    };
  }, []);

  useEffect(() => {
    if (playerA) computeStats(playerA).then(setStatsA);
    else setStatsA(null);
  }, [playerA, computeStats]);

  useEffect(() => {
    if (playerB) computeStats(playerB).then(setStatsB);
    else setStatsB(null);
  }, [playerB, computeStats]);

  if (loading) return <div className="cap-loading"><div className="spinner" /></div>;

  const playerLabel = (p) => `#${p.jersey_number} ${p.display_name}`;

  return (
    <div className="cap-comparison">
      <div className="cap-comparison-selectors">
        <select value={playerA} onChange={e => setPlayerA(e.target.value)}>
          <option value="">Välj spelare A</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>{playerLabel(p)}</option>
          ))}
        </select>
        <span className="cap-vs">vs</span>
        <select value={playerB} onChange={e => setPlayerB(e.target.value)}>
          <option value="">Välj spelare B</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>{playerLabel(p)}</option>
          ))}
        </select>
      </div>

      {(statsA || statsB) && (
        <div className="cap-comparison-grid">
          <StatColumn
            label={playerA ? playerLabel(players.find(p => p.id === playerA)) : '—'}
            stats={statsA}
          />
          <div className="cap-comparison-labels">
            <span className="cap-stat-label-header">Statistik</span>
            <span>Totalt antal aktioner</span>
            <span>Kill %</span>
            <span>Positiv %</span>
            <span>Error %</span>
          </div>
          <StatColumn
            label={playerB ? playerLabel(players.find(p => p.id === playerB)) : '—'}
            stats={statsB}
          />
        </div>
      )}
    </div>
  );
}

function StatColumn({ label, stats }) {
  return (
    <div className="cap-stat-col">
      <span className="cap-stat-player-name">{label}</span>
      {stats ? (
        <>
          <span className="cap-stat-value">{stats.total}</span>
          <span className="cap-stat-value">{stats.killPct}%</span>
          <span className="cap-stat-value">{stats.positivePct}%</span>
          <span className="cap-stat-value">{stats.errorRate}%</span>
        </>
      ) : (
        <>
          <span className="cap-stat-value cap-stat-empty">—</span>
          <span className="cap-stat-value cap-stat-empty">—</span>
          <span className="cap-stat-value cap-stat-empty">—</span>
          <span className="cap-stat-value cap-stat-empty">—</span>
        </>
      )}
    </div>
  );
}

/* ─── Tab: Publicering ─── */
function PublishingTab({ orgId }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabaseKvittra
          .from('matches')
          .select('id, title, match_date, visibility')
          .eq('org_id', orgId)
          .order('match_date', { ascending: false });
        if (error) throw error;
        if (!cancelled) setMatches(data || []);
      } catch (err) {
        console.error('Failed to load matches:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  async function toggleVisibility(matchId, currentVisibility) {
    const newVal = currentVisibility === 'public' ? 'internal' : 'public';
    setToggling(matchId);
    try {
      const { error } = await supabaseKvittra
        .from('matches')
        .update({ visibility: newVal })
        .eq('id', matchId);
      if (error) throw error;
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, visibility: newVal } : m
      ));
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <div className="cap-loading"><div className="spinner" /></div>;

  if (matches.length === 0) {
    return <p className="cap-empty">Inga matcher att publicera.</p>;
  }

  return (
    <div className="cap-publishing">
      <table className="cap-table">
        <thead>
          <tr>
            <th>Titel</th>
            <th>Datum</th>
            <th>Status</th>
            <th>Åtgärd</th>
          </tr>
        </thead>
        <tbody>
          {matches.map(m => (
            <tr key={m.id}>
              <td className="cap-cell-title">{m.title || '—'}</td>
              <td>
                {m.match_date
                  ? new Date(m.match_date).toLocaleDateString('sv-SE')
                  : '—'}
              </td>
              <td>
                <span className={`cap-badge cap-badge--${m.visibility}`}>
                  {m.visibility === 'public' ? 'Publik' : 'Intern'}
                </span>
              </td>
              <td>
                <button
                  className="cap-toggle-btn"
                  disabled={toggling === m.id}
                  onClick={() => toggleVisibility(m.id, m.visibility)}
                >
                  {toggling === m.id
                    ? 'Sparar...'
                    : m.visibility === 'public'
                      ? 'Gör intern'
                      : 'Publicera'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Tab: Användare (admin only) ─── */
function UsersTab({ orgId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabaseKvittra
          .from('organization_members')
          .select('id, user_id, email, roles, is_active')
          .eq('org_id', orgId)
          .order('email');
        if (error) throw error;
        if (!cancelled) setMembers(data || []);
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  async function toggleActive(memberId, currentActive) {
    setToggling(memberId);
    try {
      const { error } = await supabaseKvittra
        .from('organization_members')
        .update({ is_active: !currentActive })
        .eq('id', memberId);
      if (error) throw error;
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, is_active: !currentActive } : m
      ));
    } catch (err) {
      console.error('Failed to toggle member status:', err);
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <div className="cap-loading"><div className="spinner" /></div>;

  if (members.length === 0) {
    return <p className="cap-empty">Inga medlemmar hittades.</p>;
  }

  return (
    <div className="cap-users">
      <table className="cap-table">
        <thead>
          <tr>
            <th>E-post</th>
            <th>Roller</th>
            <th>Status</th>
            <th>Åtgärd</th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id} className={!m.is_active ? 'cap-row-inactive' : ''}>
              <td>{m.email || '—'}</td>
              <td>
                <div className="cap-roles">
                  {(m.roles || []).map(role => (
                    <span key={role} className="cap-role-chip">{role}</span>
                  ))}
                </div>
              </td>
              <td>
                <span className={`cap-badge cap-badge--${m.is_active ? 'active' : 'inactive'}`}>
                  {m.is_active ? 'Aktiv' : 'Inaktiv'}
                </span>
              </td>
              <td>
                <button
                  className="cap-toggle-btn"
                  disabled={toggling === m.id}
                  onClick={() => toggleActive(m.id, m.is_active)}
                >
                  {toggling === m.id
                    ? 'Sparar...'
                    : m.is_active ? 'Inaktivera' : 'Aktivera'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main Panel ─── */
const TABS = [
  { key: 'videos', label: 'Videobibliotek' },
  { key: 'comparison', label: 'Spelarjämförelse' },
  { key: 'publishing', label: 'Publicering' },
  { key: 'users', label: 'Användare', adminOnly: true },
];

export default function CoachAdminPanel() {
  const { org } = useOrg();
  const [activeTab, setActiveTab] = useState('videos');
  const [member, setMember] = useState(null);

  // Fetch current user's membership to determine role
  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    async function loadMember() {
      try {
        const { data: { user } } = await supabaseKvittra.auth.getUser();
        if (!user || cancelled) return;
        const { data, error } = await supabaseKvittra
          .from('organization_members')
          .select('id, roles, is_active')
          .eq('org_id', org.id)
          .eq('user_id', user.id)
          .single();
        if (error) throw error;
        if (!cancelled) setMember(data);
      } catch (err) {
        console.error('Failed to load membership:', err);
      }
    }
    loadMember();
    return () => { cancelled = true; };
  }, [org?.id]);

  const isAdmin = member?.roles?.includes('admin');

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  if (!org) {
    return (
      <div className="cap-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="coach-admin-panel">
      <h1 className="cap-heading">Coach &amp; Admin</h1>

      <nav className="panel-tabs">
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            className={`panel-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="cap-tab-content">
        {activeTab === 'videos' && <VideoLibraryTab orgId={org.id} />}
        {activeTab === 'comparison' && <PlayerComparisonTab orgId={org.id} />}
        {activeTab === 'publishing' && <PublishingTab orgId={org.id} />}
        {activeTab === 'users' && isAdmin && <UsersTab orgId={org.id} />}
      </div>
    </div>
  );
}
