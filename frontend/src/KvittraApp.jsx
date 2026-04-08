// ===========================================
// Kvittra — App (Role-based routing)
// Reads roles from OrgContext, renders correct panel.
// ===========================================
import { Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { useAuth } from './context/KvittraAuthContext.jsx';
import { useOrg } from './context/OrgContext.jsx';
import Layout from './components/layout/Layout.jsx';
import KvittraLoginPage from './pages/KvittraLoginPage.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: 'var(--brand-bg, #0a1628)', color: 'var(--brand-text, #f4f5f7)' }}>
          <h1 style={{ fontSize: '1.4rem' }}>Något gick fel</h1>
          <p style={{ color: '#7c8294' }}>Sidan stötte på ett oväntat fel.</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
            style={{ padding: '0.6rem 1.2rem', background: 'var(--brand-primary, #1a5fb4)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Tillbaka till startsidan
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Existing pages (lazy-loaded)
const TeamsPage = React.lazy(() => import('./pages/TeamsPage.jsx'));
const SeasonsPage = React.lazy(() => import('./pages/SeasonsPage.jsx'));
const VideosPage = React.lazy(() => import('./pages/VideosPage.jsx'));
const VideoPlayerPage = React.lazy(() => import('./pages/VideoPlayerPage.jsx'));
const UploadPage = React.lazy(() => import('./pages/UploadPage.jsx'));
const AdminPage = React.lazy(() => import('./pages/AdminPage.jsx'));
const ChangelogPage = React.lazy(() => import('./pages/ChangelogPage.jsx'));
const InboxPage = React.lazy(() => import('./pages/InboxPage.jsx'));
const PlayerStatsPage = React.lazy(() => import('./pages/PlayerStatsPage.jsx'));
const MultiScoutPage = React.lazy(() => import('./pages/MultiScoutPage.jsx'));
const AnalysisPage = React.lazy(() => import('./pages/AnalysisPage.jsx'));

// Protected route that checks org membership and roles
function ProtectedRoute({ children, requiredRoles }) {
  const { user, loading: authLoading } = useAuth();
  const { membership, loading: orgLoading, error: orgError } = useOrg();

  if (authLoading || orgLoading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!membership) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: 'var(--brand-bg, #0a1628)', color: 'var(--brand-text, #f4f5f7)' }}>
        <h1 style={{ fontSize: '1.4rem' }}>Ingen åtkomst</h1>
        <p style={{ color: '#7c8294' }}>{orgError || 'Du är inte medlem i denna organisation.'}</p>
      </div>
    );
  }

  if (requiredRoles) {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const hasRole = roles.some(r => membership.roles.includes(r));
    if (!hasRole) return <Navigate to="/" replace />;
  }

  return children;
}

// Public route — for matches with visibility='public'
function PublicVideoRoute({ children }) {
  return children; // No auth needed
}

// Determine the home page based on highest role
function HomePage() {
  const { roles } = useOrg();

  // Player with no admin/coach role → player dashboard (when built)
  // For now, redirect to teams
  if (roles.includes('player') && !roles.includes('admin') && !roles.includes('coach')) {
    return <TeamsPage />; // Will be PlayerDashboard later
  }

  return <TeamsPage />;
}

export default function KvittraApp() {
  const { loading: authLoading } = useAuth();
  const { loading: orgLoading, isLandingPage, isSuperadmin } = useOrg();

  if (authLoading || orgLoading) {
    return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner" /></div>;
  }

  // kvittra.se (no subdomain) → landing page / login
  if (isLandingPage) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<KvittraLoginPage />} />
          <Route path="*" element={<KvittraLoginPage />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  // filipadmin.kvittra.se → superadmin (placeholder)
  if (isSuperadmin) {
    return (
      <ErrorBoundary>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1628', color: '#f4f5f7' }}>
          <h1>Superadmin — Under uppbyggnad</h1>
        </div>
      </ErrorBoundary>
    );
  }

  const fallback = <div className="loading-container"><div className="spinner" /></div>;

  return (
    <ErrorBoundary>
      <Suspense fallback={fallback}>
        <Routes>
          <Route path="/login" element={<KvittraLoginPage />} />

          {/* Protected org routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="team/:teamId" element={<SeasonsPage />} />
            <Route path="team/:teamId/season/:seasonId" element={<VideosPage />} />
            <Route path="videos" element={<VideosPage />} />
            <Route path="video/:id" element={<VideoPlayerPage />} />
            <Route path="multi-scout" element={<MultiScoutPage />} />
            <Route path="analys" element={<AnalysisPage />} />
            <Route path="player/:playerId" element={<PlayerStatsPage />} />
            <Route path="changelog" element={<ChangelogPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route
              path="upload"
              element={
                <ProtectedRoute requiredRoles={['admin', 'uploader', 'coach']}>
                  <UploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute requiredRoles="admin">
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
