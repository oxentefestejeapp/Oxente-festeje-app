// Google Ads & Google Tag Tracking Helper
// This utility handles dynamic Google Tag (gtag.js) script insertion and click event tracking.

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Initializes the Google Tag (gtag.js) for Google Ads dynamically.
 * Reads the VITE_GOOGLE_ADS_ID from the environment variables (e.g., AW-11516248981).
 */
export function initGoogleAds() {
  const adsId = import.meta.env.VITE_GOOGLE_ADS_ID || 'AW-18143769748';
  if (!adsId) {
    console.warn(
      "[Google Ads] Google Ads ID (VITE_GOOGLE_ADS_ID) não configurado no arquivo .env. O rastreamento funcionará em modo simulação."
    );
    return;
  }

  // Prevent duplicate initialization
  if (window.gtag || document.getElementById('google-ads-script')) {
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

    console.log(`[Google Ads] Inicializado com sucesso para o ID: ${adsId}`);
  } catch (error) {
    console.error("[Google Ads] Erro ao carregar os scripts do Google Tag:", error);
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
  const adsId = import.meta.env.VITE_GOOGLE_ADS_ID || 'AW-18143769748';

  if (window.gtag) {
    // 1. Custom event tracking
    window.gtag('event', action, {
      'event_category': 'Engagement',
      'event_label': label,
      'value': value
    });

    // 2. Google Ads conversion trigger if conversion labels are configured
    // Usually formatted as AW-CONVERSION_ID/CONVERSION_LABEL
    // Users can customize this dynamically or configure their Google Ads account.
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
