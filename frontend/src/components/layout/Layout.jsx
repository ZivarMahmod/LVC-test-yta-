// ===========================================
// LVC Media Hub — Layout med navigation
// ===========================================
import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi } from '../../utils/api.js';
import './Layout.css';

export default function Layout() {
  const { user, logout, isAdmin, isUploader, isCoach } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [viewAsRole, setViewAsRole] = useState(null); // null = normal, 'coach'/'uploader'/'viewer' = preview
  const [showPassword, setShowPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchUnreadCount() {
    try {
      const res = await fetch('/api/reviews/inbox', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const unread = (data.reviews || []).filter(r => !r.acknowledgedAt).length;
      setUnreadCount(unread);
    } catch {}
  }

  // Beräkna effektiv roll baserat på viewAsRole
  const effectiveRole = viewAsRole || user?.role;
  const effectiveIsAdmin = !viewAsRole && isAdmin;
  const effectiveIsUploader = !viewAsRole ? isUploader : ['admin', 'uploader', 'coach'].includes(viewAsRole);
  const effectiveIsCoach = !viewAsRole ? isCoach : ['admin', 'coach'].includes(viewAsRole);

  const handleLogout = async () => {
    setMenuOpen(false);
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

  // Stäng dropdown vid klick utanför
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setShowPassword(false);
        setPwError('');
        setPwSuccess('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 8) {
      setPwError('Minst 8 tecken.');
      return;
    }
    if (newPassword !== newPassword2) {
      setPwError('Lösenorden matchar inte.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setPwSuccess('Lösenord ändrat!');
        setOldPassword('');
        setNewPassword('');
        setNewPassword2('');
        setTimeout(() => { setShowPassword(false); setPwSuccess(''); }, 2000);
      } else {
        setPwError(data.error || 'Kunde inte ändra lösenord.');
      }
    } catch {
      setPwError('Nätverksfel.');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="layout">
      {viewAsRole && (
        <div style={{
          background: 'var(--lvc-gold)', color: '#000', textAlign: 'center',
          padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
        }}>
          <span>Förhandsgranskar som: {viewAsRole}</span>
          <button
            onClick={() => setViewAsRole(null)}
            style={{
              padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0,0,0,0.3)',
              background: 'rgba(0,0,0,0.1)', color: '#000', cursor: 'pointer',
              fontSize: '0.72rem', fontWeight: 600
            }}
          >Tillbaka till admin</button>
        </div>
      )}
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="logo" onClick={closeMenu}>
            <img src="/Linkoping-lejon.png" alt="LVC" style={{height: "64px", width: "auto", marginRight: "8px"}} />
            <span className="logo-text">
              LVC <span className="logo-accent">Media Hub</span>
            </span>
          </NavLink>

          <nav className="nav-links">
            <NavLink to="/" end className="nav-link">
              Videor
            </NavLink>
            {effectiveIsUploader && (
              <NavLink to="/upload" className="nav-link">
                Ladda upp
              </NavLink>
            )}
            {effectiveIsAdmin && (
              <NavLink to="/admin" className="nav-link">
                Admin
              </NavLink>
            )}
            <NavLink to="/analys" className="nav-link">
              Analys
            </NavLink>
            <NavLink to="/inbox" className="nav-link" style={{ position: 'relative' }}>
              Inbox
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -10,
                  background: 'var(--lvc-blue)', color: '#fff',
                  borderRadius: '50%', width: 18, height: 18,
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{unreadCount}</span>
              )}
            </NavLink>
            <NavLink to="/changelog" className="nav-link">
              Logg
            </NavLink>
          </nav>

          <div className="user-section" ref={dropdownRef}>
            <button
              className="user-dropdown-btn"
              onClick={() => { setDropdownOpen(!dropdownOpen); setShowPassword(false); setPwError(''); setPwSuccess(''); }}
            >
              <span className="user-name">{user?.name}</span>
              <span className={`badge badge-${user?.role}`}>{user?.role}</span>
              <span className="dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
            </button>

            {dropdownOpen && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'var(--lvc-blue)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem', fontWeight: '600', color: '#fff', flexShrink: 0
                    }}>
                      {(user?.name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                    </div>
                    <div>
                      <strong>{user?.name}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{user?.role}</div>
                    </div>
                  </div>
                </div>

                {!showPassword ? (
                  <>
                    {isAdmin && (
                      <div style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border-default)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Visa som roll:</div>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {['admin', 'coach', 'uploader', 'viewer'].map(role => (
                            <button
                              key={role}
                              onClick={() => { setViewAsRole(viewAsRole === role || role === 'admin' ? null : role); setDropdownOpen(false); }}
                              style={{
                                padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer',
                                border: (viewAsRole === role || (!viewAsRole && role === 'admin')) ? '1px solid var(--lvc-gold)' : '1px solid var(--border-default)',
                                background: (viewAsRole === role || (!viewAsRole && role === 'admin')) ? 'rgba(232,168,37,0.15)' : 'transparent',
                                color: (viewAsRole === role || (!viewAsRole && role === 'admin')) ? 'var(--lvc-gold)' : 'var(--text-muted)'
                              }}
                            >{role}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button className="dropdown-item" onClick={() => setShowPassword(true)}>
                      Ändra lösenord
                    </button>
                    <button className="dropdown-item dropdown-logout" onClick={handleLogout}>
                      Logga ut
                    </button>
                  </>
                ) : (
                  <div className="dropdown-password">
                    {pwError && <div className="alert alert-error" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{pwError}</div>}
                    {pwSuccess && <div className="alert alert-success" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{pwSuccess}</div>}
                    <input
                      type="password"
                      placeholder="Nuvarande lösenord"
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      style={{ marginBottom: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                    />
                    <input
                      type="password"
                      placeholder="Nytt lösenord (minst 8 tecken)"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ marginBottom: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                    />
                    <input
                      type="password"
                      placeholder="Bekräfta nytt lösenord"
                      value={newPassword2}
                      onChange={e => setNewPassword2(e.target.value)}
                      style={{ marginBottom: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn-primary btn-sm" onClick={handleChangePassword} disabled={pwLoading}>
                        {pwLoading ? 'Sparar...' : 'Spara'}
                      </button>
                      <button className="btn-secondary btn-sm" onClick={() => { setShowPassword(false); setPwError(''); }}>
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav">
            <NavLink to="/" end className="mobile-nav-link" onClick={closeMenu}>
              Videor
            </NavLink>
            {effectiveIsUploader && (
              <NavLink to="/upload" className="mobile-nav-link" onClick={closeMenu}>
                Ladda upp
              </NavLink>
            )}
            {effectiveIsAdmin && (
              <NavLink to="/admin" className="mobile-nav-link" onClick={closeMenu}>
                Admin
              </NavLink>
            )}
            <NavLink to="/analys" className="mobile-nav-link" onClick={closeMenu}>
              Analys
            </NavLink>
            <NavLink to="/inbox" className="mobile-nav-link" onClick={closeMenu} style={{ position: 'relative' }}>
              Inbox {unreadCount > 0 && <span style={{
                background: 'var(--lvc-blue)', color: '#fff',
                borderRadius: 10, padding: '1px 7px',
                fontSize: 11, fontWeight: 700, marginLeft: 4
              }}>{unreadCount}</span>}
            </NavLink>
            <NavLink to="/changelog" className="mobile-nav-link" onClick={closeMenu}>
              Logg
            </NavLink>
          </nav>
          <div className="mobile-menu-footer">
            <span className="mobile-user">{user?.name} <span className={`badge badge-${user?.role}`}>{user?.role}</span></span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { closeMenu(); setDropdownOpen(true); setShowPassword(true); }} className="btn-secondary btn-sm">
                Ändra lösenord
              </button>
              <button onClick={handleLogout} className="btn-secondary btn-sm">
                Logga ut
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
