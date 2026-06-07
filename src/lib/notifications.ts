/**
 * System Notifications, Text-to-Speech (TTS), and Voice Alerts Helper
 * for Oxente Festeje realtime order alerts.
 */

import { playAppSound } from './audio';

// Local storage configuration keys
const NOTIFICATIONS_ENABLED_KEY = 'oxente_notifications_enabled';
const TTS_ENABLED_KEY = 'oxente_tts_enabled';

/**
 * Checks if the browser supports notifications and permissions are active.
 */
export function getNotificationPermissionStatus(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Requests native browser/mobile system notification permissions.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Este dispositivo/navegador não suporta notificações de sistema.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Erro ao solicitar permissão de notificações:', err);
    return false;
  }
}

/**
 * Gets currently customized preference for browser notifications.
 * Defaults to true (needs permission to be granted).
 */
export function isNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) !== 'false';
}

/**
 * Toggles customized preference for browser notifications in localStorage.
 */
export function setNotificationsEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
}

/**
 * Gets currently customized preference for Voice Alerts (TTS).
 * Defaults to true.
 */
export function isTtsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(TTS_ENABLED_KEY) !== 'false';
}

/**
 * Toggles customized preference for Voice Alerts (TTS) in localStorage.
 */
export function setTtsEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TTS_ENABLED_KEY, enabled ? 'true' : 'false');
}

/**
 * Play a beautiful custom synthesized sound chime for new orders.
 */
export function playNewOrderChime() {
  try {
    // We can use playAppSound from our procedural synthesizer
    playAppSound('complete'); 
  } catch (err) {
    console.warn('Falha ao reproduzir áudio do pedido:', err);
  }
}

/**
 * Synthesizes speech to speak out loud when a new order comes in.
 */
export function announceNewSaleVoice(clientName: string, total: number) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (!isTtsEnabled()) return;

    // Fast cleanup to prevent audio queue build-up / lagging Speak queue
    window.speechSynthesis.cancel();

    const formattedTotal = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const cleanClient = clientName && clientName.trim() !== 'Consumidor' ? clientName : 'Consumidor Geral';
    
    // Warm and friendly audio copy in Portuguese
    const msg = `Novo pedido de ${cleanClient}! No valor de ${formattedTotal}!`;
    
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05; // Slightly faster to sound crisp
    utterance.pitch = 1.0;  // Natural pitch
    
    // Find a proper Brazilian Portuguese voice if available
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Erro ao processar síntese de voz (TTS):', err);
  }
}

/**
 * Spawns a physical browser/OS native push notification on the user's mobile or desktop.
 */
export function triggerSystemNotification(title: string, body: string, onClick?: () => void) {
  if (typeof window === 'undefined') return;

  // 1. Verify general preference setting is enabled
  if (!isNotificationsEnabled()) return;

  // 2. Verify permission has been granted
  if (getNotificationPermissionStatus() !== 'granted') {
    console.log('Permissão de notificação negada ou não configurada ainda.');
    return;
  }

  try {
    const options: any = {
      body,
      icon: '/favicon.ico', // standard web icon
      badge: '/favicon.ico',
      tag: 'new-sale-alert',
      vibrate: [200, 100, 200], // vibration rhythm for mobile devices
      requireInteraction: false
    };

    // Try service worker registration push notification which has better background support on Android/iOS standalone PWAs
    if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, options);
      }).catch(() => {
        // Fallback to standard web notification
        const notification = new Notification(title, options);
        if (onClick) {
          notification.onclick = () => {
            window.focus();
            onClick();
          };
        }
      });
    } else {
      // Standard local notification
      const notification = new Notification(title, options);
      if (onClick) {
        notification.onclick = () => {
          window.focus();
          onClick();
        };
      }
    }
  } catch (err) {
    console.warn('Falha ao emitir notificação de sistema:', err);
  }
}

/**
 * Master controller executed whenever a new sale is created.
 * Triggers chime alert, speaks text-to-speech voice announcer, and creates system push.
 */
export function dispatchNewOrderNotification(clientName: string, total: number, orderNum?: string, onClick?: () => void) {
  // 1. Play premium order completion synthesized chime
  playNewOrderChime();

  // 2. Speak via Voice Synthesis
  announceNewSaleVoice(clientName, total);

  // 3. Spawns standard OS notification
  const displayNum = orderNum ? `(Nº ${orderNum})` : '';
  const title = `🛍️ Novo Pedido Recebido! ${displayNum}`;
  const totalFormatted = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const cleanClient = clientName && clientName.trim() !== 'Consumidor' ? clientName : 'Consumidor Geral';
  const body = `Cliente: ${cleanClient}\nValor Total: ${totalFormatted}`;

  triggerSystemNotification(title, body, onClick);
}

/**
 * Synthesizes speech to speak out loud when an existing order is updated/edited.
 */
export function announceEditedSaleVoice(clientName: string, total: number) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (!isTtsEnabled()) return;

    // Fast cleanup to prevent audio queue build-up / lagging Speak queue
    window.speechSynthesis.cancel();

    const formattedTotal = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const cleanClient = clientName && clientName.trim() !== 'Consumidor' ? clientName : 'Consumidor Geral';
    
    // Warm and friendly audio copy in Portuguese
    const msg = `Pedido de ${cleanClient} foi alterado! Novo valor de ${formattedTotal}!`;
    
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05; // Slightly faster to sound crisp
    utterance.pitch = 1.0;  // Natural pitch
    
    // Find a proper Brazilian Portuguese voice if available
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Erro ao processar síntese de voz (TTS) para alteração:', err);
  }
}

/**
 * Master controller executed whenever a sale is updated/edited.
 * Triggers chime alert, speaks text-to-speech voice announcer, and creates system push.
 */
export function dispatchOrderEditedNotification(clientName: string, total: number, orderNum?: string, onClick?: () => void) {
  // 1. Play premium order completion synthesized chime
  playNewOrderChime();

  // 2. Speak via Voice Synthesis
  announceEditedSaleVoice(clientName, total);

  // 3. Spawns standard OS notification using custom title for edits
  const displayNum = orderNum ? `(Nº ${orderNum})` : '';
  const title = `✏️ Pedido Alterado! ${displayNum}`;
  const totalFormatted = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const cleanClient = clientName && clientName.trim() !== 'Consumidor' ? clientName : 'Consumidor Geral';
  const body = `Cliente: ${cleanClient}\nNovo Valor: ${totalFormatted}`;

  triggerSystemNotification(title, body, onClick);
}

/**
 * Declares global Window structure for OneSignal SDK.
 */
declare global {
  interface Window {
    OneSignal?: any;
  }
}

/**
 * Initializes OneSignal if App ID is declared.
 */
export function initOneSignal() {
  if (typeof window === 'undefined') return;
  const appId = localStorage.getItem('oxente_onesignal_app_id') || import.meta.env.VITE_ONESIGNAL_APP_ID;
  if (!appId) {
    console.log("OneSignal App ID não configurado. Notificações nativas em 2º plano inativas.");
    return;
  }

  window.OneSignal = window.OneSignal || [];
  window.OneSignal.push(() => {
    window.OneSignal.init({
      appId: appId,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerParam: { scope: '/' },
      serviceWorkerPath: 'OneSignalSDKWorker.js',
    });
    console.log("OneSignal inicializado com App ID:", appId);
  });
}

/**
 * Requests the user subscription opt-in for OneSignal Push Notifications.
 */
export function optInOneSignal() {
  if (typeof window === 'undefined' || !window.OneSignal) {
    console.warn("SDK do OneSignal não carregado nas dependências.");
    return;
  }
  window.OneSignal.push(async () => {
    try {
      if (window.OneSignal.Slidedown) {
        await window.OneSignal.Slidedown.promptPush();
      } else if (window.OneSignal.User && window.OneSignal.User.PushSubscription) {
        await window.OneSignal.User.PushSubscription.optIn();
      } else if (window.OneSignal.registerForPushNotifications) {
        await window.OneSignal.registerForPushNotifications();
      } else {
        await window.OneSignal.showNativePrompt();
      }
      console.log("Solicitado registro de Push no OneSignal.");
    } catch (err) {
      console.warn("Erro ao solicitar inscrição de push:", err);
    }
  });
}

/**
 * Dispatches a native BACKGROUND push notification through OneSignal's REST API.
 * This runs client-side on the device saving the order, broadcasting the push to all other backgrounded devices.
 */
export async function sendBackgroundPushNotification(
  clientName: string,
  total: number,
  actionType: 'new' | 'edit',
  orderNum?: string
) {
  if (typeof window === 'undefined') return;
  const appId = localStorage.getItem('oxente_onesignal_app_id') || import.meta.env.VITE_ONESIGNAL_APP_ID;
  const restKey = localStorage.getItem('oxente_onesignal_rest_key') || import.meta.env.VITE_ONESIGNAL_REST_KEY;

  if (!appId || !restKey) {
    console.log("Vias de push em 2º plano puladas: OneSignal não está configurado completamente.");
    return;
  }

  const title = actionType === 'new' 
    ? `🛍️ Novo Pedido Recebido! ${orderNum ? `(Nº ${orderNum})` : ''}`
    : `✏️ Pedido Alterado! ${orderNum ? `(Nº ${orderNum})` : ''}`;

  const totalFormatted = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const cleanClient = clientName && clientName.trim() !== 'Consumidor' ? clientName : 'Consumidor Geral';
  const body = actionType === 'new'
    ? `Cliente: ${cleanClient}\nValor Total: ${totalFormatted}`
    : `Cliente: ${cleanClient}\nNovo Valor: ${totalFormatted}`;

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${restKey}`
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ["All"], // Sends to all active subscribers
        headings: { en: title, pt: title },
        contents: { en: body, pt: body },
        data: { activeTab: "vendas", orderNum },
        priority: 10, // high priority delivery
        ttl: 259200 // 3 days shelf life
      })
    });
    const result = await response.json();
    console.log("API OneSignal enviou push de 2º plano:", result);
  } catch (error) {
    console.error("Erro ao transmitir sinal de push ao OneSignal:", error);
  }
}


