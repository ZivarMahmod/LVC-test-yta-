import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// Switchover: use Supabase Auth when env vars are set, otherwise fall back to Express
const useSupabase = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

const AuthProviderModule = useSupabase
  ? await import('./context/SupabaseAuthContext.jsx')
  : await import('./context/AuthContext.jsx');

const { AuthProvider } = AuthProviderModule;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
