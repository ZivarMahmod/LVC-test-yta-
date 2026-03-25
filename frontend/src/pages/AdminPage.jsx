// ===========================================
// LVC Media Hub — Adminpanel
// Hantera användare, visa uppladdningshistorik
// ===========================================
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './AdminPage.css';

const ROLE_LABELS = { admin: 'Admin', uploader: 'Uppladdare', viewer: 'Tittare' };

function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email || '',
    name: user?.name || '',
    password: '',
    role: user?.role || 'viewer',
    isActive: user?.isActive ?? true
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              <option value="admin">Admin</option>
            </select>
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
  const [users, setUsers] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | user object

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

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    else fetchUploads();
  }, [tab, fetchUsers, fetchUploads]);

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

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Administration</h1>
        <p>Hantera användare och övervaka uppladdningar</p>
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
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {tab === 'users' && (
        <div className="admin-section">
          <div className="section-header">
            <h2>Användare ({users.length})</h2>
            <button className="btn-gold" onClick={() => setModal('create')}>
              + Ny användare
            </button>
          </div>

          {loading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Namn</th>
                    <th>E-post</th>
                    <th>Roll</th>
                    <th>Status</th>
                    <th>Videor</th>
                    <th>Skapad</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className={!u.isActive ? 'row-inactive' : ''}>
                      <td className="td-name">{u.name}</td>
                      <td className="text-muted">{u.email}</td>
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

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={modal === 'create' ? handleCreateUser : handleUpdateUser}
        />
      )}
    </div>
  );
}
