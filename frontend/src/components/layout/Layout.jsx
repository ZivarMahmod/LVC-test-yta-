// ===========================================
// LVC Media Hub — Layout med navigation
// ===========================================
import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi } from '../../utils/api.js';
import './Layout.css';

export default function Layout() {
  const { user, logout, isAdmin, isUploader } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const dropdownRef = useRef(null);

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
            {isUploader && (
              <NavLink to="/upload" className="nav-link">
                Ladda upp
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className="nav-link">
                Admin
              </NavLink>
            )}
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
            {isUploader && (
              <NavLink to="/upload" className="mobile-nav-link" onClick={closeMenu}>
                Ladda upp
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className="mobile-nav-link" onClick={closeMenu}>
                Admin
              </NavLink>
            )}
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
