// ===========================================
// Kvittra — Inloggningssida med OTP
// Email → Lösenord → OTP-kod → Org-val → Redirect
// ===========================================
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './KvittraLoginPage.css';

// API-anrop direkt (innan vi refaktorerar api.js)
async function fetchCsrf() {
  const res = await fetch('/api/auth/csrf-token', { credentials: 'include' });
  const data = await res.json();
  return data.csrfToken;
}

async function kvittraLogin(email, password, csrfToken) {
  const res = await fetch('/api/auth/kvittra/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function kvittraVerifyOtp(userId, code, csrfToken) {
  const res = await fetch('/api/auth/kvittra/verify-otp', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ userId, code }),
  });
  return { ok: res.ok, data: await res.json() };
}

async function kvittraResendOtp(userId, csrfToken) {
  const res = await fetch('/api/auth/kvittra/resend-otp', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export default function KvittraLoginPage() {
  const { isAuthenticated, checkAuth } = useAuth();
  const navigate = useNavigate();

  // Steg: 'credentials' → 'otp' → 'org-select' → redirect
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [userId, setUserId] = useState(null);
  const [devOtp, setDevOtp] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState(null);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const ensureCsrf = async () => {
    if (!csrfToken) {
      const token = await fetchCsrf();
      setCsrfToken(token);
      return token;
    }
    return csrfToken;
  };

  // Steg 1: Skicka email + lösenord
  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const csrf = await ensureCsrf();
      const result = await kvittraLogin(email, password, csrf);

      if (result.error) {
        setError(result.error);
      } else if (result.step === 'otp_required') {
        setUserId(result.userId);
        setDevOtp(result._devOtp || null);
        setStep('otp');
      }
    } catch {
      setError('Nätverksfel. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  // Steg 2: Verifiera OTP
  const handleOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const csrf = await ensureCsrf();
      const { ok, data } = await kvittraVerifyOtp(userId, otpCode, csrf);

      if (!ok) {
        setError(data.error || 'Felaktig kod.');
        if (data.attemptsLeft !== undefined) {
          setError(`Felaktig kod. ${data.attemptsLeft} försök kvar.`);
        }
      } else if (data.step === 'authenticated') {
        // Session skapad — kolla org-val
        if (data.organizations && data.organizations.length > 1) {
          setOrganizations(data.organizations);
          setStep('org-select');
        } else {
          // Direkt inlogg
          await checkAuth();
          navigate('/');
        }
      }
    } catch {
      setError('Nätverksfel. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  // Skicka ny OTP
  const handleResend = async () => {
    setError('');
    try {
      const csrf = await ensureCsrf();
      const result = await kvittraResendOtp(userId, csrf);
      setDevOtp(result._devOtp || null);
      setOtpCode('');
      setError('Ny kod skickad!');
    } catch {
      setError('Kunde inte skicka ny kod.');
    }
  };

  return (
    <div className="kl-page">
      <div className="kl-card">
        {/* Header */}
        <div className="kl-header">
          <div className="kl-logo">K</div>
          <h1>Kvittra</h1>
          <p>Sports Video Analysis</p>
        </div>

        {/* Steg-indikator */}
        <div className="kl-steps">
          <div className={`kl-step ${step === 'credentials' ? 'kl-step--active' : step !== 'credentials' ? 'kl-step--done' : ''}`}>
            <span>1</span>
          </div>
          <div className="kl-step-line" />
          <div className={`kl-step ${step === 'otp' ? 'kl-step--active' : step === 'org-select' ? 'kl-step--done' : ''}`}>
            <span>2</span>
          </div>
          <div className="kl-step-line" />
          <div className={`kl-step ${step === 'org-select' ? 'kl-step--active' : ''}`}>
            <span>3</span>
          </div>
        </div>

        {error && <div className="kl-alert">{error}</div>}

        {/* Steg 1: Credentials */}
        {step === 'credentials' && (
          <form onSubmit={handleCredentials}>
            <div className="kl-field">
              <label>E-post</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="din@email.se"
                required
                autoFocus
                disabled={loading}
              />
            </div>
            <div className="kl-field">
              <label>Lösenord</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Ditt lösenord"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="kl-btn" disabled={loading}>
              {loading ? 'Verifierar...' : 'Fortsätt'}
            </button>
          </form>
        )}

        {/* Steg 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleOtp}>
            <p className="kl-info">En 6-siffrig kod har skickats till din e-post.</p>

            {devOtp && (
              <div className="kl-dev-otp">
                DEV: Koden är <strong>{devOtp}</strong>
              </div>
            )}

            <div className="kl-field">
              <label>Verifieringskod</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                autoFocus
                disabled={loading}
                className="kl-otp-input"
              />
            </div>
            <button type="submit" className="kl-btn" disabled={loading || otpCode.length !== 6}>
              {loading ? 'Verifierar...' : 'Logga in'}
            </button>
            <button type="button" className="kl-btn-secondary" onClick={handleResend}>
              Skicka ny kod
            </button>
          </form>
        )}

        {/* Steg 3: Org-val */}
        {step === 'org-select' && (
          <div>
            <p className="kl-info">Välj organisation:</p>
            <div className="kl-org-list">
              {organizations.map(org => (
                <button
                  key={org.id}
                  className="kl-org-btn"
                  onClick={() => {
                    // I framtiden: redirect till [slug].kvittra.se
                    navigate('/');
                  }}
                >
                  <span className="kl-org-name">{org.name}</span>
                  <span className="kl-org-role">{org.roles?.join(', ')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="kl-footer">
          <p>Kvittra — Sports Video Analysis</p>
          {step !== 'credentials' && (
            <button className="kl-back" onClick={() => { setStep('credentials'); setError(''); setOtpCode(''); }}>
              Tillbaka till inloggning
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
