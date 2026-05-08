import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './styles/index.css';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Sentry — captures uncaught browser errors, unhandled promise rejections,
// and any error bubbled to <Sentry.ErrorBoundary>. No-op when VITE_SENTRY_DSN
// is unset (i.e. local dev) so test errors don't pollute the prod project.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div style={{ padding: 32, color: '#FF3366', textAlign: 'center' }}>Something went wrong. Please refresh the page.</div>}>
      <LanguageProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </LanguageProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);