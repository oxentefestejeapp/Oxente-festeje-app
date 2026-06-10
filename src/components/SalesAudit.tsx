import React, { useState, useMemo } from 'react';
import { 
  ClipboardList, 
  Search, 
  UserCheck, 
  Calendar, 
  Layers, 
  Filter, 
  BadgeCheck, 
  Clock, 
  AlertCircle,
  X,
  Eye,
  Pencil,
  Palette,
  Sparkles,
  Check,
  RotateCcw,
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import { Sale, StoreInfo } from '../types';
import { Receipt } from './Receipt';

const formatAuditDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr || '';
  }
};

const getChanges = (sale: Sale) => {
  if (!sale.valoresOriginais) return [];
  const orig = sale.valoresOriginais;
  const changes = [];

  if (orig.cliente !== sale.cliente) {
    changes.push({
      field: 'Cliente',
      oldValue: orig.cliente,
      newValue: sale.cliente,
    });
  }

  if (orig.total !== sale.total) {
    changes.push({
      field: 'Valor Total',
      oldValue: `R$ ${orig.total.toFixed(2)}`,
      newValue: `R$ ${sale.total.toFixed(2)}`,
    });
  }

  if (orig.formaPagamento !== sale.formaPagamento) {
    changes.push({
      field: 'Meio de Pagamento',
      oldValue: orig.formaPagamento,
      newValue: sale.formaPagamento,
    });
  }

  const origValorPago = orig.valorPago !== undefined ? orig.valorPago : orig.total;
  const currValorPago = sale.valorPago !== undefined ? sale.valorPago : sale.total;
  if (origValorPago !== currValorPago) {
    changes.push({
      field: 'Valor Pago',
      oldValue: `R$ ${origValorPago.toFixed(2)}`,
      newValue: `R$ ${currValorPago.toFixed(2)}`,
    });
  }

  const origFaltante = orig.valorFaltante !== undefined ? orig.valorFaltante : Math.max(0, orig.total - origValorPago);
  const currFaltante = sale.valorFaltante !== undefined ? sale.valorFaltante : Math.max(0, sale.total - currValorPago);
  if (origFaltante !== currFaltante) {
    changes.push({
      field: 'Valor Faltante',
      oldValue: `R$ ${origFaltante.toFixed(2)}`,
      newValue: `R$ ${currFaltante.toFixed(2)}`,
    });
  }

  if (orig.numeroPedido !== sale.numeroPedido) {
    changes.push({
      field: 'Número do Pedido',
      oldValue: orig.numeroPedido || 'Nenhum',
      newValue: sale.numeroPedido || 'Nenhum',
    });
  }

  if (orig.statusProducao !== sale.statusProducao) {
    changes.push({
      field: 'Status de Produção',
      oldValue: orig.statusProducao || 'Agendado',
      newValue: sale.statusProducao || 'Agendado',
    });
  }

  // Compare elements of itens
  const origItensStr = (orig.itens || []).map(i => `${i.produtoNome} (x${i.quantidade}) - R$ ${i.total.toFixed(2)}`).join(' | ');
  const currItensStr = (sale.itens || []).map(i => `${i.produtoNome} (x${i.quantidade}) - R$ ${i.total.toFixed(2)}`).join(' | ');
  if (origItensStr !== currItensStr) {
    changes.push({
      field: 'Itens do Pedido',
      oldValue: (orig.itens && orig.itens.length > 0) ? (
        <div className="space-y-0.5">
          {orig.itens.map((item, idx) => (
            <div key={idx} className="font-mono text-[9.5px] leading-tight text-zinc-300">
              • {item.produtoNome} (x{item.quantidade} R$ {item.precoUn.toFixed(2)}) = R$ {item.total.toFixed(2)}
            </div>
          ))}
        </div>
      ) : `Produto: ${orig.produtoNome || 'Nenhum'}`,
      newValue: (sale.itens && sale.itens.length > 0) ? (
        <div className="space-y-0.5">
          {sale.itens.map((item, idx) => (
            <div key={idx} className="font-mono text-[9.5px] leading-tight text-brand-pink font-semibold">
              • {item.produtoNome} (x{item.quantidade} R$ {item.precoUn.toFixed(2)}) = R$ {item.total.toFixed(2)}
            </div>
          ))}
        </div>
      ) : `Produto: ${sale.produtoNome || 'Nenhum'}`,
    });
  }

  return changes;
};

interface SalesAuditProps {
  sales: Sale[];
  storeInfo: StoreInfo;
  onUpdateSale?: (updatedSale: Sale) => void;
}

export function SalesAudit({ sales, storeInfo, onUpdateSale }: SalesAuditProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'this_month' | 'custom'>('all');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [specialFilter, setSpecialFilter] = useState<'all' | 'edited' | 'has_designer' | 'finished_art'>('all');
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);

  // Convert string timestamp to comparative date
  const parseSaleDate = (dateStr: string) => {
    try {
      return new Date(dateStr);
    } catch {
      return new Date();
    }
  };

  // Get list of unique creators and designers with comprehensive metrics
  const creatorsStats = useMemo(() => {
    const stats: Record<string, { count: number; totalValue: number; designsCompleted: number }> = {};
    
    const ensureUser = (email: string) => {
      if (!stats[email]) {
        stats[email] = { count: 0, totalValue: 0, designsCompleted: 0 };
      }
    };

    sales.forEach(sale => {
      // 1. Check creations (excluding estimates)
      if (sale.status !== 'Orçamento') {
        const creatorEmail = sale.criadoPorEmail || 'Sistema/Legado';
        ensureUser(creatorEmail);
        stats[creatorEmail].count += 1;
        stats[creatorEmail].totalValue += sale.total;
      }

      // 2. Check completed designs (arts)
      if (sale.statusArte === 'Arte Finalizada') {
        const designerEmail = sale.arteFinalizadaPorEmail || sale.puxadoPor;
        if (designerEmail) {
          ensureUser(designerEmail);
          stats[designerEmail].designsCompleted += 1;
        }
      }
    });

    return stats;
  }, [sales]);

  // Determine leaders for gamified presentation & comparison
  const leaderboardMeta = useMemo(() => {
    let maxVal = 0;
    let maxDesigns = 0;
    let maxValEmail = '';
    let maxDesignsEmail = '';

    (Object.entries(creatorsStats) as [string, { count: number; totalValue: number; designsCompleted: number }][]).forEach(([email, stats]) => {
      if (stats.totalValue > maxVal) {
        maxVal = stats.totalValue;
        maxValEmail = email;
      }
      if (stats.designsCompleted > maxDesigns) {
        maxDesigns = stats.designsCompleted;
        maxDesignsEmail = email;
      }
    });

    return {
      maxSalesValue: maxVal || 1,
      maxDesignsCompleted: maxDesigns || 1,
      maxSalesEmail: maxValEmail,
      maxDesignsEmail: maxDesignsEmail,
    };
  }, [creatorsStats]);

  // Filter Sales list based on search term, date, user filter, and special audit filter
  const auditLogs = useMemo(() => {
    // We sort sales to show the latest created orders first (Audit Timeline descending)
    const sortedSales = sales.filter(s => s.status !== 'Orçamento').sort((a, b) => {
      return parseSaleDate(b.data).getTime() - parseSaleDate(a.data).getTime();
    });

    return sortedSales.filter((sale) => {
      // 1. User Filter (Matches both sale creator and designer who completed the artwork)
      const creator = sale.criadoPorEmail || 'Sistema/Legado';
      const designer = sale.arteFinalizadaPorEmail || sale.puxadoPor || '';
      if (selectedUserFilter !== 'all' && creator !== selectedUserFilter && designer !== selectedUserFilter) {
        return false;
      }

      // 1.5. Special Audit Filter
      if (specialFilter === 'edited' && !sale.foiAlterado) {
        return false;
      }
      if (specialFilter === 'has_designer' && !sale.designerId) {
        return false;
      }
      if (specialFilter === 'finished_art' && sale.statusArte !== 'Arte Finalizada') {
        return false;
      }

      // 2. Date Filter
      try {
        const saleDate = parseSaleDate(sale.data);
        const now = new Date();

        if (dateFilter === 'today') {
          if (saleDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === '7days') {
          const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (dateFilter === 'this_month') {
          if (saleDate.getMonth() !== now.getMonth() || saleDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (dateFilter === 'custom') {
          if (startDateStr) {
            const start = new Date(startDateStr + 'T00:00:00');
            if (saleDate < start) return false;
          }
          if (endDateStr) {
            const end = new Date(endDateStr + 'T23:59:59');
            if (saleDate > end) return false;
          }
        }
      } catch (e) {
        console.error('Audit date filtering error:', e);
      }

      // 3. Search Term Filter (checks customer, order number, creator, editor, or designer)
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;

      const creatorEmail = (sale.criadoPorEmail || 'Sistema/Legado').toLowerCase();
      const editorEmail = (sale.editadoPorEmail || '').toLowerCase();
      const designerEmail = (sale.arteFinalizadaPorEmail || '').toLowerCase();
      const assignEmail = (sale.puxadoPor || '').toLowerCase();
      const customer = sale.cliente.toLowerCase();
      const orderNum = sale.numeroPedido ? sale.numeroPedido.toLowerCase() : '';
      const product = sale.produtoNome.toLowerCase();

      return (
        creatorEmail.includes(term) ||
        editorEmail.includes(term) ||
        designerEmail.includes(term) ||
        assignEmail.includes(term) ||
        customer.includes(term) ||
        orderNum.includes(term) ||
        product.includes(term)
      );
    });
  }, [sales, searchTerm, dateFilter, startDateStr, endDateStr, selectedUserFilter, specialFilter]);

  // Overall statistics for the filtered selection
  const filteredMetrics = useMemo(() => {
    let totalValue = 0;
    let editedCount = 0;
    let artworkFinishedCount = 0;
    
    auditLogs.forEach(s => {
      totalValue += s.total;
      if (s.foiAlterado) editedCount++;
      if (s.statusArte === 'Arte Finalizada') artworkFinishedCount++;
    });

    return {
      count: auditLogs.length,
      totalValue,
      editedCount,
      artworkFinishedCount
    };
  }, [auditLogs]);

  return (
    <div className="space-y-6 select-text text-zinc-100">
      
      {/* Title & Introduction Panel */}
      <div className="bg-zinc-900 border border-zinc-805 rounded-2xl p-6 select-none shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-pink/10 rounded-xl border border-brand-pink/35 text-brand-pink shrink-0">
            <ClipboardList className="h-6 w-6 stroke-[2]" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-zinc-100">Painel de Auditoria de Vendas</h2>
            <p className="text-xs text-zinc-450 mt-0.5">Rastreabilidade completa de todas as vendas e encomendas registradas pelos usuários</p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        {/* Metric 1 */}
        <div className="bg-zinc-950 border border-zinc-850/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[10px] font-black tracking-wider uppercase">Vendas no Filtro</span>
            <Layers className="h-4 w-4 text-brand-pink" />
          </div>
          <div className="text-2xl font-black font-mono text-zinc-100">{filteredMetrics.count}</div>
          <p className="text-[10px] text-zinc-450 mt-1">Transações gravadas no período</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-zinc-950 border border-zinc-850/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[10px] font-black tracking-wider uppercase">Faturamento no Filtro</span>
            <BadgeCheck className="h-4 w-4 text-emerald-450" />
          </div>
          <div className="text-2xl font-black font-mono text-zinc-100">R$ {filteredMetrics.totalValue.toFixed(2)}</div>
          <p className="text-[10px] text-zinc-450 mt-1">Valor somado das vendas ativas no filtro</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-zinc-950 border border-zinc-850/80 rounded-2xl p-4 shadow-xs border-l-red-900/40 border-l-2">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[10px] font-black tracking-wider uppercase">Recibos Alterados</span>
            <Pencil className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-2xl font-black font-mono text-red-400">{filteredMetrics.editedCount}</div>
          <p className="text-[10px] text-zinc-450 mt-1">Recibos editados após criação original</p>
        </div>

        {/* Metric 4 */}
        <div className="bg-zinc-950 border border-zinc-850/80 rounded-2xl p-4 shadow-xs border-l-emerald-900/40 border-l-2">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[10px] font-black tracking-wider uppercase">Artes Finalizadas</span>
            <Sparkles className="h-4 w-4 text-emerald-450" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-450">{filteredMetrics.artworkFinishedCount}</div>
          <p className="text-[10px] text-zinc-450 mt-1">Designs de pedidos totalmente concluídos</p>
        </div>
      </div>

      {/* Collaborator Contributions Leaderboard */}
      <div className="bg-zinc-900 border border-zinc-805 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <h3 className="text-xs font-bold font-display uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 select-none">
            <UserCheck className="h-4 w-4 text-brand-pink" />
            <span>Atividade e Comparativo por Usuário</span>
          </h3>
          <span className="text-[10px] text-zinc-550 font-bold uppercase select-none">
            🎨 Compare o desempenho de vendas e designs concluídos
          </span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(creatorsStats).map(([email, info]) => {
            const stats = info as { count: number; totalValue: number; designsCompleted: number };
            const isSalesLeader = email === leaderboardMeta.maxSalesEmail && stats.totalValue > 0;
            const isDesignsLeader = email === leaderboardMeta.maxDesignsEmail && stats.designsCompleted > 0;
            
            return (
              <button
                key={email}
                onClick={() => setSelectedUserFilter(selectedUserFilter === email ? 'all' : email)}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer group relative overflow-hidden ${
                  selectedUserFilter === email 
                    ? 'bg-brand-pink/15 border-brand-pink/50 shadow-md ring-1 ring-brand-pink/20' 
                    : 'bg-black/30 border-zinc-850 hover:border-zinc-750'
                }`}
              >
                <div className="w-full space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="min-w-0 flex-1">
                      <div className="text-zinc-500 text-[9px] font-extrabold uppercase tracking-widest group-hover:text-zinc-400 transition-colors">E-mail do Operador</div>
                      <div className="text-zinc-200 text-xs font-bold font-mono truncate mt-0.5" title={email}>{email}</div>
                    </div>
                  </div>

                  {/* Operational stats list */}
                  <div className="space-y-3 bg-zinc-950/30 p-3 rounded-xl border border-zinc-850/35">
                    {/* Vendas */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-zinc-350">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-brand-pink shrink-0" />
                          <span>Vendas: <b className="text-zinc-150 font-mono font-black">{stats.count}</b></span>
                        </span>
                        <span className="text-brand-pink font-mono font-extrabold text-[10.5px]">R$ {stats.totalValue.toFixed(2)}</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-pink rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(3, (stats.totalValue / leaderboardMeta.maxSalesValue) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* Artes Criadas / Arte Finalizada */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-zinc-350">
                        <span className="flex items-center gap-1">
                          <Palette className="w-3.5 h-3.5 text-emerald-450 shrink-0" />
                          <span>Artes Concluídas:</span>
                        </span>
                        <span className="text-emerald-400 font-mono font-black text-xs">{stats.designsCompleted}</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(3, (stats.designsCompleted / leaderboardMeta.maxDesignsCompleted) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Leader ribbons / tags */}
                  {(isSalesLeader || isDesignsLeader) && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-zinc-850/30 w-full select-none">
                      {isSalesLeader && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400">
                          👑 Top Vendas
                        </span>
                      )}
                      {isDesignsLeader && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          ✨ Líder Artes
                        </span>
                      )}
                    </div>
                  )}

                </div>
              </button>
            );
          })}
          {Object.keys(creatorsStats).length === 0 && (
            <div className="col-span-full py-4 text-center text-zinc-500 text-xs">
              Nenhum dado de auditoria disponível no momento.
            </div>
          )}
        </div>
        {selectedUserFilter !== 'all' && (
          <div className="flex justify-end select-none pt-1">
            <button
              onClick={() => setSelectedUserFilter('all')}
              className="text-[10px] text-brand-pink bg-brand-pink/10 hover:bg-brand-pink/20 px-2.5 py-1 rounded-lg font-bold border border-brand-pink/20 transition-all cursor-pointer"
            >
              Exibindo somente *{selectedUserFilter}* · Limpar Filtro
            </button>
          </div>
        )}
      </div>

      {/* Main Audit Logs Filters & History Timeline list */}
      <div className="bg-zinc-900 border border-zinc-805 rounded-2xl p-5 shadow-sm space-y-4">
        
        {/* Special Audit Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-black/25 p-2 border border-zinc-850 rounded-xl select-none">
          <div className="text-[10px] uppercase font-black text-zinc-500 tracking-wider flex items-center px-1 mr-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5 mr-1 text-brand-pink" />
            Focos de Auditoria:
          </div>
          {[
            { id: 'all', label: 'Todos os Pedidos' },
            { id: 'edited', label: '🚨 Recibos Alterados' },
            { id: 'has_designer', label: '🎨 Em Design' },
            { id: 'finished_art', label: '✨ Arte Concluída' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSpecialFilter(tab.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                specialFilter === tab.id
                  ? 'bg-brand-pink/15 text-brand-pink border-brand-pink/30 shadow-xs'
                  : 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-250 hover:bg-zinc-850/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch justify-between select-none">
          {/* Search bar inside the Audit panel */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-zinc-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por operador, cliente, produto, número do pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-pink text-xs text-zinc-200 placeholder-zinc-650"
            />
          </div>

          {/* Quick Date Filters row */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/40 border border-zinc-850 p-1.5 rounded-xl">
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                dateFilter === 'all' 
                  ? 'bg-brand-pink text-black' 
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Tudo
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                dateFilter === 'today' 
                  ? 'bg-brand-pink text-black' 
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('7days')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                dateFilter === '7days' 
                  ? 'bg-brand-pink text-black' 
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              7d
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('this_month')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                dateFilter === 'this_month' 
                  ? 'bg-brand-pink text-black' 
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('custom')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                dateFilter === 'custom' 
                  ? 'bg-brand-pink text-black' 
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Personalizar
            </button>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-1 px-1.5 border-l border-zinc-800 text-[10px] mt-1.5 md:mt-0 w-full md:w-auto">
                <input
                  type="date"
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="px-1.5 py-0.5 bg-black border border-zinc-800 rounded text-zinc-200 text-[10px]"
                />
                <span className="text-zinc-500">a</span>
                <input
                  type="date"
                  value={endDateStr}
                  onChange={(e) => setEndDateStr(e.target.value)}
                  className="px-1.5 py-0.5 bg-black border border-zinc-800 rounded text-zinc-200 text-[10px]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Audit Timeline List */}
        <div className="overflow-hidden border border-zinc-850 rounded-xl bg-black/20">
          <div className="divide-y divide-zinc-850/60 max-h-[500px] overflow-y-auto">
            {auditLogs.map((sale) => {
              const creator = sale.criadoPorEmail || 'Sistema/Legado';
              const isLegacy = !sale.criadoPorEmail;
              const saleDate = parseSaleDate(sale.data);
              
              return (
                <div 
                  key={sale.id} 
                  onClick={() => setViewingSale(sale)}
                  className="p-4 hover:bg-zinc-950/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer group"
                  title="Clique para visualizar o recibo do pedido"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    
                    {/* Top: operator badge & event timestamp */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isLegacy 
                          ? 'bg-zinc-800/60 text-zinc-400' 
                          : creator === 'oxentefesteje@gmail.com' || creator === 'abraaoapp@oxente.com' || creator === 'abraaoapp'
                            ? 'bg-brand-pink/10 text-brand-pink border border-brand-pink/20'
                            : 'bg-blue-950/30 text-blue-300 border border-blue-900/20'
                      }`}>
                        <BadgeCheck className="h-3 w-3" />
                        <span>{creator}</span>
                      </span>
                      <span className="text-zinc-500 text-[10px] flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-zinc-550" />
                        <span>{saleDate.toLocaleDateString('pt-BR')} {saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      <span className="text-brand-pink opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold ml-1 hidden sm:inline-flex items-center gap-1">
                        • Ver recibo <Eye className="h-3 w-3" />
                      </span>
                    </div>

                    {/* Middle: customer name, specific item */}
                    <div className="text-zinc-250 font-medium">
                      Pedido criado para o cliente <strong className="text-zinc-100">{sale.cliente}</strong> 
                      {sale.telefoneCliente && <span className="text-zinc-500 text-[10.5px] font-mono"> ({sale.telefoneCliente})</span>}
                    </div>

                    {/* Product and item summaries */}
                    <div className="text-zinc-400 text-[11px] flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span>Produto(s):</span>
                      <span className="text-zinc-300 font-semibold bg-zinc-900 px-1.5 py-0.5 rounded text-[10.5px]" title={sale.produtoNome}>{sale.produtoNome}</span>
                      <span className="text-zinc-500 font-mono">x{sale.quantidade}</span>
                      {sale.numeroPedido && (
                        <>
                          <span className="text-zinc-650">•</span>
                          <span className="bg-zinc-850 text-zinc-400 px-1 py-0.5 rounded text-[9.5px] font-mono uppercase">Pedido #{sale.numeroPedido}</span>
                        </>
                      )}
                    </div>

                    {/* MODIFIED RECEIPT AUDIT LOG */}
                    {sale.foiAlterado && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-red-400 bg-red-950/20 border border-red-900/25 px-3 py-1.5 rounded-xl text-[11px] font-medium mt-2">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <div>
                          <span className="font-extrabold text-red-400">Recibo Alterado:</span>{' '}
                          {sale.editadoPorEmail ? (
                            <span className="text-zinc-300">
                              Modificado por <strong className="text-red-300 font-mono select-all">{sale.editadoPorEmail}</strong>{sale.editadoEm && ` em ${formatAuditDate(sale.editadoEm)}`}
                            </span>
                          ) : (
                            <span className="text-zinc-400">Dados do recibo foram reeditados na plataforma.</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ASSIGNED DESIGNER AUDIT LOG */}
                    {sale.designerId && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-blue-400 bg-blue-950/20 border border-blue-900/15 px-3 py-1.5 rounded-xl text-[11px] font-medium mt-1.5">
                        <Palette className="h-3.5 w-3.5 text-blue-450 shrink-0" />
                        <div>
                          <span className="font-bold text-blue-300">Puxado para Design (Mesa {sale.designerId === 'designer1' ? '1' : '2'}):</span>{' '}
                          <span className="text-zinc-350">
                            Por <strong className="text-blue-200 font-mono">{sale.puxadoPor || 'Designer'}</strong>{sale.puxadoEm && ` em ${formatAuditDate(sale.puxadoEm)}`}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* COMPLETED ARTWORK AUDIT LOG */}
                    {sale.statusArte === 'Arte Finalizada' && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-emerald-450 bg-emerald-950/15 border border-emerald-900/25 px-3 py-1.5 rounded-xl text-[11px] font-medium mt-1.5 select-text">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-450 shrink-0" />
                        <div>
                          <span className="font-bold text-emerald-450">✨ Arte Concluída:</span>{' '}
                          {sale.arteFinalizadaPorEmail ? (
                            <span className="text-zinc-300">
                              Arte concluída com sucesso pelo designer <strong className="text-emerald-300 font-mono select-all">{sale.arteFinalizadaPorEmail}</strong>{sale.arteFinalizadaEm && ` em ${formatAuditDate(sale.arteFinalizadaEm)}`}
                            </span>
                          ) : sale.puxadoPor ? (
                            <span className="text-zinc-350">
                              Arte concluída pelo designer <strong className="text-emerald-300 font-mono">{sale.puxadoPor}</strong>
                            </span>
                          ) : (
                            <span className="text-emerald-300 font-semibold">Arte do pedido foi marcada como Concluída!</span>
                          )}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Right side check status, details & total value of recorded order */}
                  <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 border-t border-dashed border-zinc-850 pt-2 sm:pt-0 sm:border-t-0 shrink-0 select-none">
                    <div className="text-sm font-black font-mono text-brand-pink flex flex-wrap items-center gap-1.5 justify-end">
                      {sale.foiAlterado && (
                        <span className="text-[10px] text-red-400 font-extrabold flex items-center gap-0.5 animate-pulse bg-red-950/40 border border-red-900/50 px-1.5 py-0.5 rounded select-none">
                          🚨 ALTERADO
                        </span>
                      )}
                      R$ {sale.total.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                        sale.status === 'Pendente' 
                          ? 'bg-[#EAB308]/10 text-[#EAB308] border border-[#EAB308]/20' 
                          : 'bg-emerald-950/20 text-emerald-450 border border-emerald-900/10'
                      }`}>
                        {sale.status || 'Concluído'}
                      </span>
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingSale(sale);
                        }}
                        className="px-2.5 py-1 bg-zinc-900 hover:bg-brand-pink text-zinc-400 hover:text-black border border-zinc-800 hover:border-brand-pink rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Ver Recibo do Pedido"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Recibo</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}

            {auditLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 space-y-2">
                <AlertCircle className="h-8 w-8 text-zinc-600 stroke-[1.5]" />
                <p className="text-xs">Não foram encontradas movimentações de pedido no filtro selecionado.</p>
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setDateFilter('all');
                    setSelectedUserFilter('all');
                  }} 
                  className="text-[10px] font-bold text-brand-pink underline hover:text-brand-pink-hover"
                >
                  Limpar todos os filtros
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Interactive Receipt Preview Modal Overlay */}
      {viewingSale && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto no-print"
          onClick={() => setViewingSale(null)}
        >
          <div 
            className="relative w-full max-w-xl bg-zinc-950 border border-zinc-850 rounded-2xl p-6 shadow-2xl space-y-4 my-8 animate-in fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Heading Actions */}
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-brand-pink/15 text-brand-pink rounded-lg">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <span className="font-display font-semibold text-sm text-zinc-100">Visualizar Recibo do Pedido</span>
              </div>
              
              <button
                onClick={() => setViewingSale(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-all cursor-pointer border border-zinc-850"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Embed components scroll block */}
            <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4">
              
              {/* COMPARATIVE AUDIT TRAIL LOG */}
              {viewingSale.foiAlterado && (
                <div className="bg-zinc-900/80 p-4 border border-red-500/15 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800 pb-2">
                    <p className="text-[10px] font-black tracking-widest uppercase text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span>Auditoria de Modificação: Comparativo</span>
                    </p>
                    {viewingSale.editadoEm && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatAuditDate(viewingSale.editadoEm)}
                      </span>
                    )}
                  </div>

                  {viewingSale.editadoPorEmail && (
                    <div className="text-[11.5px] bg-black/40 border border-zinc-850 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-red-400" />
                        Quem alterou este recibo:
                      </span>
                      <strong className="text-red-300 font-mono break-all text-xs">{viewingSale.editadoPorEmail}</strong>
                    </div>
                  )}
                  
                  <div className="space-y-3 divide-y divide-zinc-805">
                    {getChanges(viewingSale).length === 0 ? (
                      <p className="text-[10.5px] text-zinc-500 italic pt-1 text-center">
                        Nenhum campo principal alterado (modificação de status ou metadado).
                      </p>
                    ) : (
                      getChanges(viewingSale).map((change, idx) => (
                        <div key={idx} className={`text-xs ${idx > 0 ? 'pt-3' : ''} space-y-1.5`}>
                          <span className="font-extrabold text-zinc-300 font-sans block text-[11px] uppercase tracking-wide">
                            {change.field}
                          </span>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="bg-red-950/20 border border-red-900/15 p-2.5 rounded-lg text-zinc-400">
                              <span className="text-[9px] font-black text-red-400 uppercase tracking-widest block mb-1">
                                Como era ❌
                              </span>
                              <div className="leading-snug text-[10.5px]">
                                {change.oldValue}
                              </div>
                            </div>
                            <div className="bg-emerald-950/15 border border-emerald-950/30 p-2.5 rounded-lg text-zinc-250 select-text">
                              <span className="text-[9px] font-black text-emerald-450 uppercase tracking-widest block mb-1">
                                Como ficou ✅
                              </span>
                              <div className="leading-snug text-[10.5px]">
                                {change.newValue}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Embed thermal receipt printer block */}
              <div className="border border-zinc-905 rounded-xl bg-zinc-900/20 overflow-hidden">
                <Receipt 
                  sale={viewingSale} 
                  storeInfo={storeInfo} 
                  onUpdateSale={(updatedSale) => {
                    if (onUpdateSale) {
                      onUpdateSale(updatedSale);
                    }
                    setViewingSale(updatedSale);
                  }} 
                />
              </div>

            </div>
            
            {/* Modal Closer bar */}
            <div className="pt-2 border-t border-zinc-850">
              <button
                onClick={() => setViewingSale(null)}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-zinc-100 border border-zinc-800 rounded-xl font-semibold text-xs transition-colors cursor-pointer text-center"
              >
                Voltar à Auditoria
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
