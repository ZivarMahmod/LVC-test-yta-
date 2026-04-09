// ===========================================
// LVC Media Hub — App (Routing)
// Supabase-only: SupabaseAuthContext, LandingPage, SuperadminPage
// ===========================================
import { Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { useAuth } from './context/SupabaseAuthContext.jsx';
import Layout from './components/layout/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';

const isSuperadmin = window.location.hostname === 'filipadmin.corevo.se';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: '#0a1628', color: '#f4f5f7' }}>
          <h1 style={{ fontSize: '1.4rem' }}>Något gick fel</h1>
          <p style={{ color: '#7c8294' }}>Sidan stötte på ett oväntat fel.</p>
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
// Lazy-laddade sidor
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

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const fallback = <div className="loading-container"><div className="spinner" /></div>;

  // filipadmin.corevo.se → superadmin-panel (kräver inloggning)
  if (isSuperadmin) {
    return (
      <ErrorBoundary>
        <Suspense fallback={fallback}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={
              <ProtectedRoute requiredRole="admin">
                <SuperadminPage />
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Ej inloggad → landningssida på /
  if (!user) {
    return (
      <ErrorBoundary>
      <Suspense fallback={fallback}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route
          path="/"
          element={<Layout />}
        >
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
              <ProtectedRoute requiredRole={['admin', 'uploader', 'coach']}>
                <UploadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute requiredRole="admin">
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
