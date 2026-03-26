// ===========================================
// LVC Media Hub — App (Routing)
// ===========================================
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/layout/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import TeamsPage from './pages/TeamsPage.jsx';
import SeasonsPage from './pages/SeasonsPage.jsx';
import VideosPage from './pages/VideosPage.jsx';
import VideoPlayerPage from './pages/VideoPlayerPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

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

  return (
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
        <Route
          path="upload"
          element={
            <ProtectedRoute requiredRole={['admin', 'uploader']}>
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
  );
}
