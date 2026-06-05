import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker for Offline and Install capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('PWA Service Worker registered:', reg.scope))
      .catch((err) => console.warn('PWA Service Worker failed to register:', err));
  });
}

// Global PWA Installer Interceptor
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent standard browser bar from displaying instantly
  e.preventDefault();
  // Store the prompt event globally in window context
  (window as any).deferredInstallPrompt = e;
  
  // Notify listening active components that the PWA install is ready
  window.dispatchEvent(new CustomEvent('appbeforeinstallprompt', { detail: e }));
});

window.addEventListener('appinstalled', () => {
  (window as any).deferredInstallPrompt = null;
  console.log('App successfully installed on homescreen!');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

