// ===========================================
// Kvittra — Superadmin Panel
// Skapa organisationer, hantera features, se stats
// ===========================================
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './SuperAdminPage.css';

export default function SuperAdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('orgs');
  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [newOrg, setNewOrg] = useState({ name: '', slug: '' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Hämta data
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/teams', { credentials: 'include' }).then(r => r.ok ? r.json() : { teams: [] }),
      fetch('/api/admin/users', { credentials: 'include' }).then(r => r.ok ? r.json() : { users: [] }),
    ]).then(([teamsData, usersData]) => {
      setOrgs(teamsData.teams || teamsData || []);
      setUsers(usersData.users || usersData || []);
    }).finally(() => setLoading(false));
  }, []);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  if (user?.role !== 'admin') {
    return <div className="sa-denied">Åtkomst nekad</div>;
  }

  const tabs = [
    { id: 'orgs', label: 'Organisationer' },
    { id: 'users', label: 'Användare' },
    { id: 'features', label: 'Features' },
    { id: 'stats', label: 'Statistik' },
  ];

  return (
    <div className="sa-page">
      <div className="sa-header">
        <div className="sa-logo">
          <span className="sa-logo-icon">K</span>
          <div>
            <h1>Kvittra Superadmin</h1>
            <p>Systemöversikt och konfiguration</p>
          </div>
        </div>
      </div>

      {message && <div className="sa-message">{message}</div>}

      <div className="sa-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`sa-tab ${activeTab === t.id ? 'sa-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Organisationer */}
      {activeTab === 'orgs' && (
        <div className="sa-section">
          <h2>Organisationer / Lag</h2>
          <div className="sa-org-list">
            {orgs.length === 0 ? (
              <p className="sa-empty">Inga organisationer skapade ännu. Skapa via Admin → Lag & Säsonger.</p>
            ) : (
              orgs.map(org => (
                <div key={org.id} className="sa-org-card">
                  <div className="sa-org-info">
                    <span className="sa-org-name">{org.name}</span>
                    <span className="sa-org-meta">
                      {org._count?.videos || 0} matcher · {org._count?.seasons || 0} säsonger
                    </span>
                  </div>
                  <span className="sa-org-badge">Aktiv</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Användare */}
      {activeTab === 'users' && (
        <div className="sa-section">
          <h2>Alla användare</h2>
          <div className="sa-users-list">
            {users.map(u => (
              <div key={u.id} className="sa-user-row">
                <div className="sa-user-info">
                  <span className="sa-user-name">{u.name}</span>
                  <span className="sa-user-email">{u.email || u.username}</span>
                </div>
                <span className={`sa-role-badge sa-role-${u.role}`}>{u.role}</span>
                <span className={`sa-status ${u.isActive ? 'sa-status--active' : 'sa-status--inactive'}`}>
                  {u.isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {activeTab === 'features' && (
        <div className="sa-section">
          <h2>Feature Flags</h2>
          <p className="sa-desc">Aktivera/avaktivera features globalt eller per organisation.</p>
          <div className="sa-feature-list">
            {[
              { key: 'player_dashboard', label: 'Spelare Dashboard', desc: 'Individuell dashboard per spelare' },
              { key: 'heatmap', label: 'Heatmaps', desc: 'Zonanalys och precisionsheatmaps' },
              { key: 'player_comparison', label: 'Spelarjämförelse', desc: 'Jämför 2-4 spelare med radardiagram' },
              { key: 'pressure_stats', label: 'Pressningsstatistik', desc: 'Clutch, trailing, leading-analys' },
              { key: 'highlights', label: 'Höjdpunkter', desc: 'Highlights-reel på spelar-dashboard' },
              { key: 'stats_export', label: 'Dela statistik', desc: 'Exportera/dela spelarstatistik' },
              { key: 'public_matches', label: 'Publika matcher', desc: 'Publicera matcher för ej-inloggade' },
              { key: 'coach_review', label: 'Coach-feedback', desc: 'Coaches kan ge feedback på aktioner' },
              { key: 'multi_scout', label: 'Flermatchsanalys', desc: 'Analysera flera matcher samtidigt' },
            ].map(f => (
              <div key={f.key} className="sa-feature-row">
                <div className="sa-feature-info">
                  <span className="sa-feature-name">{f.label}</span>
                  <span className="sa-feature-desc">{f.desc}</span>
                </div>
                <span className="sa-feature-status sa-feature-status--on">Global ON</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistik */}
      {activeTab === 'stats' && (
        <div className="sa-section">
          <h2>Systemstatistik</h2>
          <div className="sa-stats-grid">
            <div className="sa-stat-card">
              <span className="sa-stat-value">{orgs.length}</span>
              <span className="sa-stat-label">Organisationer</span>
            </div>
            <div className="sa-stat-card">
              <span className="sa-stat-value">{users.length}</span>
              <span className="sa-stat-label">Användare</span>
            </div>
            <div className="sa-stat-card">
              <span className="sa-stat-value">{users.filter(u => u.isActive).length}</span>
              <span className="sa-stat-label">Aktiva</span>
            </div>
            <div className="sa-stat-card">
              <span className="sa-stat-value">{users.filter(u => u.role === 'admin').length}</span>
              <span className="sa-stat-label">Admins</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
