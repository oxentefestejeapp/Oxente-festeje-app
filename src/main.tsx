import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for Mobile App Badging & Web Push Notifications
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => {
        console.log('Oxente Festeje: Service Worker ativo para Mobile Push & App Badging');
      })
      .catch((err) => {
        console.debug('Falha ao registrar Service Worker:', err);
      });
  };

  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}

// Periodic check: clear storage cache if present (only run once per app load session to avoid reload loops)
if (typeof caches !== 'undefined' && !sessionStorage.getItem('oxente_cache_cleaned')) {
  caches.keys().then((keys) => {
    if (keys.length > 0) {
      Promise.all(keys.map(key => caches.delete(key))).then(() => {
        sessionStorage.setItem('oxente_cache_cleaned', 'true');
        console.log('Oxente Festeje: Stale browser caches cleared on boot.');
        (window as any).location.reload();
      });
    } else {
      sessionStorage.setItem('oxente_cache_cleaned', 'true');
    }
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

// 🛡️ BLOQUEADOR GLOBAL DE SCROLL WHEEL PARA INPUTS NUMÉRICOS
// Evita alteração de valores de estoque, preços e quantidades acidentalmente ao rolar a página
document.addEventListener('wheel', (e) => {
  if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

