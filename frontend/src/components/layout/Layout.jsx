// ===========================================
// LVC Media Hub — Layout med navigation
// ===========================================
import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/SupabaseAuthContext.jsx';
import { authApi, reviewApi, settingsApi } from '../../utils/apiSwitch.js';
import { useGradeSymbols } from '../../hooks/useGradeSymbols.js';
import { useScoreboardSettings } from '../../hooks/useScoreboardSettings.js';
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
  const { gradeSymbols, updateSymbol, reset: resetGradeSymbols } = useGradeSymbols();
  const [showSymbolSettings, setShowSymbolSettings] = useState(false);
  const { settings: scoreboardSettings, updateSettings: updateScoreboardSettings, resetSettings: resetScoreboardSettings2 } = useScoreboardSettings();
  const [settingsTab, setSettingsTab] = useState('symbols');
  const [musicUrl, setMusicUrl] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    settingsApi.getMusicUrl().then(data => { if (data?.url) setMusicUrl(data.url); }).catch(() => {});
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchUnreadCount() {
    try {
      const data = await reviewApi.getInbox();
      const reviews = Array.isArray(data) ? data : (data?.reviews || []);
      const unread = reviews.filter(r => !r.acknowledgedAt).length;
      setUnreadCount(unread);
    } catch {}
  }

  // Beräkna effektiv roll baserat på viewAsRole
  const _effectiveRole = viewAsRole || user?.role;
  const effectiveIsAdmin = !viewAsRole && isAdmin;
  const effectiveIsUploader = !viewAsRole ? isUploader : ['admin', 'uploader', 'coach'].includes(viewAsRole);
  const _effectiveIsCoach = !viewAsRole ? isCoach : ['admin', 'coach'].includes(viewAsRole);

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
      await authApi.changePassword(oldPassword, newPassword);
      setPwSuccess('Lösenord ändrat!');
      setOldPassword('');
      setNewPassword('');
      setNewPassword2('');
      setTimeout(() => { setShowPassword(false); setPwSuccess(''); }, 2000);
    } catch (err) {
      setPwError(err.message || 'Nätverksfel.');
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
          <NavLink to="." className="logo" onClick={closeMenu}>
            <img src="/Linkoping-lejon.png" alt="LVC" style={{height: "64px", width: "auto", marginRight: "8px"}} />
            <span className="logo-text">
              LVC <span className="logo-accent">Media Hub</span>
            </span>
          </NavLink>

          <nav className="nav-links">
            <NavLink to="dashboard" className="nav-link">
              Dashboard
            </NavLink>
            <NavLink to="." end className="nav-link">
              Videor
            </NavLink>
            {(effectiveIsAdmin || isCoach) && (
              <NavLink to="coach" className="nav-link">
                Coach
              </NavLink>
            )}
            {effectiveIsUploader && (
              <NavLink to="uploader" className="nav-link">
                Uppladdning
              </NavLink>
            )}
            <NavLink to="my-stats" className="nav-link">
              Min statistik
            </NavLink>
            <NavLink to="analys" className="nav-link">
              Analys
            </NavLink>
            {effectiveIsAdmin && (
              <NavLink to="admin" className="nav-link">
                Admin
              </NavLink>
            )}
            <NavLink to="inbox" className="nav-link" style={{ position: 'relative' }}>
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
            <NavLink to="changelog" className="nav-link">
              Logg
            </NavLink>
            {musicUrl && (
              <a href={musicUrl} target="_blank" rel="noopener noreferrer" className="nav-link">
                Musik
              </a>
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
                    <button className="dropdown-item" onClick={() => { setShowSymbolSettings(true); setDropdownOpen(false); }}>
                      Inställningar
                    </button>
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

          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Meny" aria-expanded={menuOpen}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav">
            <NavLink to="dashboard" className="mobile-nav-link" onClick={closeMenu}>
              Dashboard
            </NavLink>
            <NavLink to="." end className="mobile-nav-link" onClick={closeMenu}>
              Videor
            </NavLink>
            {(effectiveIsAdmin || isCoach) && (
              <NavLink to="coach" className="mobile-nav-link" onClick={closeMenu}>
                Coach
              </NavLink>
            )}
            {effectiveIsUploader && (
              <NavLink to="uploader" className="mobile-nav-link" onClick={closeMenu}>
                Uppladdning
              </NavLink>
            )}
            <NavLink to="my-stats" className="mobile-nav-link" onClick={closeMenu}>
              Min statistik
            </NavLink>
            <NavLink to="analys" className="mobile-nav-link" onClick={closeMenu}>
              Analys
            </NavLink>
            {effectiveIsAdmin && (
              <NavLink to="admin" className="mobile-nav-link" onClick={closeMenu}>
                Admin
              </NavLink>
            )}
            <NavLink to="inbox" className="mobile-nav-link" onClick={closeMenu} style={{ position: 'relative' }}>
              Inbox {unreadCount > 0 && <span style={{
                background: 'var(--lvc-blue)', color: '#fff',
                borderRadius: 10, padding: '1px 7px',
                fontSize: 11, fontWeight: 700, marginLeft: 4
              }}>{unreadCount}</span>}
            </NavLink>
            <NavLink to="changelog" className="mobile-nav-link" onClick={closeMenu}>
              Logg
            </NavLink>
            {musicUrl && (
              <a href={musicUrl} target="_blank" rel="noopener noreferrer" className="mobile-nav-link" onClick={closeMenu}>
                Musik
              </a>
            )}
            <button className="mobile-nav-link" onClick={() => { setShowSymbolSettings(true); closeMenu(); }} style={{ textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', width: '100%', color: 'inherit', font: 'inherit' }}>
              Inställningar
            </button>
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
          <Outlet context={{ scoreboardSettings, updateScoreboardSettings }} />
        </div>
      </main>

      {showSymbolSettings && (
        <div className="symbol-settings-overlay" onClick={() => setShowSymbolSettings(false)}>
          <div className="symbol-settings-modal" onClick={e => e.stopPropagation()}>
            <div className="symbol-settings-header">
              <h3>Inställningar</h3>
              <button className="symbol-settings-close" onClick={() => setShowSymbolSettings(false)}>✕</button>
            </div>
            <div className="settings-tabs">
              <button
                className={`settings-tab ${settingsTab === 'symbols' ? 'settings-tab-active' : ''}`}
                onClick={() => setSettingsTab('symbols')}
              >
                Symboler
              </button>
              <button
                className={`settings-tab ${settingsTab === 'scoreboard' ? 'settings-tab-active' : ''}`}
                onClick={() => setSettingsTab('scoreboard')}
              >
                Scoreboard
              </button>
            </div>
            {settingsTab === 'symbols' && (
              <>
                <p className="symbol-settings-desc">Anpassa hur betyg visas i hela appen. Ändringarna sparas på ditt konto.</p>
                <div className="symbol-settings-grid">
                  {[
                    { code: '#', name: 'Perfekt', color: '#4CAF50' },
                    { code: '+', name: 'Bra', color: '#8BC34A' },
                    { code: '!', name: 'OK', color: '#FF9800' },
                    { code: '-', name: 'Dålig', color: '#FF5722' },
                    { code: '/', name: 'Fel', color: '#f44336' },
                    { code: '=', name: 'Boll borta', color: '#f44336' },
                  ].map(g => (
                    <div key={g.code} className="symbol-settings-row">
                      <span className="symbol-settings-code" style={{ color: g.color }}>{g.code}</span>
                      <span className="symbol-settings-name">{g.name}</span>
                      <input
                        type="text"
                        className="symbol-settings-input"
                        value={gradeSymbols[g.code] || ''}
                        onChange={e => updateSymbol(g.code, e.target.value)}
                        maxLength={3}
                      />
                    </div>
                  ))}
                </div>
                <div className="symbol-settings-actions">
                  <button className="symbol-settings-reset" onClick={resetGradeSymbols}>
                    Återställ standard
                  </button>
                  <button className="symbol-settings-done" onClick={() => setShowSymbolSettings(false)}>
                    Klar
                  </button>
                </div>
              </>
            )}
            {settingsTab === 'scoreboard' && (
              <div className="scoreboard-settings-panel">
                <p className="symbol-settings-desc">Anpassa scoreboardets utseende i videospelaren.</p>

                <div className="symbol-settings-grid">
                  <div className="symbol-settings-row">
                    <span className="symbol-settings-name" style={{ flex: 1 }}>Visa scoreboard</span>
                    <button
                      className={`toggle-btn ${scoreboardSettings.visible ? 'toggle-active' : ''}`}
                      onClick={() => updateScoreboardSettings({ visible: !scoreboardSettings.visible })}
                    >
                      {scoreboardSettings.visible ? 'På' : 'Av'}
                    </button>
                  </div>

                  <div className="symbol-settings-row">
                    <span className="symbol-settings-name" style={{ flex: 1 }}>Textstorlek</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[{ key: 'small', label: 'Liten' }, { key: 'medium', label: 'Medium' }, { key: 'large', label: 'Stor' }].map(s => (
                        <button
                          key={s.key}
                          className={`size-btn ${scoreboardSettings.fontSize === s.key ? 'size-btn-active' : ''}`}
                          onClick={() => updateScoreboardSettings({ fontSize: s.key })}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="symbol-settings-row">
                    <span className="symbol-settings-name" style={{ flex: 1 }}>Genomskinlighet</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round(scoreboardSettings.opacity * 100)}
                        onChange={e => updateScoreboardSettings({ opacity: parseInt(e.target.value) / 100 })}
                        className="opacity-slider"
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>
                        {Math.round(scoreboardSettings.opacity * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="symbol-settings-row">
                    <span className="symbol-settings-name" style={{ flex: 1 }}>Låst position</span>
                    <button
                      className={`toggle-btn ${scoreboardSettings.pinned ? 'toggle-active' : ''}`}
                      onClick={() => updateScoreboardSettings({ pinned: !scoreboardSettings.pinned })}
                    >
                      {scoreboardSettings.pinned ? '🔒 Låst' : '🔓 Olåst'}
                    </button>
                  </div>
                </div>

                <div className="symbol-settings-actions">
                  <button className="symbol-settings-reset" onClick={() => { resetScoreboardSettings2(); }}>
                    Återställ standard
                  </button>
                  <button className="symbol-settings-done" onClick={() => setShowSymbolSettings(false)}>
                    Klar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
