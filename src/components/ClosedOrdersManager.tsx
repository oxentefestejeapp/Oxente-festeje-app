import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Palette, 
  Paintbrush, 
  CheckCircle2, 
  Clock, 
  User, 
  Search, 
  FileText, 
  X, 
  ArrowRightLeft, 
  ChevronRight, 
  Calendar,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Copy,
  Check,
  QrCode,
  Pencil,
  Trash,
  Plus,
  ShoppingBag,
  MessageSquare,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sale, StoreInfo, Product, SaleItem } from '../types';
import { Receipt } from './Receipt';
import { playAppSound } from '../lib/audio';
import QRCode from 'qrcode';

interface ClosedOrdersManagerProps {
  products: Product[];
  sales: Sale[];
  storeInfo: StoreInfo;
  onUpdateSale: (updatedSale: Sale) => void;
  currentUserEmail: string;
}

export function ClosedOrdersManager({ products, sales, storeInfo, onUpdateSale, currentUserEmail }: ClosedOrdersManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const receiptContainerRef = useRef<HTMLDivElement>(null);

  // States for editing a sale inside ClosedOrdersManager
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editCliente, setEditCliente] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editNumeroPedido, setEditNumeroPedido] = useState('');
  const [editFormaPagamento, setEditFormaPagamento] = useState<'Pix' | 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito'>('Pix');
  const [editValorPago, setEditValorPago] = useState('');
  const [editDataRetirada, setEditDataRetirada] = useState('');
  const [editStatusProducao, setEditStatusProducao] = useState<'Agendado' | 'Em Produção' | 'Pronto para Retirada' | 'Entregue'>('Agendado');

  // New States for editing items inside order edit modal
  const [editItens, setEditItens] = useState<SaleItem[]>([]);
  const [selectedAddProductId, setSelectedAddProductId] = useState('');

  const editTotal = useMemo(() => {
    return editItens.reduce((sum, item) => sum + (item.precoUn * item.quantidade), 0);
  }, [editItens]);

  // Prompt state to show "remover da lista" options
  const [saleToRemovePrompt, setSaleToRemovePrompt] = useState<Sale | null>(null);
  const [showRemovedFromDesign, setShowRemovedFromDesign] = useState(false);

  const paymentMethods: { value: 'Pix' | 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito'; label: string; icon: string }[] = [
    { value: 'Pix', label: 'Pix', icon: '⚡' },
    { value: 'Dinheiro', label: 'Dinheiro', icon: '💵' },
    { value: 'Cartão de Crédito', label: 'C. Crédito', icon: '💳' },
    { value: 'Cartão de Débito', label: 'C. Débito', icon: '🏦' }
  ];

  // Sync edit states when editingSale shifts
  useEffect(() => {
    if (editingSale) {
      setEditCliente(editingSale.cliente);
      setEditTelefone(editingSale.telefoneCliente || '');
      setEditNumeroPedido(editingSale.numeroPedido || '');
      setEditFormaPagamento(editingSale.formaPagamento);
      setEditValorPago(editingSale.valorPago !== undefined ? editingSale.valorPago.toString() : editingSale.total.toString());
      setEditDataRetirada(editingSale.dataRetirada || '');
      setEditStatusProducao(editingSale.statusProducao || 'Agendado');

      if (editingSale.itens && editingSale.itens.length > 0) {
        setEditItens(editingSale.itens.map(item => ({ ...item })));
      } else {
        setEditItens([{
          id: `item-${editingSale.produtoId || '1'}-${Date.now()}`,
          produtoId: editingSale.produtoId || '',
          produtoNome: editingSale.produtoNome || '',
          precoUn: editingSale.precoUn || 0,
          quantidade: editingSale.quantidade || 1,
          total: (editingSale.precoUn || 0) * (editingSale.quantidade || 1)
        }]);
      }
    }
  }, [editingSale]);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;

    if (editItens.length === 0) {
      alert("O pedido precisa conter pelo menos um produto!");
      return;
    }

    const valPagoNum = editValorPago.trim() === '' ? editTotal : parseFloat(editValorPago);
    const finalValorPago = isNaN(valPagoNum) ? editTotal : valPagoNum;
    const finalValorFaltante = Math.max(0, editTotal - finalValorPago);

    const mainItem = editItens[0];
    const mainProdutoId = mainItem.produtoId;
    const mainProdutoNome = editItens.length > 1
      ? `${mainItem.produtoNome} (+${editItens.length - 1} itens)`
      : mainItem.produtoNome;
    const mainPrecoUn = mainItem.precoUn;
    const mainQuantidade = editItens.reduce((sum, item) => sum + item.quantidade, 0);

    const originalValues = editingSale.valoresOriginais || {
      cliente: editingSale.cliente,
      telefoneCliente: editingSale.telefoneCliente,
      produtoNome: editingSale.produtoNome,
      total: editingSale.total,
      formaPagamento: editingSale.formaPagamento,
      valorPago: editingSale.valorPago,
      valorFaltante: editingSale.valorFaltante,
      numeroPedido: editingSale.numeroPedido,
      statusProducao: editingSale.statusProducao,
      itens: editingSale.itens || [
        {
          id: `item-${editingSale.produtoId || '1'}`,
          produtoId: editingSale.produtoId || '',
          produtoNome: editingSale.produtoNome || '',
          precoUn: editingSale.precoUn || 0,
          quantidade: editingSale.quantidade || 1,
          total: editingSale.total
        }
      ]
    };

    const updatedSale: Sale = {
      ...editingSale,
      cliente: editCliente.trim() || 'Consumidor',
      telefoneCliente: editTelefone.trim() ? editTelefone.trim() : undefined,
      produtoId: mainProdutoId,
      produtoNome: mainProdutoNome,
      precoUn: mainPrecoUn,
      quantidade: mainQuantidade,
      total: editTotal,
      formaPagamento: editFormaPagamento,
      valorPago: finalValorPago,
      valorFaltante: finalValorFaltante,
      numeroPedido: editNumeroPedido.trim() ? editNumeroPedido.trim() : undefined,
      dataRetirada: editDataRetirada || undefined,
      statusProducao: editStatusProducao,
      itens: editItens,
      foiAlterado: true,
      editadoPorEmail: currentUserEmail,
      editadoEm: new Date().toISOString(),
      valoresOriginais: originalValues
    };

    onUpdateSale(updatedSale);
    playAppSound('success');
    setEditingSale(null);
  };

  // Sync selected sale if updated externally
  useEffect(() => {
    if (viewedSale) {
      const current = sales.find(s => s.id === viewedSale.id);
      if (current) {
        setViewedSale(current);
      } else {
        setViewedSale(null);
      }
    }
  }, [sales]);

  // Sync notes when viewedSale selection changes
  useEffect(() => {
    if (viewedSale) {
      setNotesText(viewedSale.observacoesDesign || '');
    } else {
      setNotesText('');
    }
  }, [viewedSale?.id]);

  // Handle order selection and smooth scroll to receipt view
  const handleSelectSaleForReceipt = (sale: Sale) => {
    setViewedSale(sale);
    setTimeout(() => {
      receiptContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  // Helper: Format relative date/time
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // User simple display label from email
  const getUserFriendlyName = (email: string) => {
    if (!email) return 'Sistema';
    if (email === 'oxentefesteje@gmail.com' || email === 'abraaoapp@oxente.com') return 'Dona / Admin';
    return email.split('@')[0];
  };

  // Assign or Pull order
  const handlePullOrder = (sale: Sale, targetDesigner: 'designer1' | 'designer2' | null) => {
    const updated: Sale = {
      ...sale,
      designerId: targetDesigner,
      statusArte: targetDesigner ? (sale.statusArte || 'Pendente') : undefined,
      puxadoPor: targetDesigner ? getUserFriendlyName(currentUserEmail) : undefined,
      puxadoEm: targetDesigner ? new Date().toISOString() : undefined
    };
    onUpdateSale(updated);
    if (targetDesigner) {
      playAppSound('pop');
    } else {
      playAppSound('trash');
    }
  };

  // Toggle Artwork Finished Status
  const handleToggleArtworkStatus = (sale: Sale) => {
    const nextStatus = sale.statusArte === 'Arte Finalizada' ? 'Pendente' : 'Arte Finalizada';
    if (nextStatus === 'Arte Finalizada') {
      const updated: Sale = {
        ...sale,
        statusArte: nextStatus,
        statusProducao: 'Em Produção', // Already set to in production when art is completed
        arteFinalizadaPorEmail: currentUserEmail,
        arteFinalizadaEm: new Date().toISOString()
      };
      onUpdateSale(updated);
      playAppSound('complete');
      setSaleToRemovePrompt(updated);
    } else {
      const updated: Sale = {
        ...sale,
        statusArte: nextStatus,
        removerDoDesign: false,
        arteFinalizadaPorEmail: undefined,
        arteFinalizadaEm: undefined
      };
      onUpdateSale(updated);
      playAppSound('click');
    }
  };

  const handleConfirmRemoveFromDesign = (sale: Sale, shouldRemove: boolean) => {
    const updated: Sale = {
      ...sale,
      removerDoDesign: shouldRemove
    };
    onUpdateSale(updated);
    setSaleToRemovePrompt(null);
  };

  // Pre-filter database to only active or closed orders that are registered (all registered orders/sales are fechados)
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      if (sale.status === 'Orçamento') return false;
      if (sale.removerDoDesign && !showRemovedFromDesign) return false;

      const term = searchTerm.toLowerCase();
      const isMatch = 
        sale.cliente.toLowerCase().includes(term) ||
        (sale.numeroPedido && sale.numeroPedido.toLowerCase().includes(term)) ||
        sale.produtoNome.toLowerCase().includes(term) ||
        (sale.itens && sale.itens.some(item => item.produtoNome.toLowerCase().includes(term)));
      return isMatch;
    });
  }, [sales, searchTerm, showRemovedFromDesign]);

  // Split into columns
  const isUrgent = (sale: Sale) => {
    if (!sale.dataRetirada) return false;
    try {
      let limitDays = 3; // Default warning timeframe of 3 days
      
      if (sale.itens && sale.itens.length > 0) {
        sale.itens.forEach(item => {
          const prod = products.find(p => p.id === item.produtoId);
          if (prod && prod.prazoUrgencia !== undefined && prod.prazoUrgencia !== null) {
            if (prod.prazoUrgencia > limitDays) {
              limitDays = prod.prazoUrgencia;
            }
          }
        });
      } else if (sale.produtoId) {
        const prod = products.find(p => p.id === sale.produtoId);
        if (prod && prod.prazoUrgencia !== undefined && prod.prazoUrgencia !== null) {
          limitDays = prod.prazoUrgencia;
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pickupDate = new Date(sale.dataRetirada + 'T12:00:00');
      pickupDate.setHours(0, 0, 0, 0);
      const diffTime = pickupDate.getTime() - today.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays <= limitDays;
    } catch {
      return false;
    }
  };

  const getUrgentText = (dataRetirada?: string) => {
    if (!dataRetirada) return '';
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pickupDate = new Date(dataRetirada + 'T12:00:00');
      pickupDate.setHours(0, 0, 0, 0);
      const diffTime = pickupDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return `Atrasado ${Math.abs(diffDays)}d`;
      } else if (diffDays === 0) {
        return 'Hoje!';
      } else if (diffDays === 1) {
        return 'Amanhã!';
      } else {
        return `${diffDays} dias`;
      }
    } catch {
      return 'Urgente!';
    }
  };

  const unassignedOrders = useMemo(() => {
    const list = filteredSales.filter(s => !s.designerId);
    return [...list].sort((a, b) => {
      if (!a.dataRetirada && !b.dataRetirada) return 0;
      if (!a.dataRetirada) return 1;
      if (!b.dataRetirada) return -1;
      return a.dataRetirada.localeCompare(b.dataRetirada);
    });
  }, [filteredSales]);

  const designer1Orders = useMemo(() => {
    return filteredSales.filter(s => s.designerId === 'designer1');
  }, [filteredSales]);

  const designer2Orders = useMemo(() => {
    return filteredSales.filter(s => s.designerId === 'designer2');
  }, [filteredSales]);

  // Metrics calculations
  const totalUnassigned = unassignedOrders.length;
  const totalD1 = designer1Orders.length;
  const finishedD1 = designer1Orders.filter(s => s.statusArte === 'Arte Finalizada').length;
  const totalD2 = designer2Orders.length;
  const finishedD2 = designer2Orders.filter(s => s.statusArte === 'Arte Finalizada').length;

  return (
    <div className="space-y-6">
      
      {/* 1. Dashboard Metrics Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Waiting card */}
        <div className="bg-zinc-950 border border-zinc-800 p-4.5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Aguardando Arte</span>
            <span className="text-2xl font-extrabold text-zinc-100 font-mono">{totalUnassigned}</span>
            <p className="text-[10px] text-zinc-500">Pedidos aguardando design</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Designer 1 card */}
        <div className="bg-zinc-950 border border-zinc-800 p-4.5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-pink block">Designer 1</span>
            <span className="text-2xl font-extrabold text-zinc-100 font-mono">
              {finishedD1} <span className="text-sm font-semibold text-zinc-500">/ {totalD1}</span>
            </span>
            <p className="text-[10px] text-zinc-500">{totalD1 - finishedD1} artes pendentes para finalizar</p>
          </div>
          <div className="p-3 bg-brand-pink/10 border border-brand-pink/20 text-brand-pink rounded-xl">
            <Paintbrush className="h-5 w-5" />
          </div>
        </div>

        {/* Designer 2 card */}
        <div className="bg-zinc-950 border border-zinc-800 p-4.5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-455 block">Designer 2</span>
            <span className="text-2xl font-extrabold text-zinc-100 font-mono">
              {finishedD2} <span className="text-sm font-semibold text-zinc-500">/ {totalD2}</span>
            </span>
            <p className="text-[10px] text-zinc-500">{totalD2 - finishedD2} artes pendentes para finalizar</p>
          </div>
          <div className="p-3 bg-cyan-950/20 border border-cyan-900/30 text-cyan-400 rounded-xl">
            <Palette className="h-5 w-5" />
          </div>
        </div>

      </div>

      {/* 2. Top search and filter utility panel */}
      <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-brand-pink" />
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Controle de Arte &amp; Criação</h2>
            <p className="text-[10.5px] text-zinc-500">Puxe os pedidos para a sua camada, crie a arte e mude para finalizado</p>
          </div>
        </div>

        {/* Actions & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          {/* Toggle show/hide archived design items */}
          <button
            type="button"
            onClick={() => setShowRemovedFromDesign(prev => !prev)}
            className={`py-2 px-3.5 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 select-none ${
              showRemovedFromDesign
                ? 'bg-red-500/10 border-red-500/50 text-red-400 font-extrabold shadow-[0_0_12px_rgba(239,68,68,0.05)]'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
            }`}
          >
            {showRemovedFromDesign ? (
              <>
                <X className="h-3.5 w-3.5" />
                <span>Ocultar Removidos</span>
              </>
            ) : (
              <>
                <Trash className="h-3.5 w-3.5 text-zinc-500" />
                <span>Ver Ocultos do Design</span>
              </>
            )}
          </button>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="h-3.5 w-3.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar cliente ou número..."
              className="w-full bg-zinc-950/80 border border-zinc-800 text-xs px-9 py-2 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-pink"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Three Columns Kanban Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* COLUMN 1: Aguardando Arte (Orders without designer assigned) */}
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-zinc-950 px-3 py-2.5 rounded-xl border border-zinc-850">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse"></span>
              Aguardando Designer ({totalUnassigned})
            </span>
          </div>

          <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
            {unassignedOrders.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/20 border border-dashed border-zinc-850 rounded-xl text-zinc-500 text-[10.5px]">
                Nenhum pedido aguardando designer.
              </div>
            ) : (
              unassignedOrders.map((sale, idx) => {
                const urgent = isUrgent(sale);
                return (
                  <div 
                    key={sale.id}
                    onClick={() => handleSelectSaleForReceipt(sale)}
                    className={`transition-all duration-300 cursor-pointer group active:scale-[0.99] border rounded-xl p-4 space-y-3 ${
                      urgent
                        ? 'border-red-500/40 bg-red-950/10 hover:border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.06)]'
                        : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-450 px-1.5 py-0.5 rounded">
                        Pedido #{sale.numeroPedido || sale.id.substring(0, 5)}
                      </span>
                      {urgent ? (
                        <span className="text-[9px] font-extrabold uppercase text-red-400 bg-red-500/15 border border-red-500/25 px-1.5 py-0.5 rounded-sm animate-pulse flex items-center gap-1 shrink-0">
                          🚨 Urgente: {getUrgentText(sale.dataRetirada)}
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-500">
                          {formatDateTime(sale.data)}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-200 group-hover:text-brand-pink transition-colors truncate">
                        {sale.cliente}
                      </p>
                      <p className="text-[10.5px] text-zinc-400 leading-snug line-clamp-2">
                        {sale.itens && sale.itens.length > 0 
                          ? sale.itens.map(it => `${it.quantidade}x ${it.produtoNome}`).join(', ')
                          : `${sale.quantidade}x ${sale.produtoNome}`}
                      </p>
                    </div>

                    {sale.dataRetirada && (
                      <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border w-fit ${
                        urgent
                          ? 'text-red-400 bg-red-500/10 border-red-500/20'
                          : 'text-amber-500 bg-amber-500/5 border-amber-500/10'
                      }`}>
                        <Calendar className="h-3 w-3" />
                        <span>Retirada: {new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}

                  {/* Actions to Drag / Pull */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-900">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePullOrder(sale, 'designer1');
                      }}
                      className="py-1.5 px-2 bg-brand-pink text-black font-extrabold text-[10px] rounded-lg transition-all hover:bg-opacity-90 flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <span>Pegar D1</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePullOrder(sale, 'designer2');
                      }}
                      className="py-1.5 px-2 bg-cyan-500 hover:bg-cyan-450 text-black font-extrabold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <span>Pegar D2</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )})
            )}
          </div>
        </div>

        {/* COLUMN 2: Designer 1 Workspace */}
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-brand-pink/5 px-3 py-2.5 rounded-xl border border-brand-pink/20">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-pink flex items-center gap-1.5">
              <Paintbrush className="h-3.5 w-3.5 text-brand-pink" />
              Designer 1 ({totalD1})
            </span>
            <span className="text-[9.5px] font-mono text-zinc-550 font-bold">
              {finishedD1}/{totalD1} Concluídas
            </span>
          </div>

          <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
            {designer1Orders.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/20 border border-dashed border-zinc-850 rounded-xl text-zinc-500 text-[10.5px]">
                Nenhum pedido com o Designer 1.
              </div>
            ) : (
              designer1Orders.map((sale) => {
                const isFinished = sale.statusArte === 'Arte Finalizada';
                return (
                  <div 
                    key={sale.id}
                    onClick={() => handleSelectSaleForReceipt(sale)}
                    className={`border rounded-xl p-4 space-y-3 transition-all cursor-pointer relative group ${
                      isFinished 
                        ? 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40' 
                        : 'bg-zinc-950 border-zinc-850 hover:border-brand-pink/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-450 px-1.5 py-0.5 rounded">
                        Pedido #{sale.numeroPedido || sale.id.substring(0, 5)}
                      </span>
                      {isFinished ? (
                        <span className="text-[9px] font-bold text-emerald-450 uppercase flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-sm">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Arte Finalizada
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-sm animate-pulse">
                          🎨 Em Produção
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-200 group-hover:text-brand-pink transition-colors truncate">
                        {sale.cliente}
                      </p>
                      <p className="text-[10.5px] text-zinc-400 leading-snug line-clamp-2">
                        {sale.itens && sale.itens.length > 0 
                          ? sale.itens.map(it => `${it.quantidade}x ${it.produtoNome}`).join(', ')
                          : `${sale.quantidade}x ${sale.produtoNome}`}
                      </p>
                    </div>

                    {/* Metadata: who pulled and date */}
                    {sale.puxadoPor && (
                      <div className="text-[9.5px] text-zinc-500 bg-zinc-900/60 p-1.5 rounded-md border border-zinc-850 flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-2.5 w-2.5 shrink-0 text-brand-pink" />
                          <span>Puxado por: <strong>{sale.puxadoPor}</strong></span>
                        </span>
                        {sale.puxadoEm && (
                          <span className="text-[8.5px] font-mono flex-shrink-0">
                            {formatDateTime(sale.puxadoEm)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Control Panel actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-900 no-print">
                      <div className="flex-1 flex gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleArtworkStatus(sale);
                          }}
                          className={`flex-1 py-1.5 px-2 font-bold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                            isFinished
                              ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-500 hover:border-amber-500/30'
                              : 'bg-emerald-600 hover:bg-emerald-550 text-white'
                          }`}
                        >
                          {isFinished ? (
                            <>
                              <RefreshCw className="h-3 w-3" />
                              <span>Reabrir Arte</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Concluir Arte</span>
                            </>
                          )}
                        </button>

                        {isFinished && (
                          <button
                            type="button"
                            title={sale.removerDoDesign ? "Mostrar na lista de design" : "Remover da lista de design"}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmRemoveFromDesign(sale, !sale.removerDoDesign);
                            }}
                            className={`py-1.5 px-2.5 border rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0 ${
                              sale.removerDoDesign
                                ? 'bg-emerald-950/20 border-emerald-950/40 hover:border-emerald-650 hover:text-emerald-300 text-emerald-400'
                                : 'bg-red-950/20 border-red-900/30 hover:border-red-650 hover:text-red-300 text-red-400'
                            }`}
                          >
                            <Trash className="h-3.5 w-3.5" />
                            <span>{sale.removerDoDesign ? 'Mostrar' : 'Ocultar'}</span>
                          </button>
                        )}
                      </div>

                      {/* Devolve / Switch designer */}
                      <button
                        type="button"
                        title="Liberar pedido ou mover"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePullOrder(sale, null);
                        }}
                        className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-red-500 hover:text-red-400 text-zinc-550 rounded-lg transition-colors cursor-pointer"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        title="Transferir para Designer 2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePullOrder(sale, 'designer2');
                        }}
                        className="py-1 px-1.5 bg-zinc-900 border border-zinc-800 hover:border-cyan-550 hover:text-cyan-400 text-zinc-550 text-[9px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        D2
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 3: Designer 2 Workspace */}
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-cyan-950/10 px-3 py-2.5 rounded-xl border border-cyan-900/30">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-cyan-400" />
              Designer 2 ({totalD2})
            </span>
            <span className="text-[9.5px] font-mono text-cyan-600 font-bold">
              {finishedD2}/{totalD2} Concluídas
            </span>
          </div>

          <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
            {designer2Orders.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/20 border border-dashed border-zinc-850 rounded-xl text-zinc-500 text-[10.5px]">
                Nenhum pedido com o Designer 2.
              </div>
            ) : (
              designer2Orders.map((sale) => {
                const isFinished = sale.statusArte === 'Arte Finalizada';
                return (
                  <div 
                    key={sale.id}
                    onClick={() => handleSelectSaleForReceipt(sale)}
                    className={`border rounded-xl p-4 space-y-3 transition-all cursor-pointer relative group ${
                      isFinished 
                        ? 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40' 
                        : 'bg-zinc-950 border-zinc-850 hover:border-cyan-400/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-450 px-1.5 py-0.5 rounded">
                        Pedido #{sale.numeroPedido || sale.id.substring(0, 5)}
                      </span>
                      {isFinished ? (
                        <span className="text-[9px] font-bold text-emerald-450 uppercase flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-sm">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Arte Finalizada
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-sm animate-pulse">
                          🎨 Em Produção
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors truncate">
                        {sale.cliente}
                      </p>
                      <p className="text-[10.5px] text-zinc-400 leading-snug line-clamp-2">
                        {sale.itens && sale.itens.length > 0 
                          ? sale.itens.map(it => `${it.quantidade}x ${it.produtoNome}`).join(', ')
                          : `${sale.quantidade}x ${sale.produtoNome}`}
                      </p>
                    </div>

                    {/* Metadata: who pulled and date */}
                    {sale.puxadoPor && (
                      <div className="text-[9.5px] text-zinc-500 bg-zinc-900/60 p-1.5 rounded-md border border-zinc-850 flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-2.5 w-2.5 shrink-0 text-cyan-400" />
                          <span>Puxado por: <strong>{sale.puxadoPor}</strong></span>
                        </span>
                        {sale.puxadoEm && (
                          <span className="text-[8.5px] font-mono flex-shrink-0">
                            {formatDateTime(sale.puxadoEm)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Control Panel actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-900 no-print">
                      <div className="flex-1 flex gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleArtworkStatus(sale);
                          }}
                          className={`flex-1 py-1.5 px-2 font-bold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                            isFinished
                              ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-500 hover:border-amber-500/30'
                              : 'bg-emerald-600 hover:bg-emerald-550 text-white'
                          }`}
                        >
                          {isFinished ? (
                            <>
                              <RefreshCw className="h-3 w-3" />
                              <span>Reabrir Arte</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Concluir Arte</span>
                            </>
                          )}
                        </button>

                        {isFinished && (
                          <button
                            type="button"
                            title={sale.removerDoDesign ? "Mostrar na lista de design" : "Remover da lista de design"}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmRemoveFromDesign(sale, !sale.removerDoDesign);
                            }}
                            className={`py-1.5 px-2.5 border rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0 ${
                              sale.removerDoDesign
                                ? 'bg-emerald-950/20 border-emerald-950/40 hover:border-emerald-650 hover:text-emerald-300 text-emerald-400'
                                : 'bg-red-950/20 border-red-900/30 hover:border-red-650 hover:text-red-300 text-red-400'
                            }`}
                          >
                            <Trash className="h-3.5 w-3.5" />
                            <span>{sale.removerDoDesign ? 'Mostrar' : 'Ocultar'}</span>
                          </button>
                        )}
                      </div>

                      {/* Devolve / Switch designer */}
                      <button
                        type="button"
                        title="Liberar pedido ou mover"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePullOrder(sale, null);
                        }}
                        className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-red-500 hover:text-red-400 text-zinc-550 rounded-lg transition-colors cursor-pointer"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        title="Transferir para Designer 1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePullOrder(sale, 'designer1');
                        }}
                        className="py-1 px-1.5 bg-zinc-950 border border-zinc-800 hover:border-brand-pink hover:text-brand-pink text-zinc-550 text-[9px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        D1
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 4. Thermal view selected in the bottom with smooth scroll focuser */}
      <div ref={receiptContainerRef} className="pt-4 scroll-mt-6">
        <h3 className="font-display font-semibold text-zinc-100 text-sm mb-3 px-1 flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-pink" />
          <span>Visualização de Recibo do Pedido</span>
        </h3>
        
        {viewedSale ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
              <span className="text-xs text-zinc-400">
                Visualizando pedido: <strong className="text-brand-pink">#{viewedSale.numeroPedido || viewedSale.id.substring(0, 5)}</strong> ({viewedSale.cliente})
              </span>
              <button 
                onClick={() => setViewedSale(null)} 
                className="text-xs text-zinc-400 hover:text-red-400 cursor-pointer flex items-center gap-1 font-bold transition-colors animate-fade-in"
              >
                Fechar Recibo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mt-2">
              {/* Left Column: Printable Thermal Receipt */}
              <div className="flex flex-col items-center w-full">
                <span className="text-[10px] text-zinc-500 font-bold uppercase mb-2 block self-start">Recibo Térmico</span>
                <Receipt 
                  sale={viewedSale} 
                  storeInfo={storeInfo} 
                  onUpdateSale={onUpdateSale} 
                  onEdit={() => setEditingSale(viewedSale)}
                />
              </div>

              {/* Right Column: Copy-able Text Block */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-5 space-y-4 h-full self-stretch flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-900 pb-3">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Resumo para Copiar</h4>
                      <p className="text-[10px] text-zinc-500 font-medium">Básico estruturado para compartilhamento rápido</p>
                    </div>
                    
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          const numPed = viewedSale.numeroPedido || viewedSale.id.substring(0, 5);
                          const tel = viewedSale.telefoneCliente || 'Não informado';
                          const pagou = viewedSale.valorPago ?? 0;
                          const falta = viewedSale.valorFaltante !== undefined ? viewedSale.valorFaltante : (viewedSale.total - (viewedSale.valorPago ?? 0));
                          const entrega = viewedSale.dataRetirada 
                            ? new Date(viewedSale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') 
                            : 'Não cadastrada';

                          const produtosTexto = viewedSale.itens && viewedSale.itens.length > 0 
                            ? viewedSale.itens.map(item => `• ${item.produtoNome} (Qtd: ${item.quantidade})`).join('\n')
                            : `• ${viewedSale.produtoNome} (Qtd: ${viewedSale.quantidade})`;

                          const finalString = `Número do Pedido: #${numPed}
Telefone: ${tel}
Quanto pagou: R$ ${pagou.toFixed(2)}
Quanto falta pagar: R$ ${falta.toFixed(2)}
Data de entrega: ${entrega}
Produto e a quantidade:
${produtosTexto}`;

                          navigator.clipboard.writeText(finalString);
                          playAppSound('success');
                          setCopiedText(true);
                          setTimeout(() => setCopiedText(false), 2000);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          copiedText 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                        }`}
                      >
                        {copiedText ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Texto Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copiar Texto</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          const codeValue = `oxente:${viewedSale.id}`;
                          QRCode.toDataURL(
                            codeValue,
                            {
                              margin: 1,
                              width: 300,
                              color: { dark: '#dc2626', light: '#ffffff' }
                            },
                            async (err, url) => {
                              if (err) {
                                console.warn('Erro ao gerar código QR para cópia:', err);
                              } else {
                                try {
                                  const res = await fetch(url);
                                  const blob = await res.blob();
                                  
                                  if (navigator.clipboard && window.ClipboardItem) {
                                    const item = new ClipboardItem({
                                      'image/png': blob
                                    });
                                    await navigator.clipboard.write([item]);
                                    playAppSound('success');
                                    setCopiedQr(true);
                                    setTimeout(() => setCopiedQr(false), 2000);
                                  } else {
                                    console.warn('Clipboard API not fully supported for images.');
                                  }
                                } catch (writeErr) {
                                  console.warn('Falha ao gravar imagem QR no clipboard:', writeErr);
                                }
                              }
                            }
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          copiedQr 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-brand-pink text-black hover:bg-opacity-95'
                        }`}
                      >
                        {copiedQr ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>QR Copiado!</span>
                          </>
                        ) : (
                          <>
                            <QrCode className="h-3.5 w-3.5" />
                            <span>Copiar QR Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Styled preview box containing exact user request options */}
                  <div className="bg-zinc-900 border border-zinc-805 rounded-xl p-4.5 font-mono text-[11.5px] text-zinc-300 leading-relaxed space-y-2 select-all">
                    <div>
                      <span className="text-zinc-500 font-bold">Número do Pedido:</span> <strong>#{viewedSale.numeroPedido || viewedSale.id.substring(0, 5)}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-bold">Telefone:</span> <strong>{viewedSale.telefoneCliente || 'Não cadastrado'}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-bold">Quanto pagou:</span> <strong className="text-emerald-400">R$ {(viewedSale.valorPago ?? 0).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-bold">Quanto falta pagar:</span> <strong className={(viewedSale.valorFaltante ?? (viewedSale.total - (viewedSale.valorPago ?? 0))) > 0 ? 'text-red-400' : 'text-zinc-400'}>R$ {(viewedSale.valorFaltante !== undefined ? viewedSale.valorFaltante : (viewedSale.total - (viewedSale.valorPago ?? 0))).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-bold">Data de entrega:</span> <strong className="text-amber-400">{viewedSale.dataRetirada ? new Date(viewedSale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informada'}</strong>
                    </div>
                    <div className="pt-2 border-t border-zinc-800 mt-2">
                      <span className="text-zinc-500 uppercase text-[9px] font-extrabold block mb-1 tracking-wider">Produto e a quantidade:</span>
                      {viewedSale.itens && viewedSale.itens.length > 0 ? (
                        <div className="space-y-1">
                          {viewedSale.itens.map((item, i) => (
                            <div key={i} className="text-zinc-200">
                              • {item.produtoNome} <span className="text-brand-pink font-bold font-mono">({item.quantidade}x)</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-zinc-200">
                          • {viewedSale.produtoNome} <span className="text-brand-pink font-bold font-mono">({viewedSale.quantidade}x)</span>
                        </div>
                      )}
                    </div>
                  </div>



                  {/* IDEIA 1: Linha do Tempo da Jornada do Pedido */}
                  <div className="pt-3 border-t border-zinc-900 space-y-3 select-none">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">Jornada Temporal do Pedido</span>
                    
                    <div className="relative pl-5 border-l-2 border-zinc-900 space-y-4 ml-1.5 pt-1.5 pb-1.5">
                      {/* Step 1: Pedido Registrado */}
                      <div className="relative">
                        <div className="absolute -left-[25.5px] top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950 shadow-inner" />
                        <h5 className="text-[10.5px] font-bold text-zinc-200 font-sans">🛒 Pedido Registrado</h5>
                        <p className="text-[9px] text-zinc-550 mt-0.5 leading-normal">
                          Lançado por <span className="text-zinc-400 font-mono font-bold">{viewedSale.criadoPorEmail || 'Sistema/Legado'}</span> em {new Date(viewedSale.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>

                      {/* Step 2: Designer Assignment */}
                      <div className="relative font-sans">
                        <div className={`absolute -left-[25.5px] top-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                          viewedSale.statusArte === 'Arte Finalizada'
                            ? 'bg-emerald-500'
                            : viewedSale.puxadoPor
                              ? 'bg-blue-500'
                              : 'bg-zinc-800'
                        }`} />
                        <h5 className="text-[10.5px] font-bold text-zinc-200">🎨 Criação de Arte (Design)</h5>
                        <p className="text-[9px] text-zinc-550 mt-0.5 leading-normal">
                          {viewedSale.statusArte === 'Arte Finalizada' ? (
                            <span>Aprovada e Finalizada por <strong className="text-emerald-400">{viewedSale.arteFinalizadaPorEmail || viewedSale.puxadoPor || 'Designer'}</strong>{viewedSale.arteFinalizadaEm && ` em ${new Date(viewedSale.arteFinalizadaEm).toLocaleString('pt-BR')}`}</span>
                          ) : viewedSale.puxadoPor ? (
                            <span>Em elaboração por <strong className="text-blue-400">{viewedSale.puxadoPor}</strong>{viewedSale.puxadoEm && ` desde ${new Date(viewedSale.puxadoEm).toLocaleString('pt-BR')}`}</span>
                          ) : (
                            <span className="text-amber-500/80">Aguardando designer puxar a arte</span>
                          )}
                        </p>
                      </div>

                      {/* Step 3: Produção Física */}
                      <div className="relative font-sans">
                        <div className={`absolute -left-[25.5px] top-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                          viewedSale.statusProducao === 'Entregue'
                            ? 'bg-emerald-500'
                            : ['Pronto para Retirada', 'Agendado para Entrega'].includes(viewedSale.statusProducao || '')
                              ? 'bg-amber-400'
                              : viewedSale.statusProducao === 'Em Produção'
                                ? 'bg-amber-600'
                                : 'bg-zinc-800'
                        }`} />
                        <h5 className="text-[10.5px] font-bold text-zinc-200">📦 Produção & Logística</h5>
                        <p className="text-[9px] text-zinc-550 mt-0.5 leading-normal">
                          Etapa atual: <strong className="text-zinc-300 font-mono text-[9px]">{viewedSale.statusProducao || 'Agendado'}</strong>{viewedSale.dataRetirada && ` (Previsão: ${new Date(viewedSale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')})`}
                        </p>
                      </div>

                      {/* Step 4: Fluxo Financeiro */}
                      <div className="relative font-sans">
                        {(() => {
                          const falta = viewedSale.valorFaltante !== undefined ? viewedSale.valorFaltante : (viewedSale.total - (viewedSale.valorPago ?? 0));
                          const paidFull = falta <= 0;
                          return (
                            <>
                              <div className={`absolute -left-[25.5px] top-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                                paidFull ? 'bg-emerald-500' : 'bg-red-500/80'
                              }`} />
                              <h5 className="text-[10.5px] font-bold text-zinc-200">💰 Balancete Financeiro</h5>
                              <p className="text-[9px] text-zinc-550 mt-0.5 leading-normal">
                                {paidFull ? (
                                  <span className="text-emerald-400 font-bold">Totalmente Quitado! 💳 Valor Total de R$ {viewedSale.total.toFixed(2)}</span>
                                ) : (
                                  <span className="text-red-400/90 font-bold">Aguardando quitação: Restam R$ {falta.toFixed(2)} pendentes (Total R$ {viewedSale.total.toFixed(2)})</span>
                                )}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Editable Notepad Block for Order Notes */}
                  <div className="pt-3.5 border-t border-zinc-900 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/10 border border-amber-400/15 px-2.5 py-0.5 rounded flex items-center gap-1.5 animate-pulse-slow">
                        <span>📝 Bloco de Notas / Observações</span>
                      </span>
                      {saveSuccess ? (
                        <span className="text-[10.5px] text-emerald-400 font-extrabold flex items-center gap-1 transition-all">
                          Sincronizado ✔️
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">
                          {isSavingNotes ? 'Sincronizando...' : 'Anotações Locais'}
                        </span>
                      )}
                    </div>

                    <div className="relative rounded-xl border border-zinc-850 bg-zinc-900/55 p-3.5 overflow-hidden shadow-inner">
                      {/* Lined notebook decoration utilizing vertical linear gradients to mimic horizontal writing lines */}
                      <textarea
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="Escreva observações aqui... (ex: detalhes de tamanho da arte, medidas solicitadas, cores especiais ou alterações do cliente)"
                        rows={6}
                        className="w-full text-[11.5px] text-zinc-250 bg-[linear-gradient(to_bottom,transparent_23px,rgba(217,119,6,0.05)_23px)] bg-[size:100%_24px] leading-[24px] resize-none focus:outline-none placeholder-zinc-650 font-sans"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      <p className="text-[9px] text-zinc-550 leading-relaxed max-w-[210px] font-medium">
                        As anotações gravadas são compartilhadas e ficam salvas de forma permanente neste pedido.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!viewedSale) return;
                          setIsSavingNotes(true);
                          const updated: Sale = {
                            ...viewedSale,
                            observacoesDesign: notesText
                          };
                          onUpdateSale(updated);
                          playAppSound('success');
                          setTimeout(() => {
                            setIsSavingNotes(false);
                            setSaveSuccess(true);
                            setTimeout(() => setSaveSuccess(false), 2000);
                          }, 450);
                        }}
                        disabled={isSavingNotes}
                        className="py-1.5 px-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white hover:border-zinc-700 border border-zinc-800 rounded-lg text-[10px] font-black tracking-wide transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50 shrink-0 select-none"
                      >
                        {isSavingNotes ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Gravando...</span>
                          </>
                        ) : saveSuccess ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Gravado!</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5 text-brand-pink" />
                            <span>Salvar Observação</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-850/50 flex items-start gap-2 text-[10px] text-zinc-550 leading-relaxed">
                  <span className="text-xs">✨</span>
                  <p>
                    As informações acima são sincronizadas dinamicamente. Clique sobre a caixa para selecionar ou use o botão <strong className="text-zinc-400">Copiar Resumo</strong> para enviar imediatamente para seu aplicativo de mensagens.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-print bg-zinc-900 rounded-2xl border border-zinc-800 border-dashed p-10 text-center text-zinc-500 min-h-[200px] flex flex-col items-center justify-center">
            <FileText className="h-10 w-10 text-zinc-700 stroke-1 mb-2 animate-pulse-slow" />
            <p className="font-medium text-zinc-400 text-xs text-center">Nenhum recibo selecionado</p>
            <p className="text-[10px] text-zinc-500 max-w-[320px] mx-auto mt-1 text-center">
              Selecione qualquer card ou pedido nos fluxos de Designer acima para carregar o seu respectivo recibo térmico imprimível aqui.
            </p>
          </div>
        )}
      </div>

      {/* Edit Sale Modal Overlay */}
      <AnimatePresence>
        {editingSale && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8"
            >
              {/* Header */}
              <div className="px-6 py-4.5 bg-zinc-950 border-b border-zinc-850 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-zinc-100 text-sm">Editar Informações da Venda</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">ID: {editingSale.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                {/* Editable Items List */}
                <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-850">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 animate-pulse-slow">
                      <ShoppingBag className="h-3.5 w-3.5 text-brand-pink" />
                      Produtos no Pedido
                    </span>
                    <span className="text-[11px] font-bold font-mono text-brand-pink">
                      Total: R$ {editTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* List of current items */}
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {editItens.map((item, idx) => {
                      return (
                        <div key={item.id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
                          {/* Product selection/name */}
                          <div className="flex-1 min-w-0">
                            {products && products.length > 0 ? (
                              <select
                                value={item.produtoId}
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  const dbProd = products.find(p => p.id === selectedId);
                                  if (dbProd) {
                                    const updated = editItens.map((item, i) => i === idx ? {
                                      ...item,
                                      produtoId: dbProd.id,
                                      produtoNome: dbProd.nome,
                                      precoUn: dbProd.preco,
                                      total: dbProd.preco * item.quantidade
                                    } : item);
                                    setEditItens(updated);
                                  }
                                }}
                                className="w-full bg-black border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-brand-pink font-medium"
                              >
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>{p.nome} - R$ {p.preco.toFixed(2)}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-semibold text-zinc-300 block truncate">{item.produtoNome}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 justify-between sm:justify-start shrink-0">
                            {/* Quantity controls */}
                            <div className="flex items-center border border-zinc-800 bg-black rounded-lg overflow-hidden h-7">
                              <button
                                type="button"
                                onClick={() => {
                                  if (editItens[idx].quantidade > 1) {
                                    const updated = editItens.map((item, i) => i === idx ? {
                                      ...item,
                                      quantidade: item.quantidade - 1,
                                      total: item.precoUn * (item.quantidade - 1)
                                    } : item);
                                    setEditItens(updated);
                                  }
                                }}
                                className="px-2 h-full hover:bg-zinc-800 border-r border-zinc-800 text-zinc-400 font-bold hover:text-zinc-250 select-none cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  const updated = editItens.map((item, i) => i === idx ? {
                                    ...item,
                                    quantidade: val,
                                    total: item.precoUn * val
                                  } : item);
                                  setEditItens(updated);
                                }}
                                className="w-9 text-center bg-transparent text-xs font-semibold text-zinc-150 h-full border-none focus:outline-none font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = editItens.map((item, i) => i === idx ? {
                                    ...item,
                                    quantidade: item.quantidade + 1,
                                    total: item.precoUn * (item.quantidade + 1)
                                  } : item);
                                  setEditItens(updated);
                                }}
                                className="px-2 h-full hover:bg-zinc-800 border-l border-zinc-800 text-zinc-400 font-bold hover:text-zinc-250 select-none cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            {/* Price Override */}
                            <div className="relative w-20">
                              <span className="absolute left-1.5 inset-y-0 flex items-center text-[9px] text-zinc-550 select-none">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.precoUn}
                                onChange={(e) => {
                                  const pVal = parseFloat(e.target.value) || 0;
                                  const updated = editItens.map((item, i) => i === idx ? {
                                    ...item,
                                    precoUn: pVal,
                                    total: pVal * item.quantidade
                                  } : item);
                                  setEditItens(updated);
                                }}
                                className="w-full bg-black border border-zinc-800 rounded-lg pl-5 pr-1 py-1 text-right text-xs font-semibold text-zinc-200 focus:outline-none focus:border-brand-pink font-mono"
                              />
                            </div>

                            {/* Remove button */}
                            {editItens.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = editItens.filter((_, i) => i !== idx);
                                  setEditItens(updated);
                                }}
                                className="p-1 px-1.5 bg-red-950/20 hover:bg-red-900 border border-red-900/40 text-red-400 rounded-lg transition-colors cursor-pointer"
                                title="Remover item"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add New Product Block */}
                  {products && products.length > 0 && (
                    <div className="pt-2 border-t border-zinc-850 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        id="add-item-select"
                        value={selectedAddProductId}
                        onChange={(e) => setSelectedAddProductId(e.target.value)}
                        className="flex-1 bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-350 focus:outline-none focus:border-brand-pink cursor-pointer font-medium"
                      >
                        <option value="">➕ Selecione um produto para acrescentar...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nome} - R$ {p.preco.toFixed(2)}
                          </option>
                        ))}
                      </select>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedAddProductId) return;
                          const dbProd = products.find(p => p.id === selectedAddProductId);
                          if (dbProd) {
                            const existingIdx = editItens.findIndex(item => item.produtoId === dbProd.id);
                            if (existingIdx > -1) {
                              const updated = editItens.map((item, i) => i === existingIdx ? {
                                ...item,
                                quantidade: item.quantidade + 1,
                                total: item.precoUn * (item.quantidade + 1)
                              } : item);
                              setEditItens(updated);
                            } else {
                              setEditItens([
                                ...editItens,
                                {
                                  id: `item-${dbProd.id}-${Date.now()}`,
                                  produtoId: dbProd.id,
                                  produtoNome: dbProd.nome,
                                  precoUn: dbProd.preco,
                                  quantidade: 1,
                                  total: dbProd.preco
                                }
                              ]);
                            }
                            setSelectedAddProductId('');
                          }
                        }}
                        className="py-1.5 px-3 bg-brand-pink/15 hover:bg-brand-pink border border-brand-pink/35 text-brand-pink hover:text-black font-bold rounded-lg text-[11px] transition-all cursor-pointer whitespace-nowrap active:scale-95"
                      >
                        Acrescentar
                      </button>
                    </div>
                  )}
                </div>

                {/* Grid Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-client" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Nome do Cliente
                    </label>
                    <input
                      id="edit-client"
                      type="text"
                      required
                      value={editCliente}
                      onChange={(e) => setEditCliente(e.target.value)}
                      className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-sm"
                      placeholder="Identificação do cliente"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-phone" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Telefone do Cliente
                    </label>
                    <input
                      id="edit-phone"
                      type="tel"
                      value={editTelefone}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        // Simple formatting
                        let formatted = raw;
                        if (raw.length > 2) {
                          formatted = `(${raw.slice(0, 2)}) ` + raw.slice(2);
                        }
                        if (raw.length > 7) {
                          formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
                        }
                        setEditTelefone(formatted);
                      }}
                      className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-sm"
                      placeholder="(DD) 90000-0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-order-number" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Nº do Pedido
                    </label>
                    <input
                      id="edit-order-number"
                      type="text"
                      value={editNumeroPedido}
                      onChange={(e) => setEditNumeroPedido(e.target.value)}
                      className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-sm"
                      placeholder="Ex: 2548"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-pickup-date" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Data Programada de Retirada
                    </label>
                    <input
                      id="edit-pickup-date"
                      type="date"
                      value={editDataRetirada}
                      onChange={(e) => setEditDataRetirada(e.target.value)}
                      className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-150 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="edit-production-status" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Status Interno de Produção
                    </label>
                    <select
                      id="edit-production-status"
                      value={editStatusProducao}
                      onChange={(e) => setEditStatusProducao(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-150 text-xs font-semibold"
                    >
                      <option value="Agendado">📅 Agendado / Reservado</option>
                      <option value="Em Produção">🔨 Em Produção Interna</option>
                      <option value="Pronto para Retirada">✨ Pronto para Retirada</option>
                      <option value="Agendado para Entrega">🚚 Agendado para Entrega</option>
                      <option value="Entregue">🤝 Entregue ao Cliente</option>
                    </select>
                  </div>
                </div>

                {/* Edit Payment Method Select Options */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-400">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {paymentMethods.map((m) => {
                      const isSelected = editFormaPagamento === m.value;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setEditFormaPagamento(m.value)}
                          className={`py-2 px-1 rounded-lg text-center border transition-all text-[10px] flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'border-brand-pink bg-brand-pink/10 text-brand-pink font-semibold shadow-xs'
                              : 'border-zinc-800 text-zinc-400 hover:bg-zinc-950/40'
                          }`}
                        >
                          <span className="text-base">{m.icon}</span>
                          <span className="whitespace-nowrap">{m.value}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Paid amount & automatic recalculation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 bg-zinc-950/25 border border-zinc-850 p-4 rounded-xl">
                  <div>
                    <label htmlFor="edit-paid-amount" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Quanto o cliente pagou? (R$)
                    </label>
                    <input
                      id="edit-paid-amount"
                      type="text"
                      value={editValorPago}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setEditValorPago(val);
                      }}
                      className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-sm font-mono font-semibold"
                      placeholder={`Vazio = R$ ${editTotal.toFixed(2)}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Falta Pagar (Calculado)
                    </label>
                    <div className="px-3 py-2 bg-black border border-zinc-850 rounded-lg text-sm text-zinc-300 flex items-center h-[38px] font-mono justify-between">
                      <span className="text-zinc-550 text-[10px] select-none uppercase font-bold">Restante:</span>
                      <span className={`font-bold ${(editTotal - (editValorPago === '' ? editTotal : parseFloat(editValorPago) || 0)) > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                        R$ {Math.max(0, editTotal - (editValorPago === '' ? editTotal : parseFloat(editValorPago) || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 justify-end pt-3 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => setEditingSale(null)}
                    className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer select-none"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-brand-pink hover:bg-brand-pink-hover text-black font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer select-none"
                  >
                    Salvar Alterações
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ask to remove from design board when art is finished */}
      <AnimatePresence>
        {saleToRemovePrompt && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-zinc-900 border border-zinc-805 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-450 rounded-xl">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-100 text-sm">✨ Arte Concluída!</h3>
                  <p className="text-[10.5px] text-zinc-400 mt-0.5">Cliente: <strong className="text-zinc-200 font-bold">{saleToRemovePrompt.cliente}</strong></p>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-850 p-3.5 rounded-xl text-xs text-zinc-400 space-y-1 leading-relaxed">
                <p className="font-bold text-zinc-300">Deseja remover da lista do design?</p>
                <p className="text-[10px] text-zinc-500">
                  Ocultar este pedido libera espaço nas suas colunas. Ele continuará registrado em suas vendas normais.
                </p>
              </div>

              <div className="flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => handleConfirmRemoveFromDesign(saleToRemovePrompt, false)}
                  className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-850 text-zinc-450 hover:text-zinc-300 font-bold rounded-lg text-xs transition-colors cursor-pointer select-none"
                >
                  Manter na lista
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmRemoveFromDesign(saleToRemovePrompt, true)}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-550 text-white font-extrabold rounded-lg text-xs shadow-md transition-colors cursor-pointer select-none"
                >
                  Ocultar agora 🚫
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
