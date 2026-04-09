import { useState, useEffect, useCallback } from 'react';
import { adminApi, inviteApi } from '../../utils/apiSwitch.js';
import { useAuth } from '../../context/SupabaseAuthContext.jsx';

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

export default function AdminUsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [teams, setTeams] = useState([]);
  const [userTeamFilter, setUserTeamFilter] = useState('ALL');
  const [activeData, setActiveData] = useState({ online: [], recent: [], totalOnline: 0, totalRecent: 0 });

  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('Kopierad!')).catch(() => {
        prompt('Kopiera länken:', text);
      });
    } else {
      prompt('Kopiera länken:', text);
    }
  };

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

  const fetchInvites = async () => {
    try {
      const data = await inviteApi.list();
      setInvites(data.invites || []);
    } catch {}
  };

  const fetchTeams = useCallback(async () => {
    try {
      const teamsData = await adminApi.listTeams();
      setTeams(teamsData.teams);
    } catch {}
  }, []);

  const fetchActiveUsers = async () => {
    try {
      const data = await adminApi.getActiveUsers();
      setActiveData(data);
    } catch {}
  };

  useEffect(() => {
    fetchUsers();
    fetchInvites();
    fetchTeams();
    fetchActiveUsers();
  }, [fetchUsers, fetchTeams]);

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
    <div className="admin-section">
      {error && <div className="alert alert-error">{error}</div>}
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
                <th>#</th>
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
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      defaultValue={u.jerseyNumber || ''}
                      placeholder="—"
                      onBlur={async (e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        if (val === (u.jerseyNumber || null)) return;
                        try {
                          await adminApi.updateUser(u.id, { jerseyNumber: val });
                          fetchUsers();
                        } catch {}
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      style={{
                        width: '36px', padding: '0.15rem 0.3rem', borderRadius: '4px',
                        border: '1px solid transparent', background: 'transparent',
                        color: 'var(--text-primary)', fontSize: '0.82rem', textAlign: 'center'
                      }}
                      onFocus={(e) => { e.target.style.border = '1px solid var(--lvc-blue, #1a5fb4)'; e.target.style.background = 'var(--surface-raised)'; }}
                      onBlurCapture={(e) => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(u.teams || []).map(ut => (
                        <span key={ut.team?.id || ut.teamId} className="badge" style={{ fontSize: '0.68rem', background: 'rgba(99,102,241,0.15)', color: 'var(--lvc-blue-light, #3584e4)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          {ut.team?.name || 'Lag'}
                          <button
                            onClick={async () => {
                              try {
                                await adminApi.removeUserTeam(u.id, ut.team?.id || ut.teamId);
                                fetchUsers();
                              } catch {}
                            }}
                            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.6rem', padding: 0, lineHeight: 1, opacity: 0.7 }}
                          >×</button>
                        </span>
                      ))}
                      {teams.filter(t => !(u.teams || []).some(ut => (ut.team?.id || ut.teamId) === t.id)).length > 0 && (
                        <select
                          value=""
                          onChange={async (e) => {
                            const selectedTeamId = e.target.value;
                            if (!selectedTeamId) return;
                            try {
                              await adminApi.addUserTeam(u.id, selectedTeamId);
                              fetchUsers();
                            } catch {}
                          }}
                          style={{
                            padding: '0.1rem', borderRadius: '50%', fontSize: '0.7rem',
                            border: '1px solid transparent', background: 'transparent',
                            color: 'var(--text-muted)', cursor: 'pointer',
                            width: '20px', height: '20px', textAlign: 'center',
                            appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none'
                          }}
                          title="Lägg till lag"
                        >
                          <option value="">+</option>
                          {teams.filter(t => !(u.teams || []).some(ut => (ut.team?.id || ut.teamId) === t.id)).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${u.role}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const isOnline = activeData.online.some(a => a.id === u.id);
                      const isRecent = activeData.recent.some(a => a.id === u.id);
                      if (!u.isActive) return <><span className="status-dot inactive" /> Inaktiv</>;
                      if (isOnline) return <><span className="status-dot" style={{ background: '#22c55e' }} /> Online</>;
                      if (isRecent) return <><span className="status-dot" style={{ background: '#f59e0b' }} /> Nyligen</>;
                      return <><span className="status-dot" style={{ background: '#ef4444' }} /> Offline</>;
                    })()}
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

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={modal === 'create' ? handleCreateUser : handleUpdateUser}
          teams={teams}
          onAddTeam={async (userId, teamId) => {
            try {
              await adminApi.addUserTeam(userId, teamId);
              const data = await adminApi.listUsers();
              setUsers(data.users || []);
              const updated = (data.users || []).find(u => u.id === userId);
              if (updated) setModal(updated);
            } catch {}
          }}
          onRemoveTeam={async (userId, teamId) => {
            try {
              await adminApi.removeUserTeam(userId, teamId);
              const data = await adminApi.listUsers();
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
