import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';

// Detect mode: Kvittra (multi-tenant) vs LVC (legacy single-tenant)
const useSupabase = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const useKvittra = !!(useSupabase && import.meta.env.VITE_KVITTRA_MODE === 'true');

async function bootstrap() {
  if (useKvittra) {
    // Kvittra multi-tenant mode
    const { AuthProvider } = await import('./context/KvittraAuthContext.jsx');
    const { OrgProvider } = await import('./context/OrgContext.jsx');
    const { BrandingProvider } = await import('./context/BrandingContext.jsx');
    const KvittraApp = (await import('./KvittraApp.jsx')).default;

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <OrgProvider>
              <BrandingProvider>
                <KvittraApp />
              </BrandingProvider>
            </OrgProvider>
          </AuthProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  } else {
    // Legacy LVC mode (single-tenant)
    const AuthProviderModule = useSupabase
      ? await import('./context/SupabaseAuthContext.jsx')
      : await import('./context/AuthContext.jsx');
    const { AuthProvider } = AuthProviderModule;
    const App = (await import('./App.jsx')).default;

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  }
}

bootstrap();
