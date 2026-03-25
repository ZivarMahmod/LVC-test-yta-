// ===========================================
// LVC Media Hub — Layout med navigation
// ===========================================
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import './Layout.css';

export default function Layout() {
  const { user, logout, isAdmin, isUploader } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="logo">
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
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
