export const OFFICIAL_SITE_URL = 'https://www.oxentefesteje.com.br';

/**
 * Gera o link oficial público de acompanhamento de pedido para envio ao cliente
 * e QR Code do recibo, garantindo o domínio oficial da loja independentemente
 * do endereço temporário de hospedagem/preview em que o painel esteja aberto.
 */
export const getOrderTrackingUrl = (saleId: string): string => {
  return `${OFFICIAL_SITE_URL}/?venda=${encodeURIComponent(saleId)}`;
};

/**
 * Gera o link oficial público de aprovação de layout para envio via WhatsApp.
 */
export const getLayoutApprovalUrl = (orderIdentifier: string): string => {
  return `${OFFICIAL_SITE_URL}/?aprovar=${encodeURIComponent(orderIdentifier)}`;
};
