import { Outlet, Link } from 'react-router-dom';
import { useOrg } from '../../context/OrgContext.jsx';
import './PublicLayout.css';

export default function PublicLayout() {
  const { org, loading, error } = useOrg();

  if (loading) {
    return (
      <div className="public-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="public-error">
        <h1>404</h1>
        <p>{error || 'Organisation hittades inte'}</p>
        <a href="https://kvikta.se">Tillbaka till kvikta.se</a>
      </div>
    );
  }

  const branding = org.branding_config || {};
  const logoUrl = branding.logoUrl;
  const orgName = branding.displayName || org.name;

  return (
    <div className="public-layout">
      <header className="public-header">
        <Link to="/" className="public-header-brand">
          {logoUrl ? (
            <img src={logoUrl} alt={orgName} className="public-header-logo" />
          ) : (
            <span className="public-header-logo-placeholder">
              {orgName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="public-header-name">{orgName}</span>
        </Link>
        <nav className="public-header-nav">
          <Link to="/">Matcher</Link>
        </nav>
      </header>

      <main className="public-main">
        <Outlet />
      </main>

      <footer className="public-footer">
        <span>Drivs av <a href="https://kvikta.se" target="_blank" rel="noopener noreferrer">Kvikta</a></span>
      </footer>
    </div>
  );
}
