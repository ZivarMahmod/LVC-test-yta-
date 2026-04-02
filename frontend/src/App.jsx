// ===========================================
// LVC Media Hub — App (Routing)
// ===========================================
import { Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/layout/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import TeamsPage from './pages/TeamsPage.jsx';

// Lazy-laddade sidor — laddas först när användaren navigerar dit
const SeasonsPage = React.lazy(() => import('./pages/SeasonsPage.jsx'));
const VideosPage = React.lazy(() => import('./pages/VideosPage.jsx'));
const VideoPlayerPage = React.lazy(() => import('./pages/VideoPlayerPage.jsx'));
const UploadPage = React.lazy(() => import('./pages/UploadPage.jsx'));
const AdminPage = React.lazy(() => import('./pages/AdminPage.jsx'));
const ChangelogPage = React.lazy(() => import('./pages/ChangelogPage.jsx'));
const InboxPage = React.lazy(() => import('./pages/InboxPage.jsx'));
const PlayerStatsPage = React.lazy(() => import('./pages/PlayerStatsPage.jsx'));
const MultiScoutPage = React.lazy(() => import('./pages/MultiScoutPage.jsx'));

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
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
  );
}
