// ===========================================
// LVC Media Hub — Adminpanel
// Hantera användare, visa uppladdningshistorik
// ===========================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi, videoApi } from '../utils/api.js';
import { teamApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { inviteApi } from '../utils/api.js';
import './AdminPage.css';

const ROLE_LABELS = {
  coach: 'Coach', admin: 'Admin', uploader: 'Uppladdare', viewer: 'Tittare' };

function UserModal({ user, onClose, onSave, teams = [], onAddTeam, onRemoveTeam }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email || '',
    name: user?.name || '',
    password: '',
    role: user?.role || 'viewer',
    isActive: user?.isActive ?? true,
    jerseyNumber: user?.jerseyNumber || ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const data = { ...form };
      if (isEdit && !data.password) delete data.password;
      if (!isEdit && !data.password) {
        setError('Lösenord krävs.');
        setSaving(false);
        return;
      }
      await onSave(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      await adminApi.createTeam(newTeamName.trim());
      setNewTeamName('');
      setTeamMsg('Laget skapades!');
      await fetchTeamsAdmin();
      setTimeout(() => setTeamMsg(''), 3000);
    } catch (err) {
      setTeamMsg(err.message);
    }
  };

  const handleDeleteTeam = async (id, name) => {
    if (!confirm(`Ta bort "${name}"? Alla säsonger för laget tas också bort.`)) return;
    try {
      await adminApi.deleteTeam(id);
      await fetchTeamsAdmin();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateSeason = async () => {
    if (!newSeasonName.trim() || !newSeasonTeamId) return;
    try {
      await adminApi.createSeason(newSeasonName.trim(), parseInt(newSeasonTeamId));
      setNewSeasonName('');
      setTeamMsg('Säsongen skapades!');
      await fetchTeamsAdmin();
      setTimeout(() => setTeamMsg(''), 3000);
    } catch (err) {
      setTeamMsg(err.message);
    }
  };

  const handleDeleteSeason = async (id, name) => {
    if (!confirm(`Ta bort säsongen "${name}"?`)) return;
    try {
      await adminApi.deleteSeason(id);
      await fetchTeamsAdmin();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssignVideo = async (videoId) => {
    try {
      const tId = assignTeamId[videoId] || null;
      const sId = assignSeasonId[videoId] || null;
      const result = await adminApi.assignVideo(videoId, tId ? parseInt(tId) : null, sId ? parseInt(sId) : null);
      
      // Uppdatera allVideos lokalt direkt
      setAllVideos(prev => prev.map(v => {
        if (v.id !== videoId) return v;
        const team = tId ? teams.find(t => String(t.id) === String(tId)) : null;
        const season = sId ? teams.flatMap(t => t.seasons || []).find(s => String(s.id) === String(sId)) : null;
        return { ...v, team: team || null, season: season || null };
      }));

      setTeamMsg('Videon tilldelades!');
      await fetchTeamsAdmin();
      setTimeout(() => setTeamMsg(''), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>{isEdit ? 'Redigera användare' : 'Skapa ny användare'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Namn</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Förnamn Efternamn"
              required
              minLength={2}
            />
          </div>
          <div className="form-group">
            <label>E-post</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="namn@email.se"
              required
            />
          </div>
          <div className="form-group">
            <label>{isEdit ? 'Nytt lösenord (lämna tomt för att behålla)' : 'Lösenord'}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? '••••••••' : 'Minst 8 tecken'}
              minLength={isEdit ? 0 : 8}
              required={!isEdit}
            />
          </div>
          <div className="form-group">
            <label>Roll</label>
            <select
              value={form.role}
              onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
            >
              <option value="viewer">Tittare</option>
              <option value="uploader">Uppladdare</option>
              <option value="coach">Coach</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label>Tröjnummer (valfritt)</label>
            <input
              type="number"
              min="1"
              max="99"
              value={form.jerseyNumber}
              onChange={(e) => setForm(f => ({ ...f, jerseyNumber: e.target.value }))}
              placeholder="t.ex. 6"
            />
          </div>
          {isEdit && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                <span>Konto aktivt</span>
              </label>
            </div>
          )}
          {isEdit && onAddTeam && (
            <div className="form-group">
              <label>Lag</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                {(user.teams || []).map(ut => (
                  <span key={ut.team.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    background: 'var(--accent-subtle, rgba(99,102,241,0.15))',
                    border: '1px solid var(--accent)', borderRadius: 6,
                    padding: '2px 8px', fontSize: '0.82rem'
                  }}>
                    {ut.team.name}
                    <button
                      type="button"
                      onClick={() => onRemoveTeam(user.id, ut.team.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem', padding: 0 }}
                    >×</button>
                  </span>
                ))}
                {(user.teams || []).length === 0 && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Inget lag kopplat</span>
                )}
              </div>
              <select
                onChange={e => { if (e.target.value) { onAddTeam(user.id, e.target.value); e.target.value = ''; } }}
                defaultValue=""
                style={{ fontSize: '0.85rem' }}
              >
                <option value="" disabled>+ Lägg till lag...</option>
                {teams
                  .filter(t => !(user.teams || []).find(ut => ut.team.id === t.id))
                  .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                }
              </select>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Avbryt</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Sparar...' : isEdit ? 'Spara ändringar' : 'Skapa användare'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('users');

  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('Kopierad!')).catch(() => {
        prompt('Kopiera länken:', text);
      });
    } else {
      prompt('Kopiera länken:', text);
    }
  };

  const fetchInvites = async () => {
    try {
      const data = await inviteApi.list();
      setInvites(data.invites || []);
    } catch {}
  };

  const handleCreateInvite = async (role) => {
    try {
      const data = await inviteApi.create(role, inviteMaxUses);
      if (data.invite) {
        const url = window.location.origin + '/register/' + data.invite.token;
        setInviteUrl(url);
        fetchInvites();
      }
    } catch {}
  };

  const handleDeleteInvite = async (id) => {
    try {
      await inviteApi.remove(id);
      fetchInvites();
    } catch {}
  };
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteUrl, setInviteUrl] = useState('');
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | user object
  const [teams, setTeams] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonTeamId, setNewSeasonTeamId] = useState('');
  const [teamMsg, setTeamMsg] = useState('');
  const [allVideos, setAllVideos] = useState([]);
  const [assignTeamId, setAssignTeamId] = useState({});
  const [assignSeasonId, setAssignSeasonId] = useState({});
  const [showAssigned, setShowAssigned] = useState(false);
  const [deletedVideos, setDeletedVideos] = useState([]);
  const [thumbLibrary, setThumbLibrary] = useState([]);
  const [thumbTeamId, setThumbTeamId] = useState('');
  const [thumbFilterTeam, setThumbFilterTeam] = useState('');
  const [userTeamFilter, setUserTeamFilter] = useState('ALL');
  const thumbInputRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.listUsers();
      setUsers(data.users);
    } catch {
      setError('Kunde inte hämta användare.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.uploadHistory();
      setUploads(data.videos);
    } catch {
      setError('Kunde inte hämta uppladdningshistorik.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchThumbLibrary = useCallback(async () => {
    try {
      const res = await fetch('/api/thumbnail-library', { credentials: 'include' });
      const data = await res.json();
      setThumbLibrary(data.thumbnails || []);
    } catch {}
  }, []);

  const handleUploadThumb = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !thumbTeamId) return;
    const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'include' });
    const csrfData = await csrfRes.json();
    const formData = new FormData();
    for (const file of files) {
      formData.append('images', file);
    }
    formData.append('teamId', thumbTeamId);
    const res = await fetch('/api/admin/thumbnail-library', {
      method: 'POST', credentials: 'include',
      headers: { 'X-CSRF-Token': csrfData.csrfToken },
      body: formData
    });
    if (res.ok) fetchThumbLibrary();
    e.target.value = '';
  };

  const handleDeleteThumb = async (id) => {
    if (!confirm('Ta bort denna thumbnail?')) return;
    const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'include' });
    const csrfData = await csrfRes.json();
    const res = await fetch('/api/admin/thumbnail-library/' + id, {
      method: 'DELETE', credentials: 'include',
      headers: { 'X-CSRF-Token': csrfData.csrfToken }
    });
    if (res.ok) fetchThumbLibrary();
  };

  const fetchDeletedVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/deleted-videos', { credentials: 'include' });
      const data = await res.json();
      setDeletedVideos(data.videos || []);
    } catch {
      setError('Kunde inte hamta borttagna videor.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeamsAdmin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const teamsData = await adminApi.listTeams();
      setTeams(teamsData.teams);
      setNewSeasonTeamId(prev => {
        if (!prev && teamsData.teams.length > 0) return String(teamsData.teams[0].id);
        return prev;
      });
    } catch {
      setError('Kunde inte hämta lag.');
      setLoading(false);
      return;
    }
    try {
      const videosData = await adminApi.uploadHistory(1, 50);
      setAllVideos(videosData.videos);
    } catch {
      // Videos är inte kritiskt, fortsätt ändå
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'users') { fetchUsers(); fetchInvites(); fetchTeamsAdmin(); }
    else if (tab === 'uploads') fetchUploads();
    else if (tab === 'teams') fetchTeamsAdmin();
    else if (tab === 'deleted') fetchDeletedVideos();
    else if (tab === 'thumbnails') { fetchThumbLibrary(); fetchTeamsAdmin(); }
  }, [tab, fetchUsers, fetchUploads, fetchTeamsAdmin, fetchDeletedVideos]);

  const handleCreateUser = async (userData) => {
    await adminApi.createUser(userData);
    await fetchUsers();
  };

  const handleUpdateUser = async (userData) => {
    await adminApi.updateUser(modal.id, userData);
    await fetchUsers();
  };

  const handleDeleteUser = async (id, name) => {
    if (!confirm(`Är du säker på att du vill ta bort "${name}"? Detta kan inte ångras.`)) return;
    try {
      await adminApi.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      await adminApi.createTeam(newTeamName.trim());
      setNewTeamName('');
      setTeamMsg('Laget skapades!');
      await fetchTeamsAdmin();
      setTimeout(() => setTeamMsg(''), 3000);
    } catch (err) {
      setTeamMsg(err.message);
    }
  };

  const handleDeleteTeam = async (id, name) => {
    if (!confirm(`Ta bort "${name}"? Alla säsonger för laget tas också bort.`)) return;
    try {
      await adminApi.deleteTeam(id);
      await fetchTeamsAdmin();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateSeason = async () => {
    if (!newSeasonName.trim() || !newSeasonTeamId) return;
    try {
      await adminApi.createSeason(newSeasonName.trim(), parseInt(newSeasonTeamId));
      setNewSeasonName('');
      setTeamMsg('Säsongen skapades!');
      await fetchTeamsAdmin();
      setTimeout(() => setTeamMsg(''), 3000);
    } catch (err) {
      setTeamMsg(err.message);
    }
  };

  const handleDeleteSeason = async (id, name) => {
    if (!confirm(`Ta bort säsongen "${name}"?`)) return;
    try {
      await adminApi.deleteSeason(id);
      await fetchTeamsAdmin();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssignVideo = async (videoId) => {
    try {
      const tId = assignTeamId[videoId] || null;
      const sId = assignSeasonId[videoId] || null;
      const result = await adminApi.assignVideo(videoId, tId ? parseInt(tId) : null, sId ? parseInt(sId) : null);
      
      // Uppdatera allVideos lokalt direkt
      setAllVideos(prev => prev.map(v => {
        if (v.id !== videoId) return v;
        const team = tId ? teams.find(t => String(t.id) === String(tId)) : null;
        const season = sId ? teams.flatMap(t => t.seasons || []).find(s => String(s.id) === String(sId)) : null;
        return { ...v, team: team || null, season: season || null };
      }));

      setTeamMsg('Videon tilldelades!');
      await fetchTeamsAdmin();
      setTimeout(() => setTeamMsg(''), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Administration</h1>
        <p>Hantera användare, uppladdningar och ändringslogg</p>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          Användare
        </button>
        <button
          className={`admin-tab ${tab === 'uploads' ? 'active' : ''}`}
          onClick={() => setTab('uploads')}
        >
          Uppladdningshistorik
        </button>

        <button
          className={`admin-tab ${tab === 'teams' ? 'active' : ''}`}
          onClick={() => setTab('teams')}
        >
          Lag & Säsonger
        </button>
        <button
          className={`admin-tab ${tab === 'thumbnails' ? 'active' : ''}`}
          onClick={() => setTab('thumbnails')}
        >
          Thumbnails
        </button>
        <button
          className={`admin-tab ${tab === 'deleted' ? 'active' : ''}`}
          onClick={() => setTab('deleted')}
        >
          Borttagna{deletedVideos.length > 0 ? ` (${deletedVideos.length})` : ''}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {tab === 'users' && (
        <div className="admin-section">
          <div className="section-header">
            <h2>Användare ({users.length})</h2>
            <button className="btn-gold" onClick={() => setModal('create')}>
              + Ny användare
            </button>
            <div style={{ marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Antal:</span>
              <input
                type="number"
                min="1"
                max="100"
                value={inviteMaxUses}
                onChange={e => setInviteMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '60px', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-default)', background: 'var(--surface-raised)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
              <button className="btn-primary btn-sm" onClick={() => handleCreateInvite('viewer')}>
                + Viewer-länk
              </button>
              <button className="btn-primary btn-sm" onClick={() => handleCreateInvite('uploader')}>
                + Uploader-länk
              </button>
              <button className="btn-primary btn-sm" onClick={() => handleCreateInvite('coach')}>
                + Coach-länk
              </button>
            </div>
          </div>

          {inviteUrl && (
            <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <strong>Inbjudningslänk skapad!</strong><br/>
                <code style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{inviteUrl}</code>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => { copyToClipboard(inviteUrl); }}>
                Kopiera
              </button>
            </div>
          )}

          {invites.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Aktiva inbjudningar</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Roll</th>
                      <th>Användningar</th>
                      <th>Skapad</th>
                      <th>Går ut</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map(inv => {
                      const expired = new Date(inv.expiresAt) < new Date();
                      const used = inv.useCount >= inv.maxUses;
                      return (
                        <tr key={inv.id}>
                          <td><span className={`badge badge-${inv.role}`}>{inv.role}</span></td>
                          <td>{inv.useCount} / {inv.maxUses}</td>
                          <td className="text-muted">{new Date(inv.createdAt).toLocaleDateString('sv-SE')}</td>
                          <td className="text-muted">{new Date(inv.expiresAt).toLocaleDateString('sv-SE')}</td>
                          <td>{used ? 'Använd' : expired ? 'Utgången' : 'Aktiv'}</td>
                          <td>
                            {!used && !expired && (
                              <button className="btn-secondary btn-sm" onClick={() => {
                                const url = window.location.origin + '/register/' + inv.token;
                                copyToClipboard(url);
                              }}>Kopiera</button>
                            )}
                            <button className="btn-danger btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => handleDeleteInvite(inv.id)}>Ta bort</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : (
            <>
            {/* Lag-filter */}
            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Filtrera lag:</span>
              <select
                value={userTeamFilter}
                onChange={e => setUserTeamFilter(e.target.value)}
                style={{
                  padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.82rem',
                  border: '1px solid var(--border-default)', background: 'var(--surface-raised)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="ALL">Alla ({users.length})</option>
                {teams.map(t => {
                  const count = users.filter(u => (u.teams || []).some(ut => ut.team?.id === t.id || ut.teamId === t.id)).length;
                  return <option key={t.id} value={t.id}>{t.name} ({count})</option>;
                })}
                <option value="NONE">Utan lag ({users.filter(u => !u.teams || u.teams.length === 0).length})</option>
              </select>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Namn</th>
                    <th>Lag</th>
                    <th>Roll</th>
                    <th>Status</th>
                    <th>Videor</th>
                    <th>Skapad</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter(u => {
                      if (userTeamFilter === 'ALL') return true;
                      if (userTeamFilter === 'NONE') return !u.teams || u.teams.length === 0;
                      return (u.teams || []).some(ut => String(ut.team?.id || ut.teamId) === userTeamFilter);
                    })
                    .map(u => (
                    <tr key={u.id} className={!u.isActive ? 'row-inactive' : ''}>
                      <td className="td-name">{u.name}</td>
                      <td>
                        {(u.teams || []).length > 0
                          ? (u.teams || []).map(ut => (
                              <span key={ut.team?.id || ut.teamId} className="badge" style={{ fontSize: '0.68rem', background: 'rgba(99,102,241,0.15)', color: 'var(--lvc-blue-light, #3584e4)', marginRight: '0.2rem' }}>
                                {ut.team?.name || 'Lag'}
                              </span>
                            ))
                          : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                      <td>
                        <span className={`badge badge-${u.role}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td>
                        <span className={`status-dot ${u.isActive ? 'active' : 'inactive'}`} />
                        {u.isActive ? 'Aktiv' : 'Inaktiv'}
                      </td>
                      <td className="text-muted">{u._count?.videos || 0}</td>
                      <td className="text-muted">
                        {new Date(u.createdAt).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="td-actions">
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => setModal(u)}
                        >
                          Redigera
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            className="btn-danger btn-sm"
                            onClick={() => handleDeleteUser(u.id, u.name)}
                          >
                            Ta bort
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {tab === 'uploads' && (
        <div className="admin-section">
          <h2>Senaste uppladdningar</h2>
          {loading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : uploads.length === 0 ? (
            <div className="empty-state">
              <h3>Inga uppladdningar ännu</h3>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Match</th>
                    <th>Uppladdad av</th>
                    <th>Storlek</th>
                    <th>Uppladdad</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map(v => (
                    <tr key={v.id}>
                      <td>{new Date(v.matchDate).toLocaleDateString('sv-SE')}</td>
                      <td>{v.title}</td>
                      <td className="text-muted">{v.uploadedBy?.name} ({v.uploadedBy?.email})</td>
                      <td className="text-muted">
                        {(v.fileSize / (1024 * 1024)).toFixed(1)} MB
                      </td>
                      <td className="text-muted">
                        {new Date(v.createdAt).toLocaleString('sv-SE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}



      {tab === 'thumbnails' && (
        <div className="admin-section">
          <h2 style={{ marginBottom: '1rem' }}>Thumbnail-bibliotek</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Ladda upp thumbnails per lag. Filnamnet blir motståndarnamnet (t.ex. Gislaved.jpg).
          </p>

          {/* Upload */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <select
              id="thumbTeam"
              value={thumbTeamId}
              onChange={(e) => { setThumbTeamId(e.target.value); }}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.88rem' }}
            >
              <option value="">Välj lag</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn-primary btn-sm" disabled={!thumbTeamId} onClick={() => thumbInputRef.current?.click()}>
              + Ladda upp bilder
            </button>
            <input ref={thumbInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={handleUploadThumb} hidden />
          </div>

          {/* Filter per lag */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setThumbFilterTeam('')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: !thumbFilterTeam ? '1px solid var(--lvc-blue)' : '1px solid var(--border)', background: !thumbFilterTeam ? 'rgba(26,95,180,0.15)' : 'transparent', color: !thumbFilterTeam ? 'var(--lvc-blue-light)' : 'var(--text-muted)', cursor: 'pointer' }}>Alla</button>
            {teams.map(t => (
              <button key={t.id} onClick={() => setThumbFilterTeam(String(t.id))} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: '4px', border: thumbFilterTeam === String(t.id) ? '1px solid var(--lvc-blue)' : '1px solid var(--border)', background: thumbFilterTeam === String(t.id) ? 'rgba(26,95,180,0.15)' : 'transparent', color: thumbFilterTeam === String(t.id) ? 'var(--lvc-blue-light)' : 'var(--text-muted)', cursor: 'pointer' }}>{t.name}</button>
            ))}
          </div>

          {/* Grid */}
          {thumbLibrary.filter(t => !thumbFilterTeam || String(t.teamId) === thumbFilterTeam).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Inga thumbnails.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {thumbLibrary.filter(t => !thumbFilterTeam || String(t.teamId) === thumbFilterTeam).map(t => (
                <div key={t.id} style={{
                  borderRadius: '8px', overflow: 'hidden',
                  border: '1px solid var(--border)', background: 'var(--surface)'
                }}>
                  <img
                    src={`/api/thumbnail-library/image/${t.filePath}`}
                    alt={t.name}
                    style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ padding: '0.4rem 0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.78rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.team?.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteThumb(t.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--lvc-red)', cursor: 'pointer', fontSize: '0.9rem', padding: '0.1rem 0.3rem' }}
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'deleted' && (
        <div className="admin-section">
          <h2>Borttagna videor</h2>
          {loading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : deletedVideos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Inga borttagna videor.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {deletedVideos.map(v => (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.75rem 1rem', borderRadius: '8px',
                  background: 'var(--surface)', border: '1px solid var(--border)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{v.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Borttagen {new Date(v.deletedAt).toLocaleDateString('sv-SE')} av {v.uploadedBy?.name || 'okand'}
                    </div>
                  </div>
                  <button className="btn-primary btn-sm" onClick={async () => {
                    try {
                      await videoApi.restore(v.id);
                      fetchDeletedVideos();
                    } catch (err) { alert(err.message); }
                  }}>Återställ</button>
                  <button className="btn-danger btn-sm" onClick={async () => {
                    if (!confirm('Radera permanent? Filen tas bort fran NAS.')) return;
                    try {
                      await videoApi.permanentDelete(v.id);
                      fetchDeletedVideos();
                    } catch (err) { alert(err.message); }
                  }}>Radera</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'teams' && (
        <div className="admin-section">
          <h2>Lag & Säsonger</h2>
          {teamMsg && <div className="alert alert-success">{teamMsg}</div>}
          {loading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : (
            <>
              {/* Skapa lag och säsong */}
              <div className="teams-admin-grid">
                <div className="teams-admin-col">
                  <h3>Skapa lag</h3>
                  <div className="inline-form">
                    <input
                      type="text"
                      placeholder="t.ex. LVC Dam"
                      value={newTeamName}
                      onChange={e => setNewTeamName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
                    />
                    <button className="btn-gold" onClick={handleCreateTeam}>Skapa</button>
                  </div>
                  <div className="teams-list">
                    {teams.map(team => (
                      <div key={team.id} className="teams-admin-item">
                        <div>
                          <strong>{team.name}</strong>
                          <span className="text-muted"> — {team._count?.seasons ?? 0} säsonger, {team._count?.videos ?? 0} matcher</span>
                        </div>
                        <button className="btn-danger btn-sm" onClick={() => handleDeleteTeam(team.id, team.name)}>Ta bort</button>
                      </div>
                    ))}
                    {teams.length === 0 && <p className="text-muted">Inga lag ännu.</p>}
                  </div>
                </div>

                <div className="teams-admin-col">
                  <h3>Skapa säsong</h3>
                  <div className="inline-form">
                    <select value={newSeasonTeamId} onChange={e => setNewSeasonTeamId(e.target.value)}>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder="t.ex. 25/26"
                      value={newSeasonName}
                      onChange={e => setNewSeasonName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateSeason()}
                    />
                    <button className="btn-gold" onClick={handleCreateSeason}>Skapa</button>
                  </div>
                  <div className="teams-list">
                    {teams.flatMap(team =>
                      (team.seasons || []).map(season => (
                        <div key={`${team.id}-${season.id}`} className="teams-admin-item">
                          <div>
                            <strong>{season.name}</strong>
                            <span className="text-muted"> — {team.name}</span>
                          </div>
                          <button className="btn-danger btn-sm" onClick={() => handleDeleteSeason(season.id, season.name)}>Ta bort</button>
                        </div>
                      ))
                    )}
                    {teams.every(t => (t.seasons || []).length === 0) && <p className="text-muted">Inga säsonger ännu.</p>}
                  </div>
                </div>
              </div>

              {/* Tilldelade videos — kollapsbar */}
              <div className="assigned-section">
                <button
                  className="assigned-toggle"
                  onClick={() => setShowAssigned(prev => !prev)}
                >
                  <span>Tilldelade videos ({allVideos.filter(v => v.team).length})</span>
                  <span className="toggle-arrow">{showAssigned ? '▲' : '▼'}</span>
                </button>
                {showAssigned && (
                  <div className="table-container" style={{marginTop: '0.5rem'}}>
                    <table>
                      <thead>
                        <tr>
                          <th>Video</th>
                          <th>Lag</th>
                          <th>Säsong</th>
                          <th>Flytta till lag</th>
                          <th>Flytta till säsong</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {allVideos.filter(v => v.team).map(v => (
                          <tr key={v.id}>
                            <td>{v.title}</td>
                            <td className="text-muted">{v.team?.name}</td>
                            <td className="text-muted">{v.season?.name || '—'}</td>
                            <td>
                              <select
                                value={assignTeamId[v.id] ?? (v.team?.id || '')}
                                onChange={e => {
                                  setAssignTeamId(prev => ({...prev, [v.id]: e.target.value}));
                                  setAssignSeasonId(prev => ({...prev, [v.id]: ''}));
                                }}
                              >
                                <option value="">— Inget lag —</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            </td>
                            <td>
                              <select
                                value={assignSeasonId[v.id] ?? (v.season?.id || '')}
                                onChange={e => setAssignSeasonId(prev => ({...prev, [v.id]: e.target.value}))}
                              >
                                <option value="">— Ingen säsong —</option>
                                {teams
                                  .find(t => String(t.id) === String(assignTeamId[v.id] ?? v.team?.id))
                                  ?.seasons?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                            <td>
                              <button className="btn-gold btn-sm" onClick={() => handleAssignVideo(v.id)}>Spara</button>
                            </td>
                          </tr>
                        ))}
                        {allVideos.filter(v => v.team).length === 0 && (
                          <tr><td colSpan="6" className="text-muted">Inga tilldelade videos ännu.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Otilldelade videos */}
              <h3 style={{marginTop: '1.5rem'}}>
                Tilldela videos
                <span className="text-muted" style={{fontWeight: 400, fontSize: '0.9rem', marginLeft: '0.5rem'}}>
                  ({allVideos.filter(v => !v.team).length} otilldelade)
                </span>
              </h3>
              {allVideos.filter(v => !v.team).length === 0 ? (
                <p className="text-muted">Alla videos är tilldelade! 🎉</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Video</th>
                        <th>Tilldela lag</th>
                        <th>Tilldela säsong</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {allVideos.filter(v => !v.team).map(v => (
                        <tr key={v.id}>
                          <td>{v.title}</td>
                          <td>
                            <select
                              value={assignTeamId[v.id] || ''}
                              onChange={e => {
                                setAssignTeamId(prev => ({...prev, [v.id]: e.target.value}));
                                setAssignSeasonId(prev => ({...prev, [v.id]: ''}));
                              }}
                            >
                              <option value="">— Välj lag —</option>
                              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </td>
                          <td>
                            <select
                              value={assignSeasonId[v.id] || ''}
                              onChange={e => setAssignSeasonId(prev => ({...prev, [v.id]: e.target.value}))}
                            >
                              <option value="">— Välj säsong —</option>
                              {teams
                                .find(t => String(t.id) === String(assignTeamId[v.id]))
                                ?.seasons?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </td>
                          <td>
                            <button className="btn-gold btn-sm" onClick={() => handleAssignVideo(v.id)}>Spara</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={modal === 'create' ? handleCreateUser : handleUpdateUser}
          teams={teams}
          onAddTeam={async (userId, teamId) => {
            try {
              const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'include' });
              const { csrfToken } = await csrfRes.json();
              await fetch(`/api/admin/users/${userId}/teams`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ teamId: parseInt(teamId) })
              });
              const data = await fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json());
              setUsers(data.users || []);
              const updated = (data.users || []).find(u => u.id === userId);
              if (updated) setModal(updated);
            } catch {}
          }}
          onRemoveTeam={async (userId, teamId) => {
            try {
              const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'include' });
              const { csrfToken } = await csrfRes.json();
              await fetch(`/api/admin/users/${userId}/teams/${teamId}`, {
                method: 'DELETE', credentials: 'include',
                headers: { 'X-CSRF-Token': csrfToken }
              });
              const data = await fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json());
              setUsers(data.users || []);
              const updated = (data.users || []).find(u => u.id === userId);
              if (updated) setModal(updated);
            } catch {}
          }}
        />
      )}
    </div>
  );
}
