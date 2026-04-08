// ===========================================
// Kvittra — Login Page
// email → password → OTP → org picker → redirect
// ===========================================
import { useState } from 'react';
import { useAuth } from '../context/KvittraAuthContext.jsx';
import './LoginPage.css';

export default function KvittraLoginPage() {
  const {
    isAuthenticated,
    signInWithPassword,
    requestOtp,
    verifyOtp,
    redirectToOrg,
    STEP_EMAIL,
    STEP_PASSWORD,
    STEP_OTP,
    STEP_ORG_PICKER,
  } = useAuth();

  const [step, setStep] = useState(STEP_EMAIL);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [userId, setUserId] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // Already logged in with an org → redirect
  if (isAuthenticated && organizations.length === 1) {
    redirectToOrg(organizations[0].org.slug);
    return null;
  }

  // Step 1: Email
  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError('Ange en giltig e-postadress.');
      return;
    }
    setStep(STEP_PASSWORD);
  };

  // Step 2: Password → then send OTP
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signInWithPassword(email, password);
      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setUserId(result.userId);

      // Send OTP
      const otpResult = await requestOtp(result.userId, result.email);
      if (!otpResult.success) {
        setError(otpResult.error);
        setLoading(false);
        return;
      }

      setOtpSent(true);
      setStep(STEP_OTP);
    } catch {
      setError('Ett nätverksfel uppstod.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify OTP
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await verifyOtp(userId, otpCode);
      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const orgs = result.organizations;

      if (orgs.length === 0) {
        setError('Inget konto kopplat till din användare. Kontakta support.');
        setLoading(false);
        return;
      }

      if (orgs.length === 1) {
        // Direct redirect
        redirectToOrg(orgs[0].org.slug);
        return;
      }

      // Multiple orgs → show picker
      setOrganizations(orgs);
      setStep(STEP_ORG_PICKER);
    } catch {
      setError('Ett nätverksfel uppstod.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await requestOtp(userId, email);
      if (result.success) {
        setOtpSent(true);
        setOtpCode('');
      } else {
        setError(result.error);
      }
    } catch {
      setError('Kunde inte skicka ny kod.');
    } finally {
      setLoading(false);
    }
  };

  // Go back one step
  const goBack = () => {
    setError('');
    if (step === STEP_PASSWORD) setStep(STEP_EMAIL);
    if (step === STEP_OTP) setStep(STEP_PASSWORD);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🏐</div>
          <h1>Kvittra</h1>
          <p>Sports Video Analysis</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* STEP 1: Email */}
        {step === STEP_EMAIL && (
          <form onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label htmlFor="email">E-postadress</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@email.se"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary login-btn">
              Fortsätt
            </button>
          </form>
        )}

        {/* STEP 2: Password */}
        {step === STEP_PASSWORD && (
          <form onSubmit={handlePasswordSubmit}>
            <p className="login-email-display">{email}</p>
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
                autoFocus
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary login-btn" disabled={loading}>
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>
            <button type="button" className="btn-link login-back" onClick={goBack}>
              Byt e-post
            </button>
          </form>
        )}

        {/* STEP 3: OTP */}
        {step === STEP_OTP && (
          <form onSubmit={handleOtpSubmit}>
            <p className="login-otp-info">
              En 6-siffrig kod har skickats till <strong>{email}</strong>
            </p>
            <div className="form-group">
              <label htmlFor="otp">Verifieringskod</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                autoFocus
                disabled={loading}
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
              />
            </div>
            <button type="submit" className="btn-primary login-btn" disabled={loading || otpCode.length !== 6}>
              {loading ? 'Verifierar...' : 'Verifiera'}
            </button>
            <button type="button" className="btn-link login-back" onClick={handleResendOtp} disabled={loading}>
              Skicka ny kod
            </button>
            <button type="button" className="btn-link login-back" onClick={goBack}>
              Tillbaka
            </button>
          </form>
        )}

        {/* STEP 4: Org picker */}
        {step === STEP_ORG_PICKER && (
          <div>
            <p className="login-otp-info">Välj organisation:</p>
            <div className="org-picker-list">
              {organizations.map((membership) => (
                <button
                  key={membership.orgId}
                  className="org-picker-item"
                  onClick={() => redirectToOrg(membership.org.slug)}
                >
                  <span className="org-picker-name">{membership.org.name}</span>
                  <span className="org-picker-roles">
                    {membership.roles.join(', ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="login-footer">
          <p>Kvittra — Sports Video Analysis</p>
        </div>
      </div>
    </div>
  );
}
