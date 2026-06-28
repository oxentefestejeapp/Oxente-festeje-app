// Google Ads & Google Tag Tracking Helper
// This utility handles dynamic Google Tag (gtag.js) script insertion and click event tracking.

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
    [key: string]: any;
  }
}

const DEFAULT_ADS_ID = 'AW-18143769748';

/**
 * Initializes the Google Tag (gtag.js) for Google Ads dynamically.
 * Reads the VITE_GOOGLE_ADS_ID from the environment variables or falls back to AW-18143769748.
 */
export function initGoogleAds() {
  const adsId = import.meta.env.VITE_GOOGLE_ADS_ID || DEFAULT_ADS_ID;
  if (!adsId) {
    console.warn(
      "[Google Ads] Google Ads ID (VITE_GOOGLE_ADS_ID) não configurado no arquivo .env. O rastreamento funcionará em modo simulação."
    );
    return;
  }

  // If explicitly disabled in this session, re-enable it for the landing page
  delete window[`ga-disable-${adsId}`];

  // Prevent duplicate initialization
  if (document.getElementById('google-ads-script')) {
    return;
  }

  try {
    // 1. Inject the external gtag.js library script
    const script1 = document.createElement('script');
    script1.id = 'google-ads-script';
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${adsId}`;
    document.head.appendChild(script1);

    // 2. Initialize the global dataLayer and gtag function
    const script2 = document.createElement('script');
    script2.id = 'google-ads-init';
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){window.dataLayer.push(arguments);}
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', '${adsId}', { 'page_path': window.location.pathname });
    `;
    document.head.appendChild(script2);

    console.log(`[Google Ads] Inicializado com sucesso para a página pública. ID: ${adsId}`);
  } catch (error) {
    console.error("[Google Ads] Erro ao carregar os scripts do Google Tag:", error);
  }
}

/**
 * Completely disables Google Ads and removes Google Tag elements and functions from the window.
 * This ensures the tracking code is completely disabled and inactive on internal management pages.
 */
export function disableGoogleAds() {
  const adsId = import.meta.env.VITE_GOOGLE_ADS_ID || DEFAULT_ADS_ID;
  
  // Instruct Google Tag scripts to block all data sending (standard Google API)
  window[`ga-disable-${adsId}`] = true;

  // Remove the script elements from the DOM
  const script1 = document.getElementById('google-ads-script');
  const script2 = document.getElementById('google-ads-init');
  
  if (script1) script1.remove();
  if (script2) script2.remove();

  // Clear global variables and data layers
  try {
    delete window.gtag;
    window.dataLayer = [];
    console.log("[Google Ads] Rastreamento desativado com sucesso para proteger áreas administrativas.");
  } catch (e) {
    // Fallback if delete fails
    window.gtag = undefined;
  }
}

/**
 * Sends a conversion/click event to Google Ads/Analytics.
 * Falls back to console log for easy verification during preview.
 * 
 * @param action Name of the action (e.g., 'click_whatsapp_orçamento')
 * @param label Human-friendly description of the click
 * @param value Optional conversion value (defaults to 1.0)
 */
export function trackGoogleAdsEvent(action: string, label: string, value: number = 1.0) {
  const adsId = import.meta.env.VITE_GOOGLE_ADS_ID || DEFAULT_ADS_ID;

  // Do not track if disabled
  if (window[`ga-disable-${adsId}`]) {
    console.log(`[Google Ads] Ignorando evento "${action}" pois o rastreamento está desativado.`);
    return;
  }

  if (window.gtag) {
    // 1. Custom event tracking
    window.gtag('event', action, {
      'event_category': 'Engagement',
      'event_label': label,
      'value': value
    });

    // 2. Google Ads conversion trigger
    window.gtag('event', 'conversion', {
      'send_to': `${adsId}/${action}`,
      'value': value,
      'currency': 'BRL'
    });

    console.log(`[Google Ads] Evento disparado: "${action}" (Label: ${label}, Value: ${value})`);
  } else {
    console.log(
      `[Google Ads - Simulação] Evento de clique interceptado!\n` +
      `📌 Ação: "${action}"\n` +
      `📌 Descrição: "${label}"\n` +
      `💡 (Adicione VITE_GOOGLE_ADS_ID no arquivo .env para enviar dados reais ao painel do Google Ads)`
    );
  }
}
