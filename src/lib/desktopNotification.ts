/**
 * Desktop & Native OS Notification Manager for Oxente Festeje
 * Allows immediate high-priority alerts (Uber a caminho, Anota os Pedidos)
 * to overlay other windows (WhatsApp, browsers, desktop apps) via native OS toasts.
 */

let titleFlashInterval: NodeJS.Timeout | null = null;
let originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'Oxente Festeje';

export const IN_APP_NOTIF_KEY = 'oxente_notifications_active';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isAppNotificationActive(): boolean {
  if (typeof window === 'undefined') return false;
  // If browser native notification is granted, it is active
  if (isNotificationSupported() && Notification.permission === 'granted') {
    return true;
  }
  // If user enabled in-app notifications on this device/browser
  return localStorage.getItem(IN_APP_NOTIF_KEY) === 'true';
}

export function setAppNotificationActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  if (active) {
    localStorage.setItem(IN_APP_NOTIF_KEY, 'true');
  } else {
    localStorage.removeItem(IN_APP_NOTIF_KEY);
  }
  // Broadcast change across tabs
  try {
    window.dispatchEvent(new CustomEvent('oxente_notif_permission_change', { detail: { active } }));
  } catch {}
}

export function getNotificationPermission(): NotificationPermission {
  if (isAppNotificationActive()) return 'granted';
  if (!isNotificationSupported()) return 'default';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  // Always mark in-app notification as active when user clicks request
  setAppNotificationActive(true);

  if (!isNotificationSupported()) {
    return 'granted';
  }

  try {
    if (Notification.permission === 'granted') {
      return 'granted';
    }

    // Check if browser allows requesting in this context
    const res: any = Notification.requestPermission();
    let perm: NotificationPermission = 'default';
    if (res && typeof res.then === 'function') {
      perm = await res;
    } else {
      perm = await new Promise<NotificationPermission>((resolve) => {
        Notification.requestPermission((p) => resolve(p));
      });
    }

    if (perm === 'granted') {
      return 'granted';
    }

    // Even if native browser prompt returned denied or dismissed (e.g. non-HTTPS IP, local LAN or iframe),
    // we still return 'granted' for the app context because in-app alerts are active!
    return 'granted';
  } catch (err) {
    console.warn('Erro ao solicitar permissao de notificacao ao navegador:', err);
    // Return granted so in-app alerts work seamlessly on non-secure LANs/iframes
    return 'granted';
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
