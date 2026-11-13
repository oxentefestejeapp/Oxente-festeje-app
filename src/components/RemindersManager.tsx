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
  RotateCcw,
  Gift,
  HelpCircle,
  TrendingUp,
  History,
  Check,
  Send,
  Zap,
  FileText,
  Eye,
  Lock,
  Unlock,
  Link,
  Search,
  X,
  Package,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  AlertTriangle,
  Layers,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sale, StoreInfo, Product, findMatchingProduct, detectProductCategoryGroup } from '../types';
import { WhatsAppNotifier } from './WhatsAppNotifier';
import { Receipt } from './Receipt';
import { playAppSound } from '../lib/audio';

interface RemindersManagerProps {
  sales: Sale[];
  products?: Product[];
  storeInfo: StoreInfo;
  onUpdateSale: (updatedSale: Sale) => void;
  isAdmin?: boolean;
}

export function getLinkedSales(sale: Sale, allSales: Sale[]): Sale[] {
  if (!sale.numeroPedido) return [];
  
  const linkedByThis = sale.pedidoVinculoNumero 
    ? allSales.filter(s => s.numeroPedido === sale.pedidoVinculoNumero && s.id !== sale.id) 
    : [];
    
  const linkedByOthers = allSales.filter(s => s.pedidoVinculoNumero === sale.numeroPedido && s.id !== sale.id);
  
  // Combine unique entries
  const uniqueLinkedSalesMap = new Map<string, Sale>();
  [...linkedByThis, ...linkedByOthers].forEach(s => {
    uniqueLinkedSalesMap.set(s.id, s);
  });
  
  return Array.from(uniqueLinkedSalesMap.values());
}

export function RemindersManager({ sales, products = [], storeInfo, onUpdateSale, isAdmin = false }: RemindersManagerProps) {
  const [selectedSaleForWA, setSelectedSaleForWA] = useState<Sale | null>(null);
  const [isDelayedReminderSelected, setIsDelayedReminderSelected] = useState<boolean>(false);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [filterType, setFilterType] = useState<'todos' | 'pendentes' | 'avisados' | 'concluidos' | 'esquecidos'>('pendentes');
  const [searchQuery, setSearchQuery] = useState('');
  const [readyId, setReadyId] = useState<string | null>(null);
  const [schedulingSaleId, setSchedulingSaleId] = useState<string | null>(null);
  
  // Subtabs: Lembretes do Dia, Agenda da Semana (disponível para todos), Recorrência e Indicação (Admin)
  const [activeSubTab, setActiveSubTab] = useState<'lembretes' | 'semana' | 'recorrencia' | 'indicacao'>('lembretes');

  // Weekly Delivery & Production Capacity Planner states
  const [weekMode, setWeekMode] = useState<'week' | 'custom'>('week');
  const [weekOffset, setWeekOffset] = useState<number>(1); // Default: Próxima Semana (ou alternável facilmente para Esta Semana)
  const [customRangeStart, setCustomRangeStart] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [customRangeEnd, setCustomRangeEnd] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('Todos');
  const [selectedSpecificProduct, setSelectedSpecificProduct] = useState<string>('');
  const [weekStatusFilter, setWeekStatusFilter] = useState<'todos' | 'pendentes' | 'prontos' | 'entregues'>('todos');
  const [weekSearchQuery, setWeekSearchQuery] = useState<string>('');
  const [weeklyCapacityLimit, setWeeklyCapacityLimit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('oxente_weekly_capacity_limit');
      const parsed = saved ? parseInt(saved, 10) : 60;
      return !isNaN(parsed) && parsed > 0 ? parsed : 60;
    } catch {
      return 60;
    }
  });
  const [isEditingCapacity, setIsEditingCapacity] = useState<boolean>(false);

  const updateWeeklyCapacityLimit = (newLimit: number) => {
    const safeLimit = Math.max(1, Math.min(9999, Math.round(newLimit || 1)));
    setWeeklyCapacityLimit(safeLimit);
    try {
      localStorage.setItem('oxente_weekly_capacity_limit', String(safeLimit));
    } catch {}
  };

  // Override / Unlock state for linked orders that are pending/unready
  const [unlockedLinkedOrderIds, setUnlockedLinkedOrderIds] = useState<string[]>([]);

  const toggleUnlockLinkedOrder = (saleId: string) => {
    playAppSound('click');
    setUnlockedLinkedOrderIds(prev => 
      prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]
    );
  };

  // Safeguard: Reset activeSubTab to 'lembretes' only if non-admin tries to open admin-only tabs
  useEffect(() => {
    if (!isAdmin && (activeSubTab === 'recorrencia' || activeSubTab === 'indicacao')) {
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
        cashbackEarned: number; // Storing active discount percentage (e.g. 5, 10, 15) for backward compatibility
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
          totalCompletedReferrals += 1;
          totalReferredRevenue += sale.total;
        }
      }
    });

    // 3. Post-process to calculate spent and available percentage-based coupons for each indicator
    const indicatorsList = Object.values(indicatorsMap).filter(ind => ind.code && ind.indicatorName);
    
    indicatorsList.forEach(ind => {
      const cleanClient = ind.indicatorName.trim().toLowerCase();
      const cleanPhone = ind.indicatorPhone.replace(/\D/g, '');
      
      // Find indicators' own completed purchases where they used their discount
      const clientPreviousSales = sales.filter(s => {
        if (s.status === 'Orçamento') return false;
        const matchByName = cleanClient.length >= 3 && s.cliente && s.cliente.trim().toLowerCase() === cleanClient;
        const matchByPhone = cleanPhone.length >= 8 && s.telefoneCliente && s.telefoneCliente.replace(/\D/g, '') === cleanPhone;
        return matchByName || matchByPhone;
      });
      
      let totalReferralsSpent = 0;
      clientPreviousSales.forEach(s => {
        if (s.cashbackGasto) {
          totalReferralsSpent += (s.cashbackGasto / 5);
        }
      });
      
      const totalReferralsEarned = ind.referredSales.length;
      const availableReferrals = Math.max(0, totalReferralsEarned - totalReferralsSpent);
      const availableDiscountPercent = Math.min(15, availableReferrals * 5);
      
      ind.cashbackEarned = availableDiscountPercent; // Store active percentage (0, 5, 10, 15)
    });

    return {
      indicatorsList,
      totalCompletedReferrals,
      totalReferredRevenue,
      totalCashbackEarned: totalCompletedReferrals * 5 // Each completed referral is 5% base value
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

  // Helper to safely calculate how many days late an order is
  const getDaysLate = (dateStr: string) => {
    try {
      const d1 = new Date(todayStr + 'T12:00:00');
      const d2 = new Date(dateStr + 'T12:00:00');
      const diffTime = d1.getTime() - d2.getTime();
      return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    } catch {
      return 1;
    }
  };

  // Filter sales that are scheduled for pickup today OR un-delivered orders from past days (excluding estimates)
  const todaySales = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'Orçamento' || !s.dataRetirada) return false;
      if (s.statusProducao === 'Entregue') return false;
      if (s.dataRetirada === todayStr) return true;
      if (s.dataRetirada < todayStr) return true;
      return false;
    });
  }, [sales, todayStr]);

  // Filter sales scheduled for pickup tomorrow (excluding estimates)
  const tomorrowSales = useMemo(() => {
    return sales.filter(s => s.dataRetirada === tomorrowStr && s.status !== 'Orçamento');
  }, [sales, tomorrowStr]);

  // Filter forgotten/overdue sales (withdrawal date before today and not delivered)
  const forgottenSales = useMemo(() => {
    return sales.filter(s => s.dataRetirada && s.dataRetirada < todayStr && s.status !== 'Orçamento' && s.statusProducao !== 'Entregue');
  }, [sales, todayStr]);

  // Helper to check if sale has been notified
  const isAvisado = (sale: Sale) => Boolean(sale.avisoProntoSended || sale.statusProducao === 'Pronto para Retirada');

  // Apply visual status filters on today's or forgotten sales
  const filteredSales = useMemo(() => {
    let result: Sale[] = [];
    if (filterType === 'esquecidos') {
      result = forgottenSales;
    } else if (filterType === 'concluidos') {
      result = sales.filter(s => s.status !== 'Orçamento' && s.statusProducao === 'Entregue' && s.dataRetirada && s.dataRetirada <= todayStr);
    } else if (filterType === 'avisados') {
      result = todaySales.filter(sale => isAvisado(sale) && sale.statusProducao !== 'Entregue');
    } else if (filterType === 'pendentes') {
      result = todaySales.filter(sale => !isAvisado(sale) && sale.statusProducao !== 'Entregue');
    } else {
      // 'todos' shows active reminders for today that are not delivered
      result = todaySales.filter(sale => sale.statusProducao !== 'Entregue');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const cleanQ = q.replace(/\D/g, '');
      result = result.filter(sale => {
        const clientMatch = sale.cliente?.toLowerCase().includes(q);
        const orderMatch = sale.numeroPedido?.toLowerCase().includes(q) || 
                           sale.id?.toLowerCase().includes(q) || 
                           sale.pedidoVinculoNumero?.toLowerCase().includes(q);
        const phone = sale.telefoneCliente || '';
        const rawPhone = phone.replace(/\D/g, '');
        const phoneMatch = cleanQ.length > 0 && rawPhone.includes(cleanQ);
        const phoneTextMatch = phone.toLowerCase().includes(q);
        
        return clientMatch || orderMatch || phoneMatch || phoneTextMatch;
      });
    }

    // Sort: Overdue/rolled-over items first (sorted by dataRetirada asc), then today's items
    return [...result].sort((a, b) => {
      const dateA = a.dataRetirada || '';
      const dateB = b.dataRetirada || '';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      return 0;
    });
  }, [todaySales, forgottenSales, filterType, sales, todayStr, searchQuery]);

  // Counts for Today
  const pendingCount = useMemo(() => {
    return todaySales.filter(s => !isAvisado(s) && s.statusProducao !== 'Entregue').length;
  }, [todaySales]);

  const notifiedCount = useMemo(() => {
    return todaySales.filter(s => isAvisado(s) && s.statusProducao !== 'Entregue').length;
  }, [todaySales]);

  const completedCount = useMemo(() => {
    return sales.filter(s => s.dataRetirada && s.dataRetirada <= todayStr && s.statusProducao === 'Entregue' && s.status !== 'Orçamento').length;
  }, [sales, todayStr]);

  // Handle reminder click to trigger ready status update & WhatsApp notification
  const handleReminderAction = (sale: Sale) => {
    setIsDelayedReminderSelected(false);
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

  const handleUndoAvisado = (sale: Sale) => {
    playAppSound('click');
    const updatedSale: Sale = {
      ...sale,
      avisoProntoSended: false,
      statusProducao: sale.statusProducao === 'Pronto para Retirada' ? 'Em Produção' : sale.statusProducao,
      foiAlterado: true,
      editadoEm: new Date().toISOString()
    };
    onUpdateSale(updatedSale);
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

  // ============================================================================
  // 📅 PLANEJAMENTO & CAPACIDADE SEMANAL DE ENTREGAS / PRODUÇÃO
  // ============================================================================
  const normalizeText = (str: string) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const formatYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekBounds = (offsetWeeks: number) => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const shortDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const fullDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    const days = Array.from({ length: 7 }, (_, idx) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + idx);
      const dateStr = formatYmd(dt);
      return {
        dateStr,
        weekdayShort: shortDays[idx],
        weekdayFull: fullDays[idx],
        dayMonth: `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
      };
    });

    const startStr = formatYmd(monday);
    const endStr = formatYmd(sunday);
    const label = `${days[0].dayMonth} a ${days[6].dayMonth}/${sunday.getFullYear()}`;
    return { startStr, endStr, days, label };
  };

  const jumpToWeekOfDate = (dateStr: string) => {
    if (!dateStr) return;
    try {
      const target = new Date(dateStr + 'T12:00:00');
      if (isNaN(target.getTime())) return;
      const now = new Date();
      now.setHours(12, 0, 0, 0);

      const nowDay = now.getDay();
      const nowMon = new Date(now);
      nowMon.setDate(now.getDate() + (nowDay === 0 ? -6 : 1 - nowDay));

      const targetDay = target.getDay();
      const targetMon = new Date(target);
      targetMon.setDate(target.getDate() + (targetDay === 0 ? -6 : 1 - targetDay));

      const diffWeeks = Math.round((targetMon.getTime() - nowMon.getTime()) / (1000 * 60 * 60 * 24 * 7));
      setWeekMode('week');
      setWeekOffset(diffWeeks);
      setSelectedWeekDay(dateStr);
    } catch {}
  };

  const activeWeekInfo = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);

  const activePeriodBounds = useMemo(() => {
    if (weekMode === 'custom') {
      const s = customRangeStart <= customRangeEnd ? customRangeStart : customRangeEnd;
      const e = customRangeStart <= customRangeEnd ? customRangeEnd : customRangeStart;
      return {
        startStr: s,
        endStr: e,
        label: `${formatLocalDate(s)} a ${formatLocalDate(e)}`,
        days: [] as { dateStr: string; weekdayShort: string; weekdayFull: string; dayMonth: string }[]
      };
    }
    return activeWeekInfo;
  }, [weekMode, customRangeStart, customRangeEnd, activeWeekInfo]);

  // Helper to extract normalized items with categoryGroup for any sale
  const getSaleNormalizedItems = (sale: Sale) => {
    if (sale.itens && sale.itens.length > 0) {
      return sale.itens.map(item => {
        const nome = item.produtoNome || item.nome || sale.produtoNome || 'Produto';
        const matchedProd = findMatchingProduct(item.produtoId, nome, products);
        const categoriaGrupo = detectProductCategoryGroup(nome, matchedProd?.categoria);
        const qtd = Number((item as any).quantity || item.quantidade || 1);
        return {
          nome,
          produtoId: item.produtoId || matchedProd?.id || '',
          categoriaGrupo,
          quantidade: isNaN(qtd) ? 1 : qtd,
          total: item.total || 0
        };
      });
    }
    const nome = sale.produtoNome || 'Produto';
    const matchedProd = findMatchingProduct(sale.produtoId, nome, products);
    const categoriaGrupo = detectProductCategoryGroup(nome, matchedProd?.categoria);
    const qtd = Number(sale.quantidade || 1);
    return [
      {
        nome,
        produtoId: sale.produtoId || matchedProd?.id || '',
        categoriaGrupo,
        quantidade: isNaN(qtd) ? 1 : qtd,
        total: sale.total || 0
      }
    ];
  };

  // Resumos rápidos de Esta Semana (offset 0) e Próxima Semana (offset 1) para exibir no painel de Lembretes
  const quickWeeksOverview = useMemo(() => {
    const thisWeek = getWeekBounds(0);
    const nextWeek = getWeekBounds(1);

    const countOrdersInBounds = (startStr: string, endStr: string) =>
      sales.filter(s => s.status !== 'Orçamento' && s.dataRetirada && s.dataRetirada >= startStr && s.dataRetirada <= endStr).length;

    return {
      thisWeekCount: countOrdersInBounds(thisWeek.startStr, thisWeek.endStr),
      thisWeekLabel: thisWeek.label,
      nextWeekCount: countOrdersInBounds(nextWeek.startStr, nextWeek.endStr),
      nextWeekLabel: nextWeek.label
    };
  }, [sales]);

  // All closed orders & budgets scheduled inside activePeriodBounds
  const { periodClosedSales, periodBudgetCount } = useMemo(() => {
    const closed: Sale[] = [];
    let budgets = 0;

    sales.forEach(s => {
      if (!s.dataRetirada) return;
      if (s.dataRetirada >= activePeriodBounds.startStr && s.dataRetirada <= activePeriodBounds.endStr) {
        if (s.status === 'Orçamento') {
          budgets += 1;
        } else {
          closed.push(s);
        }
      }
    });

    closed.sort((a, b) => (a.dataRetirada || '').localeCompare(b.dataRetirada || ''));
    return { periodClosedSales: closed, periodBudgetCount: budgets };
  }, [sales, activePeriodBounds]);

  // Daily breakdown inside the selected week
  const weekDaysBreakdown = useMemo(() => {
    if (weekMode !== 'week') return [];
    return activePeriodBounds.days.map(d => {
      const count = periodClosedSales.filter(s => s.dataRetirada === d.dateStr).length;
      return { ...d, count };
    });
  }, [weekMode, activePeriodBounds, periodClosedSales]);

  // Orders filtered by selected day (if any) and status
  const dayAndStatusSales = useMemo(() => {
    return periodClosedSales.filter(sale => {
      if (selectedWeekDay && sale.dataRetirada !== selectedWeekDay) return false;
      if (weekStatusFilter === 'pendentes') {
        return sale.statusProducao !== 'Entregue' && sale.statusProducao !== 'Pronto para Retirada';
      }
      if (weekStatusFilter === 'prontos') {
        return sale.statusProducao === 'Pronto para Retirada' || sale.statusProducao === 'Agendado para Entrega';
      }
      if (weekStatusFilter === 'entregues') {
        return sale.statusProducao === 'Entregue';
      }
      return true;
    });
  }, [periodClosedSales, selectedWeekDay, weekStatusFilter]);

  // Breakdown by Category Group AND Specific Product for dayAndStatusSales
  const { categoryBreakdown, specificProductsBreakdown, totalUnitsInPeriod } = useMemo(() => {
    const catMap = new Map<string, { category: string; orderIds: Set<string>; units: number }>();
    const prodMap = new Map<string, { key: string; name: string; category: string; orderIds: Set<string>; units: number }>();
    let totalUnits = 0;

    dayAndStatusSales.forEach(sale => {
      const items = getSaleNormalizedItems(sale);
      items.forEach(item => {
        totalUnits += item.quantidade;

        // Category aggregation
        if (!catMap.has(item.categoriaGrupo)) {
          catMap.set(item.categoriaGrupo, { category: item.categoriaGrupo, orderIds: new Set(), units: 0 });
        }
        const catEntry = catMap.get(item.categoriaGrupo)!;
        catEntry.orderIds.add(sale.id);
        catEntry.units += item.quantidade;

        // Specific product aggregation
        const prodKey = normalizeText(item.nome);
        if (prodKey) {
          if (!prodMap.has(prodKey)) {
            prodMap.set(prodKey, {
              key: prodKey,
              name: item.nome,
              category: item.categoriaGrupo,
              orderIds: new Set(),
              units: 0
            });
          }
          const prodEntry = prodMap.get(prodKey)!;
          prodEntry.orderIds.add(sale.id);
          prodEntry.units += item.quantidade;
        }
      });
    });

    const categories = Array.from(catMap.values())
      .map(c => ({ category: c.category, ordersCount: c.orderIds.size, unitsCount: c.units }))
      .sort((a, b) => b.ordersCount - a.ordersCount || b.unitsCount - a.unitsCount);

    const specificProducts = Array.from(prodMap.values())
      .map(p => ({ key: p.key, name: p.name, category: p.category, ordersCount: p.orderIds.size, unitsCount: p.units }))
      .sort((a, b) => b.ordersCount - a.ordersCount || b.unitsCount - a.unitsCount);

    return {
      categoryBreakdown: categories,
      specificProductsBreakdown: specificProducts,
      totalUnitsInPeriod: totalUnits
    };
  }, [dayAndStatusSales, products]);

  // Final filtered orders list + matching product/category unit count
  const { weeklyFilteredSales, matchingItemsUnitsCount, hasProductOrTextFilter } = useMemo(() => {
    const qNorm = normalizeText(weekSearchQuery);
    const qDigits = weekSearchQuery.replace(/\D/g, '');
    const isFilteringByProductOrText =
      selectedCategoryFilter !== 'Todos' || Boolean(selectedSpecificProduct) || qNorm.length > 0;

    let matchingUnits = 0;

    const filtered = dayAndStatusSales.filter(sale => {
      const items = getSaleNormalizedItems(sale);

      // 1. Category Filter
      if (selectedCategoryFilter !== 'Todos') {
        const hasCat = items.some(it => it.categoriaGrupo === selectedCategoryFilter);
        if (!hasCat) return false;
      }

      // 2. Specific Product Filter
      if (selectedSpecificProduct) {
        const hasProd = items.some(it => normalizeText(it.nome) === selectedSpecificProduct);
        if (!hasProd) return false;
      }

      // 3. Text Search (product name, category, client name, order #, phone)
      if (qNorm) {
        const words = qNorm.split(/\s+/).filter(Boolean);
        const clientNorm = normalizeText(sale.cliente || '');
        const orderNorm = normalizeText(sale.numeroPedido || sale.id || '');
        const phoneRaw = (sale.telefoneCliente || '').replace(/\D/g, '');

        const matchesClient = words.every(w => clientNorm.includes(w));
        const matchesOrder = orderNorm.includes(qNorm);
        const matchesPhone = qDigits.length >= 3 && phoneRaw.includes(qDigits);
        const matchesAnyItem = items.some(it => {
          const itemNorm = normalizeText(it.nome);
          const catNorm = normalizeText(it.categoriaGrupo);
          return words.every(w => itemNorm.includes(w) || catNorm.includes(w));
        });

        if (!matchesClient && !matchesOrder && !matchesPhone && !matchesAnyItem) {
          return false;
        }
      }

      // Sum matching units for accuracy when filtered by product/category
      items.forEach(it => {
        const catOk = selectedCategoryFilter === 'Todos' || it.categoriaGrupo === selectedCategoryFilter;
        const prodOk = !selectedSpecificProduct || normalizeText(it.nome) === selectedSpecificProduct;
        let textOk = true;
        if (qNorm) {
          const words = qNorm.split(/\s+/).filter(Boolean);
          const itemNorm = normalizeText(it.nome);
          const catNorm = normalizeText(it.categoriaGrupo);
          const itemMatchesQuery = words.every(w => itemNorm.includes(w) || catNorm.includes(w));
          // If the query matched a product/category on this item, count only matching items;
          // otherwise if query only matched client name, count all items of the selected category/product
          const anyItemMatchedQuery = items.some(x => words.every(w => normalizeText(x.nome).includes(w) || normalizeText(x.categoriaGrupo).includes(w)));
          if (anyItemMatchedQuery) {
            textOk = itemMatchesQuery;
          }
        }
        if (catOk && prodOk && textOk) {
          matchingUnits += it.quantidade;
        }
      });

      return true;
    });

    return {
      weeklyFilteredSales: filtered,
      matchingItemsUnitsCount: matchingUnits,
      hasProductOrTextFilter: isFilteringByProductOrText
    };
  }, [dayAndStatusSales, selectedCategoryFilter, selectedSpecificProduct, weekSearchQuery, products]);

  const weekPendingCount = useMemo(() => {
    return periodClosedSales.filter(s => s.statusProducao !== 'Entregue').length;
  }, [periodClosedSales]);

  const weekDeliveredCount = useMemo(() => {
    return periodClosedSales.filter(s => s.statusProducao === 'Entregue').length;
  }, [periodClosedSales]);

  const getWeekdayPt = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T12:00:00');
      const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      return names[d.getDay()] || '';
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6 select-text">
      
      {/* Subtab Switcher: Lembretes vs Agenda da Semana vs Recorrência vs Indicação */}
      <div className="flex bg-zinc-950 p-1 border border-zinc-900 rounded-xl w-full sm:w-fit flex-wrap sm:flex-nowrap gap-1 no-print relative">
        <button
          onClick={() => {
            playAppSound('click');
            setActiveSubTab('lembretes');
          }}
          className={`py-1.5 px-3.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-transparent relative z-10 whitespace-nowrap ${
            activeSubTab === 'lembretes'
              ? 'text-black font-extrabold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {activeSubTab === 'lembretes' && (
            <motion.div
              layoutId="activeSubTabIndicator"
              className="absolute inset-0 bg-brand-pink rounded-lg -z-10"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <Bell className="h-3.5 w-3.5" />
          <span>🔔 Lembretes do Dia</span>
        </button>

        <button
          onClick={() => {
            playAppSound('click');
            setActiveSubTab('semana');
          }}
          className={`py-1.5 px-3.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-transparent relative z-10 whitespace-nowrap ${
            activeSubTab === 'semana'
              ? 'text-white font-extrabold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {activeSubTab === 'semana' && (
            <motion.div
              layoutId="activeSubTabIndicator"
              className="absolute inset-0 bg-sky-600 rounded-lg -z-10 shadow-md shadow-sky-950/40"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <CalendarDays className="h-3.5 w-3.5" />
          <span>📅 Agenda da Semana</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full ${
            activeSubTab === 'semana'
              ? 'bg-black/25 text-white'
              : quickWeeksOverview.nextWeekCount >= weeklyCapacityLimit
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-sky-500/15 text-sky-300 border border-sky-500/25'
          }`} title="Pedidos fechados para a Próxima Semana / Meta semanal">
            {quickWeeksOverview.nextWeekCount}/{weeklyCapacityLimit}
          </span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => {
                playAppSound('click');
                setActiveSubTab('recorrencia');
              }}
              className={`py-1.5 px-3.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-transparent relative z-10 whitespace-nowrap ${
                activeSubTab === 'recorrencia'
                  ? 'text-white font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {activeSubTab === 'recorrencia' && (
                <motion.div
                  layoutId="activeSubTabIndicator"
                  className="absolute inset-0 bg-purple-650 rounded-lg -z-10 shadow-md shadow-purple-950/40"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Brain className="h-3.5 w-3.5 text-purple-300" />
              <span>🔮 Recorrência</span>
            </button>
            <button
              onClick={() => {
                playAppSound('click');
                setActiveSubTab('indicacao');
              }}
              className={`py-1.5 px-3.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-transparent relative z-10 whitespace-nowrap ${
                activeSubTab === 'indicacao'
                  ? 'text-white font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {activeSubTab === 'indicacao' && (
                <motion.div
                  layoutId="activeSubTabIndicator"
                  className="absolute inset-0 bg-emerald-650 rounded-lg -z-10 shadow-md shadow-emerald-950/40"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Gift className="h-3.5 w-3.5 text-emerald-300" />
              <span>🎁 Indicação 5%</span>
            </button>
          </>
        )}
      </div>

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

        {/* Dynamic counter buttons */}
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => {
              playAppSound('click');
              setFilterType('todos');
            }}
            className={`px-3 py-2 rounded-xl text-center min-w-[70px] transition-all cursor-pointer border ${
              filterType === 'todos'
                ? 'bg-brand-pink text-black border-brand-pink font-extrabold'
                : 'bg-black/40 border-zinc-850 hover:bg-zinc-800/40 text-zinc-200'
            }`}
          >
            <span className={`text-[9px] font-extrabold uppercase block select-none ${filterType === 'todos' ? 'text-black/70' : 'text-zinc-500'}`}>Total</span>
            <span className="text-sm font-black">{todaySales.length}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playAppSound('click');
              setFilterType('pendentes');
            }}
            className={`px-3 py-2 rounded-xl text-center min-w-[70px] transition-all cursor-pointer border ${
              filterType === 'pendentes'
                ? 'bg-amber-500 text-black border-amber-500 font-extrabold'
                : 'bg-amber-955/10 border-amber-900/30 hover:bg-amber-955/25 text-amber-400'
            }`}
          >
            <span className={`text-[9px] font-extrabold uppercase block select-none ${filterType === 'pendentes' ? 'text-black/70' : 'text-amber-500'}`}>Pendentes</span>
            <span className="text-sm font-black">{pendingCount}</span>
          </button>
          <button
            type="button"
            id="btn-encomendas-esquecidas"
            onClick={() => {
              playAppSound('click');
              setFilterType('esquecidos');
            }}
            className={`px-3 py-2 rounded-xl text-center min-w-[70px] transition-all cursor-pointer border relative overflow-hidden ${
              filterType === 'esquecidos'
                ? 'bg-rose-600 text-white border-rose-500 font-extrabold shadow-md shadow-rose-950/50'
                : 'bg-red-955/15 border-red-900/30 hover:bg-red-955/35 text-red-400'
            } ${forgottenSales.length > 0 ? 'animate-pulse' : ''}`}
            title="Mostrar Encomendas Esquecidas (Agendadas para datas passadas e não entregues)"
          >
            {forgottenSales.length > 0 && (
              <span className="absolute top-0 right-0 h-1.5 w-1.5 bg-red-400 rounded-full animate-ping" />
            )}
            <span className={`text-[9px] font-extrabold uppercase block select-none ${filterType === 'esquecidos' ? 'text-white/80' : 'text-red-500'}`}>Esquecidas</span>
            <span className="text-sm font-black">{forgottenSales.length}</span>
          </button>
        </div>
      </div>

      {/* Grid Layout: Left 2 cols for Today, Right 1 col for Tomorrow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left main section - Today's Reminders */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-brand-pink tracking-wide flex items-center gap-2 select-none uppercase">
              {filterType === 'esquecidos' ? (
                <>
                  <span>⚠️</span> Encomendas Esquecidas / Atrasadas
                </>
              ) : (
                <>
                  <span>🔔</span> LEMBRETES DE HOJE
                </>
              )}
            </h3>
            <span className="text-[9.5px] text-zinc-500 font-mono tracking-wider">
              {filteredSales.length} {filteredSales.length === 1 ? 'registro' : 'registros'} encontrado(s)
            </span>
          </div>

          {/* Guidelines info banner */}
          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex items-start gap-3 text-xs leading-relaxed text-zinc-400 no-print">
            <span className="text-lg mt-0.5 shrink-0 select-none">
              {filterType === 'esquecidos' ? '⚠️' : '💡'}
            </span>
            <div className="space-y-1">
              <h4 className="font-bold text-zinc-200">
                {filterType === 'esquecidos' 
                  ? 'Como funcionam as Encomendas Esquecidas?' 
                  : 'Como funcionam os Lembretes do Dia?'}
              </h4>
              <p>
                {filterType === 'esquecidos' ? (
                  <>
                    Estes são os pedidos com retirada agendada para <strong>datas anteriores a hoje</strong> que ainda não constam como entregues. Clique em <strong className="text-rose-450 font-semibold">"Avisar Pronto &amp; Contatar"</strong> para preparar a mensagem de aviso no WhatsApp, cobrando novamente a retirada.
                  </>
                ) : (
                  <>
                    Rastreie os pedidos com retirada agendada para hoje ou rolados de datas anteriores não entregues. Pedidos pendentes de dias passados continuam aparecendo <strong>automática e diariamente</strong> nos Lembretes do Dia até serem concluídos/entregues.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Filters & Search Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Filters Row */}
            <div className="flex gap-1 bg-zinc-900/50 p-1 border border-zinc-850 rounded-xl w-full sm:w-auto sm:max-w-xl flex-wrap sm:flex-nowrap relative select-none">
              <button 
                onClick={() => setFilterType('todos')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer select-none border border-transparent relative z-10 ${
                  filterType === 'todos' 
                    ? 'text-brand-pink font-black' 
                    : 'text-zinc-450 hover:text-zinc-200'
                }`}
              >
                {filterType === 'todos' && (
                  <motion.div
                    layoutId="remindersFilterIndicator"
                    className="absolute inset-0 bg-zinc-800 border border-zinc-700/50 rounded-lg -z-10 shadow-xs"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                Todos ({todaySales.length})
              </button>
              <button 
                onClick={() => setFilterType('pendentes')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer select-none border border-transparent relative z-10 ${
                  filterType === 'pendentes' 
                    ? 'text-amber-400 font-black' 
                    : 'text-zinc-450 hover:text-zinc-200'
                }`}
              >
                {filterType === 'pendentes' && (
                  <motion.div
                    layoutId="remindersFilterIndicator"
                    className="absolute inset-0 bg-amber-955/20 border border-amber-900/25 rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                Avisar ({pendingCount})
              </button>
              <button 
                onClick={() => setFilterType('avisados')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer select-none border border-transparent relative z-10 ${
                  filterType === 'avisados' 
                    ? 'text-orange-400 font-black' 
                    : 'text-zinc-450 hover:text-zinc-200'
                }`}
              >
                {filterType === 'avisados' && (
                  <motion.div
                    layoutId="remindersFilterIndicator"
                    className="absolute inset-0 bg-orange-955/20 border border-orange-900/25 rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                Avisados ({notifiedCount})
              </button>
              <button 
                onClick={() => setFilterType('concluidos')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer select-none border border-transparent relative z-10 ${
                  filterType === 'concluidos' 
                    ? 'text-emerald-400 font-black' 
                    : 'text-zinc-450 hover:text-zinc-200'
                }`}
              >
                {filterType === 'concluidos' && (
                  <motion.div
                    layoutId="remindersFilterIndicator"
                    className="absolute inset-0 bg-emerald-955/20 border border-emerald-900/15 rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                Entregues ({completedCount})
              </button>
              <button 
                onClick={() => setFilterType('esquecidos')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer select-none border border-transparent relative z-10 ${
                  filterType === 'esquecidos' 
                    ? 'text-rose-400 font-black' 
                    : 'text-zinc-450 hover:text-rose-450/75'
                }`}
              >
                {filterType === 'esquecidos' && (
                  <motion.div
                    layoutId="remindersFilterIndicator"
                    className="absolute inset-0 bg-rose-955/25 border border-rose-900/35 rounded-lg -z-10 shadow-xs"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                Esquecidas ({forgottenSales.length})
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, nº pedido ou telefone..."
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-8 pr-7 py-2 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-pink/50 focus:ring-1 focus:ring-brand-pink/50 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 rounded-full"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List of today's reminders */}
          <div className="space-y-4">
            {filteredSales.map((sale) => {
              const isPending = sale.statusProducao !== 'Entregue';
              const isReadyForPickup = sale.statusProducao === 'Pronto para Retirada';
              const linkedSales = getLinkedSales(sale, sales);
              const unreadyLinkedSales = linkedSales.filter(s => s.statusProducao === 'Agendado' || s.statusProducao === 'Em Produção');
              const isLinkedBlocked = unreadyLinkedSales.length > 0 && !unlockedLinkedOrderIds.includes(sale.id);
              const isManuallyUnlocked = unreadyLinkedSales.length > 0 && unlockedLinkedOrderIds.includes(sale.id);
              
              return (
                <motion.div 
                  key={sale.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className={`border rounded-2xl p-5 transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-5 ${
                    sale.bloqueadoLembrete
                      ? 'border-red-500/35 bg-red-955/15 hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.06)]'
                      : isLinkedBlocked
                        ? 'border-sky-550/30 bg-sky-955/5 hover:border-sky-500/45 shadow-[0_0_15px_rgba(56,189,248,0.04)]'
                        : isManuallyUnlocked
                          ? 'border-amber-500/35 bg-amber-955/10 hover:border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.06)]'
                          : isReadyForPickup
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

                      {sale.dataRetirada && sale.dataRetirada < todayStr && (
                        <button
                          type="button"
                          onClick={() => {
                            playAppSound('click');
                            setFilterType('esquecidos');
                          }}
                          className="cursor-pointer text-[9px] font-black uppercase tracking-widest bg-rose-500/20 hover:bg-rose-500/35 text-rose-400 hover:text-rose-250 border border-rose-500/30 hover:border-rose-400/50 px-1.5 py-0.5 rounded animate-pulse transition-all select-none"
                          title="Clique para filtrar apenas encomendas esquecidas"
                        >
                          ⚠️ ESQUECIDO / ATRASADO ({getDaysLate(sale.dataRetirada)} {getDaysLate(sale.dataRetirada) === 1 ? 'dia' : 'dias'})
                        </button>
                      )}
                      
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

                      <button
                        type="button"
                        onClick={() => {
                          playAppSound('click');
                          onUpdateSale({
                            ...sale,
                            bloqueadoLembrete: !sale.bloqueadoLembrete
                          });
                        }}
                        className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-all border ${
                          sale.bloqueadoLembrete
                            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/35 shadow-xs'
                            : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-850'
                        }`}
                        title={sale.bloqueadoLembrete ? "Clique para DESBLOQUEAR avisos deste pedido" : "Clique para BLOQUEAR avisos por atraso de produção"}
                      >
                        {sale.bloqueadoLembrete ? (
                          <>
                            <Lock className="h-3 w-3 text-red-400 animate-pulse" />
                            <span>Atrasado/Bloqueado 🔒</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3 w-3 text-zinc-500" />
                            <span>Bloquear Lembrete</span>
                          </>
                        )}
                      </button>

                      {linkedSales.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                            unreadyLinkedSales.length > 0
                              ? isManuallyUnlocked 
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/35'
                                : 'bg-sky-500/25 text-sky-455 border-sky-500/35'
                              : 'bg-emerald-500/20 text-emerald-450 border-emerald-500/35'
                          }`}
                          title={unreadyLinkedSales.length > 0 
                            ? `Pedido Conjunto! Vinculado ao Pedido #${linkedSales.map(s => s.numeroPedido).join(', ')}. Depende do outro pedido ficar pronto!`
                            : `Pedido Conjunto! Vinculado ao Pedido #${linkedSales.map(s => s.numeroPedido).join(', ')}. Ambos estão prontos!`
                          }
                          >
                            <Link className="h-3 w-3 shrink-0" />
                            <span>
                              Conjunto: {linkedSales.map(s => `#${s.numeroPedido} (${s.statusProducao === 'Pronto para Retirada' ? '✨ Pronto' : s.statusProducao || 'Pendente'})`).join(', ')}
                            </span>
                          </span>

                          {unreadyLinkedSales.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleUnlockLinkedOrder(sale.id)}
                              className={`text-[9.5px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-all border ${
                                isManuallyUnlocked
                                  ? 'bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 border-amber-500/40'
                                  : 'bg-sky-950 hover:bg-sky-900 text-sky-300 hover:text-white border-sky-800/60'
                              }`}
                              title={isManuallyUnlocked ? "Clique para reativar o bloqueio de segurança conjunto" : "Clique para liberar o aviso deste pedido mesmo com o pedido vinculado pendente"}
                            >
                              {isManuallyUnlocked ? (
                                <>
                                  <Unlock className="h-3 w-3 text-amber-400" />
                                  <span>Desbloqueado p/ Avisar 🔓</span>
                                </>
                              ) : (
                                <>
                                  <Unlock className="h-3 w-3 text-sky-400" />
                                  <span>Liberar Envio 🔓</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
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
                      {sale.dataRetirada && sale.dataRetirada !== todayStr && (
                        <div className="mt-1.5 space-y-1.5">
                          <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1.5 bg-rose-950/10 border border-rose-900/15 px-2.5 py-1 rounded-lg">
                            <Calendar className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                            <span>Retirada original: {formatLocalDate(sale.dataRetirada)} ({getDaysLate(sale.dataRetirada)} {getDaysLate(sale.dataRetirada) === 1 ? 'dia' : 'dias'} de atraso - Rolado para Hoje)</span>
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                playAppSound('click');
                                onUpdateSale({
                                  ...sale,
                                  dataRetirada: todayStr,
                                  dataAvisoAtraso: undefined,
                                  foiAlterado: true,
                                  editadoEm: new Date().toISOString()
                                });
                              }}
                              className="text-[10px] font-extrabold bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-800/40 px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                              title="Atualizar a data de retirada oficialmente para HOJE"
                            >
                              <span>📅 Atualizar Data para Hoje</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playAppSound('click');
                                onUpdateSale({
                                  ...sale,
                                  dataRetirada: tomorrowStr,
                                  dataAvisoAtraso: undefined,
                                  foiAlterado: true,
                                  editadoEm: new Date().toISOString()
                                });
                              }}
                              className="text-[10px] font-extrabold bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                              title="Adiar a data de retirada officially para AMANHÃ"
                            >
                              <span>⏭️ Adiar p/ Amanhã</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {linkedSales.length > 0 && (
                      <div className={`p-2.5 rounded-xl text-xs flex gap-2 border items-start justify-between ${
                        unreadyLinkedSales.length > 0
                          ? isManuallyUnlocked
                            ? 'bg-amber-955/20 border-amber-900/40 text-amber-300'
                            : 'bg-sky-955/20 border-sky-900/40 text-sky-300'
                          : 'bg-emerald-955/20 border-emerald-950/40 text-emerald-300'
                      }`}>
                        <div className="flex gap-2">
                          <span className="text-sm">⚠️</span>
                          <div>
                            <strong className="block font-bold">
                              Pedido Conjunto! {isManuallyUnlocked && <span className="text-[10px] text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/50 font-black ml-1 uppercase">Liberado Manualmente</span>}
                            </strong>
                            <span className="text-[10.5px] leading-relaxed block mt-0.5">
                              {unreadyLinkedSales.length > 0 ? (
                                isManuallyUnlocked ? (
                                  <>
                                    Você <strong>desbloqueou</strong> este pedido vinculado a <strong>#{unreadyLinkedSales.map(u => u.numeroPedido).join(', ')}</strong>. Agora você já pode avisar o cliente ou marcar como pronto!
                                  </>
                                ) : (
                                  <>
                                    Este pedido está vinculado ao <strong>Pedido #{unreadyLinkedSales.map(u => u.numeroPedido).join(', ')}</strong>. Os avisos estão <strong>BLOQUEADOS</strong> até ambos os pedidos ficarem prontos.
                                  </>
                                )
                              ) : (
                                <>
                                  Ambos os pedidos vinculados <strong>estão prontos</strong>! Agora você pode compartilhar o aviso de retirada unificado de forma segura.
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        {unreadyLinkedSales.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleUnlockLinkedOrder(sale.id)}
                            className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 self-center ${
                              isManuallyUnlocked
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                                : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border-sky-500/40'
                            }`}
                          >
                            {isManuallyUnlocked ? (
                              <>
                                <Lock className="h-3 w-3 text-amber-400" />
                                <span>Bloquear</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="h-3 w-3 text-sky-400" />
                                <span>Desbloquear</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

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
                        {sale.bloqueadoLembrete ? (
                          <button
                            type="button"
                            disabled
                            className="flex-1 py-2.5 px-4 font-extrabold rounded-xl text-[11px] bg-red-955/35 text-red-400 border border-red-900/40 cursor-not-allowed flex items-center justify-center gap-1.5 shadow-none select-none"
                            title="Esse contato está bloqueado pois há um atraso na produção interna!"
                          >
                            <Lock className="h-4 w-4 shrink-0 text-red-400" />
                            <span>Aviso Bloqueado (Atraso)</span>
                          </button>
                        ) : isLinkedBlocked ? (
                          <div className="flex flex-col gap-1.5 w-full">
                            <button
                              type="button"
                              disabled
                              className="flex-1 py-2.5 px-4 font-extrabold rounded-xl text-[11px] bg-sky-955/35 text-sky-400 border border-sky-900/40 cursor-not-allowed flex items-center justify-center flex-col gap-1 shadow-none select-none"
                              title={`Esse aviso está bloqueado pois o pedido conjunto #${unreadyLinkedSales[0].numeroPedido} (${unreadyLinkedSales[0].produtoNome}) não está pronto!`}
                            >
                              <div className="flex items-center gap-1">
                                <Link className="h-4 w-4 shrink-0 text-sky-400" />
                                <span>Aviso Bloqueado 🔗</span>
                              </div>
                              <span className="text-[9px] font-normal opacity-85">Aguardando #{unreadyLinkedSales[0].numeroPedido}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleUnlockLinkedOrder(sale.id)}
                              className="py-1.5 px-3 bg-sky-950/80 hover:bg-sky-900/90 text-sky-300 hover:text-white border border-sky-700/50 font-black rounded-lg text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm active:scale-95"
                              title="Desbloquear para avisar mesmo com pedido conjunto pendente"
                            >
                              <Unlock className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                              <span>Desbloquear Aviso 🔓</span>
                            </button>
                          </div>
                        ) : (
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
                        )}

                        {isAvisado(sale) && (
                          <button
                            type="button"
                            onClick={() => handleUndoAvisado(sale)}
                            className="flex-1 py-2 px-3 bg-amber-955/25 hover:bg-amber-900/40 text-amber-300 hover:text-amber-200 border border-amber-800/40 hover:border-amber-600/60 font-black rounded-xl text-[10.5px] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                            title="Desfazer aviso enviado ou status de pronto. Volta este pedido para a lista de Avisar (pendentes)."
                          >
                            <RotateCcw className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                            <span>Desfazer Avisado</span>
                          </button>
                        )}

                        {(isReadyForPickup || (sale.dataRetirada && sale.dataRetirada < todayStr)) && (
                          <button
                            type="button"
                            onClick={() => {
                              playAppSound('click');
                              setIsDelayedReminderSelected(true);
                              setSelectedSaleForWA(sale);
                            }}
                            className={`flex-1 py-2.5 px-4 font-extrabold rounded-xl text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-md ${
                              sale.dataAvisoAtraso === todayStr
                                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-955/20 border border-rose-500/30'
                                : 'bg-emerald-600 hover:bg-emerald-550 text-white shadow-emerald-955/20 border border-emerald-500/30'
                            }`}
                            title={
                              sale.dataAvisoAtraso === todayStr
                                ? 'Cliente já foi notificado sobre o atraso hoje! Clique para reenviar.'
                                : 'Cliente ainda não foi notificado hoje sobre o atraso. Clique para enviar lembrete via WhatsApp.'
                            }
                          >
                            <MessageSquare className="h-4 w-4 shrink-0" />
                            <span>
                              {sale.dataAvisoAtraso === todayStr
                                ? 'Aviso de Atraso Enviado 🔴'
                                : 'Lembrar Retirada em Atraso 🟢'}
                            </span>
                          </button>
                        )}
                        
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
                                    status: 'Pago total',
                                    valorPago: sale.total,
                                    valorFaltante: 0,
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
                                    status: 'Pago total',
                                    valorPago: sale.total,
                                    valorFaltante: 0,
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
                            const isAlreadyPaid = sale.status === 'Pago total' || (sale.valorFaltante !== undefined && sale.valorFaltante <= 0);
                            const confirmMessage = isAlreadyPaid
                              ? `Deseja marcar o pedido de ${sale.cliente} como entregue agora?`
                              : `Deseja liquidar todo o saldo faltante e marcar o pedido de ${sale.cliente} como entregue agora?`;
                            const confirmDel = window.confirm(confirmMessage);
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
                          <span>
                            {sale.status === 'Pago total' || (sale.valorFaltante !== undefined && sale.valorFaltante <= 0)
                              ? 'Marcar como Entregue'
                              : 'Liquidar & Entregar'}
                          </span>
                        </button>
                      </>
                    ) : (
                      <div className="text-center py-2 px-3 flex flex-col items-center justify-center gap-2 select-none">
                        <div className="flex flex-col items-center justify-center text-emerald-500 gap-1.5">
                          <CheckCircle className="h-5 w-5 stroke-[3]" />
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-450">Pedido Entregue</span>
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
                                status: prevValorFaltante <= 0 ? 'Pago total' : 'Pendente',
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
                          <span>↩️ Desfazer Entrega</span>
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
                  <h4 className="text-xs font-bold text-zinc-300">
                    {filterType === 'esquecidos' 
                      ? 'Nenhuma encomenda esquecida encontrada' 
                      : filterType === 'avisados'
                        ? 'Nenhum pedido avisado aguardando retirada'
                        : 'Sem lembretes pendentes para avisar hoje! 🎉'}
                  </h4>
                  <p className="text-[10.5px] text-zinc-500 mt-0.5">
                    {filterType === 'esquecidos'
                      ? 'Todos os pedidos de datas passadas foram devidamente entregues ou faturados!'
                      : filterType === 'avisados'
                        ? 'Os pedidos que já foram avisados ao cliente e ainda não foram entregues aparecerão aqui.'
                        : 'Altere os botões de filtro acima ou confira os demais dias.'}
                  </p>
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

          {/* Quick Weekly Overview Card right inside Lembretes */}
          <div className="bg-sky-950/15 border border-sky-500/25 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-sky-400" />
                Capacidade Semanal
              </span>
              <span className="text-[9px] font-mono text-zinc-400">Meta: {weeklyCapacityLimit}/sem</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  playAppSound('click');
                  setWeekMode('week');
                  setWeekOffset(0);
                  setSelectedWeekDay(null);
                  setActiveSubTab('semana');
                }}
                className="bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 hover:border-sky-500/40 rounded-lg p-2 text-left transition-all cursor-pointer"
              >
                <span className="text-[9px] font-bold uppercase text-zinc-400 block">Esta Semana</span>
                <span className={`text-sm font-black font-mono ${
                  quickWeeksOverview.thisWeekCount >= weeklyCapacityLimit
                    ? 'text-rose-400'
                    : quickWeeksOverview.thisWeekCount >= weeklyCapacityLimit * 0.8
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }`}>
                  {quickWeeksOverview.thisWeekCount} <span className="text-[10px] text-zinc-500 font-normal">/ {weeklyCapacityLimit}</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playAppSound('click');
                  setWeekMode('week');
                  setWeekOffset(1);
                  setSelectedWeekDay(null);
                  setActiveSubTab('semana');
                }}
                className="bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 hover:border-sky-500/40 rounded-lg p-2 text-left transition-all cursor-pointer"
              >
                <span className="text-[9px] font-bold uppercase text-sky-300 block">Próx. Semana</span>
                <span className={`text-sm font-black font-mono ${
                  quickWeeksOverview.nextWeekCount >= weeklyCapacityLimit
                    ? 'text-rose-400'
                    : quickWeeksOverview.nextWeekCount >= weeklyCapacityLimit * 0.8
                      ? 'text-amber-400'
                      : 'text-sky-300'
                }`}>
                  {quickWeeksOverview.nextWeekCount} <span className="text-[10px] text-zinc-500 font-normal">/ {weeklyCapacityLimit}</span>
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                playAppSound('click');
                setWeekMode('week');
                setWeekOffset(1);
                setSelectedWeekDay(null);
                setActiveSubTab('semana');
              }}
              className="w-full py-1.5 px-3 bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/30 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Search className="h-3 w-3" />
              <span>Pesquisar Semanas &amp; Produtos</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Tomorrow's entries list */}
          <div className="space-y-3">
            {tomorrowSales.map((sale) => {
              const isPending = sale.statusProducao !== 'Entregue';
              const linkedSales = getLinkedSales(sale, sales);
              const unreadyLinkedSales = linkedSales.filter(s => s.statusProducao === 'Agendado' || s.statusProducao === 'Em Produção');
              const isLinkedBlocked = unreadyLinkedSales.length > 0 && !unlockedLinkedOrderIds.includes(sale.id);
              const isManuallyUnlocked = unreadyLinkedSales.length > 0 && unlockedLinkedOrderIds.includes(sale.id);
              
              return (
                <div 
                  key={sale.id}
                  className={`border rounded-xl p-4 space-y-3.5 transition-all ${
                    sale.bloqueadoLembrete
                      ? 'border-red-500/35 bg-red-955/10 hover:border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.04)]'
                      : isLinkedBlocked
                        ? 'border-sky-550/25 bg-sky-955/5 hover:border-sky-500/40 shadow-[0_0_12px_rgba(58,191,248,0.03)]'
                        : isManuallyUnlocked
                          ? 'border-amber-500/35 bg-amber-955/10 hover:border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.04)]'
                          : 'bg-black/35 border-zinc-850 hover:border-zinc-800'
                  } ${
                    !isPending && !sale.bloqueadoLembrete && !isLinkedBlocked ? 'opacity-55' : ''
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

                        <button
                          type="button"
                          onClick={() => {
                            playAppSound('click');
                            onUpdateSale({
                              ...sale,
                              bloqueadoLembrete: !sale.bloqueadoLembrete
                            });
                          }}
                          className={`p-1 border rounded-md cursor-pointer transition-colors flex items-center justify-center ${
                            sale.bloqueadoLembrete
                              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-450 border-red-500/35'
                              : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-355 border-zinc-850'
                          }`}
                          title={sale.bloqueadoLembrete ? "Clique para DESBLOQUEAR avisos deste pedido" : "Clique para BLOQUEAR avisos por atraso de produção"}
                        >
                          {sale.bloqueadoLembrete ? <Lock className="h-3.5 w-3.5 text-red-400 animate-pulse" /> : <Unlock className="h-3.5 w-3.5 text-zinc-500" />}
                        </button>
                      </div>
                    </div>
                    {sale.telefoneCliente && (
                      <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{sale.telefoneCliente}</span>
                      </div>
                    )}

                    {linkedSales.length > 0 && (
                      <div className={`p-1.5 rounded-lg text-[9.5px] border mt-1.5 flex items-start justify-between gap-1.5 ${
                        unreadyLinkedSales.length > 0
                          ? isManuallyUnlocked
                            ? 'bg-amber-955/15 border-amber-900/30 text-amber-300'
                            : 'bg-sky-955/10 border-sky-900/30 text-sky-450'
                          : 'bg-emerald-955/10 border-emerald-900/10 text-emerald-450'
                      }`}>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-bold">
                            <span>⚠️ Conjunto:</span>
                            <span>Pedido #{linkedSales.map(s => s.numeroPedido).join(', ')}</span>
                          </div>
                          <span className="opacity-80 leading-normal block">
                            {unreadyLinkedSales.length > 0
                              ? isManuallyUnlocked
                                ? 'Desbloqueado manualmente para envio!'
                                : 'Avisos BLOQUEADOS até que ambos fiquem prontos.'
                              : 'Ambos os pedidos estão prontos para envio!'}
                          </span>
                        </div>

                        {unreadyLinkedSales.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleUnlockLinkedOrder(sale.id)}
                            className={`shrink-0 text-[8.5px] font-black px-1.5 py-0.5 rounded border transition-all cursor-pointer flex items-center gap-0.5 ${
                              isManuallyUnlocked
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            }`}
                            title={isManuallyUnlocked ? "Reativar bloqueio de segurança conjunto" : "Desbloquear para avisar"}
                          >
                            {isManuallyUnlocked ? (
                              <>
                                <Lock className="h-2.5 w-2.5 text-amber-400" />
                                <span>Bloquear</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="h-2.5 w-2.5 text-sky-400" />
                                <span>Liberar 🔓</span>
                              </>
                            )}
                          </button>
                        )}
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
                      sale.bloqueadoLembrete ? (
                        <button
                          type="button"
                          disabled
                          className="py-1 px-2.5 bg-red-955/35 text-red-400 border border-red-900/40 text-[9px] font-black rounded-md flex items-center gap-1 cursor-not-allowed select-none"
                          title="Esse contato está bloqueado pois há um atraso na produção interna!"
                        >
                          <Lock className="h-3 w-3 text-red-400" />
                          <span>Bloqueado 🔒</span>
                        </button>
                      ) : isLinkedBlocked ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled
                            className="py-1 px-2 bg-sky-955/35 text-sky-400 border border-sky-900/40 text-[9px] font-black rounded-md flex items-center gap-1 cursor-not-allowed select-none"
                            title={`Esse aviso está bloqueado pois o pedido conjunto #${unreadyLinkedSales[0].numeroPedido} (${unreadyLinkedSales[0].produtoNome}) não está pronto!`}
                          >
                            <Link className="h-3 w-3 text-sky-405" />
                            <span>Bloqueado 🔗</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleUnlockLinkedOrder(sale.id)}
                            className="py-1 px-1.5 bg-sky-950 text-sky-300 hover:text-white border border-sky-800 rounded-md text-[9px] font-black cursor-pointer"
                            title="Desbloquear para avisar"
                          >
                            <Unlock className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
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
                      )
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

      {activeSubTab === 'semana' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header & Week Picker */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-sky-400 font-extrabold uppercase tracking-widest">
                      {weekMode === 'custom'
                        ? 'Período Personalizado'
                        : weekOffset === 0
                          ? 'Esta Semana'
                          : weekOffset === 1
                            ? 'Próxima Semana'
                            : weekOffset > 1
                              ? `Daqui a ${weekOffset} Semanas`
                              : `${Math.abs(weekOffset)} Semana(s) Atrás`}
                    </span>
                    <span className="text-[10px] font-mono bg-zinc-950 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                      {activePeriodBounds.label}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-100 mt-0.5">
                    Controle Semanal de Entregas &amp; Produção
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Consulte quantos pedidos estão fechados por semana e separe por produto (copos, bolsas, taças...) para não exceder sua capacidade
                  </p>
                </div>
              </div>

              {/* Navigation Arrows & Quick Date Jump */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    playAppSound('click');
                    setWeekMode('week');
                    setWeekOffset(prev => prev - 1);
                    setSelectedWeekDay(null);
                  }}
                  className="px-3 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Semana Anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Anterior</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playAppSound('click');
                    setWeekMode('week');
                    setWeekOffset(prev => prev + 1);
                    setSelectedWeekDay(null);
                  }}
                  className="px-3 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Próxima Semana"
                >
                  <span>Próxima</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5">
                  <span className="text-[10px] text-zinc-400 font-bold">Ir p/ data:</span>
                  <input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value) {
                        playAppSound('click');
                        jumpToWeekOfDate(e.target.value);
                      }
                    }}
                    className="bg-transparent text-xs text-zinc-200 font-mono focus:outline-none cursor-pointer"
                    title="Escolha qualquer data para abrir a semana correspondente"
                  />
                </div>
              </div>
            </div>

            {/* Quick Week Preset Buttons */}
            <div className="flex flex-wrap gap-2 items-center pt-1">
              {[
                { label: 'Esta Semana', offset: 0 },
                { label: 'Próxima Semana', offset: 1 },
                { label: 'Daqui 2 Semanas', offset: 2 },
                { label: 'Daqui 3 Semanas', offset: 3 }
              ].map(preset => {
                const isActive = weekMode === 'week' && weekOffset === preset.offset;
                return (
                  <button
                    key={preset.offset}
                    type="button"
                    onClick={() => {
                      playAppSound('click');
                      setWeekMode('week');
                      setWeekOffset(preset.offset);
                      setSelectedWeekDay(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-950/40'
                        : 'bg-zinc-950/70 text-zinc-400 hover:text-zinc-100 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  playAppSound('click');
                  setWeekMode('custom');
                  setSelectedWeekDay(null);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${
                  weekMode === 'custom'
                    ? 'bg-brand-pink text-black border-brand-pink shadow-md'
                    : 'bg-zinc-950/70 text-zinc-400 hover:text-zinc-100 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span>Período Personalizado</span>
              </button>
            </div>

            {/* Custom Date Range Pickers */}
            {weekMode === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 bg-zinc-950/80 border border-zinc-800 p-3.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-zinc-400">De:</span>
                  <input
                    type="date"
                    value={customRangeStart}
                    onChange={(e) => setCustomRangeStart(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-brand-pink"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-zinc-400">Até:</span>
                  <input
                    type="date"
                    value={customRangeEnd}
                    onChange={(e) => setCustomRangeEnd(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-brand-pink"
                  />
                </div>
              </div>
            )}

            {/* Day-by-day clickable breakdown strip (for week mode) */}
            {weekMode === 'week' && (
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Distribuição por Dia da Semana (clique no dia para filtrar)
                  </span>
                  {selectedWeekDay && (
                    <button
                      type="button"
                      onClick={() => {
                        playAppSound('click');
                        setSelectedWeekDay(null);
                      }}
                      className="text-[10px] font-bold text-sky-400 hover:underline cursor-pointer"
                    >
                      Ver Semana Inteira
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {weekDaysBreakdown.map(day => {
                    const isSelected = selectedWeekDay === day.dateStr;
                    const isToday = day.dateStr === todayStr;
                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => {
                          playAppSound('click');
                          setSelectedWeekDay(isSelected ? null : day.dateStr);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-sky-600/20 border-sky-400 text-white ring-1 ring-sky-400/50'
                            : isToday
                              ? 'bg-brand-pink/10 border-brand-pink/35 hover:border-brand-pink text-zinc-100'
                              : 'bg-zinc-950/70 border-zinc-850 hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-[10px] font-black uppercase ${isToday ? 'text-brand-pink' : 'text-zinc-400'}`}>
                            {day.weekdayShort}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">{day.dayMonth}</span>
                        </div>
                        <div className="mt-1.5 flex items-baseline gap-1">
                          <span className={`text-base font-black font-mono ${
                            day.count === 0 ? 'text-zinc-600' : day.count >= 15 ? 'text-amber-400' : 'text-zinc-100'
                          }`}>
                            {day.count}
                          </span>
                          <span className="text-[9.5px] text-zinc-500">
                            {day.count === 1 ? 'pedido' : 'pedidos'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Weekly Production Capacity Meter Card */}
          {(() => {
            const totalClosed = periodClosedSales.length;
            const percent = Math.min(100, Math.round((totalClosed / Math.max(1, weeklyCapacityLimit)) * 100));
            const remaining = weeklyCapacityLimit - totalClosed;
            const isOver = remaining < 0;
            const isWarning = !isOver && percent >= 75;

            return (
              <div className={`border rounded-2xl p-5 shadow-md space-y-4 transition-all ${
                isOver
                  ? 'bg-rose-950/20 border-rose-500/40'
                  : isWarning
                    ? 'bg-amber-950/15 border-amber-500/35'
                    : 'bg-zinc-900/70 border-zinc-800'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                        {isOver ? (
                          <AlertTriangle className="h-4 w-4 text-rose-400 animate-pulse" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-emerald-400" />
                        )}
                        Capacidade de Produção da Semana
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        isOver
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : isWarning
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {isOver
                          ? `⚠️ ${Math.abs(remaining)} acima da meta!`
                          : remaining === 0
                            ? 'Limite exato atingido'
                            : `Restam ${remaining} vagas livres`}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      <strong className="text-zinc-100 text-base font-black font-mono">{totalClosed}</strong> de{' '}
                      <strong className="text-zinc-200 font-mono">{weeklyCapacityLimit} pedidos</strong> fechados para entrega neste período ({percent}%)
                      {periodBudgetCount > 0 && (
                        <span className="ml-2 text-amber-400/90 font-semibold">
                          • +{periodBudgetCount} {periodBudgetCount === 1 ? 'orçamento em aberto' : 'orçamentos em aberto'} (não contam na meta)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Editable Capacity Goal */}
                  <div className="flex items-center gap-2 bg-zinc-950/90 border border-zinc-800 rounded-xl px-3 py-2 shrink-0 self-start md:self-auto">
                    <span className="text-[10px] font-bold uppercase text-zinc-400">Meta semanal:</span>
                    {isEditingCapacity ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={weeklyCapacityLimit}
                          onChange={(e) => updateWeeklyCapacityLimit(parseInt(e.target.value, 10) || 1)}
                          className="w-16 bg-zinc-900 border border-sky-500 rounded-lg px-2 py-1 text-xs font-mono font-bold text-white focus:outline-none text-center"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            playAppSound('success');
                            setIsEditingCapacity(false);
                          }}
                          className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-black cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateWeeklyCapacityLimit(weeklyCapacityLimit - 5)}
                          className="h-6 w-6 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs cursor-pointer"
                          title="Diminuir 5"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingCapacity(true)}
                          className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sky-300 font-mono font-black text-xs cursor-pointer"
                          title="Clique para digitar o número exato da sua capacidade semanal"
                        >
                          {weeklyCapacityLimit} ped.
                        </button>
                        <button
                          type="button"
                          onClick={() => updateWeeklyCapacityLimit(weeklyCapacityLimit + 5)}
                          className="h-6 w-6 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs cursor-pointer"
                          title="Aumentar 5"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isOver
                        ? 'bg-gradient-to-r from-rose-600 to-red-400'
                        : isWarning
                          ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                          : 'bg-gradient-to-r from-emerald-600 to-sky-400'
                    }`}
                    style={{ width: `${Math.min(100, (totalClosed / Math.max(1, weeklyCapacityLimit)) * 100)}%` }}
                  />
                </div>

                {/* Secondary quick metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-3">
                    <span className="text-[9.5px] font-bold uppercase text-zinc-500 block">Total da Semana</span>
                    <span className="text-lg font-black font-mono text-zinc-100">{periodClosedSales.length} pedidos</span>
                  </div>
                  <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-3">
                    <span className="text-[9.5px] font-bold uppercase text-amber-500/80 block">Ainda Não Entregues</span>
                    <span className="text-lg font-black font-mono text-amber-400">{weekPendingCount} pedidos</span>
                  </div>
                  <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-3">
                    <span className="text-[9.5px] font-bold uppercase text-emerald-500/80 block">Já Entregues</span>
                    <span className="text-lg font-black font-mono text-emerald-400">{weekDeliveredCount} pedidos</span>
                  </div>
                  <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-3">
                    <span className="text-[9.5px] font-bold uppercase text-sky-400/80 block">Soma de Unidades</span>
                    <span className="text-lg font-black font-mono text-sky-300">{totalUnitsInPeriod.toLocaleString('pt-BR')} un.</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Separação por Tipo de Produto & Pesquisa Robusta */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div>
                <h3 className="text-sm font-black text-zinc-100 uppercase tracking-wide flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-pink" />
                  <span>Separação por Produto &amp; Categoria</span>
                  {selectedWeekDay && (
                    <span className="text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded">
                      {getWeekdayPt(selectedWeekDay)} ({formatLocalDate(selectedWeekDay)})
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Clique em uma categoria (ex: Copos, Bolsas) ou digite o nome do produto para saber exatamente quantos pedidos e unidades você tem para entregar
                </p>
              </div>

              {(selectedCategoryFilter !== 'Todos' || selectedSpecificProduct || weekSearchQuery || selectedWeekDay || weekStatusFilter !== 'todos') && (
                <button
                  type="button"
                  onClick={() => {
                    playAppSound('click');
                    setSelectedCategoryFilter('Todos');
                    setSelectedSpecificProduct('');
                    setWeekSearchQuery('');
                    setSelectedWeekDay(null);
                    setWeekStatusFilter('todos');
                  }}
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Limpar Filtros</span>
                </button>
              )}
            </div>

            {/* Category Cards */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  playAppSound('click');
                  setSelectedCategoryFilter('Todos');
                  setSelectedSpecificProduct('');
                }}
                className={`px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedCategoryFilter === 'Todos' && !selectedSpecificProduct
                    ? 'bg-brand-pink text-black border-brand-pink font-extrabold shadow-sm'
                    : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                }`}
              >
                <span className={`text-[10px] uppercase font-black block ${selectedCategoryFilter === 'Todos' && !selectedSpecificProduct ? 'text-black/75' : 'text-zinc-400'}`}>
                  Todos os Produtos
                </span>
                <span className="text-xs font-mono font-black">
                  {dayAndStatusSales.length} {dayAndStatusSales.length === 1 ? 'pedido' : 'pedidos'} • {totalUnitsInPeriod} un.
                </span>
              </button>

              {categoryBreakdown.map(cat => {
                const isSelected = selectedCategoryFilter === cat.category && !selectedSpecificProduct;
                return (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => {
                      playAppSound('click');
                      setSelectedCategoryFilter(isSelected ? 'Todos' : cat.category);
                      setSelectedSpecificProduct('');
                    }}
                    className={`px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-400 font-extrabold shadow-md shadow-sky-950/40'
                        : 'bg-zinc-950/80 border-zinc-800 hover:border-sky-500/40 text-zinc-200'
                    }`}
                  >
                    <span className={`text-[10px] uppercase font-black block ${isSelected ? 'text-sky-100' : 'text-sky-400'}`}>
                      {cat.category}
                    </span>
                    <span className="text-xs font-mono font-black">
                      {cat.ordersCount} {cat.ordersCount === 1 ? 'pedido' : 'pedidos'} • {cat.unitsCount} un.
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input + Status Filter + Specific Product Dropdown */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
              <div className="relative md:col-span-5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={weekSearchQuery}
                  onChange={(e) => setWeekSearchQuery(e.target.value)}
                  placeholder="Buscar produto (ex: copo, bolsa, gin), cliente ou nº pedido..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40"
                />
                {weekSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setWeekSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="md:col-span-4">
                <select
                  value={selectedSpecificProduct}
                  onChange={(e) => {
                    playAppSound('click');
                    setSelectedSpecificProduct(e.target.value);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 font-semibold focus:outline-none focus:border-sky-500/60"
                >
                  <option value="">📦 Filtrar por produto específico ({specificProductsBreakdown.length} tipos)</option>
                  {specificProductsBreakdown
                    .filter(p => selectedCategoryFilter === 'Todos' || p.category === selectedCategoryFilter)
                    .map(p => (
                      <option key={p.key} value={p.key}>
                        {p.name} — {p.ordersCount} {p.ordersCount === 1 ? 'pedido' : 'pedidos'} ({p.unitsCount} un.)
                      </option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <select
                  value={weekStatusFilter}
                  onChange={(e) => {
                    playAppSound('click');
                    setWeekStatusFilter(e.target.value as any);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 font-semibold focus:outline-none focus:border-sky-500/60"
                >
                  <option value="todos">Status: Todos Fechados</option>
                  <option value="pendentes">Status: A Produzir / Agendados</option>
                  <option value="prontos">Status: Prontos p/ Retirada</option>
                  <option value="entregues">Status: Já Entregues</option>
                </select>
              </div>
            </div>

            {/* Active Product/Category Highlight Banner */}
            {hasProductOrTextFilter && (
              <div className="bg-sky-950/30 border border-sky-500/35 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Package className="h-5 w-5 text-sky-400 shrink-0" />
                  <div className="text-xs text-zinc-200">
                    Resultado do filtro:{' '}
                    <strong className="text-sky-300 font-black text-sm font-mono">
                      {weeklyFilteredSales.length} {weeklyFilteredSales.length === 1 ? 'pedido' : 'pedidos'}
                    </strong>{' '}
                    para entregar neste período
                    {matchingItemsUnitsCount > 0 && (
                      <span>
                        {' '}• totalizando{' '}
                        <strong className="text-emerald-300 font-black font-mono">
                          {matchingItemsUnitsCount} {matchingItemsUnitsCount === 1 ? 'unidade' : 'unidades'}
                        </strong>{' '}
                        do item pesquisado
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {selectedCategoryFilter !== 'Todos' ? `Categoria: ${selectedCategoryFilter}` : ''}
                  {selectedSpecificProduct ? ` • Produto selecionado` : ''}
                  {weekSearchQuery ? ` • Busca: "${weekSearchQuery}"` : ''}
                </span>
              </div>
            )}
          </div>

          {/* List of Matching Orders for the Selected Week */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                Pedidos Agendados na Semana ({weeklyFilteredSales.length})
              </h4>
              <span className="text-[10px] text-zinc-500 font-mono">
                Ordenados pela data de retirada/entrega
              </span>
            </div>

            {weeklyFilteredSales.length === 0 ? (
              <div className="py-14 text-center bg-zinc-950/30 border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center space-y-2.5">
                <CalendarDays className="h-8 w-8 text-zinc-600" />
                <div>
                  <h5 className="text-sm font-bold text-zinc-300">Nenhum pedido encontrado neste filtro</h5>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Não há pedidos fechados para entregar nesta semana com os filtros selecionados.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weeklyFilteredSales.map((sale) => {
                  const normItems = getSaleNormalizedItems(sale);
                  const isDelivered = sale.statusProducao === 'Entregue';
                  const isReady = sale.statusProducao === 'Pronto para Retirada';
                  const qNorm = normalizeText(weekSearchQuery);

                  return (
                    <div
                      key={sale.id}
                      className={`border rounded-2xl p-4 space-y-3 transition-all ${
                        isDelivered
                          ? 'bg-zinc-950/40 border-zinc-900 opacity-75'
                          : isReady
                            ? 'bg-emerald-950/10 border-emerald-500/30 hover:border-emerald-500/50'
                            : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* Top row: Date badge + Order number + Status */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-md font-mono">
                            📅 {getWeekdayPt(sale.dataRetirada)}, {formatLocalDate(sale.dataRetirada || '')}
                          </span>
                          {sale.turnoEntrega && (
                            <span className="text-[9.5px] font-bold bg-zinc-950 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                              {sale.turnoEntrega === 'Manhã' ? '☀️ Manhã' : '🌇 Tarde'}
                            </span>
                          )}
                          <span className="text-[10px] bg-zinc-950 border border-zinc-800 text-zinc-400 font-mono font-bold px-2 py-0.5 rounded-md">
                            #{sale.numeroPedido || sale.id.substring(0, 5).toUpperCase()}
                          </span>
                        </div>

                        <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded border ${
                          (!sale.statusProducao || sale.statusProducao === 'Agendado') ? 'bg-blue-900/15 text-blue-400 border-blue-900/30' :
                          sale.statusProducao === 'Em Produção' ? 'bg-amber-900/15 text-amber-400 border-amber-900/30' :
                          sale.statusProducao === 'Pronto para Retirada' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                          sale.statusProducao === 'Agendado para Entrega' ? 'bg-purple-900/15 text-purple-400 border-purple-900/30' :
                          'bg-emerald-950/30 text-emerald-500 border-emerald-900/30'
                        }`}>
                          {sale.statusProducao || 'Agendado'}
                        </span>
                      </div>

                      {/* Customer info */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h5 className="text-sm font-bold text-zinc-100 truncate flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-brand-pink shrink-0" />
                            <span className="truncate">{sale.cliente}</span>
                          </h5>
                          {sale.telefoneCliente && (
                            <p className="text-[10.5px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{sale.telefoneCliente}</span>
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-black text-brand-pink block">
                            R$ {sale.total.toFixed(2)}
                          </span>
                          {sale.valorFaltante && sale.valorFaltante > 0 ? (
                            <span className="text-[9.5px] font-bold text-rose-400">
                              Falta R$ {sale.valorFaltante.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-bold text-emerald-400">Pago</span>
                          )}
                        </div>
                      </div>

                      {/* Items list highlighting matching products/categories */}
                      <div className="bg-black/35 border border-zinc-850 rounded-xl p-2.5 space-y-1">
                        {normItems.map((it, idx) => {
                          const isHighlighted =
                            (selectedCategoryFilter !== 'Todos' && it.categoriaGrupo === selectedCategoryFilter) ||
                            (selectedSpecificProduct && normalizeText(it.nome) === selectedSpecificProduct) ||
                            (qNorm.length > 0 && (normalizeText(it.nome).includes(qNorm) || normalizeText(it.categoriaGrupo).includes(qNorm)));

                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded ${
                                isHighlighted ? 'bg-sky-500/15 text-sky-200 font-bold border border-sky-500/25' : 'text-zinc-300'
                              }`}
                            >
                              <span className="truncate pr-2">
                                • {it.nome}{' '}
                                <span className="text-[9.5px] text-zinc-500 font-normal">({it.categoriaGrupo})</span>
                              </span>
                              <span className="font-mono font-bold text-[10.5px] shrink-0">
                                {it.quantidade}x
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            playAppSound('click');
                            setSelectedSaleForReceipt(sale);
                          }}
                          className="px-2.5 py-1.5 bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-800/40 rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Ver Recibo</span>
                        </button>

                        {!isDelivered && (
                          <button
                            type="button"
                            onClick={() => handleReminderAction(sale)}
                            className="px-3 py-1.5 bg-brand-pink/15 hover:bg-brand-pink text-brand-pink hover:text-black border border-brand-pink/30 rounded-lg text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Avisar / WhatsApp</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
                  Estimule o crescimento orgânico da <strong className="text-brand-pink font-semibold">Oxente Festeje</strong>! Seus clientes indicam amigos enviando um cupom com código de indicação personalizado. Quando o amigo realiza uma compra informando esse código, ele ganha <strong className="text-emerald-400 font-semibold">5% de desconto imediato</strong> e o cliente indicador ganha <strong className="text-emerald-400 font-semibold">+5% de desconto acumulativo</strong> para ser descontado na sua própria próxima compra ou festa, podendo somar até <strong className="text-emerald-400 font-semibold">15% de desconto total</strong>.
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
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Clientes Indicadores</span>
                <span className="text-xl font-mono font-bold text-amber-500">{referralMetrics.indicatorsList.length}</span>
                <span className="text-[9px] text-zinc-500 block">Clientes com códigos e cupons ativos</span>
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
                  O amigo indicado informa o código no momento da compra. O app valida e concede <strong>5% de desconto na hora</strong> na nova compra.
                </p>
              </div>

              <div className="space-y-1.5 bg-black/45 border border-zinc-900 p-3 rounded-xl">
                <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                  <span className="text-amber-500 font-mono text-sm">3.</span>
                  <span>Desconto Acumulativo</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  O cliente originário ganha <strong>+5% para cada indicação</strong> finalizada, podendo acumular até <strong>15% de desconto total</strong> para usar na sua próxima festa Oxente!
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
                    <th className="py-3 px-4 text-emerald-500 text-right">Desconto Acumulado</th>
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
2. Na primeira compra deles, eles informam o seu código no momento da compra e ganham *5% de desconto na festa/pedido* na hora no valor total da compra!
3. Assim que eles completarem a compra, você ganha *+5% de desconto acumulado*, podendo juntar indicações para receber até *15% de desconto no valor total* da sua próxima festa!

Dê desconto para os seus amigos e ganhe até 15% de desconto total na sua próxima compra da Oxente! 🥳🎈`;

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
                          <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-450 text-sm">
                            {ind.cashbackEarned}% desct.
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
        onClose={() => {
          setSelectedSaleForWA(null);
          setIsDelayedReminderSelected(false);
        }}
        onUpdateSale={onUpdateSale}
        storeInfo={storeInfo}
        isDelayedPickup={isDelayedReminderSelected}
      />

      {/* Slide-over or Modal view for simulated thermal Receipt */}
      <AnimatePresence>
        {selectedSaleForReceipt && (
          <div className="fixed inset-0 bg-black/80 flex items-start justify-center p-4 z-50 overflow-y-auto backdrop-blur-[1px] py-6 sm:py-12">
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
