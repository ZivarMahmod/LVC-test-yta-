// ===========================================
// CorevoSports — App (Multi-tenant routing)
// Landing at /, Login at /login
// Org panel at /app/:slug with all pages
// Superadmin at filipadmin.corevo.se
// ===========================================
import { Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { useAuth } from './context/KvittraAuthContext.jsx';
import { useOrg } from './context/OrgContext.jsx';
import Layout from './components/layout/Layout.jsx';
import KvittraLoginPage from './pages/KvittraLoginPage.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: '#0a1628', color: '#f4f5f7' }}>
          <h1 style={{ fontSize: '1.4rem' }}>Något gick fel</h1>
          <p style={{ color: '#7c8294' }}>Sidan stötte på ett oväntat fel.</p>
          <pre style={{ color: '#ff6b6b', fontSize: '0.8rem', maxWidth: '600px', overflow: 'auto' }}>{this.state.error?.message}</pre>
          <button onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
            style={{ padding: '0.6rem 1.2rem', background: '#1a5fb4', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Tillbaka till startsidan
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Original pages (lazy loaded)
const LandingPage = React.lazy(() => import('./pages/LandingPage.jsx'));
const SuperadminPage = React.lazy(() => import('./pages/SuperadminPage.jsx'));
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

// New multi-tenant pages
const CoachAdminPanel = React.lazy(() => import('./pages/public/CoachAdminPanel.jsx'));
const PlayerDashboard = React.lazy(() => import('./pages/public/PlayerDashboard.jsx'));
const UploaderPanel = React.lazy(() => import('./pages/public/UploaderPanel.jsx'));
const PublicMatchesPage = React.lazy(() => import('./pages/public/PublicMatchesPage.jsx'));
const PublicVideoPage = React.lazy(() => import('./pages/public/PublicVideoPage.jsx'));
const OrgHomePage = React.lazy(() => import('./pages/OrgHomePage.jsx'));

// Protected route — checks auth + org membership
function ProtectedRoute({ children, requiredRoles }) {
  const { user, loading: authLoading } = useAuth();
  const { membership, loading: orgLoading, error: orgError, slug } = useOrg();

  if (authLoading || orgLoading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!membership) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: '#0a1628', color: '#f4f5f7' }}>
        <h1 style={{ fontSize: '1.4rem' }}>Ingen åtkomst</h1>
        <p style={{ color: '#7c8294' }}>{orgError || 'Du är inte medlem i denna organisation.'}</p>
        <a href="/" style={{ color: '#1a5fb4' }}>Tillbaka till startsidan</a>
      </div>
    );
  }

  if (requiredRoles) {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const hasRole = roles.some(r => membership.roles.includes(r));
    if (!hasRole) return <Navigate to={`/app/${slug}`} replace />;
  }

  return children;
}

export default function KvittraApp() {
  const { loading: authLoading } = useAuth();
  const { loading: orgLoading, isSuperadmin } = useOrg();

  if (authLoading || orgLoading) {
    return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner" /></div>;
  }

  const fallback = <div className="loading-container"><div className="spinner" /></div>;

  // filipadmin.corevo.se → superadmin
  if (isSuperadmin) {
    return (
      <ErrorBoundary>
        <Suspense fallback={fallback}>
          <Routes>
            <Route path="/login" element={<KvittraLoginPage />} />
            <Route path="*" element={<SuperadminPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={fallback}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<KvittraLoginPage />} />

          {/* Org panel — Layout with all pages */}
          <Route
            path="/app/:slug"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Original pages */}
            <Route index element={<TeamsPage />} />
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
                <ProtectedRoute requiredRoles={['admin']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />

            {/* New multi-tenant pages */}
            <Route path="dashboard" element={<OrgHomePage />} />
            <Route
              path="coach"
              element={
                <ProtectedRoute requiredRoles={['admin', 'coach']}>
                  <CoachAdminPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="uploader"
              element={
                <ProtectedRoute requiredRoles={['admin', 'coach', 'uploader']}>
                  <UploaderPanel />
                </ProtectedRoute>
              }
            />
            <Route path="my-stats" element={<PlayerDashboard />} />
          </Route>

          {/* Public match pages (no auth needed) */}
          <Route path="/app/:slug/public" element={<PublicMatchesPage />} />
          <Route path="/app/:slug/public/match/:matchId" element={<PublicVideoPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
