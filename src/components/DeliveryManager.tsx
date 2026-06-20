/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Search, Phone, CheckCircle2, Clock, DollarSign, Truck, FileText, Check, ShieldAlert, ArrowRight, User, Calendar } from 'lucide-react';
import { Sale, PaymentMethod, StoreInfo, Product } from '../types';
import { Receipt } from './Receipt';
import { playAppSound } from '../lib/audio';

interface DeliveryManagerProps {
  products: Product[];
  sales: Sale[];
  storeInfo: StoreInfo;
  onUpdateSale: (updatedSale: Sale) => void;
  preselectedSaleId?: string | null;
  onClearPreselectedSaleId?: () => void;
}

const paymentMethods: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'Pix', label: 'Pix (Instantâneo)', icon: '⚡' },
  { value: 'Dinheiro', label: 'Dinheiro físico', icon: '💵' },
  { value: 'Cartão de Crédito', label: 'Cartão de Crédito', icon: '💳' },
  { value: 'Cartão de Débito', label: 'Cartão de Débito', icon: '🏦' },
];

export function DeliveryManager({ products, sales, storeInfo, onUpdateSale, preselectedSaleId, onClearPreselectedSaleId }: DeliveryManagerProps) {
  const [category, setCategory] = useState<'Pendentes' | 'Entregues'>('Pendentes');
  const [deliverySearchTerm, setDeliverySearchTerm] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [productionStatusFilter, setProductionStatusFilter] = useState<'All' | 'Agendado' | 'Em Produção' | 'Pronto para Retirada'>('All');

  const actualSales = useMemo(() => {
    return sales.filter(s => s.status !== 'Orçamento');
  }, [sales]);

  const deliveryReceiptRef = React.useRef<HTMLDivElement>(null);

  const handleSelectDeliverySale = (saleId: string) => {
    setSelectedSaleId(saleId);
    setTimeout(() => {
      deliveryReceiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  // Sync preselectedSaleId if passed from parent
  React.useEffect(() => {
    if (preselectedSaleId) {
      setSelectedSaleId(preselectedSaleId);
      const sale = actualSales.find(s => s.id === preselectedSaleId);
      if (sale) {
        if (sale.statusProducao === 'Entregue') {
          setCategory('Entregues');
        } else {
          setCategory('Pendentes');
        }
      }
      if (onClearPreselectedSaleId) {
        onClearPreselectedSaleId();
      }
      // Also scroll to receipt when landing from parent preselection
      setTimeout(() => {
        deliveryReceiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }
  }, [preselectedSaleId, actualSales, onClearPreselectedSaleId]);
  
  // Deliver balance custom status states
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState<PaymentMethod>('Pix');
  const [successMessage, setSuccessMessage] = useState('');
  const [localObservacoes, setLocalObservacoes] = useState('');
  const [isSavingObs, setIsSavingObs] = useState(false);

  // Helper helper to check if a sale is Pending delivery
  const isSalePending = (sale: Sale) => {
    if (sale.status) {
      return sale.status === 'Pendente';
    }
    // Backward compatibility for old sales
    const missingValue = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - (sale.valorPago ?? sale.total));
    return missingValue > 0 || !!sale.numeroPedido;
  };

  const isForgottenSale = (sale: Sale) => {
    if (!sale.dataRetirada) return false;
    // It shouldn't be finalized (i.e. if statusProducao is 'Entregue' or sale.status is 'Concluído' or 'Pago total', it's delivered)
    if (sale.status === 'Concluído' || sale.status === 'Pago total' || sale.statusProducao === 'Entregue') return false;
    
    try {
      const pickupDate = new Date(sale.dataRetirada + 'T12:00:00');
      const today = new Date();
      
      pickupDate.setHours(12, 0, 0, 0);
      today.setHours(12, 0, 0, 0);
      
      const diffTime = today.getTime() - pickupDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      return diffDays >= 5;
    } catch (err) {
      return false;
    }
  };

  const forgottenCount = useMemo(() => {
    return actualSales.filter(s => isForgottenSale(s)).length;
  }, [actualSales]);

  const pipelineMetrics = useMemo(() => {
    let rawScheduled = 0;
    let rawInProduction = 0;
    let rawReadyForPickup = 0;
    let rawDeliveredTotal = 0;

    actualSales.forEach(s => {
      const prod = s.statusProducao || 'Agendado';
      if (prod === 'Agendado') {
        rawScheduled++;
      } else if (prod === 'Em Produção') {
        rawInProduction++;
      } else if (prod === 'Pronto para Retirada') {
        rawReadyForPickup++;
      } else if (prod === 'Entregue') {
        rawDeliveredTotal++;
      }
    });

    return {
      scheduled: rawScheduled,
      inProduction: rawInProduction,
      ready: rawReadyForPickup,
      delivered: rawDeliveredTotal
    };
  }, [actualSales]);

  // Divide sales into Pending and Delivered
  const pendingSales = useMemo(() => {
    return actualSales.filter(s => s.statusProducao !== 'Entregue');
  }, [actualSales]);

  const deliveredSales = useMemo(() => {
    return actualSales.filter(s => s.statusProducao === 'Entregue');
  }, [actualSales]);

  // Handle filtering by order number, client name, or telephone number
  const getFilteredList = () => {
    const term = deliverySearchTerm.toLowerCase().trim();
    let list = category === 'Pendentes' ? pendingSales : deliveredSales;
    
    // Filtro por status de produção quando selecionado nas métricas
    if (productionStatusFilter !== 'All') {
      list = list.filter(s => (s.statusProducao || 'Agendado') === productionStatusFilter);
    }
    
    if (!term) {
      if (category === 'Entregues') {
        const now = new Date();
        return list.filter(sale => {
          try {
            const saleDate = new Date(sale.data);
            const diffTime = Math.abs(now.getTime() - saleDate.getTime());
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            return diffDays <= 15;
          } catch {
            return true;
          }
        });
      }
      return list;
    }
    
    return list.filter((sale) => {
      const matchName = sale.cliente.toLowerCase().includes(term);
      const matchOrderNum = sale.numeroPedido ? sale.numeroPedido.toLowerCase().includes(term) : false;
      const matchPhone = sale.telefoneCliente ? sale.telefoneCliente.replace(/\D/g, '').includes(term.replace(/\D/g, '')) : false;
      return matchName || matchOrderNum || matchPhone;
    });
  };

  const filteredList = getFilteredList();

  // Find the currently active selected sale
  const selectedSale = useMemo(() => {
    if (!selectedSaleId) return null;
    return actualSales.find(s => s.id === selectedSaleId) || null;
  }, [selectedSaleId, actualSales]);

  // Apply default delivery details when the selected sale changes
  React.useEffect(() => {
    if (selectedSale) {
      setDeliveryPaymentMethod(selectedSale.formaPagamento);
      setLocalObservacoes(selectedSale.observacoesDesign || '');
    } else {
      setLocalObservacoes('');
    }
  }, [selectedSale]);

  const sendWhatsAppDeliveryMessage = (sale: Sale) => {
    if (!sale.telefoneCliente) return;

    const cleanPhone = sale.telefoneCliente.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.length > 0) {
      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        finalPhone = `55${cleanPhone}`;
      }
    }

    const orderNum = sale.numeroPedido || sale.id.substring(0, 5).toUpperCase();
    const clientName = sale.cliente || 'Consumidor';
    
    const messageText = `Olá, *${clientName}*! 🌟\n\nSeu pedido *#${orderNum}* foi entregue e finalizado com sucesso! 🎉\n\n*Detalhes:*\n📦 Produto: ${sale.produtoNome || 'Personalizado'} (qtd: ${sale.quantidade || 1})\n💰 Total: R$ ${(sale.total || 0).toFixed(2)}\n✅ Status Financeiro: Pago Total (Obrigado!)\n\nAgradecemos imensamente pela preferência e confiança em nosso trabalho. Esperamos que tenha uma excelente experiência com seus produtos! 🥰\n\nAtenciosamente,\n*Oxente Festeje* 🌸`;

    const encodedText = encodeURIComponent(messageText);
    const url = `whatsapp://send?phone=${finalPhone}&text=${encodedText}`;
    
    window.location.href = url;
  };

  const handleConfirmDeliveryAndPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    const remainingToPay = selectedSale.valorFaltante !== undefined ? selectedSale.valorFaltante : 0;

    // Create updated Sale with 0 balance and Concluding status
    const updated: Sale = {
      ...selectedSale,
      valorPagoAntesConcluir: selectedSale.valorPago ?? 0,
      valorFaltanteAntesConcluir: selectedSale.valorFaltante ?? (selectedSale.total - (selectedSale.valorPago ?? 0)),
      statusProducaoAntesConcluir: selectedSale.statusProducao || 'Agendado',
      valorPago: selectedSale.total,
      valorFaltante: 0,
      formaPagamento: deliveryPaymentMethod,
      status: 'Pago total',
      statusProducao: 'Entregue',
      observacoesDesign: localObservacoes,
    };

    onUpdateSale(updated);
    
    // Disparar envio de aviso por WhatsApp Desktop
    sendWhatsAppDeliveryMessage(updated);

    setSuccessMessage(`Pedido #${selectedSale.numeroPedido || selectedSale.id.substring(5, 9)} entregue e concluído com sucesso!`);
    
    // Clear success message after 4.5 seconds
    setTimeout(() => {
      setSuccessMessage('');
    }, 4500);

    // Keep it selected so they can view/print the concluded receipt, but shift category view if they want or let them enjoy the receipt
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start select-text">
      
      {/* LEFT COLUMN: Search & Selector list (7 cols) */}
      <div className="lg:col-span-7 space-y-6 no-print">
        
        {/* Headline Section */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-pink/10 border border-brand-pink/20 rounded-lg text-brand-pink">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg text-zinc-100">Controle de Entregas &amp; Pagamentos</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Gerencie recebimentos no ato da entrega e libere pedidos concluídos</p>
            </div>
          </div>
        </div>

        {/* ⚙️ PIPELINE METRICS CONTAINER BAR (CLICÁVEIS PARA FILTRAR) */}
        <div className="grid grid-cols-3 gap-3 no-print">
          <button
            type="button"
            onClick={() => {
              setProductionStatusFilter(prev => prev === 'Agendado' ? 'All' : 'Agendado');
              setSelectedSaleId(null);
            }}
            className={`p-3 rounded-xl border text-left transition-all active:scale-98 cursor-pointer relative overflow-hidden group ${
              productionStatusFilter === 'Agendado'
                ? 'bg-blue-950/20 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30'
                : 'bg-zinc-900 border-zinc-850 hover:border-zinc-750 hover:bg-zinc-850/30'
            }`}
            title="Clique para filtrar apenas pedidos agendados"
          >
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 font-extrabold block">Agendados</span>
            <span className="text-lg font-black text-blue-400 font-mono mt-0.5 block">{pipelineMetrics.scheduled}</span>
            {productionStatusFilter === 'Agendado' && (
              <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setProductionStatusFilter(prev => prev === 'Em Produção' ? 'All' : 'Em Produção');
              setSelectedSaleId(null);
            }}
            className={`p-3 rounded-xl border text-left transition-all active:scale-98 cursor-pointer relative overflow-hidden group ${
              productionStatusFilter === 'Em Produção'
                ? 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
                : 'bg-zinc-900 border-zinc-850 hover:border-zinc-750 hover:bg-zinc-850/30'
            }`}
            title="Clique para filtrar apenas pedidos em produção"
          >
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 font-extrabold block">Em Produção</span>
            <span className="text-lg font-black text-amber-400 font-mono mt-0.5 block">{pipelineMetrics.inProduction}</span>
            {productionStatusFilter === 'Em Produção' && (
              <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setProductionStatusFilter(prev => prev === 'Pronto para Retirada' ? 'All' : 'Pronto para Retirada');
              setSelectedSaleId(null);
            }}
            className={`p-3 rounded-xl border text-left transition-all active:scale-98 cursor-pointer relative overflow-hidden group ${
              productionStatusFilter === 'Pronto para Retirada'
                ? 'bg-purple-950/20 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/30'
                : 'bg-zinc-900 border-zinc-850 hover:border-zinc-750 hover:bg-zinc-850/30'
            }`}
            title="Clique para filtrar apenas pedidos prontos"
          >
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 font-extrabold block">Prontos</span>
            <span className="text-lg font-black text-purple-400 font-mono mt-0.5 block">{pipelineMetrics.ready}</span>
            {productionStatusFilter === 'Pronto para Retirada' && (
              <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-purple-400" />
            )}
          </button>
        </div>

        {forgottenCount > 0 && (
          <div className="bg-red-950/20 border border-red-800/50 p-4 rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚠️</span>
              <div>
                <h4 className="text-xs font-bold text-red-400">Alerta de Encomendas Esquecidas!</h4>
                <p className="text-[10px] text-zinc-400 mt-0.5">Detectamos {forgottenCount} {forgottenCount === 1 ? 'pedido pendente há mais' : 'pedidos pendentes há mais'} de 5 dias da data de retirada.</p>
              </div>
            </div>
            <span className="text-[9.5px] font-black uppercase text-red-400 bg-red-900/15 border border-red-800/30 px-2 py-1 rounded-md animate-pulse">
              Prioridade
            </span>
          </div>
        )}

        {/* Active Production Filter Alert */}
        {productionStatusFilter !== 'All' && (
          <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs no-print animate-fade-in">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <span>🔍</span> 
              <span>Filtrando por:</span>
              <strong className="text-zinc-100 font-black uppercase text-[10.5px]">
                {productionStatusFilter === 'Agendado' ? '📅 Agendado' : 
                 productionStatusFilter === 'Em Produção' ? '🔨 Em Produção' : '✨ Pronto para Retirada'}
              </strong>
            </span>
            <button
              onClick={() => setProductionStatusFilter('All')}
              className="text-[10px] text-brand-pink hover:text-brand-pink/80 font-black uppercase tracking-widest cursor-pointer select-none"
            >
              Limpar Filtro [x]
            </button>
          </div>
        )}

        {/* Category Toggles - Dual state filter buttons */}
        <div className="flex gap-2 bg-zinc-900/50 p-1 border border-zinc-850 rounded-xl">
          <button 
            type="button"
            onClick={() => {
              setCategory('Pendentes');
              setSelectedSaleId(null);
            }}
            className={`flex-1 py-3 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              category === 'Pendentes' 
                ? 'bg-brand-pink text-black font-bold shadow-xs' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>📦</span> Pendentes de Entrega ({pendingSales.length})
          </button>
          <button 
            type="button"
            onClick={() => {
              setCategory('Entregues');
              setSelectedSaleId(null);
            }}
            className={`flex-1 py-3 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              category === 'Entregues' 
                ? 'bg-emerald-600 text-white font-bold shadow-xs' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>✅</span> Pedidos Entregues ({deliveredSales.length})
          </button>
        </div>

        {/* Dynamic Search bar optimized for Pedidos/Telefones */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-5 space-y-4 shadow-xs">
          <div className="relative">
            <span className="absolute left-3.5 top-3 text-zinc-450">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por número do pedido (#), telefone ou cliente..."
              value={deliverySearchTerm}
              onChange={(e) => setDeliverySearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink text-zinc-100 placeholder-zinc-600 text-xs font-sans transition-colors"
            />
          </div>

          {/* List display */}
          <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
            {filteredList.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-850 rounded-xl bg-black/10">
                <p className="text-sm font-medium">Nenhum pedido encontrado</p>
                <p className="text-xs text-zinc-650 mt-1">
                  Certifique-se de digitar o número do pedido ou telefone corretamente.
                </p>
              </div>
            ) : (
              filteredList.map((sale) => {
                const isSelected = selectedSaleId === sale.id;
                const outstandingAmt = sale.valorFaltante !== undefined ? sale.valorFaltante : 0;
                
                return (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => {
                      handleSelectDeliverySale(sale.id);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-brand-pink/10 border-brand-pink text-zinc-100'
                        : 'bg-black border-zinc-850 hover:border-zinc-750 text-zinc-300'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-150 text-sm truncate">{sale.cliente}</span>
                        {sale.numeroPedido && (
                          <span className="bg-zinc-800 font-bold border border-zinc-750 text-brand-pink font-mono text-[10px] px-1.5 py-0.5 rounded leading-none">
                            #{sale.numeroPedido}
                          </span>
                        )}
                        {!sale.numeroPedido && (
                          <span className="bg-zinc-900 border border-zinc-850 text-zinc-400 font-mono text-[9px] px-1 py-0.5 rounded">
                            Avulso
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-zinc-450">
                        {sale.telefoneCliente && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3 text-zinc-500" />
                            {sale.telefoneCliente}
                          </span>
                        )}
                        <span className="text-zinc-500">
                          {new Date(sale.data).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 truncate">
                        Produto: <span className="text-zinc-200 font-medium">{sale.produtoNome} ({sale.quantidade}x)</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {sale.dataRetirada && (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold ${
                            isForgottenSale(sale)
                              ? 'bg-red-500/15 text-red-400 border border-red-500/35 animate-pulse-slow'
                              : 'bg-zinc-900 border border-zinc-800 text-amber-500'
                          }`}>
                            📅 Retirada: {new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')}
                            {isForgottenSale(sale) && ' (ESQUECIDO!)'}
                          </span>
                        )}

                        {sale.statusProducao && (
                          <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${
                            sale.statusProducao === 'Agendado' ? 'bg-blue-900/10 text-blue-400 border-blue-900/20' :
                            sale.statusProducao === 'Em Produção' ? 'bg-amber-900/10 text-amber-400 border-amber-900/20' :
                            sale.statusProducao === 'Pronto para Retirada' ? 'bg-purple-900/10 text-purple-400 border-purple-900/20' :
                            sale.statusProducao === 'Agendado para Entrega' ? 'bg-sky-950/20 text-sky-400 border-sky-850/40 text-[9px]' :
                            'bg-emerald-900/10 text-emerald-400 border-emerald-900/30'
                          }`}>
                            {sale.statusProducao === 'Agendado' ? '📅 Agendado' :
                             sale.statusProducao === 'Em Produção' ? '🔨 Produção' :
                             sale.statusProducao === 'Pronto para Retirada' ? '✨ Pronto' :
                             sale.statusProducao === 'Agendado para Entrega' ? '🚚 Agendado Entrega' :
                             '🤝 Entregue'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex flex-col justify-center sm:items-end self-start sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-850 sm:pl-4">
                      <div className="text-xs text-zinc-500 uppercase select-none text-[10px]">Total: R$ {sale.total.toFixed(2)}</div>
                      {outstandingAmt > 0 ? (
                        <div className="text-xs font-bold text-red-400 mt-1 font-mono">
                          Falta: R$ {outstandingAmt.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5 stroke-[3px]" /> Pago total
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Action panel / Thermal design printing (5 cols) */}
      <div ref={deliveryReceiptRef} className="lg:col-span-5 space-y-6 scroll-mt-6">
        
        {successMessage && (
          <div className="bg-emerald-950/80 border border-emerald-800 rounded-xl p-4 text-emerald-200 text-xs font-medium text-center shadow-lg flex items-center gap-2 justify-center no-print">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 animate-bounce" />
            <span>{successMessage}</span>
          </div>
        )}

        {selectedSale ? (
          <div className="space-y-6">
            
            {/* Forgotten Order Warning Alert */}
            {isForgottenSale(selectedSale) && (
              <div className="bg-red-950/25 border border-red-800/40 rounded-xl p-4 mr-0.5 shadow-md flex items-start gap-2.5 text-red-200 text-xs animate-fade-in no-print">
                <span className="text-xl shrink-0 select-none">⚠️</span>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-red-300 uppercase text-[10.5px] tracking-wider">Alerta: Pedido Esquecido!</h4>
                  <p className="text-red-300/80 leading-relaxed text-[11px]">
                    Este pedido passou de <strong className="text-white">5 dias</strong> após a data de retirada cadastrada de ({selectedSale.dataRetirada ? new Date(selectedSale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : ''}).
                  </p>
                  <p className="text-zinc-400 text-[10px] leading-relaxed">
                    Contate o cliente no telefone <strong className="text-zinc-200 font-mono">{selectedSale.telefoneCliente || 'Não cadastrado'}</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Interactive Ficha de Entrega (Only for pending categories, or we display finished thermal) */}
            {isSalePending(selectedSale) ? (
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md no-print space-y-5">
                <div className="border-b border-zinc-800 pb-3 flex items-center gap-2">
                  <div className="p-1 text-red-400">
                    <Clock className="h-4.5 w-4.5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100 text-sm">Ficha de Liberação e Entrega</h3>
                    <p className="text-[10px] text-zinc-550">Resolva obrigações de caixa e registre a entrega</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="bg-black/60 border border-zinc-850 p-4 rounded-xl space-y-2">
                    <div className="flex justify-between text-xs text-zinc-450 border-b border-zinc-800 pb-1.5 leading-relaxed">
                      <span className="uppercase text-[10px] text-zinc-500 font-bold">Cliente</span>
                      <span className="text-zinc-200 font-semibold">{selectedSale.cliente}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-450 pt-0.5">
                      <span className="font-bold text-[10px] uppercase text-zinc-500">Valor Total</span>
                      <span className="font-semibold text-zinc-350 font-mono">R$ {selectedSale.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-450">
                      <span className="font-bold text-[10px] uppercase text-zinc-500">Valor Pago Pago Antecipado</span>
                      <span className="font-semibold text-emerald-500 font-mono">R$ {(selectedSale.valorPago ?? 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* LARGE BALANCE HIGHLIGHT */}
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider select-none">
                      Valor a Pagar no Ato da Entrega
                    </p>
                    <p className="text-3xl font-extrabold text-red-400 font-mono mt-1">
                      R$ {((selectedSale.valorFaltante !== undefined ? selectedSale.valorFaltante : 0)).toFixed(2)}
                    </p>
                  </div>

                  {/* ALTER DATA DE AGENDAMENTO OU RETIRADA */}
                  <div className="space-y-1.5 bg-zinc-950/45 border border-zinc-850 p-4 rounded-xl no-print">
                    <label className="block text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider select-none text-brand-pink flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>📅 DATA DE AGENDAMENTO / RETIRADA</span>
                    </label>
                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="date"
                        value={selectedSale.dataRetirada || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          playAppSound('click');
                          onUpdateSale({
                            ...selectedSale,
                            dataRetirada: val || undefined,
                            foiAlterado: true,
                            editadoEm: new Date().toISOString()
                          });
                        }}
                        className="bg-black text-zinc-100 border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-brand-pink flex-1 no-print"
                      />
                      {selectedSale.dataRetirada ? (
                        <span className="text-xs font-bold text-amber-500 font-mono bg-amber-955/10 border border-amber-900/35 px-2.5 py-1.5 rounded-xl">
                          {new Date(selectedSale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-zinc-500 italic bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-xl">
                          Não agendado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* INTERACTIVE PRODUCTION FLOW STATUS STEPPER */}
                  <div className="space-y-2 bg-black/45 border border-zinc-850 p-4 rounded-xl no-print">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5 select-none text-brand-pink">
                        🔨 FLUXO DE PRODUÇÃO INTERNA (STATUS)
                      </span>
                      <span className="text-[9px] font-mono text-zinc-500">
                        Clique para alterar o status
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-900">
                      {(['Agendado', 'Em Produção', 'Pronto para Retirada', 'Agendado para Entrega', 'Entregue'] as const).map((st) => {
                        const isCurrent = (selectedSale.statusProducao || 'Agendado') === st;
                        
                        // Pick beautiful custom colors for each status to make it colorful, vibrant, and incredibly clear!
                        let activeStyles = '';
                        let inactiveStyles = '';
                        let textLabel = '';
                        
                        switch (st) {
                          case 'Agendado':
                            activeStyles = 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)] border-blue-400';
                            inactiveStyles = 'text-blue-400/85 hover:text-blue-300 hover:bg-blue-950/20 border-blue-950/40';
                            textLabel = '📅 Agendado';
                            break;
                          case 'Em Produção':
                            activeStyles = 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.5)] border-amber-400 animate-pulse';
                            inactiveStyles = 'text-amber-400/85 hover:text-amber-300 hover:bg-amber-950/20 border-amber-950/40';
                            textLabel = '🔧 Em Produção';
                            break;
                          case 'Pronto para Retirada':
                            activeStyles = 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] border-emerald-400 font-extrabold';
                            inactiveStyles = 'text-emerald-400/85 hover:text-emerald-300 hover:bg-emerald-950/20 border-emerald-950/40';
                            textLabel = '✨ Pronto p/ Retirar';
                            break;
                          case 'Agendado para Entrega':
                            activeStyles = 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_12px_rgba(147,51,234,0.5)] border-purple-400 font-bold';
                            inactiveStyles = 'text-purple-400/85 hover:text-purple-300 hover:bg-purple-950/20 border-purple-950/40';
                            textLabel = '🚚 Agendado Entrega';
                            break;
                          case 'Entregue':
                            activeStyles = 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)] border-cyan-400';
                            inactiveStyles = 'text-cyan-400/85 hover:text-cyan-300 hover:bg-cyan-950/20 border-cyan-950/40';
                            textLabel = '🤝 Entregue';
                            break;
                        }

                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              const updated: Sale = {
                                ...selectedSale,
                                statusProducao: st,
                                ...(st === 'Entregue' || st === 'Agendado para Entrega' ? { 
                                  status: 'Pago total', 
                                  valorPagoAntesConcluir: selectedSale.valorPago ?? 0,
                                  valorFaltanteAntesConcluir: selectedSale.valorFaltante ?? (selectedSale.total - (selectedSale.valorPago ?? 0)),
                                  statusProducaoAntesConcluir: selectedSale.statusProducao || 'Agendado',
                                  valorFaltante: 0, 
                                  valorPago: selectedSale.total 
                                } : {}),
                                observacoesDesign: localObservacoes,
                              };
                              onUpdateSale(updated);
                              if (st === 'Entregue') {
                                sendWhatsAppDeliveryMessage(updated);
                              }
                            }}
                            className={`py-3 px-2 rounded-xl text-[11px] font-extrabold text-center transition-all duration-300 transform active:scale-95 border-2 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                              isCurrent
                                ? activeStyles
                                : `bg-black border-zinc-850 ${inactiveStyles}`
                            }`}
                            title={`Status de produção: ${st}`}
                          >
                            <span className="whitespace-nowrap leading-none">{textLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SELECTOR FOR TURNO DE ENTREGA IF STATUS IS AGENDADO PARA ENTREGA */}
                  {selectedSale.statusProducao === 'Agendado para Entrega' && (
                    <div className="space-y-1.5 bg-purple-950/20 border border-purple-900/40 p-4 rounded-xl no-print">
                      <label className="block text-[10px] text-purple-300 font-extrabold uppercase tracking-wider select-none">
                        ⏰ TURNO DE ENTREGA AGENDADO
                      </label>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            playAppSound('click');
                            onUpdateSale({
                              ...selectedSale,
                              turnoEntrega: 'Manhã',
                              foiAlterado: true,
                              editadoEm: new Date().toISOString()
                            });
                          }}
                          className={`py-2 px-4 rounded-xl text-xs font-black transition-all border cursor-pointer flex items-center justify-center gap-2 ${
                            selectedSale.turnoEntrega === 'Manhã'
                              ? 'bg-amber-600 text-white border-amber-500 font-black shadow-md shadow-amber-955/20'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-850 hover:border-zinc-700'
                          }`}
                        >
                          <span className="text-white font-black">☀️ Manhã</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playAppSound('click');
                            onUpdateSale({
                              ...selectedSale,
                              turnoEntrega: 'Tarde',
                              foiAlterado: true,
                              editadoEm: new Date().toISOString()
                            });
                          }}
                          className={`py-2 px-4 rounded-xl text-xs font-black transition-all border cursor-pointer flex items-center justify-center gap-2 ${
                            selectedSale.turnoEntrega === 'Tarde'
                              ? 'bg-orange-600 text-white border-orange-500 font-black shadow-md shadow-orange-955/20'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-850 hover:border-zinc-700'
                          }`}
                        >
                          <span className="text-white font-black">🌆 Tarde</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* INTERACTIVE CUSTOMER NOTES OR INSTRUCTIONS */}
                  <div className="space-y-1.5 bg-zinc-950/45 border border-zinc-850 p-4 rounded-xl no-print">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider select-none text-brand-pink">
                        📝 INSTRUÇÕES OU OBSERVAÇÕES DE RETIRADA/ENTREGA
                      </label>
                      {selectedSale.observacoesDesign !== localObservacoes && (
                        <span className="text-[9px] text-amber-400 font-bold animate-pulse">
                          ⚠️ Alterações pendentes
                        </span>
                      )}
                    </div>
                    <textarea
                      placeholder="Ex: Entregar após as 14h, embalar para presente, ou deixar na portaria..."
                      value={localObservacoes}
                      onChange={(e) => setLocalObservacoes(e.target.value)}
                      onBlur={() => {
                        onUpdateSale({
                          ...selectedSale,
                          observacoesDesign: localObservacoes
                        });
                      }}
                      className="w-full min-h-[55px] max-h-[140px] p-2 bg-black border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-brand-pink"
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSavingObs(true);
                          onUpdateSale({
                            ...selectedSale,
                            observacoesDesign: localObservacoes
                          });
                          setTimeout(() => {
                            setIsSavingObs(false);
                          }, 1000);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all duration-200 flex items-center gap-1.5 border ${
                          selectedSale.observacoesDesign === localObservacoes
                            ? 'bg-zinc-800/50 text-zinc-400 border-zinc-800/80'
                            : 'bg-brand-pink text-black font-extrabold shadow-md border-white/10 hover:scale-[1.01]'
                        }`}
                      >
                        {isSavingObs ? (
                          <>
                            <span className="animate-spin inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <>
                            <span>{selectedSale.observacoesDesign === localObservacoes ? '✓' : '💾'}</span>
                            <span>{selectedSale.observacoesDesign === localObservacoes ? 'Salvo na Nuvem' : 'Salvar Instruções'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <form onSubmit={handleConfirmDeliveryAndPayment} className="space-y-4">
                    {/* Method selector */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-zinc-400">
                        Forma de Pagamento da Entrega: <span className="text-brand-pink font-bold">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {paymentMethods.map((m) => {
                          const isSelected = deliveryPaymentMethod === m.value;
                          return (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => setDeliveryPaymentMethod(m.value)}
                              className={`py-2 px-1.5 rounded-lg text-center border transition-all text-[10px] flex flex-col items-center justify-center gap-1 cursor-pointer ${
                                isSelected
                                  ? 'border-brand-pink bg-brand-pink/15 text-brand-pink font-bold shadow-xs'
                                  : 'border-zinc-850 text-zinc-450 hover:bg-zinc-950/40'
                              }`}
                            >
                              <span className="text-sm">{m.icon}</span>
                              <span className="whitespace-nowrap">{m.value}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit Confirmation button */}
                    <button
                      type="submit"
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer transform active:scale-98"
                    >
                      <span>🚚</span>
                      <span>Registrar Entrega e Receber Saldo</span>
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs no-print">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold animate-pulse">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-200 text-xs">Pedido Pago Total</h4>
                    <p className="text-[10px] text-emerald-400 font-medium">Histórico financeiro resolvido integralmente.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const confirmUndo = window.confirm(`Deseja desfazer a conclusão e entrega do pedido de ${selectedSale.cliente}? O pedido voltará para o status Pendente com seu saldo anterior.`);
                    if (confirmUndo) {
                      const prevValorPago = selectedSale.valorPagoAntesConcluir !== undefined 
                        ? selectedSale.valorPagoAntesConcluir 
                        : (selectedSale.valoresOriginais?.valorPago !== undefined ? selectedSale.valoresOriginais.valorPago : Math.max(0, selectedSale.total - (selectedSale.valoresOriginais?.valorFaltante ?? 0)));

                      const prevValorFaltante = selectedSale.valorFaltanteAntesConcluir !== undefined 
                        ? selectedSale.valorFaltanteAntesConcluir 
                        : (selectedSale.valoresOriginais?.valorFaltante !== undefined ? selectedSale.valoresOriginais.valorFaltante : Math.max(0, selectedSale.total - prevValorPago));

                      onUpdateSale({
                        ...selectedSale,
                        status: 'Pendente',
                        valorPago: prevValorPago,
                        valorFaltante: prevValorFaltante,
                        statusProducao: selectedSale.statusProducaoAntesConcluir || 'Pronto para Retirada',
                        foiAlterado: true,
                        editadoEm: new Date().toISOString()
                      });
                      
                      setSuccessMessage("Mudança desfeita com sucesso! Retornando para lista de pendentes.");
                      setTimeout(() => setSuccessMessage(''), 3000);
                    }
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 text-zinc-300 border border-zinc-750 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                >
                  <span>↩️ Desfazer Entrega</span>
                </button>
              </div>
            )}

            {/* Always display thermal template printable receipt below / instead */}
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-550 font-bold uppercase block px-1 no-print">Visualização do Recibo Imprimível</span>
              <Receipt sale={selectedSale} storeInfo={storeInfo} onUpdateSale={onUpdateSale} />
            </div>

          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-850 border-dashed p-10 text-center text-zinc-500 min-h-[400px] flex flex-col items-center justify-center">
            <Truck className="h-10 w-10 text-zinc-750 stroke-1 mb-3" />
            <p className="font-semibold text-zinc-400 text-xs">Nenhum Pedido Selecionado</p>
            <p className="text-[10px] text-zinc-600 max-w-[200px] mx-auto mt-1 leading-normal">
              Selecione um pedido pendente ou concluído na listagem ao lado para gerenciar sua entrega ou re-imprimir o recibo finalizado.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
