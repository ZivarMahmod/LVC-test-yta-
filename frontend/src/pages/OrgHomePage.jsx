// ===========================================
// CorevoSports — Org Home Page
// Shown at /app/:slug — org dashboard
// ===========================================
import { useOrg } from '../context/OrgContext.jsx';
import { useAuth } from '../context/KvittraAuthContext.jsx';

export default function OrgHomePage() {
  const { org, roles, membership } = useOrg();
  const { user, logout } = useAuth();

  if (!org) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1628', color: '#f4f5f7' }}>
        <p>Laddar organisation...</p>
      </div>
    );
  }

  const branding = org.branding_config || {};

  return (
    <div style={{
      minHeight: '100vh',
      background: branding.background_color || '#0a1628',
      color: branding.text_color || '#f4f5f7',
      fontFamily: branding.font || 'DM Sans, system-ui, sans-serif',
      padding: '2rem',
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: branding.primary_color || '#1a5fb4', fontSize: '1.8rem', marginBottom: '0.25rem' }}>
            {org.name}
          </h1>
          <p style={{ color: branding.text_color ? branding.text_color + '99' : '#7c8294', fontSize: '0.9rem' }}>
            {user?.email} — {roles.join(', ')}
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: `1px solid ${branding.primary_color || '#1a5fb4'}`,
            color: branding.primary_color || '#1a5fb4',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Logga ut
        </button>
      </header>

      <div style={{
        background: branding.surface_color || '#111f3a',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '800px',
      }}>
        <h2 style={{ marginBottom: '1rem' }}>Dashboard</h2>
        <p style={{ color: branding.text_color ? branding.text_color + '99' : '#7c8294', marginBottom: '1.5rem' }}>
          Välkommen till {org.name}. Här kommer ditt innehåll att visas.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {roles.includes('admin') && (
            <div style={{ background: branding.background_color || '#0a1628', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Admin</div>
              <p style={{ fontSize: '0.85rem', color: '#7c8294' }}>Hantera lag, användare, inställningar</p>
            </div>
          )}
          {(roles.includes('admin') || roles.includes('coach')) && (
            <div style={{ background: branding.background_color || '#0a1628', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Videoanalys</div>
              <p style={{ fontSize: '0.85rem', color: '#7c8294' }}>DVW-data, heatmaps, spelarstatistik</p>
            </div>
          )}
          {(roles.includes('admin') || roles.includes('coach') || roles.includes('uploader')) && (
            <div style={{ background: branding.background_color || '#0a1628', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Uppladdning</div>
              <p style={{ fontSize: '0.85rem', color: '#7c8294' }}>Ladda upp matchvideor och DVW-filer</p>
            </div>
          )}
          {roles.includes('player') && (
            <div style={{ background: branding.background_color || '#0a1628', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Min statistik</div>
              <p style={{ fontSize: '0.85rem', color: '#7c8294' }}>Se dina matcher och prestationer</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
