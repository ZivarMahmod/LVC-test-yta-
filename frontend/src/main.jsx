import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { OrgProvider } from './context/OrgContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <ToastProvider>
            <GlobalSearch />
            <App />
          </ToastProvider>
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
