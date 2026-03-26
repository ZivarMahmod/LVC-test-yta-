// ===========================================
// LVC Media Hub — Layout med navigation
// ===========================================
import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import './Layout.css';

export default function Layout() {
  const { user, logout, isAdmin, isUploader } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

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

          <div className="user-section">
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className={`badge badge-${user?.role}`}>{user?.role}</span>
            </div>
            <button onClick={handleLogout} className="btn-secondary btn-sm">
              Logga ut
            </button>
          </div>

          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? '\u2715' : '\u2630'}
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
            <button onClick={handleLogout} className="btn-secondary btn-sm">
              Logga ut
            </button>
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
