/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Filter, 
  Layers, 
  FileSpreadsheet, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  ReceiptText, 
  CreditCard, 
  Banknote, 
  Coins, 
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Landmark,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sale, Product, Expense, CashClosing, ExpenseCategory } from '../types';
import { getSaleCostInfo } from '../types';
import { playAppSound } from '../lib/audio';

interface FinancialDREManagerProps {
  sales: Sale[];
  products: Product[];
  currentUserEmail?: string;
}

export const FinancialDREManager: React.FC<FinancialDREManagerProps> = ({
  sales,
  products,
  currentUserEmail = ''
}) => {
  // 1. Navigation inside Financial Module
  const [subTab, setSubTab] = useState<'dre' | 'despesas' | 'fechamento'>('dre');

  // 2. Filter Period for DRE
  const [selectedPeriod, setSelectedPeriod] = useState<'este_mes' | 'mes_passado' | 'ultimos_90_dias' | 'ano_atual' | 'personalizado'>('este_mes');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // 3. Persistent Expenses State
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem('oxente_expenses');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erro ao carregar despesas:', e);
    }
    // Seed standard initial expenses for reference if empty
    return [
      {
        id: 'exp-default-1',
        descricao: 'Aluguel do Espaço / Loja',
        categoria: 'fixa',
        valor: 1500,
        dataVencimento: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-10`,
        status: 'Pendente',
        recorrente: true,
        criadoEm: new Date().toISOString()
      },
      {
        id: 'exp-default-2',
        descricao: 'Energia Elétrica / Luz',
        categoria: 'fixa',
        valor: 280,
        dataVencimento: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-15`,
        status: 'Pendente',
        recorrente: true,
        criadoEm: new Date().toISOString()
      },
      {
        id: 'exp-default-3',
        descricao: 'Internet Fibra Óptica',
        categoria: 'fixa',
        valor: 120,
        dataVencimento: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-20`,
        status: 'Pago',
        dataPagamento: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-05`,
        recorrente: true,
        criadoEm: new Date().toISOString()
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('oxente_expenses', JSON.stringify(expenses));
    } catch (e) {
      console.warn('Erro ao salvar despesas no localStorage:', e);
    }
  }, [expenses]);

  // 4. Persistent Cash Closings State
  const [cashClosings, setCashClosings] = useState<CashClosing[]>(() => {
    try {
      const saved = localStorage.getItem('oxente_cash_closings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erro ao carregar fechamentos de caixa:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('oxente_cash_closings', JSON.stringify(cashClosings));
    } catch (e) {
      console.warn('Erro ao salvar fechamentos de caixa:', e);
    }
  }, [cashClosings]);

  // Form State for Adding an Expense
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newDescricao, setNewDescricao] = useState('');
  const [newCategoria, setNewCategoria] = useState<ExpenseCategory>('fixa');
  const [newValor, setNewValor] = useState('');
  const [newDataVencimento, setNewDataVencimento] = useState(() => new Date().toISOString().split('T')[0]);
  const [newStatus, setNewStatus] = useState<'Pendente' | 'Pago'>('Pendente');
  const [newRecorrente, setNewRecorrente] = useState(false);
  const [newObservacoes, setNewObservacoes] = useState('');

  // Form State for Daily Cash Register Closing
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [saldoInicialGaveta, setSaldoInicialGaveta] = useState('100.00');
  const [dinheiroContado, setDinheiroContado] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');
  const [closingSavedToast, setClosingSavedToast] = useState(false);

  // Filter for Expenses Tab
  const [expenseFilterCategory, setExpenseFilterCategory] = useState<string>('todas');
  const [expenseFilterStatus, setExpenseFilterStatus] = useState<string>('todas');

  // Date Range Calculator for DRE
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (selectedPeriod === 'este_mes') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (selectedPeriod === 'mes_passado') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (selectedPeriod === 'ultimos_90_dias') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      end = now;
    } else if (selectedPeriod === 'ano_atual') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else {
      // Personalizado
      start = new Date(`${customStartDate}T00:00:00`);
      end = new Date(`${customEndDate}T23:59:59`);
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    return { startStr, endStr };
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Filter sales within the selected period (excluding Orçamentos)
  const periodSales = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'Orçamento') return false;
      const saleDate = (s.data || '').split('T')[0];
      if (!saleDate) return false;
      return saleDate >= dateRange.startStr && saleDate <= dateRange.endStr;
    });
  }, [sales, dateRange]);

  // Calculate Gross Revenue and CMV (Custo das Mercadorias Vendidas)
  const { totalReceitaBruta, totalCMV, totalLucroBruto, margemBrutaPercent } = useMemo(() => {
    let receita = 0;
    let cmv = 0;

    periodSales.forEach(sale => {
      receita += (sale.total || 0);
      const costInfo = getSaleCostInfo(sale, products);
      cmv += (costInfo.totalCusto || 0);
    });

    const lucroBruto = receita - cmv;
    const margem = receita > 0 ? (lucroBruto / receita) * 100 : 0;

    return {
      totalReceitaBruta: receita,
      totalCMV: cmv,
      totalLucroBruto: lucroBruto,
      margemBrutaPercent: margem
    };
  }, [periodSales, products]);

  // Filter expenses within the selected period
  const periodExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = exp.dataPagamento || exp.dataVencimento;
      if (!expDate) return false;
      return expDate >= dateRange.startStr && expDate <= dateRange.endStr;
    });
  }, [expenses, dateRange]);

  // Group expenses by category
  const expensesBreakdown = useMemo(() => {
    const groups: Record<ExpenseCategory, number> = {
      fixa: 0,
      insumos: 0,
      pessoal: 0,
      operacional: 0,
      marketing: 0,
      outros: 0
    };

    let totalGeral = 0;
    let totalPago = 0;
    let totalPendente = 0;

    periodExpenses.forEach(exp => {
      groups[exp.categoria] = (groups[exp.categoria] || 0) + exp.valor;
      totalGeral += exp.valor;
      if (exp.status === 'Pago') {
        totalPago += exp.valor;
      } else {
        totalPendente += exp.valor;
      }
    });

    return {
      groups,
      totalGeral,
      totalPago,
      totalPendente
    };
  }, [periodExpenses]);

  // DRE Final Calculation: Lucro Líquido Real ("Lucro no Bolso")
  const lucroLiquidoReal = totalLucroBruto - expensesBreakdown.totalGeral;
  const margemLiquidaPercent = totalReceitaBruta > 0 ? (lucroLiquidoReal / totalReceitaBruta) * 100 : 0;

  // Handler to toggle expense paid/pending
  const handleToggleExpenseStatus = (id: string) => {
    playAppSound('pop');
    setExpenses(prev => prev.map(exp => {
      if (exp.id === id) {
        const nextStatus = exp.status === 'Pago' ? 'Pendente' : 'Pago';
        return {
          ...exp,
          status: nextStatus,
          dataPagamento: nextStatus === 'Pago' ? new Date().toISOString().split('T')[0] : undefined,
          atualizadoEm: new Date().toISOString()
        };
      }
      return exp;
    }));
  };

  // Handler to delete expense
  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta despesa?')) {
      playAppSound('trash');
      setExpenses(prev => prev.filter(e => e.id !== id));
    }
  };

  // Handler to add expense
  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const valNum = parseFloat(newValor.replace(',', '.'));
    if (!newDescricao.trim() || isNaN(valNum) || valNum <= 0) {
      alert('Preencha a descrição e um valor válido.');
      return;
    }

    const newExp: Expense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      descricao: newDescricao.trim(),
      categoria: newCategoria,
      valor: valNum,
      dataVencimento: newDataVencimento,
      dataPagamento: newStatus === 'Pago' ? newDataVencimento : undefined,
      status: newStatus,
      recorrente: newRecorrente,
      observacoes: newObservacoes.trim() || undefined,
      criadoEm: new Date().toISOString()
    };

    setExpenses(prev => [newExp, ...prev]);
    playAppSound('success');
    setShowAddExpenseModal(false);

    // Reset fields
    setNewDescricao('');
    setNewValor('');
    setNewObservacoes('');
    setNewRecorrente(false);
    setNewStatus('Pendente');
  };

  // Daily Cash Register Calculation (for today's closing)
  const todaySalesStats = useMemo(() => {
    let totalDinheiro = 0;
    let totalPix = 0;
    let totalCartao = 0;
    let count = 0;

    sales.forEach(s => {
      if (s.status === 'Orçamento') return false;
      const saleDate = (s.data || '').split('T')[0];
      if (saleDate === todayStr) {
        count++;
        const val = s.valorPago !== undefined ? s.valorPago : s.total;
        if (s.formaPagamento === 'Dinheiro') {
          totalDinheiro += val;
        } else if (s.formaPagamento === 'Pix') {
          totalPix += val;
        } else {
          totalCartao += val;
        }
      }
    });

    // Despesas de hoje pagas em dinheiro físico
    const despesasHojeDinheiro = expenses
      .filter(e => e.status === 'Pago' && e.dataPagamento === todayStr)
      .reduce((acc, e) => acc + e.valor, 0);

    return {
      count,
      totalDinheiro,
      totalPix,
      totalCartao,
      despesasHojeDinheiro
    };
  }, [sales, expenses, todayStr]);

  // Expected Cash in Drawer
  const saldoInicialNum = parseFloat(saldoInicialGaveta.replace(',', '.')) || 0;
  const dinheiroEsperadoGaveta = saldoInicialNum + todaySalesStats.totalDinheiro - todaySalesStats.despesasHojeDinheiro;
  const dinheiroContadoNum = parseFloat(dinheiroContado.replace(',', '.')) || 0;
  const diferencaGaveta = dinheiroContado.trim() ? dinheiroContadoNum - dinheiroEsperadoGaveta : 0;

  // Handle Save Daily Cash Closing
  const handleSaveCashClosing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dinheiroContado.trim()) {
      alert('Por favor, informe o valor do dinheiro físico contado na gaveta.');
      return;
    }

    const newClosing: CashClosing = {
      id: `cash-${todayStr}-${Date.now()}`,
      data: todayStr,
      abertoPor: currentUserEmail || 'Administrador',
      fechadoPor: currentUserEmail || 'Administrador',
      saldoInicialGaveta: saldoInicialNum,
      dinheiroFisicoContado: dinheiroContadoNum,
      totalVendasDinheiroSistema: todaySalesStats.totalDinheiro,
      totalVendasPixSistema: todaySalesStats.totalPix,
      totalVendasCartaoSistema: todaySalesStats.totalCartao,
      totalDespesasPagasDinheiro: todaySalesStats.despesasHojeDinheiro,
      diferencaGaveta: diferencaGaveta,
      status: 'Fechado',
      observacoes: obsFechamento.trim() || undefined,
      criadoEm: new Date().toISOString(),
      fechadoEm: new Date().toISOString()
    };

    setCashClosings(prev => [newClosing, ...prev.filter(c => c.data !== todayStr)]);
    playAppSound('success');
    setClosingSavedToast(true);
    setTimeout(() => setClosingSavedToast(false), 4000);
  };

  // Helper labels for expense categories
  const categoryLabels: Record<ExpenseCategory, { label: string; color: string }> = {
    fixa: { label: 'Custo Fixo (Aluguel, Luz, Net)', color: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
    insumos: { label: 'Insumos & Matéria-Prima', color: 'border-purple-500/30 bg-purple-500/10 text-purple-400' },
    pessoal: { label: 'Pessoal & Diárias', color: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
    operacional: { label: 'Operacional & Frete', color: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400' },
    marketing: { label: 'Marketing & Taxas', color: 'border-pink-500/30 bg-pink-500/10 text-pink-400' },
    outros: { label: 'Outras Despesas', color: 'border-zinc-700 bg-zinc-800 text-zinc-300' }
  };

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-inner">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black text-white tracking-wide">
                Gestão Financeira & DRE (Lucro no Bolso)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Exclusivo Admin
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Demonstrativo de Resultado real, controle rigoroso de despesas operacionais e conferência de caixa.
            </p>
          </div>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex items-center bg-black/50 p-1.5 rounded-xl border border-zinc-800 self-stretch md:self-auto">
          <button
            type="button"
            onClick={() => { setSubTab('dre'); playAppSound('pop'); }}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              subTab === 'dre'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <PieChart className="h-3.5 w-3.5" />
            <span>Painel DRE & Lucro</span>
          </button>

          <button
            type="button"
            onClick={() => { setSubTab('despesas'); playAppSound('pop'); }}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
              subTab === 'despesas'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <ReceiptText className="h-3.5 w-3.5" />
            <span>Despesas & Contas</span>
            {expensesBreakdown.totalPendente > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => { setSubTab('fechamento'); playAppSound('pop'); }}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              subTab === 'fechamento'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Fechamento de Caixa</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SUB-TAB 1: PAINEL DRE (DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO)
         ========================================================================= */}
      {subTab === 'dre' && (
        <div className="space-y-6">
          {/* Period Filter Bar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-zinc-300">Período de Análise:</span>
              <div className="flex flex-wrap gap-1.5">
                {(['este_mes', 'mes_passado', 'ultimos_90_dias', 'ano_atual', 'personalizado'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedPeriod === p
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    {p === 'este_mes' && 'Este Mês'}
                    {p === 'mes_passado' && 'Mês Passado'}
                    {p === 'ultimos_90_dias' && 'Últimos 90 Dias'}
                    {p === 'ano_atual' && 'Ano Atual'}
                    {p === 'personalizado' && 'Personalizado'}
                  </button>
                ))}
              </div>
            </div>

            {selectedPeriod === 'personalizado' && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-black/60 border border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                />
                <span className="text-zinc-500">até</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-black/60 border border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <span className="text-[11px] font-mono text-zinc-400">
              Pedidos considerados: <strong className="text-zinc-200">{periodSales.length}</strong>
            </span>
          </div>

          {/* DRE Flash Cards Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Receita Bruta */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Receita Bruta (Vendas)</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-zinc-100 font-mono mt-1">
                R$ {totalReceitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Total faturado no período
              </p>
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* 2. Custo dos Insumos (CMV) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Custo dos Insumos (CMV)</span>
                <TrendingDown className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-400 font-mono mt-1">
                - R$ {totalCMV.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Balões, taças e copos com base no custo
              </p>
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* 3. Despesas Fixas & Operacionais */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Despesas Operacionais</span>
                <TrendingDown className="h-4 w-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-1">
                - R$ {expensesBreakdown.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Aluguel, energia, salários e taxas
              </p>
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* 4. Lucro Líquido Real (Lucro no Bolso) */}
            <div className={`border rounded-2xl p-4 shadow-md relative overflow-hidden ${
              lucroLiquidoReal >= 0 
                ? 'bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-900 border-emerald-500/50'
                : 'bg-gradient-to-br from-rose-950/40 via-zinc-900 to-zinc-900 border-rose-500/50'
            }`}>
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Lucro Líquido Real
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  lucroLiquidoReal >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}>
                  {margemLiquidaPercent.toFixed(1)}% margem
                </span>
              </div>
              <div className={`text-2xl font-black font-mono mt-1 ${
                lucroLiquidoReal >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                R$ {lucroLiquidoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                {lucroLiquidoReal >= 0 ? '💰 Sobra limpa estimada no bolso!' : '⚠️ Atenção: Período com prejuízo operacional!'}
              </p>
            </div>
          </div>

          {/* Detailed DRE Table (Extrato Contábil Visual Passo a Passo) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-400" />
                <h3 className="font-black text-sm text-zinc-100 uppercase tracking-wider">
                  Estrutura Analítica do DRE
                </h3>
              </div>
              <span className="text-xs text-zinc-400">
                Fórmula: Receita - CMV = Lucro Bruto - Despesas = Lucro Líquido
              </span>
            </div>

            <div className="divide-y divide-zinc-800/80 text-sm">
              {/* 1. Receita Operacional Bruta */}
              <div className="py-3 flex items-center justify-between font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-zinc-200">(+) 1. Receita Operacional Bruta</span>
                </div>
                <div className="font-mono text-emerald-400">
                  R$ {totalReceitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* 2. Custo das Mercadorias Vendidas (CMV) */}
              <div className="py-3 flex items-center justify-between font-medium">
                <div className="flex items-center gap-2 pl-4 text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>(-) 2. Custo das Mercadorias Vendidas (Balões & Insumos dos Pedidos)</span>
                </div>
                <div className="font-mono text-purple-400">
                  - R$ {totalCMV.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* 3. Margem / Lucro Bruto */}
              <div className="py-3 flex items-center justify-between font-bold bg-zinc-800/40 px-3 rounded-xl my-1">
                <div className="flex items-center gap-2 text-zinc-200">
                  <span>(=) 3. Lucro Bruto da Operação</span>
                  <span className="text-xs text-zinc-400 font-normal">
                    (Margem Bruta de Contribuição: <strong className="text-zinc-200">{margemBrutaPercent.toFixed(1)}%</strong>)
                  </span>
                </div>
                <div className="font-mono text-zinc-100">
                  R$ {totalLucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* 4. Despesas Fixas e Variáveis Detalhadas */}
              <div className="py-3 space-y-2">
                <div className="flex items-center justify-between font-bold text-rose-400">
                  <span>(-) 4. Despesas Operacionais & Administrativas</span>
                  <span className="font-mono">
                    - R$ {expensesBreakdown.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Subcategorias de despesa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1 pl-4">
                  {(Object.keys(expensesBreakdown.groups) as ExpenseCategory[]).map(cat => {
                    const val = expensesBreakdown.groups[cat];
                    if (val <= 0) return null;
                    return (
                      <div key={cat} className="bg-black/30 border border-zinc-800 p-2.5 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-zinc-400 truncate pr-2">{categoryLabels[cat].label}</span>
                        <span className="font-mono font-bold text-zinc-200">
                          R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Lucro Líquido Real */}
              <div className={`py-4 px-4 rounded-xl flex items-center justify-between font-black text-base mt-2 ${
                lucroLiquidoReal >= 0 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span>(=) 5. Lucro Líquido do Período ("Lucro no Bolso")</span>
                </div>
                <div className="font-mono text-xl">
                  R$ {lucroLiquidoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 2: GERENCIADOR DE DESPESAS (CONTAS A PAGAR / PAGAS)
         ========================================================================= */}
      {subTab === 'despesas' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={expenseFilterCategory}
                onChange={(e) => setExpenseFilterCategory(e.target.value)}
                className="bg-black/60 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todas">Todas as Categorias</option>
                <option value="fixa">Custos Fixos (Aluguel, Luz, Net)</option>
                <option value="insumos">Insumos & Matéria-Prima</option>
                <option value="pessoal">Pessoal & Ajudantes</option>
                <option value="operacional">Operacional & Frete</option>
                <option value="marketing">Marketing & Taxas</option>
                <option value="outros">Outros</option>
              </select>

              {/* Status Filter */}
              <select
                value={expenseFilterStatus}
                onChange={(e) => setExpenseFilterStatus(e.target.value)}
                className="bg-black/60 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todas">Todos os Status</option>
                <option value="Pendente">Apenas Pendentes (A Pagar)</option>
                <option value="Pago">Apenas Pagas</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAddExpenseModal(true);
                playAppSound('pop');
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-black text-xs shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Lançar Nova Despesa</span>
            </button>
          </div>

          {/* Expenses List */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-black text-sm text-zinc-100 flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-emerald-400" />
                Histórico de Contas & Despesas Cadastradas
              </h3>
              <span className="text-xs text-zinc-400">
                Total: <strong className="text-zinc-200">{expenses.length}</strong> registradas
              </span>
            </div>

            <div className="divide-y divide-zinc-800/80">
              {expenses
                .filter(exp => {
                  if (expenseFilterCategory !== 'todas' && exp.categoria !== expenseFilterCategory) return false;
                  if (expenseFilterStatus !== 'todas' && exp.status !== expenseFilterStatus) return false;
                  return true;
                })
                .map(exp => {
                  const isLate = exp.status === 'Pendente' && exp.dataVencimento < todayStr;
                  const catInfo = categoryLabels[exp.categoria] || categoryLabels.outros;

                  return (
                    <div 
                      key={exp.id} 
                      className="p-4 hover:bg-zinc-850/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-zinc-100">{exp.descricao}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catInfo.color}`}>
                            {catInfo.label}
                          </span>
                          {exp.recorrente && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400">
                              Recorrente Mensal
                            </span>
                          )}
                          {isLate && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse">
                              Vencida!
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-zinc-400 flex items-center gap-3">
                          <span>Vencimento: <strong className="text-zinc-300">{exp.dataVencimento.split('-').reverse().join('/')}</strong></span>
                          {exp.dataPagamento && (
                            <span>Pago em: <strong className="text-emerald-400">{exp.dataPagamento.split('-').reverse().join('/')}</strong></span>
                          )}
                          {exp.observacoes && (
                            <span className="text-zinc-500 italic truncate max-w-[200px]">({exp.observacoes})</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                        <div className="text-right">
                          <span className="font-mono font-black text-base text-zinc-100 block">
                            R$ {exp.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleExpenseStatus(exp.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                              exp.status === 'Pago'
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                                : 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                            }`}
                            title={exp.status === 'Pago' ? 'Marcar como pendente' : 'Marcar como paga'}
                          >
                            {exp.status === 'Pago' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Paga</span>
                              </>
                            ) : (
                              <>
                                <Clock className="h-3.5 w-3.5" />
                                <span>Pendente</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Excluir despesa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {expenses.length === 0 && (
                <div className="p-8 text-center text-zinc-500 text-sm">
                  Nenhuma despesa cadastrada ainda. Clique no botão acima para adicionar!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 3: FECHAMENTO DE CAIXA DIÁRIO (GAVETA VS SISTEMA)
         ========================================================================= */}
      {subTab === 'fechamento' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form de Fechamento de Hoje */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-black text-sm text-zinc-100 uppercase tracking-wider">
                    Conferência & Fechamento de Caixa de Hoje ({todayStr.split('-').reverse().join('/')})
                  </h3>
                </div>
                <span className="text-xs text-zinc-400">
                  {todaySalesStats.count} pedido(s) hoje
                </span>
              </div>

              {/* Cards das Entradas do Dia pelo Sistema */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/40 border border-zinc-800 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">Dinheiro (Sistema)</span>
                  <span className="font-mono font-black text-base text-emerald-400 block mt-1">
                    R$ {todaySalesStats.totalDinheiro.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <div className="bg-black/40 border border-zinc-800 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">Pix (Sistema)</span>
                  <span className="font-mono font-black text-base text-cyan-400 block mt-1">
                    R$ {todaySalesStats.totalPix.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <div className="bg-black/40 border border-zinc-800 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">Cartão (Sistema)</span>
                  <span className="font-mono font-black text-base text-purple-400 block mt-1">
                    R$ {todaySalesStats.totalCartao.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Inputs para bater a Gaveta Física */}
              <form onSubmit={handleSaveCashClosing} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">
                      Saldo Inicial da Gaveta (Fundo de Troco):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-zinc-500 font-mono">R$</span>
                      <input
                        type="text"
                        value={saldoInicialGaveta}
                        onChange={(e) => setSaldoInicialGaveta(e.target.value)}
                        placeholder="100,00"
                        className="w-full bg-black/60 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Quanto dinheiro havia na gaveta antes de começar o dia.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">
                      Dinheiro Físico Contado na Gaveta Agora:
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-zinc-500 font-mono">R$</span>
                      <input
                        type="text"
                        value={dinheiroContado}
                        onChange={(e) => setDinheiroContado(e.target.value)}
                        placeholder="Ex: 345,50"
                        className="w-full bg-black/60 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500 font-bold"
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Some as cédulas e moedas físicas presentes na gaveta.
                    </span>
                  </div>
                </div>

                {/* Box de Confronto (Esperado x Contado) */}
                <div className="bg-black/50 border border-zinc-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-zinc-400 block">Total Esperado em Gaveta:</span>
                    <span className="text-xs text-zinc-500">
                      (Fundo de Troco R$ {saldoInicialNum.toFixed(2)} + Vendas Dinheiro R$ {todaySalesStats.totalDinheiro.toFixed(2)} - Saídas R$ {todaySalesStats.despesasHojeDinheiro.toFixed(2)})
                    </span>
                    <span className="font-mono font-bold text-base text-zinc-200 block mt-0.5">
                      = R$ {dinheiroEsperadoGaveta.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {dinheiroContado.trim() && (
                    <div className={`p-3 rounded-xl border text-right ${
                      Math.abs(diferencaGaveta) < 0.05
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : diferencaGaveta > 0
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}>
                      <span className="text-[10px] uppercase font-black block">
                        {Math.abs(diferencaGaveta) < 0.05 
                          ? '✅ Caixa Bateu Perfeito!' 
                          : diferencaGaveta > 0 
                            ? '🔵 Sobra de Caixa' 
                            : '⚠️ Falta de Caixa'}
                      </span>
                      <span className="font-mono font-black text-lg">
                        {diferencaGaveta > 0 ? `+ R$ ${diferencaGaveta.toFixed(2).replace('.', ',')}` : `R$ ${diferencaGaveta.toFixed(2).replace('.', ',')}`}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">
                    Observações do Fechamento (Opcional):
                  </label>
                  <input
                    type="text"
                    value={obsFechamento}
                    onChange={(e) => setObsFechamento(e.target.value)}
                    placeholder="Ex: Sobrou R$ 2,00 por conta de troco dispensado pelo cliente..."
                    className="w-full bg-black/60 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-[1.01] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>Gravar Fechamento de Caixa do Dia</span>
                </button>

                {closingSavedToast && (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold text-center animate-fade-in">
                    🎉 Fechamento de caixa gravado com sucesso no histórico!
                  </div>
                )}
              </form>
            </div>

            {/* Histórico Recente de Fechamentos */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="font-black text-xs text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-2">
                Histórico de Fechamentos Anteriores
              </h4>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {cashClosings.map(c => (
                  <div key={c.id} className="p-3 bg-black/40 border border-zinc-800 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-zinc-200">{c.data.split('-').reverse().join('/')}</span>
                      <span className={`font-mono ${
                        Math.abs(c.diferencaGaveta) < 0.05 
                          ? 'text-emerald-400' 
                          : c.diferencaGaveta > 0 
                            ? 'text-blue-400' 
                            : 'text-rose-400'
                      }`}>
                        Dif: R$ {c.diferencaGaveta.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 flex justify-between">
                      <span>Contado: R$ {c.dinheiroFisicoContado.toFixed(2)}</span>
                      <span>Vendas Pix: R$ {c.totalVendasPixSistema.toFixed(2)}</span>
                    </div>
                    {c.observacoes && (
                      <p className="text-[10px] text-zinc-500 italic truncate">{c.observacoes}</p>
                    )}
                  </div>
                ))}

                {cashClosings.length === 0 && (
                  <div className="text-center py-6 text-zinc-500 text-xs">
                    Nenhum fechamento registrado ainda. Preencha o formulário ao lado para registrar o primeiro!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Nova Despesa */}
      <AnimatePresence>
        {showAddExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-black text-sm text-zinc-100 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-400" />
                  Cadastrar Nova Despesa / Conta
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Descrição da Conta / Despesa *</label>
                  <input
                    type="text"
                    required
                    value={newDescricao}
                    onChange={(e) => setNewDescricao(e.target.value)}
                    placeholder="Ex: Compra de balões São Roque / Aluguel da loja"
                    className="w-full bg-black/60 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-zinc-300 block mb-1">Categoria</label>
                    <select
                      value={newCategoria}
                      onChange={(e) => setNewCategoria(e.target.value as ExpenseCategory)}
                      className="w-full bg-black/60 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="fixa">Custo Fixo (Aluguel, Luz)</option>
                      <option value="insumos">Insumos & Balões</option>
                      <option value="pessoal">Pessoal & Ajudantes</option>
                      <option value="operacional">Operacional & Frete</option>
                      <option value="marketing">Marketing & Anúncios</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-zinc-300 block mb-1">Valor (R$) *</label>
                    <input
                      type="text"
                      required
                      value={newValor}
                      onChange={(e) => setNewValor(e.target.value)}
                      placeholder="Ex: 150,00"
                      className="w-full bg-black/60 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-zinc-300 block mb-1">Data de Vencimento</label>
                    <input
                      type="date"
                      required
                      value={newDataVencimento}
                      onChange={(e) => setNewDataVencimento(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-zinc-300 block mb-1">Status Atual</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as 'Pendente' | 'Pago')}
                      className="w-full bg-black/60 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Pendente">Pendente (A pagar)</option>
                      <option value="Pago">Já Pago</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="recorrente-check"
                    checked={newRecorrente}
                    onChange={(e) => setNewRecorrente(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="recorrente-check" className="text-zinc-300 cursor-pointer">
                    Despesa Recorrente (repete todos os meses)
                  </label>
                </div>

                <div>
                  <label className="font-bold text-zinc-300 block mb-1">Observações (Opcional)</label>
                  <input
                    type="text"
                    value={newObservacoes}
                    onChange={(e) => setNewObservacoes(e.target.value)}
                    placeholder="Número da nota fiscal, fornecedor, etc."
                    className="w-full bg-black/60 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddExpenseModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-black hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    Salvar Despesa
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
