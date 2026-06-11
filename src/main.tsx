import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Auto-cleanup Service Workers and stale caches to force instant updates and bypass cache lockups
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      let unregisteredAny = false;
      const promises = registrations.map(reg => 
        reg.unregister().then((success) => {
          if (success) unregisteredAny = true;
        })
      );
      
      Promise.all(promises).then(() => {
        if (unregisteredAny) {
          if (typeof caches !== 'undefined') {
            caches.keys().then((keys) => {
              Promise.all(keys.map(key => caches.delete(key))).then(() => {
                console.log('Oxente Festeje: Service Worker and caches cleared. Reloading page...');
                (window as any).location.reload();
              });
            });
          } else {
            (window as any).location.reload();
          }
        }
      });
    }
  });
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

