import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bell, 
  Calendar, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  Phone, 
  User, 
  Users,
  ArrowRight,
  Truck,
  Brain,
  Sparkles,
  RefreshCw,
  Gift,
  HelpCircle,
  TrendingUp,
  History,
  Check,
  Send,
  Zap,
  FileText,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sale, StoreInfo } from '../types';
import { WhatsAppNotifier } from './WhatsAppNotifier';
import { Receipt } from './Receipt';
import { playAppSound } from '../lib/audio';

interface RemindersManagerProps {
  sales: Sale[];
  storeInfo: StoreInfo;
  onUpdateSale: (updatedSale: Sale) => void;
  isAdmin?: boolean;
}

export function RemindersManager({ sales, storeInfo, onUpdateSale, isAdmin = false }: RemindersManagerProps) {
  const [selectedSaleForWA, setSelectedSaleForWA] = useState<Sale | null>(null);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [filterType, setFilterType] = useState<'todos' | 'pendentes' | 'concluidos'>('todos');
  const [readyId, setReadyId] = useState<string | null>(null);
  const [schedulingSaleId, setSchedulingSaleId] = useState<string | null>(null);
  
  // Predictive recurrence engine states
  const [activeSubTab, setActiveSubTab] = useState<'lembretes' | 'recorrencia' | 'indicacao'>('lembretes');

  // Safeguard: Reset activeSubTab to 'lembretes' if the user is not an admin
  useEffect(() => {
    if (!isAdmin && activeSubTab !== 'lembretes') {
      setActiveSubTab('lembretes');
    }
  }, [isAdmin, activeSubTab]);

  const [contactedSaleIds, setContactedSaleIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('oxente_predictive_contacted_ids');
    return saved ? JSON.parse(saved) : [];
  });

  const markAsContacted = (saleId: string) => {
    const updated = [...contactedSaleIds, saleId];
    setContactedSaleIds(updated);
    localStorage.setItem('oxente_predictive_contacted_ids', JSON.stringify(updated));
  };

  const clearContactedList = () => {
    if (window.confirm('Deseja limpar o histórico visual de contatos efetuados hoje?')) {
      setContactedSaleIds([]);
      localStorage.removeItem('oxente_predictive_contacted_ids');
    }
  };

  // Referral metrics calculated dynamically based on sales list
  const referralMetrics = useMemo(() => {
    const indicatorsMap: {
      [code: string]: {
        indicatorName: string;
        indicatorPhone: string;
        code: string;
        referredSales: { friendName: string; saleDate: string; total: number; orderNum: string }[];
        cashbackEarned: number;
        originalSale: Sale;
      }
    } = {};

    // 1. Initialize codes of all previous orders
    sales.forEach(sale => {
      if (!sale.cliente) return;
      const firstName = sale.cliente.trim().split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase();
      const pedNum = sale.numeroPedido || sale.id.substring(sale.id.length - 5).toUpperCase();
      const code = `${firstName}${pedNum}`;
      
      if (!indicatorsMap[code]) {
        indicatorsMap[code] = {
          indicatorName: sale.cliente,
          indicatorPhone: sale.telefoneCliente || '',
          code: code,
          referredSales: [],
          cashbackEarned: 0,
          originalSale: sale
        };
      }
    });

    // 2. Map who used which code
    let totalCompletedReferrals = 0;
    let totalReferredRevenue = 0;

    sales.forEach(sale => {
      if (sale.indicadoCodigo) {
        const uppercaseCode = sale.indicadoCodigo.trim().toUpperCase();
        if (indicatorsMap[uppercaseCode]) {
          indicatorsMap[uppercaseCode].referredSales.push({
            friendName: sale.cliente,
            saleDate: sale.data,
            total: sale.total,
            orderNum: sale.numeroPedido || ''
          });
          indicatorsMap[uppercaseCode].cashbackEarned += 10;
          totalCompletedReferrals += 1;
          totalReferredRevenue += sale.total;
        }
      }
    });

    const indicatorsList = Object.values(indicatorsMap).filter(ind => ind.code && ind.indicatorName);

    return {
      indicatorsList,
      totalCompletedReferrals,
      totalReferredRevenue,
      totalCashbackEarned: totalCompletedReferrals * 10
    };
  }, [sales]);

  // Memoized calculations for predictive engine
  const predictiveOpportunities = useMemo(() => {
    const opps: any[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();

    // Group only valid past sales (not budgets, and having valid date)
    const validSales = sales.filter(s => s.status !== 'Orçamento' && s.dataRetirada);

    validSales.forEach(sale => {
      try {
        const pastDate = new Date(sale.dataRetirada + 'T12:00:00');
        if (isNaN(pastDate.getTime())) return;

        const eventYear = pastDate.getFullYear();
        // Only predict based on previous years' data (e.g., 2025 or older)
        if (eventYear >= currentYear) return;

        // Create the same date, but for the current year
        const recurrenceDate = new Date(currentYear, pastDate.getMonth(), pastDate.getDate(), 12, 0, 0);
        
        // Difference in days
        const diffTime = recurrenceDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Window of interest: event occurs in the next 45 days, or occurred in the last 15 days
        if (diffDays >= -15 && diffDays <= 45) {
          opps.push({
            sale,
            pastDate,
            recurrenceDate,
            diffDays,
          });
        }
      } catch (e) {
        console.error(e);
      }
    });

    // Sort: upcoming first, then historical
    opps.sort((a, b) => {
      if (a.diffDays >= 0 && b.diffDays < 0) return -1;
      if (a.diffDays < 0 && b.diffDays >= 0) return 1;
      return Math.abs(a.diffDays) - Math.abs(b.diffDays);
    });

    // Group / Deduplicate by client to avoid spamming multiple past orders for the exact same month
    const finalOpps: any[] = [];
    const seenKeys = new Set<string>();

    opps.forEach(o => {
      const p = o.sale.telefoneCliente ? o.sale.telefoneCliente.replace(/\D/g, '') : '';
      const k = p ? `${p}-${o.pastDate.getMonth()}` : `${o.sale.cliente}-${o.pastDate.getMonth()}`;
      if (!seenKeys.has(k)) {
        seenKeys.add(k);
        finalOpps.push(o);
      }
    });

    return finalOpps;
  }, [sales]);

  // Statistics for the predictive engine
  const predictiveStats = useMemo(() => {
    const count = predictiveOpportunities.length;
    const potentialRevenue = predictiveOpportunities.reduce((sum, o) => sum + (o.sale.total || 0), 0);
    const avgTicket = count > 0 ? potentialRevenue / count : 0;
    return { count, potentialRevenue, avgTicket };
  }, [predictiveOpportunities]);

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
      const isPending = sale.statusProducao !== 'Entregue' && sale.status !== 'Concluído' && sale.status !== 'Pago total';
      
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
    return todaySales.filter(s => s.statusProducao !== 'Entregue' && s.status !== 'Concluído' && s.status !== 'Pago total').length;
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
      
      {/* Subtab Switcher: Lembretes vs Recorrência vs Indicação */}
      {isAdmin && (
        <div className="flex bg-zinc-950 p-1 border border-zinc-900 rounded-xl max-w-md no-print">
          <button
            onClick={() => setActiveSubTab('lembretes')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-transparent ${
              activeSubTab === 'lembretes'
                ? 'bg-brand-pink text-black font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>🔔 Lembretes</span>
          </button>
          <button
            onClick={() => setActiveSubTab('recorrencia')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-transparent ${
              activeSubTab === 'recorrencia'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/45 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Brain className="h-3.5 w-3.5 text-purple-300" />
            <span>🔮 Recorrência</span>
          </button>
          <button
            onClick={() => setActiveSubTab('indicacao')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-transparent ${
              activeSubTab === 'indicacao'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/45 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Gift className="h-3.5 w-3.5 text-emerald-300" />
            <span>🎁 Indicação R$10</span>
          </button>
        </div>
      )}

      {activeSubTab === 'lembretes' && (
        <>
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
              const isPending = sale.statusProducao !== 'Entregue' && sale.status !== 'Concluído' && sale.status !== 'Pago total';
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
                      <span className="text-[10px] bg-zinc-950 border border-zinc-850 text-zinc-400 font-mono font-bold px-2 py-0.5 rounded-md">
                        Pedido #{sale.numeroPedido || sale.id.substring(0, 5).toUpperCase()}
                      </span>
                      
                      <button
                        type="button"
                        onClick={() => {
                          playAppSound('click');
                          setSelectedSaleForReceipt(sale);
                        }}
                        className="text-[9.5px] bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 hover:text-purple-100 border border-purple-800/45 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                        title="Visualizar Recibo Completo"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Ver Recibo</span>
                      </button>
                      
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1.5 ${
                        (!sale.statusProducao || sale.statusProducao === 'Agendado') ? 'bg-blue-900/10 text-blue-400 border-blue-900/20' :
                        sale.statusProducao === 'Em Produção' ? 'bg-amber-900/10 text-amber-400 border-amber-900/20 animate-pulse' :
                        sale.statusProducao === 'Pronto para Retirada' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-extrabold' :
                        sale.statusProducao === 'Agendado para Entrega' ? 'bg-purple-900/10 text-purple-400 border-purple-900/20 font-bold' :
                        'bg-emerald-900/10 text-emerald-450 border-emerald-900/20'
                      }`}>
                        {(!sale.statusProducao || sale.statusProducao === 'Agendado') && (
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
                        {sale.statusProducao === 'Agendado para Entrega' && (
                          <>
                            <span>🚚 Agendado p/ Entrega {sale.turnoEntrega ? (
                              <strong className="text-white font-black bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 text-[9.5px] uppercase ml-1">
                                {sale.turnoEntrega === 'Manhã' ? '☀️ MANHÃ' : '🌇 TARDE'}
                              </strong>
                            ) : ''}</span>
                          </>
                        )}
                        {sale.statusProducao === 'Entregue' && (
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
                            sale.avisoProntoSended
                              ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/45'
                              : isReadyForPickup
                                ? 'bg-emerald-600 hover:bg-emerald-555 text-white shadow-emerald-950/40'
                                : 'bg-brand-pink hover:bg-brand-pink/90 text-black shadow-black/45'
                          }`}
                        >
                          <MessageSquare className="h-4 w-4 shrink-0" />
                          <span>
                            {sale.avisoProntoSended
                              ? 'Aviso Pronto Enviado 🍊'
                              : isReadyForPickup
                                ? 'Compartilhar Mensagem'
                                : 'Avisar Pronto & Contatar'}
                          </span>
                          <ArrowRight className="h-3 w-3 shrink-0 animate-bounce-horizontal" />
                        </button>
                        
                        {schedulingSaleId === sale.id ? (
                          <div className="bg-purple-950/30 border border-purple-800/60 rounded-xl p-2.5 space-y-2 mt-1 animate-fade-in no-print">
                            <span className="block text-[8.5px] uppercase font-black text-purple-300 tracking-wider text-center select-none">
                              Turno da entrega domiciliar:
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  playAppSound('success');
                                  onUpdateSale({
                                    ...sale,
                                    statusProducao: 'Agendado para Entrega',
                                    turnoEntrega: 'Manhã',
                                    foiAlterado: true,
                                    editadoEm: new Date().toISOString()
                                  });
                                  setSchedulingSaleId(null);
                                }}
                                className="py-2 px-1 bg-amber-600 hover:bg-amber-500 text-white font-black text-[10.5px] rounded-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-amber-955/20 border border-amber-500"
                              >
                                <span>☀️ Manhã</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  playAppSound('success');
                                  onUpdateSale({
                                    ...sale,
                                    statusProducao: 'Agendado para Entrega',
                                    turnoEntrega: 'Tarde',
                                    foiAlterado: true,
                                    editadoEm: new Date().toISOString()
                                  });
                                  setSchedulingSaleId(null);
                                }}
                                className="py-2 px-1 bg-orange-600 hover:bg-orange-500 text-white font-black text-[10.5px] rounded-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-orange-955/20 border border-orange-500"
                              >
                                <span>🌇 Tarde</span>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSchedulingSaleId(null)}
                              className="w-full py-1 text-[9px] text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-md cursor-pointer transition-colors mt-0.5 font-bold"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              playAppSound('click');
                              setSchedulingSaleId(sale.id);
                            }}
                            className={
                              sale.statusProducao === 'Agendado para Entrega'
                                ? "py-2.5 px-4 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-400 hover:text-emerald-200 font-extrabold rounded-xl text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-955/15"
                                : "py-2.5 px-4 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/45 text-purple-300 hover:text-purple-100 font-extrabold rounded-xl text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                            }
                          >
                            <span>
                              {sale.statusProducao === 'Agendado para Entrega'
                                ? '🚚 Agendado'
                                : '🚚 Agendar para Entrega'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const confirmDel = window.confirm(`Deseja liquidar todo o saldo faltante e marcar o pedido de ${sale.cliente} como entregue agora?`);
                            if (confirmDel) {
                              playNotificationChime();
                              onUpdateSale({
                                ...sale,
                                status: 'Pago total',
                                valorPagoAntesConcluir: sale.valorPago ?? 0,
                                valorFaltanteAntesConcluir: sale.valorFaltante ?? (sale.total - (sale.valorPago ?? 0)),
                                statusProducaoAntesConcluir: sale.statusProducao || 'Agendado',
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
                      <div className="text-center py-2 px-3 flex flex-col items-center justify-center gap-2 select-none">
                        <div className="flex flex-col items-center justify-center text-emerald-500 gap-1.5">
                          <CheckCircle className="h-5 w-5 stroke-[3]" />
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-450">Status Pago Total</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const confirmUndo = window.confirm(`Deseja desfazer a conclusão/entrega do pedido de ${sale.cliente}?`);
                            if (confirmUndo) {
                              const prevValorPago = sale.valorPagoAntesConcluir !== undefined 
                                ? sale.valorPagoAntesConcluir 
                                : (sale.valoresOriginais?.valorPago !== undefined ? sale.valoresOriginais.valorPago : Math.max(0, sale.total - (sale.valoresOriginais?.valorFaltante ?? 0)));

                              const prevValorFaltante = sale.valorFaltanteAntesConcluir !== undefined 
                                ? sale.valorFaltanteAntesConcluir 
                                : (sale.valoresOriginais?.valorFaltante !== undefined ? sale.valoresOriginais.valorFaltante : Math.max(0, sale.total - prevValorPago));

                              onUpdateSale({
                                ...sale,
                                status: 'Pendente',
                                valorPago: prevValorPago,
                                valorFaltante: prevValorFaltante,
                                statusProducao: sale.statusProducaoAntesConcluir || 'Agendado',
                                foiAlterado: true,
                                editadoEm: new Date().toISOString()
                              });
                            }
                          }}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 text-zinc-300 border border-zinc-750 rounded-lg text-[9.5px] font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <span>↩️ Desfazer Conclusão</span>
                        </button>
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
              const isPending = sale.statusProducao !== 'Entregue' && sale.status !== 'Concluído' && sale.status !== 'Pago total';
              
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
                      <div className="flex items-center gap-1 shrink-0">
                        {sale.numeroPedido && (
                          <span className="text-[8.5px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono font-extrabold">
                            #{sale.numeroPedido}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            playAppSound('click');
                            setSelectedSaleForReceipt(sale);
                          }}
                          className="p-1 bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 hover:text-purple-100 border border-purple-800/45 rounded-md cursor-pointer transition-colors flex items-center justify-center"
                          title="Visualizar Recibo"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
                          ...(targetStatus === 'Entregue' ? { status: 'Pago total', valorFaltante: 0, valorPago: sale.total } : {})
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
                        className={`py-1 px-2.5 transition-all font-black text-[9px] rounded-md flex items-center gap-1 cursor-pointer select-none ${
                          sale.avisoProntoSended
                            ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-600 hover:text-white border border-orange-500/30'
                            : 'bg-brand-pink/15 hover:bg-brand-pink text-brand-pink hover:text-black'
                        }`}
                        title="Diga que está pronto preventivamente e envie WhatsApp"
                      >
                        <span>{sale.avisoProntoSended ? 'Zap Enviado 🍊' : 'WhatsApp'}</span>
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
        </>
      )}

      {activeSubTab === 'recorrencia' && isAdmin && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Banner */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Brain className="h-28 w-28 text-purple-400 shrink-0" />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 select-none">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-lg font-bold text-zinc-100 font-sans">Motor de Recorrência Preditiva</h3>
                  <span className="text-[9px] uppercase tracking-widest font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">Ativo • Premium IA</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 leading-normal">
                  Identifica clientes de anos anteriores que estão se aproximando da data do mesmo evento (aniversários, festas anuais, comemorações recorrentes) baseados no histórico de aluguéis e compras da <strong className="text-brand-pink font-semibold">Oxente Festeje</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-zinc-900/50 border border-zinc-850 p-4 rounded-xl relative overflow-hidden">
              <span className="text-[9.5px] text-zinc-500 font-black uppercase tracking-wider block select-none">Clientes no Período de Festa</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-purple-400 font-mono">{predictiveStats.count}</span>
                <span className="text-[10px] text-zinc-400 font-semibold">oportunidades</span>
              </div>
              <p className="text-[9.5px] text-zinc-550 mt-1 leading-normal flex items-center gap-1 font-sans">
                <Clock className="h-3 w-3 shrink-0" /> Janela de 60 dias calculada
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-850 p-4 rounded-xl relative overflow-hidden">
              <span className="text-[9.5px] text-zinc-500 font-black uppercase tracking-wider block select-none">Volume Potencial Estimado</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  R$ {predictiveStats.potentialRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[9.5px] text-zinc-550 mt-1 leading-normal font-sans">
                Soma dos antigos pedidos reativáveis
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-850 p-4 rounded-xl relative overflow-hidden">
              <span className="text-[9.5px] text-zinc-500 font-black uppercase tracking-wider block select-none">Ticket Médio Reconvite</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-brand-pink font-mono">
                  R$ {predictiveStats.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[9.5px] text-zinc-550 mt-1 leading-normal font-sans flex justify-between items-center">
                <span>Sugestão de desconto ativo: 10%</span>
                {contactedSaleIds.length > 0 && (
                  <button 
                    onClick={clearContactedList} 
                    className="text-red-400 hover:underline font-bold text-[9px]"
                  >
                    Limpar Envios
                  </button>
                )}
              </p>
            </div>

          </div>

          <div className="border-b border-zinc-800 pb-2">
            <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Feed de Prospecção Preditiva (Aniversário do Pedido)</h4>
          </div>

          {predictiveOpportunities.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-zinc-850 rounded-2xl bg-zinc-950/20 max-w-xl mx-auto flex flex-col items-center justify-center space-y-3.5">
              <div className="h-12 w-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 text-lg">🔍</div>
              <div>
                <h5 className="text-sm font-bold text-zinc-300">Tudo calmo na prospecção preditiva</h5>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto mt-1 leading-relaxed">
                  Não existem pedidos anteriores (de anos passados) cujas datas de aniversário estejam na janela de -15 a +45 dias a partir de hoje. Conforme mais dados históricos forem acumulados, novas previsões surgirão!
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {predictiveOpportunities.map((opp) => {
                const { sale, pastDate, recurrenceDate, diffDays } = opp;
                const isContacted = contactedSaleIds.includes(sale.id);
                
                // Construct premium customized message
                const phoneOnly = sale.telefoneCliente ? sale.telefoneCliente.replace(/\D/g, '') : '';
                const finalPhone = (phoneOnly.length === 10 || phoneOnly.length === 11) ? `55${phoneOnly}` : phoneOnly;
                
                const pedNumber = sale.numeroPedido || sale.id.substring(0, 5).toUpperCase();
                const pastDateFormatted = pastDate.toLocaleDateString('pt-BR');
                const productsListStr = sale.itens && sale.itens.length > 0
                  ? sale.itens.map(it => `${it.quantidade}x ${it.produtoNome}`).join(', ')
                  : `${sale.quantidade || 1}x ${sale.produtoNome}`;

                const whatsappMessage = `Olá *${sale.cliente}*! Tudo bem? 🌸✨\n\nAqui é da equipe do salão de acervos *Oxente Festeje*! Estávamos revisando nosso calendário de eventos e lembramos com muito carinho daquela festa linda e inesquecível de vocês no ano passado (*pedido #${pedNumber}* realizado em *${pastDateFormatted}* com o item *${productsListStr}*)! 😍🥳\n\nComo o tempo passa voando, a data anual dessa festa linda já está se aproximando novamente! 📅🎈\n\nSabemos que planejar a comemoração com antecedência é a melhor forma de garantir os seus itens prediletos no nosso salão e deixar tudo impecável. Gostaríamos de saber se já está organizando a festa deste ano? \n\nTemos novidades incríveis de personagens, painéis e decorações no acervo que vocês vão se apaixonar! Além de prepararmos uma cortesia especial super carinhosa para você que já festeja conosco! 🥰🎁\n\nSe tiver um tempinho e quiser bater um papo para trocar ideias ou ver nosso catálogo atualizado, é só me responder por aqui! Vamos adorar fazer parte desse dia feliz de novo! 💖✨`;

                const whatsappUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(whatsappMessage)}`;

                return (
                  <div 
                    key={sale.id}
                    className={`border rounded-2xl p-5 bg-zinc-900/40 transition-all duration-300 relative overflow-hidden flex flex-col justify-between space-y-4 ${
                      isContacted 
                        ? 'border-zinc-905 opacity-60' 
                        : diffDays === 0
                          ? 'border-purple-500/50 bg-purple-950/5 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                          : diffDays > 0 && diffDays <= 10
                            ? 'border-amber-500/25 hover:border-amber-500/45 bg-amber-500/5'
                            : 'border-zinc-800 hover:border-zinc-750'
                    }`}
                  >
                    
                    {/* Floating top right badge */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] bg-zinc-950 border border-zinc-850 text-zinc-450 font-mono font-bold px-2 py-0.5 rounded-md inline-block">
                          Pedido Original #${pedNumber}
                        </span>
                        <h4 className="text-[13px] font-black text-zinc-150 truncate flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-zinc-500 lg:hidden" />
                          <span className="truncate">{sale.cliente}</span>
                        </h4>
                      </div>

                      {/* Recurrence Status Tag */}
                      <div className="text-right">
                        {diffDays === 0 ? (
                          <span className="text-[8px] font-black uppercase text-purple-300 bg-purple-950/80 border border-purple-800 px-2 py-1 rounded">
                            🔥 É HOJE!
                          </span>
                        ) : diffDays < 0 ? (
                          <span className="text-[8px] font-black uppercase text-zinc-400 bg-zinc-950 border border-zinc-900 px-2 py-1 rounded">
                            📅 Há {Math.abs(diffDays)} dias
                          </span>
                        ) : (
                          <span className="text-[8px] font-black uppercase text-amber-400 bg-amber-950/20 border border-amber-900/30 px-2 py-1 rounded">
                            ⏳ Daqui a {diffDays} dias
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Past Order History Details */}
                    <div className="bg-black/30 border border-zinc-850/40 rounded-xl p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-[10.5px] text-zinc-500">
                        <span>Festa original:</span>
                        <span className="font-mono text-zinc-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {pastDateFormatted}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-start text-[10.5px] gap-4">
                        <span className="text-zinc-500 shrink-0">Item alugado:</span>
                        <span className="text-zinc-300 font-bold text-right truncate">
                          {productsListStr}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10.5px] border-t border-zinc-900 pt-1.5 mt-1">
                        <span className="text-zinc-500">Valor investido:</span>
                        <span className="text-brand-pink font-bold font-mono">
                          R$ {sale.total.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Suggested message template visual representation */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[8.5px] uppercase font-black tracking-wider text-purple-400 flex items-center gap-1 select-none">
                          <Zap className="h-3 w-3 text-purple-400" /> Abordagem Preditiva Sugerida
                        </span>
                        
                        {sale.telefoneCliente ? (
                          <span className="text-[9px] text-zinc-400 font-mono bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded flex items-center gap-1 select-all">
                            <Phone className="h-2.5 w-2.5 text-zinc-650" /> {sale.telefoneCliente}
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold text-red-400">Falha: Sem celular</span>
                        )}
                      </div>
                      <div className="bg-black/55 border border-purple-950 p-2.5 rounded-xl text-[10px] text-zinc-400 leading-normal max-h-[110px] overflow-y-auto font-sans select-all select-text border-dashed whitespace-pre-line italic">
                        {whatsappMessage}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-900/40">
                      {sale.telefoneCliente ? (
                        <a 
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => {
                            playNotificationChime();
                            markAsContacted(sale.id);
                          }}
                          className={`flex-1 py-2 px-3 font-extrabold rounded-xl text-[10.5px] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                            isContacted
                              ? 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300'
                              : 'bg-purple-600 hover:bg-purple-550 text-white shadow-purple-900/10'
                          }`}
                        >
                          <Send className="h-3.5 w-3.5 shrink-0" />
                          <span>{isContacted ? 'Contatar Novamente' : '🚀 Disparar Reconvite'}</span>
                        </a>
                      ) : (
                        <div className="flex-1 py-1.5 px-3 bg-red-950/10 text-red-400 border border-red-900/20 text-center rounded-xl text-[9.5px] font-bold">
                          Falta telefone de cadastro para o Zap
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (isContacted) {
                            setContactedSaleIds(prev => prev.filter(id => id !== sale.id));
                          } else {
                            markAsContacted(sale.id);
                          }
                        }}
                        className={`p-2 rounded-xl transition-colors cursor-pointer select-none border ${
                          isContacted
                            ? 'bg-zinc-900 border-zinc-850 text-emerald-400'
                            : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                        }`}
                        title={isContacted ? "Marcar como não contactado" : "Já contactei manualmente / Ocultar indicador"}
                      >
                        <Check className="h-4 w-4 shrink-0" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {activeSubTab === 'indicacao' && isAdmin && (
        <div className="space-y-6 animate-fade-in font-sans">
          
          {/* Header Jumbotron */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Gift className="h-28 w-28 text-emerald-400 shrink-0" />
            </div>
            
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 select-none">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-lg font-bold text-zinc-100 font-sans">Clube de Indicação Recompensada</h3>
                  <span className="text-[9px] uppercase tracking-widest font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">Referral Club • Premium</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Estimule o crescimento orgânico da <strong className="text-brand-pink font-semibold">Oxente Festeje</strong>! Seus clientes indicam amigos enviando um cupom com código de indicação personalizado. Quando o amigo realiza uma compra informando esse código, ele ganha <strong className="text-emerald-400 font-semibold">R$ 5,00 de desconto imediato</strong> e o cliente indicador ganha <strong className="text-emerald-400 font-semibold">R$ 10,00 de cashback automático</strong> para ser descontado na sua próxima compra ou festa.
                </p>
              </div>
            </div>
          </div>

          {/* Core Metrics Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-emerald-850/20 border border-emerald-900/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Indicações Efetuadas</span>
                <span className="text-xl font-mono font-bold text-emerald-400">{referralMetrics.totalCompletedReferrals}</span>
                <span className="text-[9px] text-zinc-500 block">Amigos que utilizaram cupom Oxente</span>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-purple-950/20 border border-purple-900/30 flex items-center justify-center text-purple-400 shrink-0">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Faturamento via Indicações</span>
                <span className="text-xl font-mono font-bold text-purple-400">R$ {referralMetrics.totalReferredRevenue.toFixed(2)}</span>
                <span className="text-[9px] text-zinc-500 block">Total faturado em novos clientes indicados</span>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-amber-950/20 border border-amber-900/30 flex items-center justify-center text-amber-500 shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Cashback Distribuído</span>
                <span className="text-xl font-mono font-bold text-amber-500">R$ {referralMetrics.totalCashbackEarned.toFixed(2)}</span>
                <span className="text-[9px] text-zinc-500 block">Créditos acumulados pelos indicadores</span>
              </div>
            </div>
          </div>

          {/* Guide steps card */}
          <div className="bg-zinc-950/50 border border-zinc-850 p-5 rounded-2xl space-y-3.5">
            <h4 className="text-xs font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5 select-none font-sans">
              📍 Regras e Rastreabilidade do Programa:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed text-zinc-400">
              <div className="space-y-1.5 bg-black/45 border border-zinc-900 p-3 rounded-xl">
                <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                  <span className="text-emerald-400 font-mono text-sm">1.</span>
                  <span>Geração de Cupom</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Quando a compra do cliente é finalizada, envie seu cupom comercial. Ele já possui um código exclusivo gerado com seu primeiro nome e número do pedido.
                </p>
              </div>

              <div className="space-y-1.5 bg-black/45 border border-zinc-900 p-3 rounded-xl">
                <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                  <span className="text-purple-400 font-mono text-sm">2.</span>
                  <span>Adesão do Amigo</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  O amigo indicado informa o código no momento da compra. O app valida e concede <strong>R$ 5,00 de desconto na hora</strong> na nova compra.
                </p>
              </div>

              <div className="space-y-1.5 bg-black/45 border border-zinc-900 p-3 rounded-xl">
                <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                  <span className="text-amber-500 font-mono text-sm">3.</span>
                  <span>Cashback Automático</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  O cliente originário que indicou ganha <strong>R$ 10,00 de cashback automático</strong> para ser descontado na sua próxima compra ou festa, incentivando a fidelização!
                </p>
              </div>
            </div>
          </div>

          {/* Indicators Leader list */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-md font-bold text-zinc-100 flex items-center gap-1.5 pb-0.5">
                  👥 Carteira de Indicadores & Cupons Disponíveis
                </h4>
                <p className="text-xs text-zinc-400">Pesquise por cliente e envie sua mensagem de indicação personalizada</p>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto overflow-x-auto rounded-xl border border-zinc-800 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <table className="w-full text-left text-xs bg-black/40 table-auto">
                <thead>
                  <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-850 font-bold text-[10.5px] uppercase tracking-wider">
                    <th className="py-3 px-4">Cliente Indicador</th>
                    <th className="py-3 px-4">Código / Cupom</th>
                    <th className="py-3 px-4 text-center">Contratos Indicados</th>
                    <th className="py-3 px-4 text-emerald-500 text-right">Cashback Acumulado</th>
                    <th className="py-3 px-4 text-center">Compartilhar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60 font-sans">
                  {referralMetrics.indicatorsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-500">
                        Nenhum indicador registrado ainda. Cadastre novas vendas para gerar cupons automaticamente!
                      </td>
                    </tr>
                  ) : (
                    referralMetrics.indicatorsList.map((ind) => {
                      const inviteMessage = `Olá ${ind.indicatorName.split(' ')[0]}! Muito obrigado por comprar com a Oxente Festeje! 😍🎈

Sua compra foi concluída com sucesso e para comemorar, você acaba de entrar no nosso *Clube de Indicação Recompensada*! 🎁✨

Funciona assim:
1. Compartilhe o seu código exclusivo *${ind.code}* com seus amigos que estão organizando festa.
2. Na primeira compra deles, eles informam o seu código no momento da compra e ganham *R$ 5,00 de desconto imediato* na hora!
3. Assim que eles fecharem a compra, você ganha *R$ 10,00 de cashback automático* para descontar na sua próxima compra conosco!

Compartilhe com quem vai festejar, dê desconto aos amigos e turbine seu saldo de cashback! 🥳`;

                      const cleanPhone = ind.indicatorPhone.replace(/\D/g, '');
                      const formattedPhoneForWA = cleanPhone.length > 0
                        ? (cleanPhone.startsWith('55') ? `+${cleanPhone}` : `+55${cleanPhone}`)
                        : '';

                      const shareWhatsappUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(formattedPhoneForWA)}&text=${encodeURIComponent(inviteMessage)}`;

                      const copyToClipboard = () => {
                        navigator.clipboard.writeText(inviteMessage).then(() => {
                          alert(`Folha de indicação copiada com sucesso para o cliente ${ind.indicatorName}! Cole e compartilhe.`);
                        }).catch(err => {
                          console.error('Erro ao copiar:', err);
                        });
                      };

                      return (
                        <tr key={ind.code} className="hover:bg-zinc-800/15 transition-all text-zinc-200">
                          <td className="py-3.5 px-4 font-semibold">
                            <div>{ind.indicatorName}</div>
                            {ind.indicatorPhone && (
                              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{ind.indicatorPhone}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-black text-purple-400 select-all tracking-wider text-sm">
                            {ind.code}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-zinc-300 font-mono">
                            {ind.referredSales.length > 0 ? (
                              <span className="inline-flex items-center gap-1.5 bg-emerald-950/45 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900/35">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-450 animate-pulse"></span>
                                {ind.referredSales.length} {ind.referredSales.length === 1 ? 'amigo' : 'amigos'}
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-[10.5px] font-normal italic">Ninguém ainda</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-400 text-sm">
                            R$ {ind.cashbackEarned.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              {ind.originalSale?.statusProducao === 'Entregue' ? (
                                <>
                                  {ind.indicatorPhone ? (
                                    <a
                                      href={shareWhatsappUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={() => {
                                        if (ind.originalSale) {
                                          onUpdateSale({
                                            ...ind.originalSale,
                                            referralSended: true
                                          });
                                        }
                                      }}
                                      className={`p-1.5 rounded-lg transition-all cursor-pointer block ${
                                        ind.originalSale?.referralSended
                                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                          : 'bg-emerald-600 hover:bg-emerald-550 text-white'
                                      }`}
                                      title={ind.originalSale?.referralSended ? "Já enviado! Clique para reenviar no WhatsApp" : "Enviar Cupom no WhatsApp"}
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </a>
                                  ) : (
                                    <button
                                      disabled
                                      className="p-1.5 bg-zinc-800 text-zinc-650 rounded-lg cursor-not-allowed"
                                      title="Sem telefone cadastrado"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      copyToClipboard();
                                      if (ind.originalSale) {
                                        onUpdateSale({
                                          ...ind.originalSale,
                                          referralSended: true
                                        });
                                      }
                                    }}
                                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors cursor-pointer"
                                    title="Copiar convite comercial e marcar como enviado"
                                  >
                                    <History className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900/60 border border-zinc-850 px-2 py-0.5 rounded tracking-wide select-none" title="Os cupons do programa de indicação só são habilitados após a entrega do pedido">
                                  ⌛ Aguardando Entrega
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* WhatsApp Notifier Integration */}
      <WhatsAppNotifier 
        sale={selectedSaleForWA}
        isOpen={selectedSaleForWA !== null}
        onClose={() => setSelectedSaleForWA(null)}
        onUpdateSale={onUpdateSale}
        storeInfo={storeInfo}
      />

      {/* Slide-over or Modal view for simulated thermal Receipt */}
      <AnimatePresence>
        {selectedSaleForReceipt && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-[1px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-90 w-full max-w-lg rounded-2xl p-6 relative my-8 shadow-2xl border border-zinc-800"
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-brand-pink" />
                  <span className="font-bold text-zinc-150 text-xs tracking-wide uppercase select-none">Cupom de Aluguel</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSaleForReceipt(null)}
                  className="px-2.5 py-1 text-[10px] font-black uppercase text-zinc-400 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700/50 rounded-lg cursor-pointer transition-all"
                >
                  Fechar
                </button>
              </div>

              <div className="max-h-[72vh] overflow-y-auto pr-1">
                <Receipt 
                  sale={selectedSaleForReceipt} 
                  storeInfo={storeInfo} 
                  onUpdateSale={(updatedSale) => {
                    onUpdateSale(updatedSale);
                    setSelectedSaleForReceipt(updatedSale);
                  }} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
