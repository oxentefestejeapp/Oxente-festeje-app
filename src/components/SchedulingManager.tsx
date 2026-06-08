/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Search, Phone, CheckSquare, Clock, DollarSign, Truck, Calendar, ShoppingBag, Eye, Heart, Check, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { Sale, StoreInfo, Product, PaymentMethod } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { playAppSound } from '../lib/audio';
import { Receipt } from './Receipt';

interface SchedulingManagerProps {
  products: Product[];
  sales: Sale[];
  storeInfo: StoreInfo;
  onUpdateSale: (updatedSale: Sale) => void;
  onNavigateToTab: (tab: any, saleId?: string) => void;
}

const paymentMethods: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'Pix', label: 'Pix (Instantâneo)', icon: '⚡' },
  { value: 'Dinheiro', label: 'Dinheiro físico', icon: '💵' },
  { value: 'Cartão de Crédito', label: 'Cartão de Crédito', icon: '💳' },
  { value: 'Cartão de Débito', label: 'Cartão de Débito', icon: '🏦' },
];

export function SchedulingManager({ products, sales, storeInfo, onUpdateSale, onNavigateToTab }: SchedulingManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [quickDeliverPaymentMethod, setQuickDeliverPaymentMethod] = useState<PaymentMethod>('Pix');
  const [confirmingDeliverSaleId, setConfirmingDeliverSaleId] = useState<string | null>(null);
  const [editingDateSaleId, setEditingDateSaleId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<string>('');

  // Filter sales to ONLY scheduled deliveries
  const scheduledSales = useMemo(() => {
    return sales.filter(s => s.statusProducao === 'Agendado para Entrega');
  }, [sales]);

  // Apply search term and payment filter
  const filteredSales = useMemo(() => {
    return scheduledSales.filter(s => {
      // Search
      const text = searchTerm.toLowerCase().trim();
      const matchName = s.cliente.toLowerCase().includes(text);
      const matchOrderNum = s.numeroPedido ? s.numeroPedido.toLowerCase().includes(text) : false;
      const matchPhone = s.telefoneCliente ? s.telefoneCliente.replace(/\D/g, '').includes(text.replace(/\D/g, '')) : false;
      const matchesSearch = !text || matchName || matchOrderNum || matchPhone;

      // Payment
      const owed = s.valorFaltante !== undefined ? s.valorFaltante : Math.max(0, s.total - (s.valorPago ?? s.total));
      const hasBalance = owed > 0;
      let matchesPayment = true;
      if (paymentFilter === 'pending') {
        matchesPayment = hasBalance;
      } else if (paymentFilter === 'paid') {
        matchesPayment = !hasBalance;
      }

      return matchesSearch && matchesPayment;
    });
  }, [scheduledSales, searchTerm, paymentFilter]);

  // Handle finalize and register delivery
  const handleCompleteDelivery = (sale: Sale, methodUsed: PaymentMethod) => {
    playAppSound('success');
    const updatedSale: Sale = {
      ...sale,
      status: 'Concluído',
      statusProducao: 'Entregue',
      valorPagoAntesConcluir: sale.valorPago ?? 0,
      valorFaltanteAntesConcluir: sale.valorFaltante ?? (sale.total - (sale.valorPago ?? 0)),
      statusProducaoAntesConcluir: sale.statusProducao || 'Agendado para Entrega',
      valorFaltante: 0,
      valorPago: sale.total,
      formaPagamento: methodUsed, // Use payment method picked during delivery for remaining
      foiAlterado: true,
      editadoEm: new Date().toISOString()
    };
    onUpdateSale(updatedSale);
    setConfirmingDeliverSaleId(null);
  };

  // Helper to open WhatsApp
  const handleOpenWhatsApp = (sale: Sale) => {
    if (!sale.telefoneCliente) return;
    const cleanPh = sale.telefoneCliente.replace(/\D/g, '');
    const numToUse = cleanPh.startsWith('55') ? cleanPh : `55${cleanPh}`;
    
    const storeName = storeInfo.nome || 'Ateliê Oxente Festeje';
    const pedidoNum = sale.numeroPedido || sale.id.substring(0, 5).toUpperCase();
    const listProducts = sale.itens && sale.itens.length > 0
      ? sale.itens.map(item => `${item.produtoNome} (${item.quantidade}x)`).join(', ')
      : `${sale.produtoNome} (${sale.quantidade}x)`;

    const dateStr = sale.dataRetirada 
      ? new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')
      : 'Não informada';
      
    const shiftText = sale.turnoEntrega 
      ? `*${sale.turnoEntrega}*` 
      : 'A definir';

    const text = `Olá, *${sale.cliente}*! Tudo bem? 🌟\n\nSeu agendamento de entrega da *${storeName}* foi confirmado com sucesso! 🚚🎉\n\n*Detalhes do seu Agendamento:*\n📦 *Pedido:* #${pedidoNum}\n🛒 *Peças:* ${listProducts}\n📅 *Data de Entrega:* ${dateStr}\n⏰ *Turno da Entrega:* ${shiftText}\n\nEstamos organizando a rota de entrega para sua comodidade. Qualquer dúvida, conte conosco! ❤️`;

    // Opens directly on Web/Desktop/Mobile app depending on system configuration
    const url = `https://api.whatsapp.com/send?phone=${numToUse}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-extrabold select-none shadow-md">
            <Truck className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-display font-black text-xl text-zinc-100 tracking-tight">Cronograma de Agendamentos</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Veja seus pedidos marcados para entrega domiciliar e finalize seus despachos</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-purple-950/15 border border-purple-900/30 px-3 py-2 rounded-xl text-center md:text-right">
          <Clock className="h-4 w-4 text-purple-400 shrink-0 hidden sm:inline" />
          <div className="text-left">
            <div className="text-[10px] text-zinc-500 uppercase font-black tracking-wider leading-none">Status de Envios</div>
            <div className="text-xs font-bold text-purple-300 mt-1">
              {scheduledSales.length} {scheduledSales.length === 1 ? 'pedido agendado' : 'pedidos agendados'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-900 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por cliente, nº do pedido ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/40 text-xs font-medium text-zinc-200 placeholder-zinc-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 text-xs cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 bg-black p-1 border border-zinc-900 rounded-xl shrink-0 self-start md:self-auto">
          <button
            onClick={() => setPaymentFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              paymentFilter === 'all'
                ? 'bg-zinc-850 text-zinc-150 border border-zinc-750'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos ({scheduledSales.length})
          </button>
          <button
            onClick={() => setPaymentFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              paymentFilter === 'pending'
                ? 'bg-amber-955/15 text-amber-400 border border-amber-900/35'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            A Receber ({scheduledSales.filter(s => (s.valorFaltante ?? 0) > 0).length})
          </button>
          <button
            onClick={() => setPaymentFilter('paid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              paymentFilter === 'paid'
                ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Pagos ({scheduledSales.filter(s => (s.valorFaltante ?? 0) <= 0).length})
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      {filteredSales.length === 0 ? (
        <div className="py-16 text-center bg-zinc-950/25 border border-dashed border-zinc-850 rounded-2xl max-w-lg mx-auto flex flex-col items-center justify-center space-y-3 p-6">
          <div className="h-12 w-12 rounded-full bg-purple-950/20 border border-purple-900/40 flex items-center justify-center text-purple-400 select-none">
            <Truck className="h-6 w-6 stroke-[1.6]" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-200">Nenhum agendamento ativo</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Pedidos aparecem aqui quando marcados como <strong className="text-purple-400 font-semibold">"Agendado para Entrega"</strong>. Use o botão nos lembretes ou histórico de pedidos após notificar o cliente!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredSales.map((sale) => {
              const owed = sale.valorFaltante !== undefined ? sale.valorFaltante : Math.max(0, sale.total - (sale.valorPago ?? sale.total));
              const isPaid = owed <= 0;
              
              return (
                <motion.div
                  key={sale.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`group relative overflow-hidden bg-zinc-900 rounded-2xl border transition-all duration-300 p-5 ${
                    isPaid
                      ? 'border-emerald-500/35 hover:border-emerald-500 shadow-[0_4px_25px_rgba(16,185,129,0.06)]'
                      : 'border-brand-pink/35 hover:border-brand-pink shadow-[0_4px_25px_rgba(236,72,153,0.06)]'
                  }`}
                >
                  {/* Decorative glowing gradient effect on top */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isPaid ? 'bg-gradient-to-r from-emerald-555 to-teal-500' : 'bg-gradient-to-r from-brand-pink to-amber-500'
                  }`} />

                  {/* Top Stats block */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        isPaid 
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-brand-pink/15 text-brand-pink border border-brand-pink/20'
                      }`}>
                        {isPaid ? '🟢 PEDIDO TOTALMENTE PAGO' : '💵 RECEBER APÓS ENTREGA'}
                      </span>
                      <h4 className="font-display font-extrabold text-sm text-zinc-100 mt-1 select-all truncate max-w-[200px]" title={sale.cliente}>
                        {sale.cliente}
                      </h4>
                    </div>
                    {sale.numeroPedido && (
                      <span className="text-[10px] font-mono font-bold bg-zinc-950 px-2 py-1 border border-zinc-850 rounded-lg text-zinc-400">
                        {sale.numeroPedido}
                      </span>
                    )}
                  </div>

                  {/* Middle specs rows */}
                  <div className="mt-4 space-y-2 border-t border-b border-zinc-850/60 py-3.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 select-none">📦 Itens comprados:</span>
                      <span className="font-bold text-zinc-200 select-all truncate max-w-[150px]">{sale.produtoNome}</span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 select-none">🔢 Quantidade:</span>
                      <span className="font-bold text-zinc-200">{sale.quantidade} items</span>
                    </div>

                    {editingDateSaleId === sale.id ? (
                      <div className="space-y-1.5 bg-zinc-950 p-2 border border-zinc-800 rounded-xl mt-1.5 no-print">
                        <div className="flex justify-between items-center select-none">
                          <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-amber-500 flex items-center gap-1">
                            📅 Nova data de agendamento:
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={tempDate}
                            onChange={(e) => setTempDate(e.target.value)}
                            className="bg-black text-zinc-100 border border-zinc-800 rounded-lg py-1 px-2 text-xs focus:outline-none focus:border-amber-500 flex-1 no-print"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!tempDate) return;
                              playAppSound('success');
                              onUpdateSale({
                                ...sale,
                                dataRetirada: tempDate,
                                foiAlterado: true,
                                editadoEm: new Date().toISOString()
                              });
                              setEditingDateSaleId(null);
                            }}
                            className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold text-[10px] rounded-lg transition-transform active:scale-95 cursor-pointer shadow-md"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDateSaleId(null)}
                            className="py-1 px-2.5 bg-zinc-900 hover:bg-zinc-805 border border-zinc-800 text-zinc-400 hover:text-zinc-100 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            X
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500 select-none">📅 Planejado para:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-amber-500 bg-amber-950/15 border border-amber-900/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{sale.dataRetirada ? new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : 'A definir'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              playAppSound('click');
                              setTempDate(sale.dataRetirada || '');
                              setEditingDateSaleId(sale.id);
                            }}
                            className="p-1 hover:bg-zinc-800 border border-transparent hover:border-zinc-700/60 text-zinc-400 hover:text-amber-500 rounded-lg transition-colors cursor-pointer no-print"
                            title="Alterar data de agendamento"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-zinc-500 select-none">💰 Valor do Pedido:</span>
                      <span className="font-mono font-extrabold text-zinc-100">R$ {sale.total.toFixed(2)}</span>
                    </div>

                    {owed > 0 && (
                      <div className="flex justify-between items-center text-xs bg-red-950/15 border border-red-900/25 rounded-lg p-2 mt-1 animate-pulse-slow">
                        <span className="text-red-400 font-extrabold flex items-center gap-1 select-none">
                          <DollarSign className="h-3.5 w-3.5 line-none shrink-0" /> Resta Receber:
                        </span>
                        <span className="font-mono font-black text-red-400 text-sm">R$ {owed.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* User Note Instructions */}
                  {sale.observacoesDesign ? (
                    <div className="mt-3 bg-black/40 border border-zinc-850/50 p-2.5 rounded-xl space-y-1">
                      <div className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 flex items-center gap-1 select-none">
                        <span>📝 Instruções de Envio:</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-normal line-clamp-2 italic">
                        "{sale.observacoesDesign}"
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 py-3 text-center border border-dashed border-zinc-850/50 rounded-xl">
                      <p className="text-[9.5px] font-mono text-zinc-650 tracking-wider">Mão Festeira sem observações extras</p>
                    </div>
                  )}

                  {/* Shift of delivery (Turno da Entrega) selection */}
                  <div className="mt-3 bg-zinc-950/40 border border-zinc-850/60 p-2.5 rounded-xl space-y-2 no-print">
                    <div className="flex justify-between items-center select-none">
                      <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-purple-300 flex items-center gap-1">
                        ⏰ Turno de Entrega:
                      </span>
                      {sale.turnoEntrega ? (
                        <span className="text-[10px] font-black text-white bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 uppercase">
                          {sale.turnoEntrega === 'Manhã' ? '☀️ MANHÃ' : '🌇 TARDE'}
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-bold text-zinc-500">A definir</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       <button
                        type="button"
                        onClick={() => {
                          playAppSound('click');
                          onUpdateSale({
                            ...sale,
                            turnoEntrega: 'Manhã',
                            foiAlterado: true,
                            editadoEm: new Date().toISOString()
                          });
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                          sale.turnoEntrega === 'Manhã'
                            ? 'bg-amber-600 text-white border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-900 hover:border-zinc-805'
                        }`}
                      >
                        <span className="text-white font-black">☀️ Manhã</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playAppSound('click');
                          onUpdateSale({
                            ...sale,
                            turnoEntrega: 'Tarde',
                            foiAlterado: true,
                            editadoEm: new Date().toISOString()
                          });
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                          sale.turnoEntrega === 'Tarde'
                            ? 'bg-orange-600 text-white border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.35)]'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-900 hover:border-zinc-805'
                        }`}
                      >
                        <span className="text-white font-black">🌇 Tarde</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions buttons layout */}
                  <div className="mt-5 space-y-2.5">
                    {/* Compact Phone & View button row */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleOpenWhatsApp(sale)}
                        disabled={!sale.telefoneCliente}
                        className="py-2 px-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-black rounded-xl text-[10.5px] font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed select-none shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:scale-[1.01]"
                        title={sale.telefoneCliente ? "Enviar no WhatsApp Desktop/Zap" : "Telefone não cadastrado"}
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>Enviar no Zap</span>
                      </button>

                      <button
                        onClick={() => setSelectedSaleForReceipt(sale)}
                        className="py-2 px-2.5 bg-zinc-950 border border-zinc-800 hover:border-brand-pink text-zinc-400 hover:text-brand-pink rounded-xl text-[10.5px] font-extrabold cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95 select-none"
                      >
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        <span>Ver Recibo</span>
                      </button>
                    </div>

                    {/* Quick confirm delivery action */}
                    {confirmingDeliverSaleId === sale.id ? (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 space-y-2.5"
                      >
                        <label className="block text-[9px] uppercase font-black text-brand-pink tracking-wider">
                          Escolha a Forma do Pagamento do Saldo:
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {paymentMethods.map(m => (
                            <button
                              key={m.value}
                              onClick={() => setQuickDeliverPaymentMethod(m.value)}
                              className={`py-1.5 px-0.5 rounded-lg text-[9.5px] font-bold border truncate transition-all ${
                                quickDeliverPaymentMethod === m.value
                                  ? 'bg-brand-pink text-black border-brand-pink'
                                  : 'bg-black border-zinc-800 text-zinc-400 hover:border-zinc-700'
                              }`}
                            >
                              {m.icon} {m.value.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <button
                            onClick={() => handleCompleteDelivery(sale, quickDeliverPaymentMethod)}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold text-[10px] rounded-lg cursor-pointer flex items-center justify-center gap-1 shadow-md"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Confirmar Entrega</span>
                          </button>
                          <button
                            onClick={() => setConfirmingDeliverSaleId(null)}
                            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <button
                        onClick={() => {
                          playAppSound('click');
                          setQuickDeliverPaymentMethod(sale.formaPagamento);
                          setConfirmingDeliverSaleId(sale.id);
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl font-black text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-97 select-none ${
                          isPaid
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-black shadow-emerald-950/20'
                            : 'bg-brand-pink hover:bg-brand-pink/90 text-black shadow-rose-955/20'
                        }`}
                      >
                        <CheckSquare className="h-4 w-4 shrink-0" />
                        <span>Registrar como Entregue</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Embedded modal for printing / viewing sale receipt */}
      {selectedSaleForReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto relative p-6">
            <button
              onClick={() => setSelectedSaleForReceipt(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg p-2 cursor-pointer no-print"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="pt-2">
              <Receipt 
                sale={selectedSaleForReceipt} 
                storeInfo={storeInfo} 
                onUpdateSale={onUpdateSale}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
