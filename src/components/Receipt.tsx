/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Calendar, 
  User, 
  CreditCard, 
  ShoppingBag, 
  Eye, 
  MessageSquare, 
  Pencil, 
  QrCode,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
  Sliders,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { Sale, StoreInfo } from '../types';
import { WhatsAppNotifier } from './WhatsAppNotifier';
import { playAppSound } from '../lib/audio';

interface ReceiptProps {
  sale: Sale;
  storeInfo: StoreInfo;
  onUpdateSale?: (updatedSale: Sale) => void;
  onEdit?: () => void;
  products?: any[];
}

export function Receipt({ sale, storeInfo, onUpdateSale, onEdit, products }: ReceiptProps) {
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>('Pix');
  const [paidValue, setPaidValue] = useState<string>('');
  const [pickupDate, setPickupDate] = useState<string>(sale.dataRetirada || '');
  const [confirmForce, setConfirmForce] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  
  // Printing settings & states: 'a4' (Impressora Normal / Folha A4), '80mm' (Térmica 80mm), '58mm' (Térmica 58mm)
  const [receiptFormat, setReceiptFormat] = useState<'a4' | '80mm' | '58mm'>(() => {
    return (localStorage.getItem('oxente_receipt_format') as 'a4' | '80mm' | '58mm') || '80mm';
  });
  const [copiedReceiptText, setCopiedReceiptText] = useState(false);
  const [showPrinterHelp, setShowPrinterHelp] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sale || sale.status === 'Orçamento') return;
    const trackingUrl = `${window.location.origin}${window.location.pathname}?venda=${sale.id}`;
    QRCode.toDataURL(
      trackingUrl,
      {
        margin: 1,
        width: 140,
        color: { dark: '#000000', light: '#ffffff' }
      },
      (err, url) => {
        if (!err) {
          setQrCodeUrl(url);
        } else {
          console.warn('Erro ao gerar QR Code para o recibo:', err);
        }
      }
    );
  }, [sale.id, sale.status]);

  const handleFormatChange = (format: 'a4' | '80mm' | '58mm') => {
    setReceiptFormat(format);
    localStorage.setItem('oxente_receipt_format', format);
    playAppSound('click');
  };

  // Helper to extract items from sale
  const getSaleItems = (s: Sale): { produtoId: string; quantidade: number; produtoNome: string }[] => {
    if (s.itens && s.itens.length > 0) {
      return s.itens.map(item => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade || 0,
        produtoNome: item.produtoNome
      }));
    }
    if (s.produtoId) {
      return [{
        produtoId: s.produtoId,
        quantidade: s.quantidade || 0,
        produtoNome: s.produtoNome || 'Produto'
      }];
    }
    return [];
  };

  // Generate isolated clean HTML for thermal OR normal A4/A5 printer
  const generateCleanPrintHtml = () => {
    const formattedD = new Date(sale.data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const isOrcamento = sale.status === 'Orçamento';
    const valorPagoCalc = sale.valorPago !== undefined ? sale.valorPago : sale.total;
    const valorFaltanteCalc = sale.valorFaltante !== undefined ? sale.valorFaltante : 0;
    const formattedRetirada = sale.dataRetirada ? new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : '';

    // ==========================================
    // 1. IMPRESSORA NORMAL (FOLHA A4 / A5)
    // ==========================================
    if (receiptFormat === 'a4') {
      let a4ItemsRows = '';
      if (sale.itens && sale.itens.length > 0) {
        a4ItemsRows = sale.itens.map((item, idx) => `
          <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 10px 14px; vertical-align: middle;">
              <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.produtoNome}</div>
              ${item.corSelecionada ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Cor: <strong>${item.corSelecionada}</strong></div>` : ''}
            </td>
            <td style="padding: 10px 14px; text-align: center; font-size: 13px; color: #334155;">R$ ${item.precoUn.toFixed(2)}</td>
            <td style="padding: 10px 14px; text-align: center; font-weight: 700; font-size: 13px; color: #0f172a;">${item.quantidade}</td>
            <td style="padding: 10px 14px; text-align: right; font-weight: 700; font-size: 13px; color: #0f172a;">R$ ${item.total.toFixed(2)}</td>
          </tr>
        `).join('');
      } else {
        a4ItemsRows = `
          <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
            <td style="padding: 10px 14px; vertical-align: middle;">
              <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${sale.produtoNome}</div>
              ${sale.corSelecionada ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Cor: <strong>${sale.corSelecionada}</strong></div>` : ''}
            </td>
            <td style="padding: 10px 14px; text-align: center; font-size: 13px; color: #334155;">R$ ${sale.precoUn.toFixed(2)}</td>
            <td style="padding: 10px 14px; text-align: center; font-weight: 700; font-size: 13px; color: #0f172a;">${sale.quantidade}</td>
            <td style="padding: 10px 14px; text-align: right; font-weight: 700; font-size: 13px; color: #0f172a;">R$ ${sale.total.toFixed(2)}</td>
          </tr>
        `;
      }

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${isOrcamento ? 'Orcamento' : 'Recibo'}_${sale.numeroPedido || sale.id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff !important;
      font-size: 12px;
      line-height: 1.5;
      padding: 0;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 24px;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .badge-doc {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 13px;
      text-transform: uppercase;
      background: ${isOrcamento ? '#fef3c7' : '#ecfdf5'};
      color: ${isOrcamento ? '#92400e' : '#065f46'};
      border: 1px solid ${isOrcamento ? '#fde68a' : '#a7f3d0'};
    }
    .grid-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }
    .info-item {
      font-size: 12px;
      color: #334155;
    }
    .info-item strong {
      color: #0f172a;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      padding: 10px 14px;
      border-bottom: 1px solid #cbd5e1;
    }
    .totals-box {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 20px;
    }
    .totals-table {
      width: 320px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
    }
    .grand-total {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      margin-top: 4px;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #64748b;
    }
    .qr-side {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .qr-side img {
      width: 65px;
      height: 65px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 2px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="company-title">${storeInfo.nome || 'OXENTE FESTEJE'}</div>
        <div style="font-size: 12px; color: #475569; font-weight: 600;">Brindes & Lembrancinhas Personalizadas</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">CNPJ: 26.051.478/0001-34 • Tel/WhatsApp: (83) 98885-9302</div>
        <div style="font-size: 11px; color: #64748b;">Instagram: ${storeInfo.instagram || '@oxentefesteje'}</div>
      </div>
      <div style="text-align: right;">
        <div class="badge-doc">${isOrcamento ? '📄 ORÇAMENTO / PROPOSTA' : 'COMPROVANTE DE PEDIDO'}</div>
        <div style="font-size: 16px; font-weight: 800; margin-top: 6px; color: #0f172a;">${sale.numeroPedido ? '#' + sale.numeroPedido : 'Orçamento'}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Emissão: ${formattedD}</div>
      </div>
    </div>

    <div class="grid-info">
      <div>
        <div class="info-item"><strong>Cliente:</strong> ${sale.cliente}</div>
        ${sale.telefoneCliente ? `<div class="info-item" style="margin-top: 4px;"><strong>Telefone:</strong> ${sale.telefoneCliente}</div>` : ''}
      </div>
      <div>
        <div class="info-item"><strong>Forma de Pagamento:</strong> ${sale.formaPagamento}</div>
        ${formattedRetirada ? `<div class="info-item" style="margin-top: 4px;"><strong>Data de Retirada/Entrega:</strong> ${formattedRetirada}</div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Descrição do Item / Produto</th>
          <th style="text-align: center; width: 100px;">Valor Un.</th>
          <th style="text-align: center; width: 80px;">Qtd</th>
          <th style="text-align: right; width: 110px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${a4ItemsRows}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="totals-table">
        <div class="total-row">
          <span>Subtotal:</span>
          <strong>R$ ${sale.total.toFixed(2)}</strong>
        </div>
        ${sale.descontoReferral ? `
          <div class="total-row" style="color: #059669;">
            <span>Cupom Indicação:</span>
            <strong>- R$ ${sale.descontoReferral.toFixed(2)}</strong>
          </div>
        ` : ''}
        ${sale.descontoValor ? `
          <div class="total-row" style="color: #059669;">
            <span>Desconto Especial${sale.descontoPercent ? ` (${sale.descontoPercent}%)` : ''}:</span>
            <strong>- R$ ${sale.descontoValor.toFixed(2)}</strong>
          </div>
        ` : ''}
        ${sale.cashbackGasto ? `
          <div class="total-row" style="color: #059669;">
            <span>Cashback Usado:</span>
            <strong>- R$ ${sale.cashbackGasto.toFixed(2)}</strong>
          </div>
        ` : ''}
        <div class="total-row grand-total">
          <span>${isOrcamento ? 'VALOR ESTIMADO:' : 'TOTAL GERAL:'}</span>
          <span>R$ ${sale.total.toFixed(2)}</span>
        </div>
        ${!isOrcamento ? `
          <div class="total-row" style="margin-top: 4px;">
            <span>Valor Pago / Entrada:</span>
            <strong>R$ ${valorPagoCalc.toFixed(2)}</strong>
          </div>
          ${valorFaltanteCalc > 0 ? `
            <div class="total-row" style="color: #dc2626; font-weight: 700;">
              <span>Restante na Retirada:</span>
              <span>R$ ${valorFaltanteCalc.toFixed(2)}</span>
            </div>
          ` : `
            <div class="total-row" style="color: #059669; font-weight: 700;">
              <span>Status Financeiro:</span>
              <span>PAGO INTEGRALMENTE</span>
            </div>
          `}
        ` : ''}
      </div>
    </div>

    <div class="footer">
      <div>
        ${isOrcamento ? `
          <div style="font-weight: 700; color: #92400e;">* Proposta válida por 15 dias. Valores sujeitos a confirmação de disponibilidade de estoque.</div>
        ` : `
          <div style="font-weight: 700; color: #0f172a;">Agradecemos pela preferência e confiança em nosso trabalho!</div>
        `}
        <div style="color: #64748b; margin-top: 2px;">Para dúvidas ou alterações, entre em contato pelo nosso WhatsApp comercial.</div>
      </div>
      ${!isOrcamento && qrCodeUrl ? `
        <div class="qr-side">
          <div style="text-align: right;">
            <div style="font-weight: 700; font-size: 10px; color: #0f172a; text-transform: uppercase;">Acompanhe o Pedido</div>
            <div style="font-size: 9px; color: #64748b;">Escaneie a câmera aqui</div>
          </div>
          <img src="${qrCodeUrl}" alt="QR Code" />
        </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`;
    }

    // ==========================================
    // 2. IMPRESSORA TÉRMICA (80mm ou 58mm)
    // ==========================================
    const is58 = receiptFormat === '58mm';
    const thermalPaperWidth = is58 ? '58mm' : '80mm';
    const maxWidthCss = is58 ? '48mm' : '72mm';
    const fontSizeCss = is58 ? '10px' : '11.5px';

    let itemsRowsHtml = '';
    if (sale.itens && sale.itens.length > 0) {
      itemsRowsHtml = sale.itens.map(item => `
        <tr style="border-bottom: 1px dashed #000;">
          <td style="padding: 4px 0; vertical-align: top;">
            <div style="font-weight: bold;">${item.produtoNome}</div>
            ${item.corSelecionada ? `<div style="font-size: 8.5px;">Cor: ${item.corSelecionada}</div>` : ''}
            <div style="font-size: 8.5px;">Un: R$ ${item.precoUn.toFixed(2)}</div>
          </td>
          <td style="padding: 4px 0; text-align: center; vertical-align: top; font-weight: bold;">${item.quantidade}</td>
          <td style="padding: 4px 0; text-align: right; vertical-align: top; font-weight: bold;">R$ ${item.total.toFixed(2)}</td>
        </tr>
      `).join('');
    } else {
      itemsRowsHtml = `
        <tr style="border-bottom: 1px dashed #000;">
          <td style="padding: 4px 0; vertical-align: top;">
            <div style="font-weight: bold;">${sale.produtoNome}</div>
            ${sale.corSelecionada ? `<div style="font-size: 8.5px;">Cor: ${sale.corSelecionada}</div>` : ''}
            <div style="font-size: 8.5px;">Un: R$ ${sale.precoUn.toFixed(2)}</div>
          </td>
          <td style="padding: 4px 0; text-align: center; vertical-align: top; font-weight: bold;">${sale.quantidade}</td>
          <td style="padding: 4px 0; text-align: right; vertical-align: top; font-weight: bold;">R$ ${sale.total.toFixed(2)}</td>
        </tr>
      `;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${isOrcamento ? 'Orcamento' : 'Recibo'}_${sale.numeroPedido || sale.id}</title>
  <style>
    @page {
      margin: 0 !important;
      size: ${thermalPaperWidth} auto;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      color: #000000 !important;
      background: transparent !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
      font-size: ${fontSizeCss};
      line-height: 1.35;
      background-color: #ffffff !important;
      padding: 6px 8px;
      width: ${maxWidthCss};
      margin: 0 auto;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .divider { border-top: 1.5px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: ${fontSizeCss}; }
    th { border-top: 1.5px dashed #000; border-bottom: 1.5px dashed #000; padding: 4px 0; font-weight: bold; text-align: left; }
    .qr-container { text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1.5px dashed #000; }
    .qr-img { width: ${is58 ? '85px' : '110px'}; height: ${is58 ? '85px' : '110px'}; margin: 4px auto 0 auto; display: block; }
  </style>
</head>
<body>
  ${isOrcamento ? '<div class="text-center font-bold" style="border: 1.5px solid #000; padding: 2px; margin-bottom: 6px; font-size: 10px;">PROPOSTA / ORÇAMENTO</div>' : ''}
  <div class="text-center">
    <div style="font-size: 14px; font-weight: 900; text-transform: uppercase;">${storeInfo.nome || 'OXENTE FESTEJE'}</div>
    <div style="font-size: 9px; font-weight: bold; text-transform: uppercase;">Brindes Personalizados</div>
    <div style="font-size: 9px;">CNPJ: 26.051.478/0001-34</div>
    <div style="font-size: 9px;">Tel: (83) 98885-9302</div>
  </div>

  <div class="divider"></div>

  <div class="row">
    <span>${sale.numeroPedido ? 'Nº Pedido:' : 'Doc:'}</span>
    <span class="font-bold">${sale.numeroPedido ? '#' + sale.numeroPedido : 'Orçamento'}</span>
  </div>
  <div class="row">
    <span>Data:</span>
    <span>${formattedD}</span>
  </div>
  <div class="row">
    <span>Cliente:</span>
    <span class="font-bold">${sale.cliente}</span>
  </div>
  ${sale.telefoneCliente ? `<div class="row"><span>Telefone:</span><span>${sale.telefoneCliente}</span></div>` : ''}
  <div class="row">
    <span>Pagamento:</span>
    <span class="font-bold">${sale.formaPagamento}</span>
  </div>
  ${sale.dataRetirada ? `
    <div class="row">
      <span>Retirada:</span>
      <span class="font-bold" style="border-bottom: 1px solid #000;">${new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
    </div>
  ` : ''}

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align: center;">Qtd</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRowsHtml}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="row">
    <span>${isOrcamento ? 'VALOR ESTIMADO:' : 'TOTAL GERAL:'}</span>
    <span class="font-bold" style="font-size: 13px;">R$ ${sale.total.toFixed(2)}</span>
  </div>

  ${sale.descontoReferral ? `
    <div class="row">
      <span>Cupom Amigo:</span>
      <span class="font-bold">- R$ ${sale.descontoReferral.toFixed(2)}</span>
    </div>
  ` : ''}

  ${sale.descontoValor ? `
    <div class="row">
      <span>Desconto Especial${sale.descontoPercent ? ` (${sale.descontoPercent}%)` : ''}:</span>
      <span class="font-bold">- R$ ${sale.descontoValor.toFixed(2)}</span>
    </div>
  ` : ''}

  ${sale.cashbackGasto ? `
    <div class="row">
      <span>Cashback Usado:</span>
      <span class="font-bold">- R$ ${sale.cashbackGasto.toFixed(2)}</span>
    </div>
  ` : ''}

  ${!isOrcamento ? `
    <div class="row">
      <span>Valor Pago:</span>
      <span class="font-bold">R$ ${valorPagoCalc.toFixed(2)}</span>
    </div>
    ${valorFaltanteCalc > 0 ? `
      <div class="row" style="border-top: 1px dashed #000; padding-top: 3px; margin-top: 2px;">
        <span class="font-bold">RESTANTE A PAGAR:</span>
        <span class="font-bold" style="font-size: 13px;">R$ ${valorFaltanteCalc.toFixed(2)}</span>
      </div>
    ` : `
      <div class="row" style="border-top: 1px dashed #000; padding-top: 3px; margin-top: 2px;">
        <span>Status:</span>
        <span class="font-bold">Pago Integralmente</span>
      </div>
    `}
  ` : ''}

  <div class="divider"></div>

  <div class="text-center" style="margin-top: 6px;">
    ${isOrcamento ? `
      <div style="font-size: 9px; font-weight: bold; border: 1px solid #000; padding: 3px; margin-bottom: 4px;">
        Proposta válida por 15 dias.<br/>Sujeito a alteração de estoque.
      </div>
    ` : `
      <div class="font-bold" style="font-size: 11px;">Muito obrigado pela preferência!</div>
    `}
    <div style="font-size: 9px; margin-top: 2px;">Instagram: ${storeInfo.instagram || '@oxentefesteje'}</div>
  </div>

  ${!isOrcamento && qrCodeUrl ? `
    <div class="qr-container">
      <div style="font-size: 9px; font-weight: bold; text-transform: uppercase;">Acompanhe seu Pedido</div>
      <img src="${qrCodeUrl}" class="qr-img" alt="QR Code Rastreio" />
    </div>
  ` : ''}
</body>
</html>`;
  };

  // 1. Direct Isolated Iframe Printing Engine (Works seamlessly without page css interference)
  const handleDirectPrint = () => {
    try {
      setIsPrinting(true);
      playAppSound('click');

      const printHtml = generateCleanPrintHtml();

      // Remove any existing print iframe
      const oldFrame = document.getElementById('oxente_print_iframe');
      if (oldFrame) {
        oldFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'oxente_print_iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc) {
        throw new Error('Não foi possível acessar o contexto de impressão.');
      }

      frameDoc.open();
      frameDoc.write(printHtml);
      frameDoc.close();

      // Wait for QR code image and fonts to load inside iframe before triggering print
      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.warn('Iframe print failed, falling back to window.print():', err);
          window.print();
        } finally {
          setIsPrinting(false);
          setTimeout(() => {
            iframe.remove();
          }, 3000);
        }
      };

      if (iframe.contentWindow) {
        iframe.contentWindow.onload = () => {
          setTimeout(triggerPrint, 350);
        };
      } else {
        setTimeout(triggerPrint, 500);
      }
    } catch (e) {
      console.error('Erro na impressão direta:', e);
      setIsPrinting(false);
      window.print();
    }
  };

  // 2. Open in New Tab Printing Fallback (For browsers or webviews where iframes are sandboxed)
  const handleOpenInNewTabPrint = () => {
    try {
      playAppSound('click');
      const printHtml = generateCleanPrintHtml();
      const newWin = window.open('', '_blank', 'width=460,height=750,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes');
      if (newWin) {
        newWin.document.open();
        newWin.document.write(printHtml);
        newWin.document.close();
        newWin.onload = () => {
          setTimeout(() => {
            newWin.focus();
            newWin.print();
          }, 400);
        };
      } else {
        alert('O navegador bloqueou a abertura da nova janela. Permita pop-ups para este site ou utilize o botão "Imprimir Recibo".');
      }
    } catch (err) {
      console.error('Erro ao abrir nova aba para impressão:', err);
      handleDirectPrint();
    }
  };

  // 3. Copy Plain Text Receipt (for Bluetooth thermal printer apps like RawBT or WhatsApp)
  const handleCopyTextReceipt = () => {
    const isOrcamento = sale.status === 'Orçamento';
    const numPed = sale.numeroPedido || sale.id.substring(0, 5);
    const tel = sale.telefoneCliente || 'Não informado';
    const pagou = (sale.valorPago !== undefined ? sale.valorPago : sale.total).toFixed(2);
    const falta = (sale.valorFaltante !== undefined ? sale.valorFaltante : 0).toFixed(2);
    const entrega = sale.dataRetirada 
      ? new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') 
      : 'Não cadastrada';

    let produtosTexto = '';
    if (sale.itens && sale.itens.length > 0) {
      produtosTexto = sale.itens.map(item => `• ${item.produtoNome} (x${item.quantidade}) - R$ ${item.total.toFixed(2)}`).join('\n');
    } else {
      produtosTexto = `• ${sale.produtoNome} (x${sale.quantidade}) - R$ ${sale.total.toFixed(2)}`;
    }

    const receiptText = `================================
${storeInfo.nome || 'OXENTE FESTEJE'}
Brindes Personalizados
CNPJ: 26.051.478/0001-34
Tel: (83) 98885-9302
================================
${isOrcamento ? '📄 ORÇAMENTO / COTAÇÃO' : `RECIBO DE PEDIDO #${numPed}`}
Data: ${new Date(sale.data).toLocaleString('pt-BR')}
Cliente: ${sale.cliente}
Telefone: ${tel}
Pagamento: ${sale.formaPagamento}
Retirada: ${entrega}
--------------------------------
ITENS:
${produtosTexto}
--------------------------------
TOTAL GERAL: R$ ${sale.total.toFixed(2)}
${!isOrcamento ? `Valor Pago: R$ ${pagou}\nRestante a Pagar: R$ ${falta}` : ''}
================================
Muito obrigado pela preferência!
Instagram: ${storeInfo.instagram || '@oxentefesteje'}
================================`;

    navigator.clipboard.writeText(receiptText);
    playAppSound('success');
    setCopiedReceiptText(true);
    setTimeout(() => setCopiedReceiptText(false), 2500);
  };

  const handleSendWhatsAppOrcamento = () => {
    const cleanPhone = (sale.telefoneCliente || '').replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.length > 0) {
      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        finalPhone = `55${cleanPhone}`;
      }
    }

    let itensDetail = '';
    if (sale.itens && sale.itens.length > 0) {
      itensDetail = sale.itens.map(item => `• ${item.produtoNome} (x${item.quantidade}) - R$ ${item.total.toFixed(2)}`).join('\n');
    } else {
      itensDetail = `• ${sale.produtoNome} (x${sale.quantidade}) - R$ ${sale.total.toFixed(2)}`;
    }

    const message = `Olá, *${sale.cliente || 'Consumidor'}*! Segue o seu orçamento solicitado da *${storeInfo.nome || 'Oxente Festeje'}* 📄🎈\n\n*Item(ns) orçado(s):*\n${itensDetail}\n\n*Valor Total:* R$ ${sale.total.toFixed(2)}\n*Forma de Pagamento sugerida:* ${sale.formaPagamento}\n\nCaso queira aprovar este orçamento e iniciar o seu pedido, é só mandar uma mensagem por aqui! Trabalhamos com 50% de entrada.\nFicaremos muito felizes em atendê-lo(a). 😊✨`;

    const encodedText = encodeURIComponent(message);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    let destUrl = '';
    if (finalPhone) {
      if (isMobile) {
        destUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`;
      } else {
        destUrl = `whatsapp://send?phone=${finalPhone}&text=${encodedText}`;
      }
    } else {
      if (isMobile) {
        destUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
      } else {
        destUrl = `whatsapp://send?text=${encodedText}`;
      }
    }
    
    window.open(destUrl, '_blank');
  };

  const formattedDate = new Date(sale.data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-white rounded-2xl border border-pink-100 p-6 shadow-xs flex flex-col items-center w-full"
    >
      
      {/* Title with printable warning info and Width Toggle */}
      <div className="no-print text-center mb-5 w-full">
        <h3 className="font-display font-semibold text-lg text-brand-dark mb-1">
          {sale.status === 'Orçamento' ? 'Visualização do Orçamento' : 'Visualização do Recibo'}
        </h3>
        <p className="text-xs text-zinc-500 mb-3">
          Escolha o tipo de impressora e imprima diretamente ou compartilhe.
        </p>

        {/* Printer format selector (Impressora Normal A4 vs Térmica 80mm vs Térmica 58mm) */}
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 p-1.5 bg-zinc-100 border border-zinc-200 rounded-xl text-xs">
          <span className="text-[10px] font-bold text-zinc-600 px-1 uppercase flex items-center gap-1">
            <Sliders className="h-3 w-3" />
            <span>Impressora:</span>
          </span>
          <button
            type="button"
            onClick={() => handleFormatChange('a4')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
              receiptFormat === 'a4'
                ? 'bg-brand-pink text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 bg-white/70'
            }`}
          >
            <FileText className="h-3 w-3" />
            <span>Normal (A4 / A5)</span>
          </button>
          <button
            type="button"
            onClick={() => handleFormatChange('80mm')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
              receiptFormat === '80mm'
                ? 'bg-brand-pink text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 bg-white/70'
            }`}
          >
            <Printer className="h-3 w-3" />
            <span>Térmica (80mm)</span>
          </button>
          <button
            type="button"
            onClick={() => handleFormatChange('58mm')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
              receiptFormat === '58mm'
                ? 'bg-brand-pink text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 bg-white/70'
            }`}
          >
            <Printer className="h-3 w-3" />
            <span>Térmica (58mm)</span>
          </button>
        </div>
      </div>

      {/* Styled Simulated Receipt Container */}
      <div 
        id="printable-receipt"
        ref={receiptRef}
        className={`printable-receipt border bg-white shadow-none text-black relative select-text transition-all ${
          receiptFormat === 'a4' 
            ? 'p-6 max-w-xl text-xs rounded-xl border-zinc-300 font-sans' 
            : receiptFormat === '58mm'
              ? 'p-4 max-w-[280px] text-[11px] border-black font-mono'
              : 'p-6 max-w-sm text-xs border-black font-mono'
        } w-full`}
        style={{ 
          fontFamily: receiptFormat === 'a4' ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" : "'JetBrains Mono', 'Courier New', Courier, monospace", 
          color: '#000000' 
        }}
      >
        {/* Receipt Header */}
        <div className="text-center space-y-1 mb-4 select-none">
          {sale.status === 'Orçamento' && (
            <div className="bg-amber-100 border border-amber-350 text-amber-950 py-1.5 px-3 rounded-lg font-bold text-[10px] uppercase mb-4 text-center tracking-wider">
              📄 Orçamento / Cotação
            </div>
          )}
          <h2 className={`font-extrabold tracking-tight text-black select-text ${receiptFormat === '58mm' ? 'text-lg' : receiptFormat === 'a4' ? 'text-2xl' : 'text-xl'}`}>
            {storeInfo.nome || 'OXENTE FESTEJE'}
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-black font-bold select-text">Brindes Personalizados</p>
          <p className="text-[10px] text-black font-bold select-text">CNPJ: 26.051.478/0001-34</p>
          <p className="text-[10px] text-black font-bold select-text">Telefone: (83) 98885-9302</p>
          <div className="border-t-2 border-dashed border-black my-2"></div>
        </div>

        {/* Sales Meta Information */}
        <div className="space-y-1.5 mb-4 leading-relaxed text-black">
          {sale.numeroPedido ? (
            <div className="flex justify-between">
              <span className="text-black font-bold uppercase select-none">Nº Pedido:</span>
              <span className="font-extrabold text-right select-text text-black">#{sale.numeroPedido}</span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span className="text-black font-bold uppercase select-none">Documento:</span>
              <span className="font-extrabold text-right select-text text-amber-600 uppercase">Orçamento</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-black font-bold uppercase select-none">Data/Hora:</span>
            <span className="font-bold text-right select-text">{formattedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-black font-bold uppercase select-none">Cliente:</span>
            <span className="font-bold text-right select-text">{sale.cliente}</span>
          </div>
          {sale.telefoneCliente && (
            <div className="flex justify-between">
              <span className="text-black font-bold uppercase select-none">Tel Cliente:</span>
              <span className="font-bold text-right select-text">{sale.telefoneCliente}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-black font-bold uppercase select-none">
              {sale.status === 'Orçamento' ? 'Forma Sugerida:' : 'Pagamento:'}
            </span>
            <span className="font-extrabold text-right select-text text-black">{sale.formaPagamento}</span>
          </div>
          {sale.dataRetirada && (
            <div className="flex justify-between text-black">
              <span className="text-black font-bold uppercase select-none">
                {sale.status === 'Orçamento' ? 'Prazo Pretendido:' : 'Retirada:'}
              </span>
              <span className="font-extrabold text-right select-text text-black border-b border-black">
                {new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>

        {/* Items Breakdown Table */}
        <table className="w-full border-collapse text-black">
          <thead>
            <tr className="border-y-2 border-dashed border-black text-black uppercase font-extrabold text-left select-none">
              <th className="py-2 animate-none">Item</th>
              <th className="py-2 text-center">Qtd</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.itens && sale.itens.length > 0 ? (
              sale.itens.map((item, idx) => (
                <tr key={idx} className="border-b border-dashed border-black/60">
                  <td className="py-2 max-w-[150px] break-words align-top select-text">
                    <span className="font-bold text-black">{item.produtoNome}</span>
                    {item.corSelecionada && (
                      <span className="block text-[9px] text-black font-semibold">Cor: {item.corSelecionada}</span>
                    )}
                    <span className="block text-[9px] text-black font-normal">Preço Un: R$ {item.precoUn.toFixed(2)}</span>
                  </td>
                  <td className="py-2 text-center align-top select-text font-bold text-black">{item.quantidade}</td>
                  <td className="py-2 text-right align-top select-text font-extrabold text-black">R$ {item.total.toFixed(2)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-dashed border-black/60">
                <td className="py-2.5 max-w-[150px] break-words align-top select-text">
                  <span className="font-bold text-black">{sale.produtoNome}</span>
                  {sale.corSelecionada && (
                    <span className="block text-[9px] text-black font-semibold">Cor: {sale.corSelecionada}</span>
                  )}
                  <span className="block text-[9px] text-black font-normal">Preço Un: R$ {sale.precoUn.toFixed(2)}</span>
                </td>
                <td className="py-2.5 text-center align-top select-text font-bold text-black">{sale.quantidade}</td>
                <td className="py-2.5 text-right align-top select-text font-extrabold text-black">R$ {sale.total.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pricing Subtotal & Payment Breakdown */}
        <div className="border-t-2 border-dashed border-black mt-4 pt-3 space-y-1 bg-white select-text text-black">
          <div className="flex justify-between items-center text-black font-bold">
            <span className="select-none uppercase text-[10px]">
              {sale.status === 'Orçamento' ? 'Valor Estimado:' : 'Total Geral:'}
            </span>
            <span className="font-extrabold">R$ {sale.total.toFixed(2)}</span>
          </div>
          {sale.descontoReferral && (
            <div className="flex justify-between items-center text-black font-bold border-t border-dashed border-black/45 pt-1">
              <span className="select-none uppercase text-[10px]">Cupom Amigo:</span>
              <span className="font-extrabold">- R$ {sale.descontoReferral.toFixed(2)}</span>
            </div>
          )}
          {sale.descontoValor && (
            <div className="flex justify-between items-center text-black font-bold border-t border-dashed border-black/45 pt-1">
              <span className="select-none uppercase text-[10px]">Desconto{sale.descontoPercent ? ` (${sale.descontoPercent}%)` : ''}:</span>
              <span className="font-extrabold">- R$ {sale.descontoValor.toFixed(2)}</span>
            </div>
          )}
          {sale.cashbackGasto && (
            <div className="flex justify-between items-center text-black font-bold border-t border-dashed border-black/45 pt-1">
              <span className="select-none uppercase text-[10px]/relaxed">Cashback Usado:</span>
              <span className="font-extrabold">- R$ {sale.cashbackGasto.toFixed(2)}</span>
            </div>
          )}
          {sale.status !== 'Orçamento' && (
            <>
              <div className="flex justify-between items-center text-black font-bold">
                <span className="select-none uppercase text-[10px]">Valor Pago:</span>
                <span className="font-extrabold">R$ {(sale.valorPago !== undefined ? sale.valorPago : sale.total).toFixed(2)}</span>
              </div>
              {(sale.valorFaltante !== undefined ? sale.valorFaltante : 0) > 0 ? (
                <div className="flex justify-between items-center text-black font-bold border-t border-dashed border-black pt-1.5 mt-1">
                  <span className="uppercase text-[9px] select-none">Restante a Pagar:</span>
                  <span className="text-sm font-extrabold">R$ {sale.valorFaltante?.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-black font-bold border-t border-dashed border-black pt-1 mt-1 uppercase text-[9px] select-none">
                  <span>Status:</span>
                  <span className="font-extrabold">Pago Integralmente</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Messages */}
        <div className="text-center mt-6 space-y-1.5 pt-3 border-t-2 border-dashed border-black">
          {sale.status === 'Orçamento' ? (
            <p className="text-[10px] text-amber-900 font-extrabold select-text bg-amber-50 py-1.5 border border-amber-300 rounded mb-2 uppercase leading-relaxed">
              Proposta válida por 15 dias.<br/>Sujeito a alteração de estoque.
            </p>
          ) : (
            <p className="text-xs font-bold text-black select-text">Muito obrigado pela preferência!</p>
          )}
          <p className="text-[10px] text-black font-bold select-text">Siga no Instagram: {storeInfo.instagram || '@oxentefesteje'}</p>
          
          {/* QR Code de Controle no Recibo */}
          {sale.status !== 'Orçamento' && qrCodeUrl && (
            <div className="flex flex-col items-center justify-center mt-4 pt-4 border-t border-dashed border-black select-none text-center">
              <span className="text-[10px] text-black font-black uppercase tracking-wider mb-1">Acompanhe seu Pedido</span>
              <span className="text-[8px] text-black/80 font-semibold mb-2">Escaneie o QR Code acima para ver o status em tempo real</span>
              <div className="bg-white p-2 border border-black rounded inline-block">
                <img src={qrCodeUrl} alt="Acompanhar Pedido" className="w-24 h-24" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Buttons for Screen UI (hidden in prints) */}
      <div className="no-print flex flex-col gap-2.5 w-full max-w-sm mt-6">
        
        {/* BUDGET TO ORDER INLINE CONVERTER FORM */}
        {sale.status === 'Orçamento' && showConvertForm ? (
          <div className="w-full p-4.5 border border-emerald-500/20 bg-zinc-900 rounded-2xl space-y-4 text-zinc-100 transition-all shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2">
              <span className="text-sm">⚡</span>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-display">
                Converter em Pedido Fechado
              </span>
            </div>
            
            {/* Payment options */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                Forma de Pagamento
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'Pix', icon: '⚡', label: 'Pix' },
                  { value: 'Dinheiro', icon: '💵', label: 'Dinheiro' },
                  { value: 'Cartão de Crédito', icon: '💳', label: 'Crédito' },
                  { value: 'Cartão de Débito', icon: '🏦', label: 'Débito' }
                ].map((m) => {
                  const isSelected = selectedPayment === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setSelectedPayment(m.value)}
                      className={`py-2 px-1 rounded-xl text-center border font-bold text-[10px] cursor-pointer transition-all flex flex-col items-center gap-0.5 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-450 font-extrabold'
                          : 'border-zinc-800 text-zinc-400 bg-zinc-950/40 hover:bg-zinc-950/80 hover:text-zinc-300'
                      }`}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paid Value input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                Quanto o cliente pagou? (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 select-none">R$</span>
                <input
                  type="text"
                  value={paidValue}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setPaidValue(val);
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-100 text-xs font-mono font-bold"
                  placeholder={`Valor total = R$ ${sale.total.toFixed(2)}`}
                />
              </div>
              <p className="text-[10px] leading-relaxed font-semibold">
                {paidValue.trim() === '' || parseFloat(paidValue) >= sale.total ? (
                  <span className="text-emerald-450 font-medium">✓ Pago Integralmente: Pedido será criado como faturado e pago.</span>
                ) : (
                  <span className="text-amber-500 font-medium">⚠ Entrada Parcial: Restará saldo devedor de R$ {Math.max(0, sale.total - (parseFloat(paidValue) || 0)).toFixed(2)} e pedido ficará Pendente.</span>
                )}
              </p>
            </div>

            {/* Pickup Date input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                Prazo de Entrega / Retirada
              </label>
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-150 text-xs font-mono font-semibold"
              />
            </div>

            {/* Stock Alerts inside conversion */}
            {(() => {
              const items = getSaleItems(sale);
              const stockAlerts = items.map(item => {
                const prod = products?.find(p => p.id === item.produtoId);
                const hasSufficient = !prod || prod.estoqueInfinito || prod.estoque >= item.quantidade;
                return {
                  ...item,
                  currentStock: prod ? prod.estoque : 0,
                  isInfinite: prod ? prod.estoqueInfinito : false,
                  hasSufficient
                };
              });
              const hasStockIssue = stockAlerts.some(alert => !alert.hasSufficient);

              if (hasStockIssue) {
                return (
                  <div className="border border-amber-900/40 bg-amber-950/15 text-amber-400 rounded-xl p-3 text-[10px] space-y-1.5 leading-relaxed">
                    <span className="font-extrabold uppercase tracking-wider block text-amber-400">⚠️ Estoques ficarão negativos</span>
                    <p className="font-medium">
                      O estoque atual é menor que o solicitado. Os itens abaixo ficarão com saldo negativo após a faturamento:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {stockAlerts.filter(a => !a.hasSufficient).map((alert, idx) => (
                        <li key={idx} className="font-semibold text-amber-300">
                          {alert.produtoNome}: necessário {alert.quantidade} un. (Disponível: {alert.currentStock} un.)
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              return (
                <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex items-center gap-2 select-none text-[10px] text-emerald-400 leading-normal font-semibold">
                  <span>✓</span>
                  <span>Todos os produtos possuem estoque disponível para faturamento imediato.</span>
                </div>
              );
            })()}

            {/* Form actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConvertForm(false)}
                className="flex-1 py-2 border border-zinc-800 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center select-none"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  const total = sale.total;
                  const valPaid = paidValue.trim() === '' ? total : parseFloat(paidValue);
                  const finalPaid = isNaN(valPaid) ? total : valPaid;
                  const finalRemaining = Math.max(0, total - finalPaid);

                  const updatedSale: Sale = {
                    ...sale,
                    status: finalRemaining > 0 ? 'Pendente' : 'Pago total',
                    valorPago: finalPaid,
                    valorFaltante: finalRemaining,
                    formaPagamento: selectedPayment,
                    statusProducao: 'Agendado',
                    dataRetirada: pickupDate || undefined,
                    foiAlterado: true,
                    editadoEm: new Date().toISOString(),
                    // Carry identifying email
                    editadoPorEmail: sale.editadoPorEmail || ''
                  };

                  if (onUpdateSale) {
                    onUpdateSale(updatedSale);
                  }

                  playAppSound('success');
                  setShowConvertForm(false);
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-505 text-white font-extrabold rounded-xl text-xs shadow-md transition-colors cursor-pointer text-center select-none"
              >
                Confirmar e Faturar
              </button>
            </div>
          </div>
        ) : null}

        {onEdit && !showConvertForm && (
          <button
            onClick={onEdit}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-red-300 font-extrabold rounded-xl text-sm shadow-[0_0_12px_rgba(239,68,68,0.04)] transition-all transform active:scale-98 cursor-pointer select-none"
          >
            <Pencil className="h-4 w-4" />
            <span>Editar Informações da Venda</span>
          </button>
        )}

        {sale.status === 'Orçamento' && !showConvertForm && (
          <button
            onClick={() => {
              setShowConvertForm(true);
              setPaidValue(sale.total.toString());
              setPickupDate(sale.dataRetirada || '');
              setConfirmForce(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-sm shadow-[0_0_15px_rgba(16,185,129,0.22)] transition-all transform hover:-translate-y-0.5 active:scale-98 cursor-pointer select-none"
          >
            <span>⚡</span>
            <span>Converter em Pedido</span>
          </button>
        )}

        {sale.status === 'Orçamento' ? (
          !showConvertForm && (
            <button
              onClick={handleSendWhatsAppOrcamento}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-650 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-all transform active:scale-98 cursor-pointer select-none"
            >
              <MessageSquare className="h-4.5 w-4.5" />
              <span>Enviar Orçamento pelo WhatsApp</span>
            </button>
          )
        ) : (
          <button
            onClick={() => setWhatsAppOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 font-bold rounded-xl text-sm shadow-xs transition-all transform active:scale-98 cursor-pointer select-none"
          >
            <MessageSquare className="h-4.5 w-4.5" />
            <span>Avisar que está Pronto (WhatsApp)</span>
          </button>
        )}

        {/* PRIMARY DIRECT PRINT BUTTON */}
        {!showConvertForm && (
          <button
            onClick={handleDirectPrint}
            disabled={isPrinting}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-brand-pink hover:bg-brand-pink-hover text-white font-black rounded-xl text-sm shadow-md transition-all transform active:scale-98 cursor-pointer select-none disabled:opacity-50"
          >
            <Printer className="h-5 w-5" />
            <span>
              {isPrinting 
                ? 'Preparando Impressão...' 
                : receiptFormat === 'a4'
                  ? (sale.status === 'Orçamento' ? '🖨️ Imprimir Orçamento (Folha A4)' : '🖨️ Imprimir Recibo (Impressora Normal A4)')
                  : (sale.status === 'Orçamento' ? `🖨️ Imprimir Orçamento (${receiptFormat})` : `🖨️ Imprimir Recibo Térmico (${receiptFormat})`)}
            </span>
          </button>
        )}

        {/* SECONDARY PRINT & SHARING TOOLS */}
        {!showConvertForm && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenInNewTabPrint}
              className="py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer select-none"
              title="Abre o recibo formatado em uma nova aba do navegador e dispara a impressão"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir p/ Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleCopyTextReceipt}
              className={`py-2.5 px-3 border font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                copiedReceiptText
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-800'
              }`}
              title="Copiar texto puro do recibo para colar no WhatsApp ou em aplicativo de impressora Bluetooth (ex: RawBT)"
            >
              {copiedReceiptText ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Texto Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar Texto</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* PRINTER TROUBLESHOOTING TOGGLE */}
        {!showConvertForm && (
          <button
            type="button"
            onClick={() => setShowPrinterHelp(!showPrinterHelp)}
            className="text-[11px] text-zinc-500 hover:text-brand-pink transition-colors flex items-center justify-center gap-1 py-1 cursor-pointer select-none"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Não está imprimindo na sua impressora? Clique para ver dicas</span>
          </button>
        )}

        {/* TROUBLESHOOTING HELP ACCORDION */}
        <AnimatePresence>
          {showPrinterHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-zinc-800 text-xs space-y-2 overflow-hidden"
            >
              <div className="flex items-center gap-1.5 font-bold text-amber-900 border-b border-amber-200 pb-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Como resolver problemas de comunicação com a impressora:</span>
              </div>
              <ul className="space-y-1.5 text-[11px] leading-relaxed list-decimal pl-4 text-zinc-700">
                <li>
                  <strong>Selecione a impressora certa:</strong> Na janela de impressão que abre, verifique se no campo <em>"Destino"</em> está selecionada a sua impressora térmica (ex: POS-80, Bematech, Elgin, Epson) e não "Salvar como PDF".
                </li>
                <li>
                  <strong>Tente o botão "Abrir p/ Imprimir":</strong> Se você estiver usando o aplicativo no celular ou em aba restrita, o botão cinza <em>"Abrir p/ Imprimir"</em> abre uma página limpa independente que se comunica diretamente com o driver da impressora.
                </li>
                <li>
                  <strong>Ajuste as margens:</strong> Nas configurações da janela de impressão, defina <em>Margens</em> como <strong>"Nenhuma"</strong> e marque a opção <strong>"Gráficos de plano de fundo"</strong>.
                </li>
                <li>
                  <strong>Impressora Bluetooth no Celular:</strong> Se usar impressora térmica bluetooth portátil no celular, use o botão <strong>"Copiar Texto"</strong> e abra no app <em>RawBT</em> ou aplicativo da sua impressora.
                </li>
                <li>
                  <strong>Cabo USB / Papel:</strong> Certifique-se de que a impressora está ligada, conectada ao USB/Wi-Fi e com a bobina de papel térmico virada para o lado correto.
                </li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <WhatsAppNotifier
        sale={sale}
        isOpen={whatsAppOpen}
        onClose={() => setWhatsAppOpen(false)}
        onUpdateSale={onUpdateSale}
        storeInfo={storeInfo}
      />

    </motion.div>
  );
}

