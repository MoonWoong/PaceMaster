import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle chunk reload errors and clean up any stale service workers or caches
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    window.location.reload();
  });

  // Ignore Vite HMR WebSocket errors in AI Studio preview iframe environment
  window.addEventListener('error', (event) => {
    if (
      event.filename?.includes('@vite/client') ||
      event.message?.includes('WebSocket') ||
      event.message?.includes('failed to connect') ||
      event.error?.stack?.includes('@vite/client')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason?.message || event.reason?.stack || event.reason || '');
    if (reasonStr.includes('WebSocket') || reasonStr.includes('@vite/client')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  }

  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key).catch(() => {});
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
