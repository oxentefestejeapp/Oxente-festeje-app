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
 * Internal custom Speech Queue to ensure sequential voice announcements
 * without skipping, overriding, or triggering the Chrome browser stuck bug.
 */
interface QueuedSpeech {
  message: string;
}

const speechQueue: QueuedSpeech[] = [];
let isSpeaking = false;
let queueTimeoutId: any = null;
let activeUtterance: SpeechSynthesisUtterance | null = null; // Essential fix for the Chrome Garbage Collector bug!

function processSpeechQueue() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  // Real-time engine healthcheck: if the browser is not actually speaking,
  // we must reset our custom locked flag to avoid deadlocks.
  if (isSpeaking && !window.speechSynthesis.speaking) {
    isSpeaking = false;
  }
  
  if (isSpeaking) return;
  if (speechQueue.length === 0) return;

  const nextItem = speechQueue.shift();
  if (!nextItem) return;

  try {
    isSpeaking = true;
    
    // Always wake up/resume synthesis in Chrome or Safari before speaking
    window.speechSynthesis.resume();

    const utterance = new SpeechSynthesisUtterance(nextItem.message);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05; // Slightly faster to sound crisp
    utterance.pitch = 1.0;  // Natural pitch

    // Store in global/module scope to completely prevent browser garbage collection of callbacks
    activeUtterance = utterance;

    // Find proper Brazilian Portuguese voice if available
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    // Safeguard: reset isSpeaking after 8 seconds if browser fails to trigger onend/onerror
    const safetyTimeout = setTimeout(() => {
      console.warn('Limite de segurança da síntese de voz atingido.');
      isSpeaking = false;
      activeUtterance = null;
      processSpeechQueue();
    }, 8000);

    const onSpeechEnd = () => {
      clearTimeout(safetyTimeout);
      isSpeaking = false;
      activeUtterance = null;
      
      // Brief, pleasant pause between announcements so they sound distinct
      if (queueTimeoutId) clearTimeout(queueTimeoutId);
      queueTimeoutId = setTimeout(() => {
        processSpeechQueue();
      }, 350);
    };

    utterance.onend = onSpeechEnd;
    utterance.onerror = (e) => {
      console.warn('Erro de evento na síntese de voz:', e);
      onSpeechEnd();
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Erro ao reproduzir fala da fila:', err);
    isSpeaking = false;
    activeUtterance = null;
    if (queueTimeoutId) clearTimeout(queueTimeoutId);
    queueTimeoutId = setTimeout(() => {
      processSpeechQueue();
    }, 350);
  }
}

function queueVoiceSpeech(message: string) {
  if (!isTtsEnabled()) return;
  speechQueue.push({ message });

  // If the browser is definitely not speaking right now, heal state
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    if (!window.speechSynthesis.speaking) {
      isSpeaking = false;
    }
  }

  processSpeechQueue();
}

/**
 * Synthesizes speech to speak out loud when a new order comes in.
 */
export function announceNewSaleVoice(clientName: string, total: number) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const formattedTotal = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const cleanClient = clientName && clientName.trim() !== 'Consumidor' ? clientName : 'Consumidor Geral';
    
    // Warm and friendly audio copy in Portuguese
    const msg = `Novo pedido de ${cleanClient}! No valor de ${formattedTotal}!`;
    
    queueVoiceSpeech(msg);
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

    const formattedTotal = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const cleanClient = clientName && clientName.trim() !== 'Consumidor' ? clientName : 'Consumidor Geral';
    
    // Warm and friendly audio copy in Portuguese
    const msg = `Pedido de ${cleanClient} foi alterado! Novo valor de ${formattedTotal}!`;
    
    queueVoiceSpeech(msg);
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

