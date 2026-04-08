// ===========================================
// LVC Media Hub — App (Routing)
// ===========================================
import { Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/layout/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
const KvittraLoginPage = React.lazy(() => import('./pages/KvittraLoginPage.jsx'));
const PublicMatchesPage = React.lazy(() => import('./pages/PublicMatchesPage.jsx'));
const LandingPage = React.lazy(() => import('./pages/LandingPage.jsx'));
const SuperAdminPage = React.lazy(() => import('./pages/SuperAdminPage.jsx'));

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
// Lazy-laddade sidor — laddas först när användaren navigerar dit
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
const TeamRosterPage = React.lazy(() => import('./pages/TeamRosterPage.jsx'));
const ComparePlayersPage = React.lazy(() => import('./pages/ComparePlayersPage.jsx'));

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
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const fallback = <div className="loading-container"><div className="spinner" /></div>;

  return (
    <ErrorBoundary>
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/kvittra/login" element={<Suspense fallback={fallback}><KvittraLoginPage /></Suspense>} />
        <Route path="/public" element={<Suspense fallback={fallback}><PublicMatchesPage /></Suspense>} />
        <Route path="/landing" element={<Suspense fallback={fallback}><LandingPage /></Suspense>} />
        <Route path="/superadmin" element={
          <ProtectedRoute requiredRole="admin">
            <Suspense fallback={fallback}><SuperAdminPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/register/:token" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<TeamsPage />} />
          <Route path="team/:teamId" element={<SeasonsPage />} />
          <Route path="team/:teamId/season/:seasonId" element={<VideosPage />} />
          <Route path="videos" element={<VideosPage />} />
          <Route path="video/:id" element={<VideoPlayerPage />} />
          <Route path="multi-scout" element={<MultiScoutPage />} />
          <Route path="analys" element={<AnalysisPage />} />
          <Route path="roster" element={<TeamRosterPage />} />
          <Route path="roster/:teamId" element={<TeamRosterPage />} />
          <Route path="compare" element={<ComparePlayersPage />} />
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
