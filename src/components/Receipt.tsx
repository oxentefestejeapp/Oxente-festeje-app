/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Printer, Calendar, User, CreditCard, ShoppingBag, Eye, MessageSquare, Pencil, QrCode } from 'lucide-react';
import { motion } from 'motion/react';
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

  useEffect(() => {
    if (!sale || sale.status === 'Orçamento') return;
    const codeValue = `oxente:${sale.id}`;
    QRCode.toDataURL(
      codeValue,
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

  const handlePrint = () => {
    window.print();
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
      
      {/* Title with printable warning info */}
      <div className="no-print text-center mb-6 w-full">
        <h3 className="font-display font-semibold text-lg text-brand-dark mb-1">
          {sale.status === 'Orçamento' ? 'Visualização do Orçamento' : 'Visualização do Recibo'}
        </h3>
        <p className="text-xs text-zinc-500">
          Você pode imprimir o documento abaixo diretamente.
        </p>
      </div>

      {/* Styled Simulated Thermal Receipt Container */}
      <div 
        id="printable-receipt"
        className="printable-receipt border border-black bg-white p-6 shadow-none font-mono text-black w-full max-w-sm relative select-text"
        style={{ fontFamily: "'JetBrains Mono', 'Courier New', Courier, monospace", color: '#000000' }}
      >
        {/* Receipt Header */}
        <div className="text-center space-y-1 mb-4 select-none">
          {sale.status === 'Orçamento' && (
            <div className="bg-amber-100 border border-amber-350 text-amber-950 py-1.5 px-3 rounded-lg font-bold text-[10px] uppercase mb-4 text-center tracking-wider">
              📄 Orçamento / Cotação
            </div>
          )}
          <h2 className="text-xl font-extrabold tracking-tight text-black select-text">{storeInfo.nome}</h2>
          <p className="text-[10px] uppercase tracking-wider text-black font-bold select-text">Brindes Personalizados</p>
          <p className="text-[10px] text-black font-bold select-text">CNPJ: 26.051.478/0001-34</p>
          <p className="text-[10px] text-black font-bold select-text">Telefone: (83) 98885-9302</p>
          <div className="border-t-2 border-dashed border-black my-2"></div>
        </div>

        {/* Sales Meta Information */}
        <div className="text-xs space-y-1.5 mb-4 leading-relaxed text-black">
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
        <table className="w-full text-xs border-collapse text-black">
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
                <tr key={item.id || idx} className="border-b border-dashed border-black/60 text-xs">
                  <td className="py-2 max-w-[150px] break-words align-top select-text">
                    <span className="font-bold text-black">{item.produtoNome}</span>
                    <span className="block text-[9px] text-black font-normal">Preço Un: R$ {item.precoUn.toFixed(2)}</span>
                  </td>
                  <td className="py-2 text-center align-top select-text font-bold text-black">{item.quantidade}</td>
                  <td className="py-2 text-right align-top select-text font-extrabold text-black">R$ {item.total.toFixed(2)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-dashed border-black/60 text-xs">
                <td className="py-2.5 max-w-[150px] break-words align-top select-text">
                  <span className="font-bold text-black">{sale.produtoNome}</span>
                  <span className="block text-[9px] text-black font-normal">Preço Un: R$ {sale.precoUn.toFixed(2)}</span>
                </td>
                <td className="py-2.5 text-center align-top select-text font-bold text-black">{sale.quantidade}</td>
                <td className="py-2.5 text-right align-top select-text font-extrabold text-black">R$ {sale.total.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pricing Subtotal & Payment Breakdown */}
        <div className="border-t-2 border-dashed border-black mt-4 pt-3 space-y-1 bg-white select-text text-xs text-black">
          <div className="flex justify-between items-center text-black font-bold">
            <span className="select-none uppercase text-[10px]">
              {sale.status === 'Orçamento' ? 'Valor Estimado:' : 'Total Geral:'}
            </span>
            <span className="font-extrabold">R$ {sale.total.toFixed(2)}</span>
          </div>
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
          <p className="text-[10px] text-black font-bold select-text">Siga no Instagram: {storeInfo.instagram}</p>
          
          {/* QR Code de Controle no Recibo */}
          {sale.status !== 'Orçamento' && qrCodeUrl && (
            <div className="flex flex-col items-center justify-center mt-4 pt-4 border-t border-dashed border-black select-none text-center">
              <span className="text-[9px] text-black font-black uppercase tracking-wider mb-2">QR Code de Controle</span>
              <div className="bg-white p-2 border border-black rounded inline-block">
                <img src={qrCodeUrl} alt="Controle de Entrega" className="w-24 h-24" />
              </div>
              <span className="text-[8px] text-black font-extrabold uppercase mt-2 tracking-wide block max-w-[190px] mx-auto text-center leading-normal">
                ESCANEAR NO PAINEL PARA MANDAR COBRANÇA OU AVISO DE PRONTO!
              </span>
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
                  <div className="border border-red-900/40 bg-red-950/15 text-red-400 rounded-xl p-3 text-[10px] space-y-1.5 leading-relaxed">
                    <span className="font-extrabold uppercase tracking-wider block text-red-400">⚠️ Estoque Insuficiente no Estoque</span>
                    <p className="font-medium">
                      O estoque físico não comporta as quantidades requisitadas:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {stockAlerts.filter(a => !a.hasSufficient).map((alert, idx) => (
                        <li key={idx} className="font-semibold text-red-300">
                          {alert.produtoNome}: necessário {alert.quantidade} un. (Disponível: {alert.currentStock} un.)
                        </li>
                      ))}
                    </ul>
                    <label className="flex items-start gap-2 pt-1 font-semibold text-red-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={confirmForce}
                        onChange={(e) => setConfirmForce(e.target.checked)}
                        className="mt-0.5 rounded text-red-500 focus:ring-red-500 bg-black border-zinc-800"
                      />
                      <span>Entendo o risco e desejo converter o pedido mesmo assim.</span>
                    </label>
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
                  const items = getSaleItems(sale);
                  const stockAlerts = items.map(item => {
                    const prod = products?.find(p => p.id === item.produtoId);
                    const hasSufficient = !prod || prod.estoqueInfinito || prod.estoque >= item.quantidade;
                    return { ...item, hasSufficient };
                  });
                  const hasStockIssue = stockAlerts.some(alert => !alert.hasSufficient);

                  if (hasStockIssue && !confirmForce) {
                    alert('Por favor, marque a caixa de confirmação de estoque para prosseguir de qualquer forma e evitar quebras indesejadas.');
                    return;
                  }

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

        {!showConvertForm && (
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-pink hover:bg-brand-pink-hover text-white font-bold rounded-xl text-sm shadow-md transition-all transform active:scale-98 cursor-pointer select-none"
          >
            <Printer className="h-4.5 w-4.5" />
            <span>{sale.status === 'Orçamento' ? 'Imprimir Orçamento' : 'Imprimir Recibo'}</span>
          </button>
        )}
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
