/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, 
  Clock, 
  Users, 
  Search, 
  Calendar, 
  ArrowRight, 
  Coins, 
  ShieldAlert, 
  CreditCard,
  MessageSquare,
  AlertTriangle,
  QrCode,
  Edit2,
  Check,
  User,
  Phone,
  HelpCircle,
  Eye,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { Sale, StoreInfo, Product } from '../types';
import { Receipt } from './Receipt';

interface ReceivablesManagerProps {
  sales: Sale[];
  storeInfo: StoreInfo;
  onUpdateSale?: (updatedSale: Sale) => void;
  onNavigateToTab: (tab: 'cadastro' | 'estoque' | 'vendas' | 'a_receber' | 'entregas' | 'configuracoes', preselectedSaleId?: string) => void;
}

export function ReceivablesManager({ sales, storeInfo, onUpdateSale, onNavigateToTab }: ReceivablesManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const receiptContainerRef = React.useRef<HTMLDivElement>(null);

  const handleSelectSaleForReceipt = (sale: Sale) => {
    setViewedSale(sale);
    setTimeout(() => {
      receiptContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };
  
  // Local state for the customizable Pix Key of the store
  const [pixKey, setPixKey] = useState(() => {
    const saved = localStorage.getItem('oxente_festeje_pix_key');
    return saved || storeInfo.telefone || 'oxentefesteje@gmail.com';
  });
  const [isEditingPix, setIsEditingPix] = useState(false);
  const [tempPixKey, setTempPixKey] = useState(pixKey);

  // Synchronize viewedSale with the latest version from sales list (e.g. if paid sum or details changed)
  useEffect(() => {
    if (viewedSale) {
      const updated = sales.find(s => s.id === viewedSale.id);
      if (updated) {
        setViewedSale(updated);
      } else {
        setViewedSale(null);
      }
    }
  }, [sales]);

  // Helper to obtain local YYYY-MM-DD
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getTodayString(), []);

  // Consistent pending delivery helper
  const isSalePending = (sale: Sale) => {
    if (sale.status) {
      return sale.status === 'Pendente';
    }
    const missingValue = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - (sale.valorPago ?? sale.total));
    return missingValue > 0 || !!sale.numeroPedido;
  };

  // Extract all pending delivery sales with real outstanding balance
  const pendingSales = useMemo(() => {
    return sales.filter(s => isSalePending(s) && (s.valorFaltante !== undefined ? s.valorFaltante > 0 : (s.total - (s.valorPago ?? 0)) > 0));
  }, [sales]);

  // Priority queue of pending collections (overdue/today pick-ups first, then others)
  const prioritizedPendingSales = useMemo(() => {
    return [...pendingSales].sort((a, b) => {
      // 1. Sort by pickup date importance
      const dateA = a.dataRetirada || '';
      const dateB = b.dataRetirada || '';
      
      if (!dateA && dateB) return 1;
      if (dateA && !dateB) return -1;
      if (!dateA && !dateB) return 0;
      
      const isOverdueA = dateA <= todayStr;
      const isOverdueB = dateB <= todayStr;
      
      if (isOverdueA && !isOverdueB) return -1;
      if (!isOverdueA && isOverdueB) return 1;
      
      return dateA.localeCompare(dateB);
    });
  }, [pendingSales, todayStr]);

  // Calculations for pending deliveries metrics
  const metrics = useMemo(() => {
    let totalValue = 0;
    let totalPago = 0;
    let totalFaltante = 0;

    pendingSales.forEach(s => {
      totalValue += s.total;
      totalPago += s.valorPago ?? 0;
      totalFaltante += s.valorFaltante ?? (s.total - (s.valorPago ?? s.total));
    });

    return {
      count: pendingSales.length,
      totalValue,
      totalPago,
      totalFaltante,
    };
  }, [pendingSales]);

  const [agingFilter, setAgingFilter] = useState<'all' | '1-7' | '>7' | 'future'>('all');

  const getOverdueDays = (dateStr?: string) => {
    if (!dateStr) return 0;
    try {
      const today = new Date(todayStr + 'T12:00:00');
      const target = new Date(dateStr + 'T12:00:00');
      const diffTime = today.getTime() - target.getTime();
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  const agingStats = useMemo(() => {
    let overdue1to7 = 0;
    let overdueOver7 = 0;
    let futureOrToday = 0;

    prioritizedPendingSales.forEach(sale => {
      const days = getOverdueDays(sale.dataRetirada);
      if (days >= 1 && days <= 7) {
        overdue1to7++;
      } else if (days > 7) {
        overdueOver7++;
      } else {
        futureOrToday++;
      }
    });

    return {
      all: prioritizedPendingSales.length,
      overdue1to7,
      overdueOver7,
      futureOrToday
    };
  }, [prioritizedPendingSales, todayStr]);

  // Apply filtering with Aging Filter
  const filteredPendingSales = useMemo(() => {
    let list = prioritizedPendingSales;

    if (agingFilter !== 'all') {
      list = list.filter(sale => {
        const days = getOverdueDays(sale.dataRetirada);
        if (agingFilter === '1-7') {
          return days >= 1 && days <= 7;
        }
        if (agingFilter === '>7') {
          return days > 7;
        }
        if (agingFilter === 'future') {
          return days <= 0 || !sale.dataRetirada;
        }
        return true;
      });
    }

    const term = searchTerm.toLowerCase().trim();
    if (!term) return list;

    return list.filter(sale => {
      const matchName = sale.cliente.toLowerCase().includes(term);
      const matchOrderNum = sale.numeroPedido ? sale.numeroPedido.toLowerCase().includes(term) : false;
      const matchPhone = sale.telefoneCliente ? sale.telefoneCliente.replace(/\D/g, '').includes(term.replace(/\D/g, '')) : false;
      const matchProduct = sale.produtoNome.toLowerCase().includes(term);
      const matchItens = sale.itens ? sale.itens.some(item => item.produtoNome.toLowerCase().includes(term)) : false;
      return matchName || matchOrderNum || matchPhone || matchProduct || matchItens;
    });
  }, [prioritizedPendingSales, searchTerm, agingFilter, todayStr]);

  // Save changes to Pix Key
  const handleSavePix = () => {
    localStorage.setItem('oxente_festeje_pix_key', tempPixKey);
    setPixKey(tempPixKey);
    setIsEditingPix(false);
  };

  const [payRemainderInput, setPayRemainderInput] = useState('');

  const handleRecordPartialPayment = (amount: number, saleToPay: Sale) => {
    if (!saleToPay || !onUpdateSale) return;
    const remaining = saleToPay.valorFaltante !== undefined ? saleToPay.valorFaltante : (saleToPay.total - (saleToPay.valorPago ?? 0));
    const paidSoFar = saleToPay.valorPago ?? 0;
    
    // Amount to subtract/pay
    const finalPayment = Math.min(remaining, Math.max(0, amount));
    const newPaid = Number((paidSoFar + finalPayment).toFixed(2));
    const newMissing = Number(Math.max(0, saleToPay.total - newPaid).toFixed(2));
    
    // Create audit action logs
    let notes = saleToPay.notasInternas || '';
    const nowStr = new Date().toLocaleString('pt-BR');
    const logStr = `\n[${nowStr}] Recebeu R$ ${finalPayment.toFixed(2)} pelo painel de saldos.`;
    notes += logStr;

    const updatedSale: Sale = {
      ...saleToPay,
      valorPago: newPaid,
      valorFaltante: newMissing,
      status: newMissing === 0 ? 'Pago total' : 'Pendente',
      notasInternas: notes
    };

    onUpdateSale(updatedSale);
    setViewedSale(updatedSale);
    setPayRemainderInput('');
  };

  // Dispatch WhatsApp message function
  const handleCobrarWhatsApp = (sale: Sale) => {
    const missingValue = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - (sale.valorPago ?? 0));
    
    // 100% Client-tailored friendly remind text
    const greeting = `Olá, *${sale.cliente}*! Tudo bem? Passando para te desejar um ótimo dia! 🌸`;
    const messageBody = `Gostaríamos de lembrar que o seu pedido de *${sale.produtoNome}* (Código #${sale.numeroPedido || sale.id.substring(0, 5)}) está agendado em nosso sistema.`;
    const balanceDetail = `Identificamos que há um saldo restante de *R$ ${missingValue.toFixed(2)}* pendente para a quitação total do pedido.`;
    const pixPrompt = `Se você preferir antecipar para agilizar o atendimento no dia de sua retirada, pode realizar o Pix com nossa chave facilitadora abaixo:\n\n🔑 *Chave Pix:* \`${pixKey}\`\n\nBasta nos enviar o comprovante de transferência logo em seguida por aqui para darmos baixa em lote. Qualquer dúvida, estamos inteiramente à disposição! 🥰`;
    
    const fullText = `${greeting}\n\n${messageBody}\n\n${balanceDetail}\n\n${pixPrompt}`;
    const encodedText = encodeURIComponent(fullText);
    
    // Format Telephone with Brazil Prefix (55)
    let rawPhone = sale.telefoneCliente ? sale.telefoneCliente.replace(/\D/g, '') : '';
    if (rawPhone) {
      if (rawPhone.length <= 11) {
        rawPhone = '55' + rawPhone;
      }
      const waUrl = `https://wa.me/${rawPhone}?text=${encodedText}`;
      window.open(waUrl, '_blank', 'referrerPolicy=no-referrer');
    } else {
      alert(`O cliente ${sale.cliente} não possui número de telefone registrado para envio direto de WhatsApp.`);
    }
  };

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return dateStr <= todayStr;
  };

  const formatLocalDate = (dateStr?: string) => {
    if (!dateStr) return 'Não definida';
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 select-text">
      
      {/* 1. Header / Intro Banner */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-805 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-pink/10 border border-brand-pink/20 rounded-xl text-brand-pink">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-zinc-100">Saldos a Receber</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Visão unificada de valores pendentes de cobrança e controle financeiro de acervos</p>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* BIG SUM CARD: Outstanding Balance left to receive */}
        <div className="bg-gradient-to-br from-red-950/15 to-red-900/5 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden shadow-xs md:col-span-2">
          <div className="absolute right-4 top-4 text-red-500/5">
            <DollarSign className="h-28 w-28 stroke-[1px]" />
          </div>
          <div className="relative z-10 space-y-2">
            <p className="text-[10px] text-red-400 uppercase font-bold tracking-wider select-none">
              Total Faltando Receber (Pendentes de Entrega)
            </p>
            <p className="text-4xl md:text-5xl font-extrabold text-red-400 font-mono tracking-tight">
              R$ {metrics.totalFaltante.toFixed(2)}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 pt-1.5">
              <span>Aguardando recebimento de</span>
              <span className="font-bold text-zinc-200">{metrics.count}</span>
              <span>pedidos ativos.</span>
            </div>
          </div>
        </div>

        {/* Breakdown details */}
        <div className="bg-zinc-900 border border-zinc-808 rounded-2xl p-6 flex flex-col justify-between gap-4">
          <div className="space-y-3.5">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total dos Pedidos Pendentes</span>
              <p className="text-lg font-bold text-zinc-200 font-mono mt-0.5">R$ {metrics.totalValue.toFixed(2)}</p>
            </div>
            <div className="border-t border-zinc-800/60 pt-3">
              <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider">Já Recebido Antecipadamente</span>
              <p className="text-md font-bold text-emerald-400 font-mono mt-0.5">R$ {metrics.totalPago.toFixed(2)}</p>
            </div>
          </div>
          <div className="text-[10px] text-zinc-450 leading-relaxed bg-black/20 p-2 border border-zinc-850 rounded-lg">
            Taxa recebida: <span className="text-zinc-250 font-bold">{metrics.totalValue > 0 ? ((metrics.totalPago / metrics.totalValue) * 100).toFixed(1) : '0.0'}%</span> do total comprometido em pedidos de entrega.
          </div>
        </div>

      </div>

      {/* 3. SEÇÃO ESPECIAL: COBRANÇAS PENDENTES (PRIORIDADE) */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-6">
        
        {/* Header of Special Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🎯</span>
            <div>
              <h3 className="font-display font-semibold text-base text-zinc-100 flex items-center gap-2">
                Painel Ativo de Cobranças Pendentes
              </h3>
              <p className="text-[10.5px] text-zinc-400 mt-0.5">Clientes com saldos devedores listados prioritariamente por proximidade ou atraso na data de entrega</p>
            </div>
          </div>

          {/* Pix Key Quick Setup config board */}
          <div className="bg-black/40 border border-zinc-800 p-3 rounded-xl flex items-center gap-4 text-xs">
            <div className="space-y-0.5">
              <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-wider block">Chave Pix para Cobrança</span>
              {isEditingPix ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={tempPixKey}
                    onChange={(e) => setTempPixKey(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand-pink"
                  />
                  <button
                    onClick={handleSavePix}
                    className="p-1 bg-brand-pink/20 hover:bg-brand-pink/30 text-brand-pink rounded cursor-pointer"
                    title="Salvar"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-zinc-300">{pixKey}</span>
                  <button
                    onClick={() => {
                      setTempPixKey(pixKey);
                      setIsEditingPix(true);
                    }}
                    className="text-zinc-500 hover:text-brand-pink transition-colors cursor-pointer"
                    title="Editar Chave"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <QrCode className="h-7 w-7 text-brand-pink/30 shrink-0 hidden sm:block" />
          </div>
        </div>

        {/* Dynamic Warning Card */}
        <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl flex items-start gap-3 text-xs text-zinc-400">
          <span className="text-sm shrink-0">💬</span>
          <p>
            O botão <strong className="text-brand-pink">"Cobrar via WhatsApp"</strong> abrirá uma conversa externa já pré-carregada com as configurações detalhadas do acervo pendente, o saldo devedor e a chave Pix configurada acima. É uma abordagem leve, profissional e que facilita a quitação imediata por parte de seus clientes.
          </p>
        </div>

        {/* 📈 DEBT AGING DASHBOARD WIDGET */}
        <div className="space-y-2">
          <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest select-none">
            Análise Cronológica do Saldo Devedor:
          </span>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { id: 'all', title: 'Todos os Pendentes', subtitle: 'Carteira completa', badge: agingStats.all, color: 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/20 text-zinc-300' },
              { id: '1-7', title: 'Vencidos 1 a 7 dias', subtitle: 'Cobrança recente', badge: agingStats.overdue1to7, color: 'border-amber-900/40 hover:border-amber-850 bg-amber-950/5 text-amber-400' },
              { id: '>', title: 'Vencidos a >7 dias', subtitle: 'Atraso crítico', badge: agingStats.overdueOver7, color: 'border-red-950/50 hover:border-red-900 bg-red-950/10 text-red-400' },
              { id: 'future', title: 'A Vencer / Sem Data', subtitle: 'Futuro ou agendado', badge: agingStats.futureOrToday, color: 'border-zinc-900 hover:border-zinc-850 bg-black/40 text-zinc-400' }
            ].map((tab) => {
              // Map '>' to '>7' for correct state representation
              const tabIdValue = tab.id === '>' ? '>7' : tab.id;
              const isActive = agingFilter === tabIdValue;
              
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAgingFilter(tabIdValue as any)}
                  className={`border p-3.5 rounded-xl text-left transition-all relative cursor-pointer select-none duration-250 ${
                    isActive
                      ? 'border-brand-pink bg-brand-pink/10 ring-1 ring-brand-pink/20 text-brand-pink'
                      : tab.color
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold leading-tight">{tab.title}</span>
                    <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md font-mono ${
                      isActive ? 'bg-brand-pink text-white' : 'bg-black/40 text-zinc-300'
                    }`}>
                      {tab.badge}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-75 mt-1 select-none font-medium">{tab.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Horizontal Bento Cards list for Priority Collections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPendingSales.slice(0, 9).map((sale, idx) => {
            const valorFaltante = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - (sale.valorPago ?? 0));
            const isOverdueItem = isOverdue(sale.dataRetirada);
            const isSelected = viewedSale?.id === sale.id;
            
            return (
              <motion.div 
                key={sale.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                whileHover={{ y: -3, transition: { duration: 0.12 } }}
                onClick={() => handleSelectSaleForReceipt(sale)}
                className={`border rounded-xl p-4.5 flex flex-col justify-between gap-4 transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'border-brand-pink bg-brand-pink/5 ring-1 ring-brand-pink/30'
                    : isOverdueItem 
                      ? 'border-red-500/30 bg-red-950/5 hover:border-red-500/50 shadow-sm shadow-red-950/10 hover:bg-red-950/10' 
                      : 'border-zinc-800 bg-black/25 hover:border-zinc-700 hover:bg-zinc-850/10'
                }`}
                title="Clique sobre o pedido para visualizar o seu recibo abaixo"
              >
                {/* Upper card meta line */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {sale.numeroPedido ? (
                        <span className="text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-450 px-2 py-0.5 rounded">
                          Pedido #{sale.numeroPedido}
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-500 font-mono">ID: {sale.id.substring(0, 5)}</span>
                      )}
                      <span className="text-brand-pink text-[9px] font-bold inline-flex items-center gap-0.5 animate-pulse">
                        • Ver Recibo
                      </span>
                    </div>

                    {isOverdueItem ? (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-red-950 text-red-400 border border-red-900/35 rounded-sm flex items-center gap-1 animate-pulse-slow">
                        <AlertTriangle className="h-2.5 w-2.5" /> ATRASADO
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-zinc-500 uppercase">Aguardando</span>
                    )}
                  </div>

                  <div className="pt-1.5">
                    <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-zinc-450 shrink-0" />
                      <span className="truncate">{sale.cliente}</span>
                    </h4>
                    {sale.telefoneCliente && (
                      <p className="text-[10.5px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5 shrink-0" />
                        <span>{sale.telefoneCliente}</span>
                      </p>
                    )}
                  </div>

                  {/* Product block info */}
                  <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-850/40 text-[11px] space-y-1 mt-2">
                    <div className="flex justify-between items-center text-zinc-400">
                      <span className="truncate max-w-[130px]">• {sale.produtoNome}</span>
                      <span className="font-mono text-zinc-500">({sale.quantidade}x)</span>
                    </div>
                    <div className="flex justify-between items-center text-[10.5px] text-zinc-500">
                      <span>Data de Retirada:</span>
                      <span className={`font-mono font-bold ${isOverdueItem ? 'text-red-400' : 'text-zinc-400'}`}>
                        {formatLocalDate(sale.dataRetirada)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lower card price metrics and dynamic button trigger */}
                <div className="border-t border-zinc-850/40 pt-3 space-y-3.5">
                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                      <span className="text-[8.5px] uppercase font-bold text-zinc-550 block">Saldo Restante</span>
                      <span className="text-base font-extrabold text-red-400 font-mono">
                        R$ {valorFaltante.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8.5px] uppercase font-bold text-zinc-550 block">Satisfeito</span>
                      <span className="text-[11px] font-bold text-emerald-500 font-mono">
                        R$ {(sale.valorPago ?? 0).toFixed(2)} / R$ {sale.total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Cobra WhatsApp call button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCobrarWhatsApp(sale);
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold rounded-lg text-[10.5px] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-97 hover:scale-[1.01]"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span>Cobrar via WhatsApp</span>
                  </button>
                </div>
              </motion.div>
            );
          })}

          {pendingSales.length === 0 && (
            <div className="col-span-full py-10 text-center bg-black/15 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
              😴 Não há saldo de pagamentos pendentes ativos para a cobrança automática hoje. Tudo em dia!
            </div>
          )}
        </div>
      </div>

      {/* 4. Search and Table Layout Grid (Complete overview of outstanding entries) */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-808 p-6 space-y-4 shadow-sm">
        
        {/* Filters Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-semibold text-zinc-100 text-sm">Relação Completa de Saldos a Receber</h3>
          
          <div className="relative w-full sm:w-72">
            <span className="absolute left-3 top-3 text-zinc-550">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Filtrar por cliente, pedido, produto ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-200 placeholder-zinc-650 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Direct tabular presentation */}
        {filteredPendingSales.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 border border-dashed border-zinc-850 rounded-xl bg-black/10">
            <p className="text-xs font-semibold">Nenhum pedido pendente com saldo a receber</p>
            <p className="text-[10px] text-zinc-650 mt-1 max-w-sm mx-auto">
              Todos os seus lançamentos ativos estão pagos integralmente ou não coincidem com o termo pesquisado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase text-[9px] font-bold select-none tracking-wider">
                  <th className="py-3 font-semibold">Cliente</th>
                  <th className="py-3 font-semibold">Produto / Qtd.</th>
                  <th className="py-3 font-semibold text-right text-zinc-500">Retirada Agendada</th>
                  <th className="py-3 font-semibold text-right">Total Pedido</th>
                  <th className="py-3 font-semibold text-right text-emerald-450">Valor Satisfeito</th>
                  <th className="py-3 font-semibold text-right text-red-400">Saldo Restante</th>
                  <th className="py-3 font-semibold text-right">WhatsApp</th>
                  <th className="py-3 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredPendingSales.map((sale) => {
                  const valorFaltante = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - (sale.valorPago ?? 0));
                  const valorPago = sale.valorPago ?? 0;
                  const isOverdueItem = isOverdue(sale.dataRetirada);
                  const isSelected = viewedSale?.id === sale.id;
                  
                  return (
                    <tr 
                      key={sale.id} 
                      onClick={() => handleSelectSaleForReceipt(sale)}
                      className={`transition-colors group cursor-pointer select-none ${
                        isSelected 
                          ? 'bg-brand-pink/15 hover:bg-brand-pink/20 font-semibold border-l-2 border-brand-pink' 
                          : 'hover:bg-zinc-850/15'
                      }`}
                      title="Clique na linha para visualizar o recibo térmico no final da página"
                    >
                      {/* Customer Client Info */}
                      <td className="py-3.5 pr-3 max-w-[150px] truncate">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold ${isSelected ? 'text-brand-pink' : 'text-zinc-200'}`}>{sale.cliente}</span>
                          {sale.numeroPedido && (
                            <span className="bg-zinc-800 text-brand-pink font-mono text-[9px] font-bold px-1 py-0.5 rounded tracking-wider leading-none">
                              #{sale.numeroPedido}
                            </span>
                          )}
                        </div>
                        {sale.telefoneCliente && (
                          <div className="text-[10px] text-zinc-555 font-mono mt-0.5 leading-none">
                            {sale.telefoneCliente}
                          </div>
                        )}
                      </td>

                      {/* Product details */}
                      <td className="py-3.5 pr-3 max-w-[160px] truncate">
                        <span className="text-zinc-300 font-medium">{sale.produtoNome}</span>
                        <span className="text-zinc-550 font-mono text-[10px] bg-zinc-800/50 px-1.5 py-0.5 rounded ml-1.5 font-bold">
                          {sale.quantidade}x
                        </span>
                      </td>

                      {/* Pickup Date */}
                      <td className="py-3.5 text-right font-mono text-zinc-400 text-[10px]">
                        <span className={isOverdueItem ? 'text-red-400 font-bold' : ''}>
                          {formatLocalDate(sale.dataRetirada)}
                        </span>
                      </td>

                      {/* Total cost */}
                      <td className="py-3.5 text-right font-bold text-zinc-300 font-mono">
                        R$ {sale.total.toFixed(2)}
                      </td>

                      {/* Paid upfront */}
                      <td className="py-3.5 text-right font-bold text-emerald-500 font-mono">
                        R$ {valorPago.toFixed(2)}
                      </td>

                      {/* Outstanding remaining charge */}
                      <td className="py-3.5 text-right font-black text-red-400 font-mono text-xs">
                        R$ {valorFaltante.toFixed(2)}
                      </td>

                      {/* Quick Whatsapp Link trigger column */}
                      <td className="py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCobrarWhatsApp(sale);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-emerald-900/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-900/20 hover:border-emerald-550 rounded-lg text-[9.5px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95"
                          title="Cobrar este cliente via WhatsApp"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>Cobrar</span>
                        </button>
                      </td>

                      {/* Navigate tab Delivery option button */}
                      <td className="py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToTab('entregas', sale.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-brand-pink text-zinc-400 hover:text-brand-pink rounded-lg text-[9.5px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-97 select-none"
                        >
                          <span>Entregar</span>
                          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* 5. End of page: Receipt Preview Panel */}
      <div ref={receiptContainerRef} className="pt-4 scroll-mt-6">
        <h3 className="font-display font-semibold text-zinc-100 text-sm mb-3 px-1 flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-pink" />
          <span>Visualização do Recibo do Pedido</span>
        </h3>
        
        {viewedSale ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="max-w-md mx-auto">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
                <span className="text-xs text-zinc-400">
                  Recibo selecionado: <strong className="text-brand-pink">#{viewedSale.numeroPedido || viewedSale.id.substring(0, 5)}</strong> ({viewedSale.cliente})
                </span>
                <button 
                  onClick={() => setViewedSale(null)} 
                  className="text-xs text-zinc-400 hover:text-red-400 cursor-pointer flex items-center gap-1 font-bold transition-colors"
                >
                  Fechar Recibo
                </button>
              </div>

              {/* 💸 QUICK DEBT SETTLEMENT ASSISTANT PANEL */}
              {(() => {
                const remaining = viewedSale.valorFaltante !== undefined ? viewedSale.valorFaltante : (viewedSale.total - (viewedSale.valorPago ?? 0));
                if (remaining <= 0) return null;
                
                return (
                  <div className="bg-zinc-950/60 border border-zinc-850 p-4 rounded-xl mb-5 space-y-3.5">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
                      <span className="uppercase text-zinc-400 tracking-wider">⚡ Baixa Parcial Express</span>
                      <span className="text-red-400 font-mono">Restante: R$ {remaining.toFixed(2)}</span>
                    </div>

                    {/* Quick helper precomputations payment confirm buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => handleRecordPartialPayment(remaining, viewedSale)}
                        className="py-2.5 px-2 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 rounded-lg hover:bg-emerald-950/70 transition-all cursor-pointer"
                      >
                        Quitar Tudo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRecordPartialPayment(remaining / 2, viewedSale)}
                        className="py-2.5 px-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg transition-all cursor-pointer"
                      >
                        Pagar Metade
                      </button>
                      {remaining > 50 && (
                        <button
                          type="button"
                          onClick={() => handleRecordPartialPayment(50, viewedSale)}
                          className="py-2.5 px-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg transition-all cursor-pointer"
                        >
                          Receber R$50
                        </button>
                      )}
                      {remaining > 20 && (
                        <button
                          type="button"
                          onClick={() => handleRecordPartialPayment(20, viewedSale)}
                          className="py-2.5 px-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg transition-all cursor-pointer"
                        >
                          Receber R$20
                        </button>
                      )}
                    </div>

                    {/* Manual precise amount discount option */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-2.5 text-zinc-500 text-[10px] uppercase font-bold">R$</span>
                        <input
                          type="text"
                          placeholder="Outro valor..."
                          value={payRemainderInput}
                          onChange={(e) => setPayRemainderInput(e.target.value.replace(/[^0-9.]/g, ''))}
                          className="w-full pl-7 pr-2 py-1.5 bg-black border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-brand-pink"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const val = parseFloat(payRemainderInput);
                          if (!isNaN(val) && val > 0) {
                            handleRecordPartialPayment(val, viewedSale);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-brand-pink hover:bg-brand-pink-hover text-white text-xs font-bold rounded-lg cursor-pointer active:scale-95 transition-all text-center"
                      >
                        Receber
                      </button>
                    </div>
                  </div>
                );
              })()}

              <Receipt 
                sale={viewedSale} 
                storeInfo={storeInfo} 
                onUpdateSale={(updatedSale) => {
                  if (onUpdateSale) {
                    onUpdateSale(updatedSale);
                  }
                  setViewedSale(updatedSale);
                }} 
              />
            </div>
          </div>
        ) : (
          <div className="no-print bg-zinc-900 rounded-2xl border border-zinc-800 border-dashed p-10 text-center text-zinc-500 min-h-[220px] flex flex-col items-center justify-center">
            <FileText className="h-10 w-10 text-zinc-700 stroke-1 mb-2" />
            <p className="font-medium text-zinc-400 text-xs">Nenhum recibo selecionado</p>
            <p className="text-[10px] text-zinc-500 max-w-[280px] mx-auto mt-1">
              Clique em qualquer linha ou card de saldo pendente acima para carregar o seu respectivo recibo térmico aqui.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
