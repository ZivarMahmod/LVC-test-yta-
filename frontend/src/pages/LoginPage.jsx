// ===========================================
// LVC Media Hub — Inloggningssida
// ===========================================
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './LoginPage.css';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(identifier, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Felaktigt användarnamn eller lösenord.');
      }
    } catch {
      setError('Ett nätverksfel uppstod. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="28" cy="28" r="26" stroke="rgba(91,163,245,0.6)" strokeWidth="2" fill="rgba(26,95,180,0.15)" />
              <path d="M28 2C28 2 20 14 20 28C20 42 28 54 28 54" stroke="rgba(91,163,245,0.4)" strokeWidth="1.5" fill="none" />
              <path d="M28 2C28 2 36 14 36 28C36 42 28 54 28 54" stroke="rgba(91,163,245,0.4)" strokeWidth="1.5" fill="none" />
              <path d="M4 20C4 20 16 24 28 24C40 24 52 20 52 20" stroke="rgba(91,163,245,0.4)" strokeWidth="1.5" fill="none" />
              <path d="M4 36C4 36 16 32 28 32C40 32 52 36 52 36" stroke="rgba(91,163,245,0.4)" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <h1>LVC Media Hub</h1>
          <p>Linköpings Volleybollklubb</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="identifier">Användarnamn</label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Användarnamn eller e-post"
              required
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Lösenord</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-primary login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Loggar in...
              </>
            ) : (
              'Logga in'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Privat plattform för LVC-medlemmar</p>
          <p style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>Glömt lösenord? Kontakta admin.</p>
        </div>
      </div>
    </div>
  );
}
