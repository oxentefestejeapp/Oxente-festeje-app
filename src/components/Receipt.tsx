/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Printer, Calendar, User, CreditCard, ShoppingBag, Eye, MessageSquare, FileImage, Loader2, Pencil } from 'lucide-react';
import { motion } from 'motion/react';
import { Sale, StoreInfo } from '../types';
import { WhatsAppNotifier } from './WhatsAppNotifier';
import html2canvas from 'html2canvas';

interface ReceiptProps {
  sale: Sale;
  storeInfo: StoreInfo;
  onUpdateSale?: (updatedSale: Sale) => void;
  onEdit?: () => void;
}

export function Receipt({ sale, storeInfo, onUpdateSale, onEdit }: ReceiptProps) {
  const [isGeneratingJPEG, setIsGeneratingJPEG] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveAsJPEG = async () => {
    setIsGeneratingJPEG(true);
    try {
      const element = document.getElementById('printable-receipt');
      if (!element) {
        alert('Erro: Recibo não encontrado para salvar.');
        return;
      }

      // Capture the styled thermal receipt element
      const canvas = await html2canvas(element, {
        scale: 2, // Perfect balance of image resolution and performance file sizing
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Clean up modern CSS features in stylesheets that crash html2canvas parser
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach((style) => {
            if (style.textContent) {
              style.textContent = style.textContent
                // Replace modern color-mix definitions with oklab/oklch which crash html2canvas parser
                .replace(/color-mix\(in oklab, (?:[^)(]|\([^)]*\))*\)/gi, '#000000')
                .replace(/color-mix\(in oklch, (?:[^)(]|\([^)]*\))*\)/gi, '#000000')
                .replace(/oklch\((?:[^)(]|\([^)]*\))*\)/gi, '#000000')
                .replace(/oklab\((?:[^)(]|\([^)]*\))*\)/gi, '#000000');
            }
          });
        }
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        alert('Erro: Não foi possível obter as dimensões da imagem do recibo.');
        return;
      }

      // Convert captured canvas to JPEG
      const imgData = canvas.toDataURL('image/jpeg', 0.9);

      let safeDateStr = 'sem_data';
      try {
        if (sale.data) {
          const d = new Date(sale.data);
          if (!isNaN(d.getTime())) {
            safeDateStr = d.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.warn('Erro ao obter data da venda para o arquivo.', e);
      }

      const safeClientName = sale.cliente
        ? sale.cliente.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_')
        : 'cliente';

      const filename = `recibo_oxente_${safeClientName}_${safeDateStr}.jpg`;

      // Download the JPEG
      const link = document.createElement('a');
      link.href = imgData;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 200);
    } catch (err) {
      console.error('Error generating JPEG:', err);
      alert('Erro inesperado ao gerar ou salvar imagem JPEG.');
    } finally {
      setIsGeneratingJPEG(false);
    }
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
        <h3 className="font-display font-semibold text-lg text-brand-dark mb-1">Visualização do Recibo</h3>
        <p className="text-xs text-zinc-500">
          Você pode imprimir o recibo abaixo ou salvar como imagem JPEG.
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
          <h2 className="text-xl font-extrabold tracking-tight text-black select-text">{storeInfo.nome}</h2>
          <p className="text-[10px] uppercase tracking-wider text-black font-bold select-text">Brindes Personalizados</p>
          <p className="text-[10px] text-black font-bold select-text">CNPJ: 26.051.478/0001-34</p>
          <p className="text-[10px] text-black font-bold select-text">Telefone: (83) 98885-9302</p>
          <div className="border-t-2 border-dashed border-black my-2"></div>
        </div>

        {/* Sales Meta Information */}
        <div className="text-xs space-y-1.5 mb-4 leading-relaxed text-black">
          {sale.numeroPedido && (
            <div className="flex justify-between">
              <span className="text-black font-bold uppercase select-none">Nº Pedido:</span>
              <span className="font-extrabold text-right select-text text-black">#{sale.numeroPedido}</span>
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
            <span className="text-black font-bold uppercase select-none">Pagamento:</span>
            <span className="font-extrabold text-right select-text text-black">{sale.formaPagamento}</span>
          </div>
          {sale.dataRetirada && (
            <div className="flex justify-between text-black">
              <span className="text-black font-bold uppercase select-none">Retirada:</span>
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
            <span className="select-none uppercase text-[10px]">Total Geral:</span>
            <span className="font-extrabold">R$ {sale.total.toFixed(2)}</span>
          </div>
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
        </div>

        {/* Footer Messages */}
        <div className="text-center mt-6 space-y-1.5 pt-3 border-t-2 border-dashed border-black">
          <p className="text-xs font-bold text-black select-text">Muito obrigado pela preferência!</p>
          <p className="text-[10px] text-black font-bold select-text">Siga no Instagram: {storeInfo.instagram}</p>
        </div>
      </div>

      {/* Control Buttons for Screen UI (hidden in prints) */}
      <div className="no-print flex flex-col gap-2.5 w-full max-w-sm mt-6">
        {onEdit && (
          <button
            onClick={onEdit}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-red-300 font-extrabold rounded-xl text-sm shadow-[0_0_12px_rgba(239,68,68,0.04)] transition-all transform active:scale-98 cursor-pointer select-none"
          >
            <Pencil className="h-4 w-4" />
            <span>Editar Informações da Venda</span>
          </button>
        )}

        <button
          onClick={() => setWhatsAppOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 font-bold rounded-xl text-sm shadow-xs transition-all transform active:scale-98 cursor-pointer select-none"
        >
          <MessageSquare className="h-4.5 w-4.5" />
          <span>Avisar que está Pronto (WhatsApp)</span>
        </button>



        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-brand-pink hover:bg-brand-pink-hover text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition-all transform active:scale-98 cursor-pointer select-none"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={handleSaveAsJPEG}
            disabled={isGeneratingJPEG}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-xl text-xs sm:text-sm transition-all transform active:scale-98 cursor-pointer select-none disabled:opacity-50"
          >
            {isGeneratingJPEG ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                <span>Gerando...</span>
              </>
            ) : (
              <>
                <FileImage className="h-4 w-4 text-zinc-500" />
                <span>Salvar em JPEG</span>
              </>
            )}
          </button>
        </div>
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
