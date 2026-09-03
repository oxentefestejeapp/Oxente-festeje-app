/**
 * Mobile Badge & Push Notification Service for Oxente Festeje
 * 
 * Exclusively active on MOBILE devices (Android / iOS / Tablets).
 * Controls:
 * - navigator.setAppBadge() / navigator.clearAppBadge()
 * - Push Subscription with Supabase backend
 * - Local count increment on realtime sales arrival
 */

import { supabase } from './supabase';
import { playAppSound } from './audio';
import { Sale } from '../types';

const MOBILE_BADGE_STORAGE_KEY = 'oxente_mobile_unread_orders';
const PUSH_SUBSCRIBED_KEY = 'oxente_push_subscribed_endpoint';

/**
 * Checks if current runtime environment is a mobile device (phone, tablet, touch device)
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isTouchScreen = 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 1;
  const isSmallScreen = window.innerWidth <= 768;

  return isMobileUA || (isTouchScreen && isSmallScreen);
}

/**
 * Checks if App Badging API is supported by the user agent
 */
export function isBadgingSupported(): boolean {
  return typeof navigator !== 'undefined' && ('setAppBadge' in navigator || 'setExperimentalAppBadge' in (navigator as any));
}

/**
 * Requests Notification permission if not already granted (required by iOS/Android for badges and push)
 */
export async function requestMobileNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'denied';
  try {
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch (err) {
    return 'denied';
  }
}

/**
 * Sets the badge on the installed mobile app icon
 */
export async function setMobileAppBadge(count?: number, force = false): Promise<boolean> {
  // STRICT RULE: Only run on mobile devices as requested by the user, unless force is true (for testing)
  if (!force && !isMobileDevice()) return false;

  try {
    const finalCount = count !== undefined ? count : getMobileUnreadOrdersCount();
    
    if (finalCount <= 0) {
      await clearMobileAppBadge(force);
      return true;
    }

    if (typeof navigator !== 'undefined') {
      if ('setAppBadge' in navigator) {
        await (navigator as any).setAppBadge(finalCount);
        return true;
      } else if ('setExperimentalAppBadge' in (navigator as any)) {
        await (navigator as any).setExperimentalAppBadge(finalCount);
        return true;
      }
    }
  } catch (err) {
    // Badging API can fail silently if user did not install PWA or OS restricted it
    console.debug('Badge API not available or restricted on this device:', err);
  }
  return false;
}

/**
 * Clears the badge from the installed mobile app icon
 */
export async function clearMobileAppBadge(force = false): Promise<void> {
  // STRICT RULE: Only run on mobile devices unless force is true
  if (!force && !isMobileDevice()) return;

  try {
    // Reset stored unread count
    localStorage.setItem(MOBILE_BADGE_STORAGE_KEY, '0');

    if (typeof navigator !== 'undefined') {
      if ('clearAppBadge' in navigator) {
        await (navigator as any).clearAppBadge();
      } else if ('clearExperimentalAppBadge' in (navigator as any)) {
        await (navigator as any).clearExperimentalAppBadge();
      }
    }
  } catch (err) {
    console.debug('Failed to clear app badge:', err);
  }
}

/**
 * Returns current count of unread orders stored locally for badging
 */
export function getMobileUnreadOrdersCount(): number {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(MOBILE_BADGE_STORAGE_KEY);
    const num = parseInt(raw || '0', 10);
    return isNaN(num) ? 0 : Math.max(0, num);
  } catch {
    return 0;
  }
}

/**
 * Increments the unread order counter and updates the badge on mobile
 */
export async function incrementMobileOrderBadge(step = 1): Promise<number> {
  if (!isMobileDevice()) return 0;

  const current = getMobileUnreadOrdersCount();
  const next = current + step;
  try {
    localStorage.setItem(MOBILE_BADGE_STORAGE_KEY, String(next));
  } catch {}

  await setMobileAppBadge(next);
  return next;
}

/**
 * Registers Web Push subscription for this mobile device and saves it in Supabase
 */
export async function setupMobilePushSubscription(userEmail?: string): Promise<boolean> {
  // Exclusivo para Mobile
  if (!isMobileDevice()) return false;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    // Request permission if not already granted
    await requestMobileNotificationPermission();

    // Register or get active service worker registration
    const registration = await navigator.serviceWorker.ready;
    if (!registration) return false;

    // Check existing push subscription
    let subscription = await registration.pushManager.getSubscription();

    // If already subscribed and stored, return true
    const currentStoredEndpoint = localStorage.getItem(PUSH_SUBSCRIBED_KEY);
    if (subscription && currentStoredEndpoint === subscription.endpoint) {
      return true;
    }

    // Get VAPID public key from env or fallback
    const vapidPublicKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.log('Mobile Push: VAPID Key não configurada ainda no .env. Badge local operando com sucesso.');
      return false;
    }

    if (!subscription) {
      // Convert VAPID key to Uint8Array
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    if (subscription) {
      localStorage.setItem(PUSH_SUBSCRIBED_KEY, subscription.endpoint);

      // Save subscription in Supabase table `oxente_push_subscriptions`
      const deviceId = getOrCreateDeviceId();
      const payload = {
        id: deviceId,
        user_email: userEmail || 'colaborador@oxente.com',
        device_type: 'mobile',
        subscription: subscription.toJSON(),
        updated_at: new Date().toISOString()
      };

      await supabase
        .from('oxente_push_subscriptions')
        .upsert(payload, { onConflict: 'id' });

      console.log('📱 Celular registrado com sucesso para receber notificações de novos pedidos no ícone!');
      return true;
    }
  } catch (err) {
    console.warn('Não foi possível registrar Web Push móvel completo (modo local ativo):', err);
  }

  return false;
}

/**
 * Generates or retrieves a persistent unique ID for this mobile browser device
 */
function getOrCreateDeviceId(): string {
  const KEY = 'oxente_mobile_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `mob_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Helper to convert url-safe base64 string to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface BadgeDiagnosticInfo {
  isMobile: boolean;
  permission: NotificationPermission | 'unsupported';
  badgeSupported: boolean;
  serviceWorkerActive: boolean;
  currentBadgeCount: number;
}

/**
 * Returns current diagnostics of the mobile notification and badging system
 */
export function getBadgeDiagnosticInfo(): BadgeDiagnosticInfo {
  const isMobile = isMobileDevice();
  let permission: NotificationPermission | 'unsupported' = 'unsupported';
  if (typeof window !== 'undefined' && 'Notification' in window) {
    permission = Notification.permission;
  }
  const badgeSupported = isBadgingSupported();
  const serviceWorkerActive = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
  const currentBadgeCount = getMobileUnreadOrdersCount();

  return {
    isMobile,
    permission,
    badgeSupported,
    serviceWorkerActive,
    currentBadgeCount
  };
}

/**
 * Directly tests the notification and icon badging on this device
 */
export async function testLocalMobileBadgeAndNotification(badgeNumber = 1): Promise<{
  success: boolean;
  permission: string;
  badgeSet: boolean;
  notificationShown: boolean;
  message: string;
}> {
  playAppSound('success');

  // 1. Request notification permission (user gesture context)
  const perm = await requestMobileNotificationPermission();

  // 2. Set the badge directly
  localStorage.setItem(MOBILE_BADGE_STORAGE_KEY, String(badgeNumber));
  const badgeSet = await setMobileAppBadge(badgeNumber, true);

  // 3. Show native push/system notification
  let notificationShown = false;
  try {
    const title = '🛍️ NOVO PEDIDO #TESTE-999';
    const body = 'Cliente: Maria Silva (R$ 150,00) - Teste de Notificação Oxente Festeje!';
    const options: any = {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'test-order-badge-alert',
      vibrate: [250, 100, 250],
      requireInteraction: false
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, options);
        notificationShown = true;
      }
    }

    if (!notificationShown && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, options);
      notificationShown = true;
    }
  } catch (err) {
    console.warn('Falha ao emitir notificação nativa de teste:', err);
  }

  return {
    success: badgeSet || notificationShown || perm === 'granted',
    permission: perm,
    badgeSet,
    notificationShown,
    message: perm === 'granted'
      ? 'Notificação e selo disparados! Minimize o app ou vá para a tela inicial do celular para ver o ícone atualizado.'
      : 'Atenção: A permissão de notificações do navegador precisa ser permitida para exibir o banner e o selo no celular.'
  };
}

/**
 * Sends a real test order into Supabase, triggering both Database Webhook and Realtime Postgres sync
 */
export async function sendFakeTestOrderViaSupabase(): Promise<{
  success: boolean;
  saleId?: string;
  orderNumber?: string;
  error?: string;
}> {
  const fakeId = `teste_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fakeOrderNumber = `TESTE-${Math.floor(Math.random() * 900 + 100)}`;

  const testSale: any = {
    id: fakeId,
    cliente: '🧪 Teste Notificação Webhook',
    telefone_cliente: '(00) 99999-9999',
    total: 89.90,
    forma_pagamento: 'Pix',
    data: new Date().toISOString(),
    numero_pedido: fakeOrderNumber,
    status: 'Confirmado',
    criado_por_email: 'teste_webhook@oxente.com',
    notas_internas: 'Pedido simulado para teste de Webhook e Notificação Mobile',
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('oxente_sales').upsert(testSale);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, saleId: fakeId, orderNumber: fakeOrderNumber };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Deletes a fake test order created for testing from Supabase
 */
export async function deleteFakeTestOrderViaSupabase(saleId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('oxente_sales').delete().eq('id', saleId);
    return !error;
  } catch {
    return false;
  }
}
