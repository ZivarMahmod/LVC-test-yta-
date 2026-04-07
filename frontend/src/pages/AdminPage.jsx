// ===========================================
// LVC Media Hub — Adminpanel
// Hantera användare, visa uppladdningshistorik
// ===========================================
import { useState } from 'react';
import AdminUsersTab from './admin/AdminUsersTab.jsx';
import AdminUploadsTab from './admin/AdminUploadsTab.jsx';
import AdminThumbsTab from './admin/AdminThumbsTab.jsx';
import AdminDeletedTab from './admin/AdminDeletedTab.jsx';
import AdminTeamsTab from './admin/AdminTeamsTab.jsx';
import AdminScoutTab from './admin/AdminScoutTab.jsx';
import AdminMusicTab from './admin/AdminMusicTab.jsx';
import AdminActivityTab from './admin/AdminActivityTab.jsx';
import './AdminPage.css';

const TABS = [
  { key: 'users', label: 'Användare' },
  { key: 'uploads', label: 'Uppladdningshistorik' },
  { key: 'teams', label: 'Lag & Säsonger' },
  { key: 'thumbnails', label: 'Thumbnails' },
  { key: 'deleted', label: 'Borttagna' },
  { key: 'scout', label: 'Scout' },
  { key: 'music', label: 'Musik' },
  { key: 'activity', label: 'Online' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('users');

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Administration</h1>
        <p>Hantera användare, uppladdningar och ändringslogg</p>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`admin-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <AdminUsersTab />}
      {tab === 'uploads' && <AdminUploadsTab />}
      {tab === 'teams' && <AdminTeamsTab />}
      {tab === 'thumbnails' && <AdminThumbsTab />}
      {tab === 'deleted' && <AdminDeletedTab />}
      {tab === 'scout' && <AdminScoutTab />}
      {tab === 'music' && <AdminMusicTab />}
      {tab === 'activity' && <AdminActivityTab />}
    </div>
  );
}
