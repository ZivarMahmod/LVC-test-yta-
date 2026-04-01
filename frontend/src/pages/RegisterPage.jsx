// ===========================================
// LVC Media Hub — Registreringssida
// ===========================================
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../utils/api.js';
import './LoginPage.css';

export default function RegisterPage() {
  const { token } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const data = await authApi.validateInvite(token);
        if (data.valid) {
          setInvite(data);
        } else {
          setError(data.error || 'Ogiltig inbjudan.');
        }
      } catch {
        setError('Kunde inte validera inbjudan.');
      } finally {
        setChecking(false);
      }
    }
    check();
  }, [token]);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== password2) {
      setError('Lösenorden matchar inte.');
      return;
    }
    if (password.length < 8) {
      setError('Lösenord måste vara minst 8 tecken.');
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.register(token, username, password, name || username);
      if (data.user) {
        window.location.href = '/';
      } else {
        setError(data.error || 'Registrering misslyckades.');
      }
    } catch {
      setError('Ett nätverksfel uppstod.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="loading-container"><div className="spinner" /></div>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">🏐</div>
            <h1>Ogiltig inbjudan</h1>
            <p>{error || 'Länken är ogiltig eller har gått ut.'}</p>
          </div>
          <Link to="/login" className="btn-primary login-btn" style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}>
            Till inloggningen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🏐</div>
          <h1>Skapa konto</h1>
          <p>LVC Media Hub — {invite.role === 'uploader' ? 'Uppladdare' : 'Tittare'}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Användarnamn</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Välj ett användarnamn"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Namn (valfritt)</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ditt namn"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Lösenord</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 8 tecken"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password2">Bekräfta lösenord</label>
            <input
              id="password2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Upprepa lösenord"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {loading ? 'Skapar konto...' : 'Skapa konto'}
          </button>
        </form>

        <div className="login-footer">
          <p>Har du redan konto? <Link to="/login">Logga in</Link></p>
        </div>
      </div>
    </div>
  );
}
