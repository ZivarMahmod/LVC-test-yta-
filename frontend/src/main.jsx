import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/KvittraAuthContext.jsx';
import { OrgProvider } from './context/OrgContext.jsx';
import { BrandingProvider } from './context/BrandingContext.jsx';
import KvittraApp from './KvittraApp.jsx';
import './index.css';

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
