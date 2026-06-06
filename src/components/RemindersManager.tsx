import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Calendar, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  Phone, 
  User, 
  ArrowRight,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sale, StoreInfo } from '../types';
import { WhatsAppNotifier } from './WhatsAppNotifier';
import { playAppSound } from '../lib/audio';

interface RemindersManagerProps {
  sales: Sale[];
  storeInfo: StoreInfo;
  onUpdateSale: (updatedSale: Sale) => void;
}

export function RemindersManager({ sales, storeInfo, onUpdateSale }: RemindersManagerProps) {
  const [selectedSaleForWA, setSelectedSaleForWA] = useState<Sale | null>(null);
  const [filterType, setFilterType] = useState<'todos' | 'pendentes' | 'concluidos'>('todos');
  const [readyId, setReadyId] = useState<string | null>(null);

  const playNotificationChime = () => {
    playAppSound('success');
  };

  // Helper to obtain local YYYY-MM-DD string
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to obtain tomorrow's YYYY-MM-DD string
  const getTomorrowString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getTodayString(), []);
  const tomorrowStr = useMemo(() => getTomorrowString(), []);

  // Filter sales that are scheduled for pickup today (excluding estimates)
  const todaySales = useMemo(() => {
    return sales.filter(s => s.dataRetirada === todayStr && s.status !== 'Orçamento');
  }, [sales, todayStr]);

  // Filter sales scheduled for pickup tomorrow (excluding estimates)
  const tomorrowSales = useMemo(() => {
    return sales.filter(s => s.dataRetirada === tomorrowStr && s.status !== 'Orçamento');
  }, [sales, tomorrowStr]);

  // Apply visual status filters on today's sales
  const filteredSales = useMemo(() => {
    return todaySales.filter(sale => {
      const isPending = sale.statusProducao !== 'Entregue' && sale.status !== 'Concluído';
      
      if (filterType === 'pendentes') {
        return isPending;
      }
      if (filterType === 'concluidos') {
        return !isPending;
      }
      return true;
    });
  }, [todaySales, filterType]);

  // Counts for Today
  const pendingCount = useMemo(() => {
    return todaySales.filter(s => s.statusProducao !== 'Entregue' && s.status !== 'Concluído').length;
  }, [todaySales]);

  const completedCount = todaySales.length - pendingCount;

  // Handle reminder click to trigger ready status update & WhatsApp notification
  const handleReminderAction = (sale: Sale) => {
    const updatedSale: Sale = {
      ...sale,
      statusProducao: 'Pronto para Retirada'
    };
    
    // Set readyId to trigger green animation immediately on this specific card
    setReadyId(sale.id);
    playNotificationChime();
    setTimeout(() => {
      setReadyId(null);
    }, 3000);

    onUpdateSale(updatedSale);
    setSelectedSaleForWA(updatedSale);
  };

  const getDayOfWeekName = () => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[new Date().getDay()];
  };

  const getTomorrowDayOfWeekName = () => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const tomorrowIndex = (new Date().getDay() + 1) % 7;
    return days[tomorrowIndex];
  };

  const getFormattedDateLong = () => {
    return new Date().toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTomorrowFormattedDateLong = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Turn local format correct for display
  const formatLocalDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 select-text">
      
      {/* Upper Date Display Jumbotron */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-brand-pink/10 border border-brand-pink/20 flex items-center justify-center text-brand-pink shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-brand-pink font-extrabold uppercase tracking-widest">{getDayOfWeekName()}</span>
            <h2 className="text-lg font-bold text-zinc-100">{getFormattedDateLong()}</h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">Pedidos programados para retirada hoje na Oxente Festeje</p>
          </div>
        </div>

        {/* Dynamic counter widgets for today */}
        <div className="flex gap-2">
          <div className="bg-black/40 border border-zinc-850 px-3 py-2 rounded-xl text-center min-w-[70px]">
            <span className="text-[9px] text-zinc-500 font-extrabold uppercase block select-none">Total</span>
            <span className="text-sm font-black text-zinc-200">{todaySales.length}</span>
          </div>
          <div className="bg-amber-955/10 border border-amber-900/30 px-3 py-2 rounded-xl text-center min-w-[70px]">
            <span className="text-[9px] text-amber-500 font-extrabold uppercase block select-none">Pendentes</span>
            <span className="text-sm font-black text-amber-400">{pendingCount}</span>
          </div>
          <div className="bg-emerald-955/10 border border-emerald-900/20 px-3 py-2 rounded-xl text-center min-w-[70px]">
            <span className="text-[9px] text-emerald-500 font-extrabold uppercase block select-none">Entregues</span>
            <span className="text-sm font-black text-emerald-400">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Grid Layout: Left 2 cols for Today, Right 1 col for Tomorrow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left main section - Today's Reminders */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-brand-pink tracking-wide flex items-center gap-2 select-none">
              <span>🔔</span> LEMBRETES DE HOJE
            </h3>
            <span className="text-[9.5px] text-zinc-500 font-mono tracking-wider">
              {filteredSales.length} {filteredSales.length === 1 ? 'registro' : 'registros'} encontrado(s)
            </span>
          </div>

          {/* Guidelines info banner */}
          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex items-start gap-3 text-xs leading-relaxed text-zinc-400 no-print">
            <span className="text-lg mt-0.5 shrink-0 select-none">💡</span>
            <div className="space-y-1">
              <h4 className="font-bold text-zinc-200">Como funcionam os Lembretes do Dia?</h4>
              <p>
                Rastreie os pedidos com retirada agendada para hoje. Clique em <strong className="text-brand-pink font-semibold">"Avisar Pronto &amp; Contatar"</strong> para marcar a encomenda como <strong className="text-purple-400">Pronto para Retirada</strong> e preparar a mensagem detalhada do WhatsApp no formato oficial de contato do salão.
              </p>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex gap-1 bg-zinc-900/50 p-1 border border-zinc-850 rounded-xl max-w-sm">
            <button 
              onClick={() => setFilterType('todos')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer select-none border border-transparent ${
                filterType === 'todos' 
                  ? 'bg-zinc-800 text-brand-pink border-zinc-700/50 shadow-xs' 
                  : 'text-zinc-450 hover:text-zinc-200'
              }`}
            >
              Todos ({todaySales.length})
            </button>
            <button 
              onClick={() => setFilterType('pendentes')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer select-none border border-transparent ${
                filterType === 'pendentes' 
                  ? 'bg-amber-950/20 text-amber-400 border-amber-900/25' 
                  : 'text-zinc-450 hover:text-zinc-200'
              }`}
            >
              A Fazer ({pendingCount})
            </button>
            <button 
              onClick={() => setFilterType('concluidos')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer select-none border border-transparent ${
                filterType === 'concluidos' 
                  ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/15' 
                  : 'text-zinc-450 hover:text-zinc-200'
              }`}
            >
              Entregues ({completedCount})
            </button>
          </div>

          {/* List of today's reminders */}
          <div className="space-y-4">
            {filteredSales.map((sale) => {
              const isPending = sale.statusProducao !== 'Entregue' && sale.status !== 'Concluído';
              const isReadyForPickup = sale.statusProducao === 'Pronto para Retirada';
              
              return (
                <motion.div 
                  key={sale.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className={`border rounded-2xl p-5 transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-5 ${
                    isReadyForPickup
                      ? 'border-emerald-500/35 bg-emerald-950/15 hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.06)]'
                      : isPending 
                        ? 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-750' 
                        : 'border-zinc-900 bg-zinc-950/30 opacity-65'
                  }`}
                >
                  {/* Absolute Green Overlay celebration when readyId is active */}
                  <AnimatePresence>
                    {readyId === sale.id && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 1, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2.5, times: [0, 0.1, 0.85, 1] }}
                        className="absolute inset-0 bg-emerald-950/80 border-2 border-emerald-500 rounded-2xl pointer-events-none flex flex-col items-center justify-center z-[15] backdrop-blur-[1.5px]"
                      >
                        <div className="absolute inset-0 bg-radial from-emerald-500/20 to-transparent pointer-events-none" />
                        <motion.div 
                          initial={{ scale: 0.7, y: -10 }}
                          animate={{ scale: 1, y: 0 }}
                          transition={{ type: 'spring', damping: 15 }}
                          className="bg-emerald-500 text-black font-extrabold rounded-2xl px-5 py-3 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex flex-col items-center gap-1.5"
                        >
                          <motion.span 
                            animate={{ scale: [1, 1.25, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="text-xl"
                          >
                            ✅
                          </motion.span>
                          <span className="uppercase tracking-wider text-[11px] font-black">Pedido Pronto!</span>
                          <span className="text-[9px] opacity-85 font-medium">Contatando cliente...</span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-3 flex-1 min-w-0">
                    
                    {/* Top detail indicators */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {sale.numeroPedido && (
                        <span className="text-[10px] bg-zinc-950 border border-zinc-850 text-zinc-400 font-mono font-bold px-2 py-0.5 rounded-md">
                          Pedido #{sale.numeroPedido}
                        </span>
                      )}
                      
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1.5 ${
                        sale.statusProducao === 'Agendado' ? 'bg-blue-900/10 text-blue-400 border-blue-900/20' :
                        sale.statusProducao === 'Em Produção' ? 'bg-amber-900/10 text-amber-400 border-amber-900/20 animate-pulse' :
                        sale.statusProducao === 'Pronto para Retirada' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-extrabold' :
                        'bg-emerald-900/10 text-emerald-450 border-emerald-900/20'
                      }`}>
                        {sale.statusProducao === 'Agendado' && (
                          <>
                            <span>📅 Agendado</span>
                          </>
                        )}
                        {sale.statusProducao === 'Em Produção' && (
                          <>
                            <span>🔨 Em Produção</span>
                          </>
                        )}
                        {sale.statusProducao === 'Pronto para Retirada' && (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                            <span>✨ Pronto para Retirada</span>
                          </>
                        )}
                        {sale.statusProducao !== 'Agendado' && sale.statusProducao !== 'Em Produção' && sale.statusProducao !== 'Pronto para Retirada' && (
                          <>
                            <span>🤝 Entregue ao Cliente</span>
                          </>
                        )}
                      </span>

                      {sale.valorFaltante && sale.valorFaltante > 0 ? (
                        <span className="text-[9px] font-bold bg-rose-950/20 text-rose-400 border border-rose-900/20 px-1.5 py-0.5 rounded">
                          Pendente R$ {sale.valorFaltante.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-emerald-950/20 text-emerald-450 border border-emerald-900/10 px-1.5 py-0.5 rounded">
                          Pago Integral
                        </span>
                      )}
                    </div>

                    {/* Client header information */}
                    <div>
                      <h4 className="text-sm font-bold text-zinc-150 flex items-center gap-1.5">
                        <User className="h-4 w-4 text-zinc-400 shrink-0" />
                        <span>{sale.cliente}</span>
                      </h4>
                      {sale.telefoneCliente && (
                        <p className="text-xs text-zinc-400 font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-zinc-500 shrink-0" />
                          <span>{sale.telefoneCliente}</span>
                        </p>
                      )}
                    </div>

                    {/* Items detail list structure inside card */}
                    <div className="bg-black/25 border border-zinc-850/80 p-3.5 rounded-xl space-y-2">
                      <span className="text-[8.5px] text-zinc-500 font-black uppercase tracking-wider block">Estojo de Peças e Serviços</span>
                      
                      {sale.itens && sale.itens.length > 0 ? (
                        <ul className="space-y-1 text-xs text-zinc-300">
                          {sale.itens.map((item, idx) => (
                            <li key={idx} className="flex justify-between items-center pr-1 text-[11px]">
                              <span className="truncate max-w-[260px] text-zinc-300">
                                • {item.produtoNome} <span className="text-zinc-500 text-[10px] font-mono">({item.quantity || item.quantidade}x)</span>
                              </span>
                              <span className="font-mono text-[10px] text-zinc-400">R$ {item.total.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex justify-between items-center text-[11px] text-zinc-300 pr-1">
                          <span>• {sale.produtoNome} <span className="text-zinc-500 text-[10px] font-mono">({sale.quantidade}x)</span></span>
                          <span className="font-mono text-[10px] text-zinc-400">R$ {sale.total.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center border-t border-zinc-900 pt-2 text-[11.5px] font-black text-zinc-200 mt-2">
                        <span>Total do Pedido</span>
                        <span className="text-brand-pink font-mono text-sm">R$ {sale.total.toFixed(2)}</span>
                      </div>
                    </div>

                  </div>

                  {/* Actions column */}
                  <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto shrink-0 self-stretch md:self-auto justify-center md:border-l md:border-zinc-850/40 md:pl-5">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReminderAction(sale)}
                          className={`flex-1 py-2.5 px-4 font-extrabold rounded-xl text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                            isReadyForPickup
                              ? 'bg-emerald-600 hover:bg-emerald-555 text-white shadow-emerald-950/40'
                              : 'bg-brand-pink hover:bg-brand-pink/90 text-black shadow-black/45'
                          }`}
                        >
                          <MessageSquare className="h-4 w-4 shrink-0" />
                          <span>{isReadyForPickup ? 'Compartilhar Mensagem' : 'Avisar Pronto & Contatar'}</span>
                          <ArrowRight className="h-3 w-3 shrink-0 animate-bounce-horizontal" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const confirmDel = window.confirm(`Deseja liquidar todo o saldo faltante e marcar o pedido de ${sale.cliente} como entregue agora?`);
                            if (confirmDel) {
                              playNotificationChime();
                              onUpdateSale({
                                ...sale,
                                status: 'Concluído',
                                valorFaltante: 0,
                                valorPago: sale.total,
                                statusProducao: 'Entregue'
                              });
                            }
                          }}
                          className="py-2.5 px-4 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 font-bold rounded-xl text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>Liquidar &amp; Entregar</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-center py-4 px-3 flex flex-col items-center justify-center text-emerald-500 gap-1.5 select-none">
                        <CheckCircle className="h-6 w-6 stroke-[3]" />
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Status Concluído</span>
                      </div>
                    )}
                  </div>

                </motion.div>
              );
            })}

            {filteredSales.length === 0 && (
              <div className="py-12 text-center bg-black/10 border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center space-y-2.5">
                <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-650 select-none">
                  <Bell className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-300">Sem lembretes filtrados para hoje</h4>
                  <p className="text-[10.5px] text-zinc-500 mt-0.5">Altere os botões de filtro acima ou confira os demais dias.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side section - Logística de Amanhã */}
        <div className="space-y-5 bg-zinc-900/15 border border-zinc-850/60 p-5 rounded-2xl">
          
          <div className="flex items-center justify-between border-b border-zinc-805 pb-3">
            <h3 className="text-sm font-bold text-amber-500 tracking-wide flex items-center gap-2 select-none">
              <Truck className="h-4.5 w-4.5 text-amber-500 shrink-0" />
              <span>Logística de Amanhã</span>
            </h3>
            <span className="text-[9px] font-black bg-amber-950/40 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded-md">
              {tomorrowSales.length} {tomorrowSales.length === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>

          {/* Tomorrow's Date Header Widget */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-wider">{getTomorrowDayOfWeekName()}</span>
              <p className="text-xs font-bold text-zinc-300">{getTomorrowFormattedDateLong()}</p>
            </div>
            <span className="text-[9px] font-mono text-zinc-550 select-none">Preparar Acervos</span>
          </div>

          <div className="bg-amber-900/5 text-[10px] text-zinc-400 leading-relaxed p-3.5 rounded-xl border border-amber-900/15">
            ⚠️ <strong>Dica Prática:</strong> Separar as tampas dos copos e verificar se tem borda pra colocar nos pedidos.
          </div>

          {/* Tomorrow's entries list */}
          <div className="space-y-3">
            {tomorrowSales.map((sale) => {
              const isPending = sale.statusProducao !== 'Entregue' && sale.status !== 'Concluído';
              
              return (
                <div 
                  key={sale.id}
                  className={`bg-black/35 border border-zinc-850 rounded-xl p-4 space-y-3.5 transition-all hover:border-zinc-800 ${
                    !isPending ? 'opacity-55' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-zinc-200 truncate flex items-center gap-1.5 max-w-[130px]">
                        <User className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate">{sale.cliente}</span>
                      </h4>
                      {sale.numeroPedido && (
                        <span className="text-[8.5px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono font-extrabold shrink-0">
                          #{sale.numeroPedido}
                        </span>
                      )}
                    </div>
                    {sale.telefoneCliente && (
                      <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{sale.telefoneCliente}</span>
                      </div>
                    )}
                  </div>

                  {/* Summary of Items */}
                  <div className="border-t border-zinc-900 pt-2.5 space-y-1">
                    {sale.itens && sale.itens.length > 0 ? (
                      <div className="space-y-0.5">
                        {sale.itens.map((it, i) => (
                          <div key={i} className="flex justify-between items-center text-[10.5px]">
                            <span className="text-zinc-450 truncate max-w-[130px]">• {it.produtoNome}</span>
                            <span className="text-zinc-500 font-mono text-[9px] font-bold">({it.quantity || it.quantidade}x)</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[10.5px]">
                        <span className="text-zinc-455 truncate max-w-[130px]">• {sale.produtoNome}</span>
                        <span className="text-zinc-500 font-mono text-[9px] font-bold">({sale.quantidade}x)</span>
                      </div>
                    )}
                  </div>

                  {/* Tomorrow's Action items & Status stepper select */}
                  <div className="border-t border-zinc-900 pt-2.5 flex items-center justify-between gap-1.5 flex-wrap">
                    <select
                      value={sale.statusProducao || 'Agendado'}
                      onChange={(e) => {
                        const targetStatus = e.target.value as any;
                        const update: Sale = {
                          ...sale,
                          statusProducao: targetStatus,
                          ...(targetStatus === 'Entregue' ? { status: 'Concluído', valorFaltante: 0, valorPago: sale.total } : {})
                        };
                        onUpdateSale(update);
                      }}
                      className="text-[9px] bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-md px-1.5 py-1 text-zinc-300 font-bold focus:outline-none"
                    >
                      <option value="Agendado">📅 Agendado</option>
                      <option value="Em Produção">🔨 Produzindo</option>
                      <option value="Pronto para Retirada">✨ Pronto</option>
                      <option value="Entregue">🤝 Entregue</option>
                    </select>

                    {isPending ? (
                      <button
                        type="button"
                        onClick={() => handleReminderAction(sale)}
                        className="py-1 px-2.5 bg-brand-pink/15 hover:bg-brand-pink text-brand-pink hover:text-black transition-all font-black text-[9px] rounded-md flex items-center gap-1 cursor-pointer select-none"
                        title="Diga que está pronto preventivamente e envie WhatsApp"
                      >
                        <span>WhatsApp</span>
                        <ArrowRight className="h-2.5 w-2.5" />
                      </button>
                    ) : (
                      <span className="text-[9px] font-black uppercase text-emerald-400 flex items-center gap-1 select-none">
                        <CheckCircle className="h-3 w-3" /> Entregue
                      </span>
                    )}
                  </div>

                </div>
              );
            })}

            {tomorrowSales.length === 0 && (
              <div className="py-12 text-center bg-black/10 border border-dashed border-zinc-850 rounded-xl flex flex-col items-center justify-center space-y-2">
                <span className="text-xl">🛌</span>
                <div>
                  <h5 className="text-[11.5px] font-bold text-zinc-400">Tudo calmo amanhã</h5>
                  <p className="text-[10px] text-zinc-550">Nenhum acervo agendado para retirada amanhã.</p>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* WhatsApp Notifier Integration */}
      <WhatsAppNotifier 
        sale={selectedSaleForWA}
        isOpen={selectedSaleForWA !== null}
        onClose={() => setSelectedSaleForWA(null)}
        onUpdateSale={onUpdateSale}
        storeInfo={storeInfo}
      />

    </div>
  );
}
