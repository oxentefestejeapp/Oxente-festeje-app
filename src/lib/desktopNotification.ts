/**
 * Desktop & Native OS Notification Manager for Oxente Festeje
 * Allows immediate high-priority alerts (Uber a caminho, Anota os Pedidos)
 * to overlay other windows (WhatsApp, browsers, desktop apps) via native OS toasts.
 */

let titleFlashInterval: NodeJS.Timeout | null = null;
let originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'Oxente Festeje';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    const res: any = Notification.requestPermission();
    if (res && typeof res.then === 'function') {
      const perm = await res;
      return perm || Notification.permission || 'denied';
    } else {
      const perm = await new Promise<NotificationPermission>((resolve) => {
        Notification.requestPermission((p) => resolve(p));
      });
      return perm || Notification.permission || 'denied';
    }
  } catch (err) {
    console.warn('Erro ao solicitar permissao de notificacao:', err);
    return Notification.permission || 'denied';
  }
}

interface DesktopAlertOptions {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
}

/**
 * Triggers native OS desktop toast notification that pops up on Windows / Mac / Android
 * even if the browser tab is in the background or behind WhatsApp.
 */
export async function sendDesktopAlert({
  title,
  body,
  tag = 'oxente_alert',
  requireInteraction = true,
  onClick
}: DesktopAlertOptions): Promise<Notification | null> {
  if (!isNotificationSupported()) return null;

  try {
    if (Notification.permission === 'granted') {
      // 1. If service worker is active, use it (required on Android Chrome / PWA)
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.showNotification) {
            await reg.showNotification(title, {
              body,
              icon: '/icon.svg',
              badge: '/icon.svg',
              tag,
              requireInteraction,
              silent: false,
            } as any);
            return null;
          }
        } catch (swErr) {
          console.warn('Falha na notificacao via Service Worker, tentando construtor padrao:', swErr);
        }
      }

      // 2. Standard Web Notification (Windows, macOS, Linux)
      const notification = new Notification(title, {
        body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag,
        requireInteraction,
        silent: false,
      });

      notification.onclick = () => {
        try {
          window.focus();
        } catch {}
        if (onClick) onClick();
        notification.close();
      };

      return notification;
    } else if (Notification.permission === 'default') {
      const perm = await requestNotificationPermission();
      if (perm === 'granted') {
        return sendDesktopAlert({ title, body, tag, requireInteraction, onClick });
      }
    }
  } catch (error) {
    console.warn('Erro ao disparar notificacao desktop:', error);
  }

  return null;
}

/**
 * Flashes the document title in the browser tab to catch peripheral vision
 * when the user is multitasking on other tabs or desktop apps.
 */
export function flashDocumentTitle(alertText: string, durationMs: number = 30000) {
  if (typeof document === 'undefined') return;

  stopFlashingTitle();

  if (document.title && !document.title.includes('🚨') && !document.title.includes('📝')) {
    originalDocumentTitle = document.title;
  }

  let isAlertState = true;
  document.title = alertText;

  titleFlashInterval = setInterval(() => {
    isAlertState = !isAlertState;
    document.title = isAlertState ? alertText : originalDocumentTitle;
  }, 750);

  // Auto-stop when user switches back to this tab
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      stopFlashingTitle();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    }
  };

  const handleFocus = () => {
    stopFlashingTitle();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);

  // Safety timer to restore title
  setTimeout(() => {
    stopFlashingTitle();
  }, durationMs);
}

export function stopFlashingTitle() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  if (typeof document !== 'undefined' && originalDocumentTitle) {
    document.title = originalDocumentTitle;
  }
}
