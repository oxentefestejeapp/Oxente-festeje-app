/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Users, Calendar, DollarSign, Wallet, FileText, CheckCircle2, RotateCcw, Search, Phone, Pencil, X, Plus, Trash2, MessageSquare, Check, CheckSquare, TrendingUp, TrendingDown, Sparkles, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Product, Sale, PaymentMethod, StoreInfo, SaleItem, getProductUnitPrice } from '../types';
import { Receipt } from './Receipt';
import { WhatsAppNotifier } from './WhatsAppNotifier';
import { playAppSound, getIsAudioMuted, setAudioMuted } from '../lib/audio';
import { dbSupabase } from '../lib/supabase';

interface SalesManagerProps {
  products: Product[];
  sales: Sale[];
  storeInfo: StoreInfo;
  onRecordSale: (sale: Sale) => void;
  onUpdateStock: (id: string, newStock: number) => void;
  onUpdateSale?: (updatedSale: Sale) => void;
  onDeleteSale?: (id: string) => Promise<boolean>;
  currentUserEmail?: string;
}

const paymentMethods: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'Pix', label: 'Pix (Instantâneo)', icon: '⚡' },
  { value: 'Dinheiro', label: 'Dinheiro físico', icon: '💵' },
  { value: 'Cartão de Crédito', label: 'Cartão de Crédito', icon: '💳' },
  { value: 'Cartão de Débito', label: 'Cartão de Débito', icon: '🏦' },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg shadow-xl text-xs font-sans">
        <p className="text-zinc-400 font-medium mb-1">Dia {payload[0].payload.date}</p>
        <p className="text-brand-pink font-bold text-sm">
          R$ {payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

// Helper to calculate the progressive quantity for items in cart with different colors of the same product
export function getCartItemEffectiveQty(
  item: { product: { id: string }; quantity: number; corSelecionada?: string },
  cartList: { product: { id: string }; quantity: number; corSelecionada?: string }[]
): number {
  const sameProductItems = cartList.filter(i => i.product.id === item.product.id);
  
  if (sameProductItems.length <= 1) {
    return item.quantity;
  }
  
  const colors = sameProductItems.map(i => i.corSelecionada || '');
  const uniqueColors = Array.from(new Set(colors));
  
  if (uniqueColors.length <= 1) {
    return item.quantity;
  }

  const differentColorSum = sameProductItems
    .filter(i => i.corSelecionada !== item.corSelecionada)
    .reduce((sum, i) => sum + i.quantity, 0);

  return item.quantity + differentColorSum;
}

export function SalesManager({ products, sales, storeInfo, onRecordSale, onUpdateStock, onUpdateSale, onDeleteSale, currentUserEmail = '' }: SalesManagerProps) {
  const isAdmin = currentUserEmail.trim().toLowerCase() === 'oxentefesteje@gmail.com' || currentUserEmail.trim().toLowerCase() === 'abraaoapp@oxente.com';
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [billingPeriod, setBillingPeriod] = useState<7 | 15 | 30>(7);
  const [cliente, setCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [quantidade, setQuantidade] = useState<number | ''>(1);
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>('Pix');
  const [valorPagoInput, setValorPagoInput] = useState('');
  const [numeroPedido, setNumeroPedido] = useState('');
  const [pedidoVinculoNumero, setPedidoVinculoNumero] = useState('');
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [dataRetirada, setDataRetirada] = useState('');
  const [statusProducao, setStatusProducao] = useState<'Agendado' | 'Em Produção' | 'Pronto para Retirada' | 'Entregue'>('Agendado');
  const [registroTipo, setRegistroTipo] = useState<'Venda' | 'Orçamento'>('Venda');
  
  // Advanced plugins: Sound effects (synchronized with master mute), Preset Discounts, and Catalog Filters
  const [soundEnabled, setSoundEnabled] = useState(() => !getIsAudioMuted());

  useEffect(() => {
    const handleMuteChange = (e: any) => {
      setSoundEnabled(!e.detail);
    };
    window.addEventListener('oxente_app_audio_mute_changed', handleMuteChange);
    return () => {
      window.removeEventListener('oxente_app_audio_mute_changed', handleMuteChange);
    };
  }, []);

   const [descontoPercent, setDescontoPercent] = useState<number>(0);
  const [customPctInput, setCustomPctInput] = useState('');
  const [customValInput, setCustomValInput] = useState('');

  // Referral / Cupom states
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isReferralApplied, setIsReferralApplied] = useState(false);
  const [appliedCouponPercentage, setAppliedCouponPercentage] = useState<number>(5);
  const [referralMatchSuccess, setReferralMatchSuccess] = useState<string | null>(null);
  const [referralMatchError, setReferralMatchError] = useState<string | null>(null);

  // Spent cashback applied as discount on indicator's own new purchase
  const [appliedCashbackDiscount, setAppliedCashbackDiscount] = useState(0);

  // Spent referral notification after sale finalization
  const [referralNotificationInfo, setReferralNotificationInfo] = useState<{
    indicatorName: string;
    indicatorPhone: string;
    indicatedName: string;
    referralCode: string;
  } | null>(null);

  // Dynamically calculate the active client's available accumulated referral discount percentage from prior indicators
  const clientCashbackBalance = useMemo(() => {
    const cleanClient = cliente.trim().toLowerCase();
    const cleanPhone = telefoneCliente.replace(/\D/g, '');
    
    if (!cleanClient && !cleanPhone) return 0;
    
    // Find previous sales belonging to this client (exclude budgets, but check all-time orders)
    const clientPreviousSales = sales.filter(s => {
      if (s.status === 'Orçamento') return false;
      const matchByName = cleanClient.length >= 3 && s.cliente && s.cliente.trim().toLowerCase() === cleanClient;
      const matchByPhone = cleanPhone.length >= 8 && s.telefoneCliente && s.telefoneCliente.replace(/\D/g, '') === cleanPhone;
      return matchByName || matchByPhone;
    });
    
    if (clientPreviousSales.length === 0) return 0;
    
    // Generate codes for these sales
    const clientCodes = clientPreviousSales.map(s => {
      const firstName = s.cliente.trim().split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase();
      const pedNum = s.numeroPedido || s.id.substring(s.id.length - 5).toUpperCase();
      return `${firstName}${pedNum}`;
    });
    
    // Count how many unique times referred friends used their codes and made a purchase
    let totalReferralsEarned = 0;
    sales.forEach(s => {
      if (s.status === 'Orçamento') return;
      if (s.indicadoCodigo) {
        const codeUsed = s.indicadoCodigo.trim().toUpperCase();
        if (clientCodes.includes(codeUsed)) {
          const isOwnOrder = clientPreviousSales.some(ps => ps.id === s.id);
          if (!isOwnOrder) {
            totalReferralsEarned += 1;
          }
        }
      }
    });
    
    // Calculate referrals spent by this client in their past sales (cashbackGasto stores the percentage like 5, 10, or 15)
    let totalReferralsSpent = 0;
    clientPreviousSales.forEach(s => {
      if (s.cashbackGasto) {
        totalReferralsSpent += (s.cashbackGasto / 5);
      }
    });
    
    const availableReferrals = Math.max(0, totalReferralsEarned - totalReferralsSpent);
    const availableDiscountPercent = Math.min(15, availableReferrals * 5);
    
    return availableDiscountPercent;
  }, [cliente, telefoneCliente, sales]);

  const playSound = (type: 'add' | 'remove' | 'success') => {
    if (getIsAudioMuted()) return;
    if (type === 'add') {
      playAppSound('pop');
    } else if (type === 'remove') {
      playAppSound('trash');
    } else if (type === 'success') {
      playAppSound('complete');
    }
  };

  const toggleSound = () => {
    const currentMuted = getIsAudioMuted();
    const nextMuted = !currentMuted;
    setAudioMuted(nextMuted);
    setSoundEnabled(!nextMuted);
    if (!nextMuted) {
      setTimeout(() => {
        playAppSound('success');
      }, 50);
    }
  };
  
  // Cart state for multi-product orders
  const [cart, setCart] = useState<{ id: string; product: Product; quantity: number; total: number; addons: Product[]; corSelecionada?: string }[]>([]);

  // Selected Addon Product IDs
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // State to show/hide optional addons list
  const [showAddons, setShowAddons] = useState(false);

  // State for Arte do design service option
  const [arteDesign, setArteDesign] = useState(false);

  // State for Segunda Arte service option
  const [segundaArte, setSegundaArte] = useState(false);

  // State for Taxa de Urgência option
  const [temTaxaUrgencia, setTemTaxaUrgencia] = useState(false);
  const [valorTaxaUrgencia, setValorTaxaUrgencia] = useState('');

  // State for Taxa do Cartão option
  const [temTaxaCartao, setTemTaxaCartao] = useState(false);
  const [valorTaxaCartao, setValorTaxaCartao] = useState('');

  // State to show/hide services and taxes list (registration)
  const [showServicosTaxas, setShowServicosTaxas] = useState(false);

  // Track annotated (notified) sales via localStorage key for cross-session consistency on their device
  const [annotatedSaleIds, setAnnotatedSaleIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('oxente_annotated_sale_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const markSaleAsAnnotated = (saleId: string) => {
    setAnnotatedSaleIds(prev => {
      if (prev.includes(saleId)) return prev;
      const next = [...prev, saleId];
      try {
        localStorage.setItem('oxente_annotated_sale_ids', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Reset selected addons when selected product changes
  useEffect(() => {
    setSelectedAddonIds([]);
    setShowAddons(false);
    setSelectedColor('');
  }, [selectedProductId]);

  // Safeguard: reset or cap applied cashback discount when customer changes or balance changes
  useEffect(() => {
    if (clientCashbackBalance === 0) {
      setAppliedCashbackDiscount(0);
    } else if (appliedCashbackDiscount > clientCashbackBalance) {
      setAppliedCashbackDiscount(clientCashbackBalance);
    }
  }, [clientCashbackBalance, appliedCashbackDiscount]);

  // States for editing a sale
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleIdToDelete, setSaleIdToDelete] = useState<string | null>(null);
  const [saleDeletePassword, setSaleDeletePassword] = useState('');
  const [isDeletingSaleId, setIsDeletingSaleId] = useState<string | null>(null);
  const [editCliente, setEditCliente] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editNumeroPedido, setEditNumeroPedido] = useState('');
  const [editPedidoVinculoNumero, setEditPedidoVinculoNumero] = useState('');
  const [editFormaPagamento, setEditFormaPagamento] = useState<PaymentMethod>('Pix');
  const [editValorPago, setEditValorPago] = useState('');
  const [editDataRetirada, setEditDataRetirada] = useState('');
  const [editStatusProducao, setEditStatusProducao] = useState<'Agendado' | 'Em Produção' | 'Pronto para Retirada' | 'Entregue'>('Agendado');
  const [editConvertToOrder, setEditConvertToOrder] = useState(false);

  const [editItens, setEditItens] = useState<SaleItem[]>([]);
  const [selectedAddProductId, setSelectedAddProductId] = useState('');
  const [editArteDesign, setEditArteDesign] = useState(false);
  const [editSegundaArte, setEditSegundaArte] = useState(false);
  const [editTemTaxaUrgencia, setEditTemTaxaUrgencia] = useState(false);
  const [editValorTaxaUrgencia, setEditValorTaxaUrgencia] = useState('');
  const [editTemTaxaCartao, setEditTemTaxaCartao] = useState(false);
  const [editValorTaxaCartao, setEditValorTaxaCartao] = useState('');
  const [editShowServicosTaxas, setEditShowServicosTaxas] = useState(false);

  const editTotal = useMemo(() => {
    const artVal = editArteDesign ? 5 : 0;
    const segundaArtVal = editSegundaArte ? 5 : 0;
    const urgVal = editTemTaxaUrgencia ? (parseFloat(editValorTaxaUrgencia) || 0) : 0;
    const cartaoVal = editTemTaxaCartao ? (parseFloat(editValorTaxaCartao) || 0) : 0;
    return editItens.reduce((sum, item) => sum + (item.precoUn * item.quantidade), 0) + artVal + segundaArtVal + urgVal + cartaoVal;
  }, [editItens, editArteDesign, editSegundaArte, editTemTaxaUrgencia, editValorTaxaUrgencia, editTemTaxaCartao, editValorTaxaCartao]);

  // Sync edit states when editingSale shifts
  React.useEffect(() => {
    if (editingSale) {
      setEditCliente(editingSale.cliente);
      setEditTelefone(editingSale.telefoneCliente || '');
      setEditNumeroPedido(editingSale.numeroPedido || '');
      setEditPedidoVinculoNumero(editingSale.pedidoVinculoNumero || '');
      setEditFormaPagamento(editingSale.formaPagamento);
      setEditValorPago(editingSale.valorPago !== undefined ? editingSale.valorPago.toString() : editingSale.total.toString());
      setEditDataRetirada(editingSale.dataRetirada || '');
      setEditStatusProducao(editingSale.statusProducao || 'Agendado');
      setEditConvertToOrder(false);

      let rawItens: SaleItem[] = [];
      if (editingSale.itens && editingSale.itens.length > 0) {
        rawItens = editingSale.itens.map(item => ({ ...item }));
      } else {
        rawItens = [{
          id: `item-${editingSale.produtoId || '1'}-${Date.now()}`,
          produtoId: editingSale.produtoId || '',
          produtoNome: editingSale.produtoNome || '',
          precoUn: editingSale.precoUn || 0,
          quantidade: editingSale.quantidade || 1,
          total: (editingSale.precoUn || 0) * (editingSale.quantidade || 1)
        }];
      }

      const hasArte = rawItens.some(item => item.produtoId === 'artedesign-service');
      const hasSegundaArte = rawItens.some(item => item.produtoId === 'segundaarte-service');
      const urgenciaItem = rawItens.find(item => item.produtoId === 'taxaurgencia-service');
      const cartaoItem = rawItens.find(item => item.produtoId === 'taxacartao-service');

      setEditArteDesign(hasArte);
      setEditSegundaArte(hasSegundaArte);
      if (urgenciaItem) {
        setEditTemTaxaUrgencia(true);
        setEditValorTaxaUrgencia(String(urgenciaItem.precoUn));
      } else {
        setEditTemTaxaUrgencia(false);
        setEditValorTaxaUrgencia('');
      }

      if (cartaoItem) {
        setEditTemTaxaCartao(true);
        setEditValorTaxaCartao(String(cartaoItem.precoUn));
      } else {
        setEditTemTaxaCartao(false);
        setEditValorTaxaCartao('');
      }

      setEditItens(rawItens.filter(item => item.produtoId !== 'artedesign-service' && item.produtoId !== 'segundaarte-service' && item.produtoId !== 'taxaurgencia-service' && item.produtoId !== 'taxacartao-service'));
    }
  }, [editingSale]);
  
  // Keep track of the active sale being simulated in the receipt section
  const [viewedSale, setViewedSale] = useState<Sale | null>(
    sales.length > 0 ? sales[sales.length - 1] : null
  );

  React.useEffect(() => {
    if (viewedSale) {
      const fresh = sales.find(s => s.id === viewedSale.id);
      if (fresh) {
        setViewedSale(fresh);
      }
    }
  }, [sales]);

  const receiptColRef = React.useRef<HTMLDivElement>(null);

  const handleSelectSaleForReceipt = (sale: Sale) => {
    setViewedSale(sale);
    setTimeout(() => {
      receiptColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // States for WhatsApp notifying
  const [whatsAppSale, setWhatsAppSale] = useState<Sale | null>(null);

  // States for Date filtering
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'this_month' | 'custom'>('all');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  // State for green closed orders metric start date (custom selector)
  const [metricStartDate, setMetricStartDate] = useState<string>(() => {
    const local = new Date();
    const year = local.getFullYear();
    const month = String(local.getMonth() + 1).padStart(2, '0');
    const day = String(local.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // 10 sales at a time with scrollable dynamic loading
  const [visibleSalesCount, setVisibleSalesCount] = useState(10);

  useEffect(() => {
    setVisibleSalesCount(10);
  }, [salesSearchTerm, dateFilter, startDateStr, endDateStr]);

  // Get filtered sales history by client, product name, or receipt order number, and period
  const filteredSales = sales.filter((sale) => {
    if (sale.status === 'Orçamento') return false;
    // 1. Period Date filtering
    try {
      const saleDate = new Date(sale.data);
      const now = new Date();
      
      if (dateFilter === 'today') {
        const isToday = saleDate.toDateString() === now.toDateString();
        if (!isToday) return false;
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = saleDate.toDateString() === yesterday.toDateString();
        if (!isYesterday) return false;
      } else if (dateFilter === '7days') {
        const diffTime = Math.abs(now.getTime() - saleDate.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      } else if (dateFilter === 'this_month') {
        const isSameMonthYear = saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        if (!isSameMonthYear) return false;
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
      console.error(e);
    }

    // 2. Text Search filtering
    const term = salesSearchTerm.toLowerCase().trim();
    if (!term) {
      return true;
    }
    
    const matchName = sale.cliente.toLowerCase().includes(term);
    const matchProduct = sale.produtoNome.toLowerCase().includes(term);
    const matchOrderNum = sale.numeroPedido ? sale.numeroPedido.toLowerCase().includes(term) : false;
    const matchPhone = sale.telefoneCliente ? sale.telefoneCliente.replace(/\D/g, '').includes(term.replace(/\D/g, '')) : false;
    
    return matchName || matchProduct || matchOrderNum || matchPhone;
  });

  // Filter out delivered sales that are older than 15 days from the list, unless there is an active search term
  const displayedSales = useMemo(() => {
    const term = salesSearchTerm.toLowerCase().trim();
    return filteredSales.filter(sale => {
      if (!term) {
        if (sale.statusProducao === 'Entregue') {
          try {
            const saleDate = new Date(sale.data);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - saleDate.getTime());
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            if (diffDays > 15) return false;
          } catch {
            // fail safe
          }
        }
      }
      return true;
    });
  }, [filteredSales, salesSearchTerm]);

  // Filter and Sort products that are available in stock (simplified to alphabetical order)
  const availableProducts = useMemo(() => {
    let list = products.filter(p => !p.adicional && (p.estoque > 0 || p.estoqueInfinito));
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [products]);

  // Filter and Sort addon products that are available in stock
  const availableAddons = useMemo(() => {
    let list = products.filter(p => p.adicional && (p.estoque > 0 || p.estoqueInfinito));
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [products]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const totalVendaSemDesconto = useMemo(() => {
    const urgenciaVal = temTaxaUrgencia ? (parseFloat(valorTaxaUrgencia) || 0) : 0;
    const cartaoVal = temTaxaCartao ? (parseFloat(valorTaxaCartao) || 0) : 0;
    const secondArtVal = segundaArte ? 5 : 0;
    if (cart.length > 0) {
      const cartTotal = cart.reduce((sum, item) => {
        const effectiveQty = getCartItemEffectiveQty(item, cart);
        const unitPrice = getProductUnitPrice(item.product, effectiveQty);
        const addonsUnitPrice = item.addons ? item.addons.reduce((s, addon) => s + getProductUnitPrice(addon, effectiveQty), 0) : 0;
        return sum + (item.quantity * (unitPrice + addonsUnitPrice));
      }, 0);
      return cartTotal + (arteDesign ? 5 : 0) + secondArtVal + urgenciaVal + cartaoVal;
    }
    const mainTotal = selectedProduct && typeof quantidade === 'number' 
      ? getProductUnitPrice(selectedProduct, quantidade) * quantidade 
      : 0;

    const addonsTotal = selectedAddonIds.reduce((sum, addonId) => {
      const addon = products.find(p => p.id === addonId);
      if (addon && typeof quantidade === 'number') {
        const addonPrice = getProductUnitPrice(addon, quantidade);
        return sum + (addonPrice * quantidade);
      }
      return sum;
    }, 0);

    return mainTotal + addonsTotal + (arteDesign ? 5 : 0) + secondArtVal + urgenciaVal + cartaoVal;
  }, [cart, selectedProduct, quantidade, selectedAddonIds, products, arteDesign, segundaArte, temTaxaUrgencia, valorTaxaUrgencia, temTaxaCartao, valorTaxaCartao]);

  // Sincronizar o desconto calculado quando o valor total sem desconto mudar e houver desconto digitado em valor fixo R$
  useEffect(() => {
    if (customValInput !== '' && totalVendaSemDesconto > 0) {
      const parsed = parseFloat(customValInput);
      if (!isNaN(parsed)) {
        const equivPct = (parsed / totalVendaSemDesconto) * 100;
        setDescontoPercent(Math.min(100, Math.max(0, equivPct)));
      }
    }
  }, [totalVendaSemDesconto, customValInput]);

  const referralDiscountApplied = useMemo(() => {
    return isReferralApplied ? Number((totalVendaSemDesconto * (appliedCouponPercentage / 100)).toFixed(2)) : 0;
  }, [isReferralApplied, totalVendaSemDesconto, appliedCouponPercentage]);

  const handleValidateReferralCode = (code: string, isSilent = false) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      if (!isSilent) {
        setReferralMatchSuccess(null);
        setReferralMatchError(null);
        setIsReferralApplied(false);
      }
      return;
    }

    // Suporte para cupons comerciais / promocionais estáticos da loja
    const staticCoupons: { [key: string]: { pct: number, label: string } } = {
      'OXENTE5': { pct: 5, label: 'Cupom Oxente 5% de Desconto!' },
      'OXENTE10': { pct: 10, label: 'Cupom Oxente 10% de Desconto!' },
      'OXENTE15': { pct: 15, label: 'Cupom Oxente 15% de Desconto!' },
      'DESCONTO5': { pct: 5, label: 'Cupom Especial 5% de Desconto!' },
      'DESCONTO10': { pct: 10, label: 'Cupom Especial 10% de Desconto!' },
      'DESCONTO15': { pct: 15, label: 'Cupom Especial 15% de Desconto!' },
      'BOASVINDAS5': { pct: 5, label: 'Cupom Boas-vindas 5% de Desconto!' },
      'BOASVINDAS10': { pct: 10, label: 'Cupom Boas-vindas 10% de Desconto!' },
      'FESTEJE5': { pct: 5, label: 'Cupom Festeje 5% de Desconto!' },
      'FESTEJE10': { pct: 10, label: 'Cupom Festeje 10% de Desconto!' },
      'CUPOM5': { pct: 5, label: 'Cupom Especial de Cliente 5% Off!' },
      'CUPOM10': { pct: 10, label: 'Cupom Especial de Cliente 10% Off!' },
    };

    if (staticCoupons[cleanCode]) {
      const coupon = staticCoupons[cleanCode];
      setReferralMatchSuccess(`Cupom ativo: ${coupon.label}`);
      setReferralMatchError(null);
      setAppliedCouponPercentage(coupon.pct);
      setIsReferralApplied(true);
      if (!isSilent) {
        playSound('success');
      }
      return;
    }

    const matchedSale = sales.find(s => {
      if (!s.cliente) return false;
      const firstName = s.cliente.trim().split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase();
      const pedNum = s.numeroPedido || s.id.substring(s.id.length - 5).toUpperCase();
      const computedCode = `${firstName}${pedNum}`;
      return computedCode === cleanCode;
    });

    if (matchedSale) {
      setReferralMatchSuccess(`Indicação válida! Você ganhou 5% de desconto de indicado na hora! E "${matchedSale.cliente}" acumulará créditos de desconto (+5%)!`);
      setReferralMatchError(null);
      setAppliedCouponPercentage(5);
      setIsReferralApplied(true);
      if (!isSilent) {
        playSound('success');
      }
    } else {
      if (!isSilent) {
        setReferralMatchSuccess(null);
        setReferralMatchError('Código de indicação ou cupom não encontrado.');
        setIsReferralApplied(false);
      }
    }
  };

  // Efeito elegante de validação automática silenciosa ao digitar o cupom
  useEffect(() => {
    if (referralCodeInput) {
      handleValidateReferralCode(referralCodeInput, true);
    } else {
      setIsReferralApplied(false);
      setReferralMatchSuccess(null);
      setReferralMatchError(null);
    }
  }, [referralCodeInput, sales]);

  const totalVenda = useMemo(() => {
    let finalPrice = totalVendaSemDesconto;
    
    // 1. Manual percentage discount (descontoPercent)
    finalPrice = finalPrice * (1 - descontoPercent / 100);
    
    // 2. Referred code or Promo coupon discount
    if (isReferralApplied) {
      finalPrice = finalPrice - (totalVendaSemDesconto * (appliedCouponPercentage / 100));
    }
    
    // 3. Accumulated referrer discount (e.g. 5%, 10%, 15% applied to their own order)
    if (appliedCashbackDiscount > 0) {
      finalPrice = finalPrice - (totalVendaSemDesconto * (appliedCashbackDiscount / 100));
    }
    
    return Number(Math.max(0, finalPrice).toFixed(2));
  }, [totalVendaSemDesconto, descontoPercent, isReferralApplied, appliedCouponPercentage, appliedCashbackDiscount]);

  // Calcule o faturamento diário para o período selecionado de dias
  const getDailyRevenueData = (days: number) => {
    const dataMap: { [dateStr: string]: number } = {};
    
    // Inicializar os últimos dias com 0 (em ordem cronológica)
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dataMap[dateStr] = 0;
    }
    
    // Preencher as vendas reais
    sales.forEach(sale => {
      if (sale.status === 'Orçamento') return;
      try {
        const saleDate = new Date(sale.data);
        if (!isNaN(saleDate.getTime())) {
          const dateStr = saleDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          if (dataMap[dateStr] !== undefined) {
             dataMap[dateStr] += sale.total;
          }
        }
      } catch (err) {
        console.error(err);
      }
    });
    
    // Mapear para o formato do Recharts
    return Object.keys(dataMap).map(date => ({
      date,
      value: Number(dataMap[date].toFixed(2))
    }));
  };

  const chartData = useMemo(() => getDailyRevenueData(billingPeriod), [sales, billingPeriod]);

  // Premium widgets metrics
  const todayRevenue = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const match = chartData.find(d => d.date === todayStr);
    return match ? match.value : 0;
  }, [chartData]);

  const averageDailyRevenue = useMemo(() => {
    if (chartData.length === 0) return 0;
    const total = chartData.reduce((acc, curr) => acc + curr.value, 0);
    return Number((total / chartData.length).toFixed(2));
  }, [chartData]);

  const peakRevenueDay = useMemo(() => {
    if (chartData.length === 0) return { date: '-', value: 0 };
    return chartData.reduce((max, curr) => (curr.value > max.value ? curr : max), { date: '-', value: 0 });
  }, [chartData]);

  const activeOrdersCount = useMemo(() => {
    return sales.filter(s => s.status !== 'Orçamento' && s.statusProducao !== 'Entregue').length;
  }, [sales]);

  const handleAddToCart = () => {
    if (!selectedProductId) {
      setFormError('Selecione um produto para adicionar ao carrinho.');
      return;
    }
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) {
      setFormError('Produto selecionado inválido.');
      return;
    }

    const qtyNum = Number(quantidade);
    if (quantidade === '' || isNaN(qtyNum) || qtyNum < 1) {
      setFormError('A quantidade precisa ser de no mínimo 1.');
      return;
    }

    // Color option validation
    if (prod.cores && prod.cores.length > 0 && !selectedColor) {
      setFormError('Este produto possui opções de cores. Por favor, selecione uma cor antes de adicionar.');
      return;
    }

    // Stock checks considering color variations
    if (registroTipo !== 'Orçamento' && !prod.estoqueInfinito) {
      if (prod.cores && prod.cores.length > 0) {
        const matchingColor = prod.cores.find(c => c.nome === selectedColor);
        const colorStock = matchingColor ? matchingColor.estoque : 0;
        const alreadyInCartColorQty = cart
          .filter(item => item.product.id === prod.id && item.corSelecionada === selectedColor)
          .reduce((sum, item) => sum + item.quantity, 0);

        if ((qtyNum + alreadyInCartColorQty) > colorStock) {
          setFormError(`Quantidade indisponível para a cor "${selectedColor}"! Estoque atual dessa cor: ${colorStock} un. (Já possui ${alreadyInCartColorQty} no carrinho).`);
          return;
        }
      } else {
        const alreadyInCartQty = cart
          .filter(item => item.product.id === prod.id)
          .reduce((sum, item) => sum + item.quantity, 0);

        if ((qtyNum + alreadyInCartQty) > prod.estoque) {
          setFormError(`Quantidade indisponível no estoque! Estoque atual de "${prod.nome}": ${prod.estoque} un. (Já possui ${alreadyInCartQty} no carrinho).`);
          return;
        }
      }
    }

    setFormError('');

    // Prepara os addons selecionados atualmente
    const currentAddons = selectedAddonIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is Product => !!p);

    // Valida estoque dos adicionais
    if (registroTipo !== 'Orçamento') {
      for (const addon of currentAddons) {
        if (!addon.estoqueInfinito && qtyNum > addon.estoque) {
          setFormError(`Quantidade do adicional "${addon.nome}" indisponível! Estoque atual: ${addon.estoque} un.`);
          return;
        }
      }
    }

    const unitPrice = getProductUnitPrice(prod, qtyNum);
    const addonsUnitPrice = currentAddons.reduce((sum, addon) => sum + getProductUnitPrice(addon, qtyNum), 0);
    const uniqueIdSuffix = Math.random().toString(36).substring(2, 7);
    
    setCart([
      ...cart,
      {
        id: `item-${prod.id}-${selectedColor ? `${selectedColor}-` : ''}${Date.now()}-${uniqueIdSuffix}`,
        product: prod,
        quantity: qtyNum,
        total: qtyNum * (unitPrice + addonsUnitPrice),
        addons: currentAddons,
        corSelecionada: selectedColor || undefined
      }
    ]);

    // Play subtle audio cue
    playSound('add');

    // Reset single item selector fields
    setSelectedProductId('');
    setSelectedColor('');
    setQuantidade(1);
    setSelectedAddonIds([]);
    setSuccessMsg(`"${prod.nome}"${selectedColor ? ` (${selectedColor})` : ''} adicionado ao carrinho!`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleRegisterSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!cliente.trim() || cliente.trim().toLowerCase() === 'consumidor') {
      setFormError('Por favor, informe o nome do consumidor. Esse dado é obrigatório para fechar o pedido e não pode ser "Consumidor".');
      return;
    }

    if (cart.length === 0 && !selectedProductId) {
      setFormError('Por favor, selecione um produto ou adicione itens ao carrinho. A escolha de um produto é obrigatória para fechar o pedido.');
      return;
    }

    if (!telefoneCliente.trim()) {
      setFormError('Por favor, informe o telefone do cliente. Esse dado é obrigatório para notificações e para o recibo.');
      return;
    }

    if (!dataRetirada.trim()) {
      setFormError('Por favor, escolha a data de retirada. Esse dado é obrigatório para notificações, agendamentos e para o recibo.');
      return;
    }

    if (registroTipo !== 'Orçamento' && valorPagoInput.trim() === '') {
      setFormError('Por favor, informe o valor pago pelo cliente (digite 0 caso ele não tenha pago nenhum sinal ou valor inicial ainda).');
      return;
    }

    let finalItens: SaleItem[] = [];

    if (cart.length > 0) {
      const itemsList: SaleItem[] = [];
      for (const item of cart) {
        // Adiciona o produto principal com corSelecionada e preço progressivo
        const effectiveQty = getCartItemEffectiveQty(item, cart);
        const mainUnitPrice = getProductUnitPrice(item.product, effectiveQty);
        itemsList.push({
          id: item.id,
          produtoId: item.product.id,
          produtoNome: item.product.nome,
          precoUn: mainUnitPrice,
          quantidade: item.quantity,
          total: mainUnitPrice * item.quantity,
          corSelecionada: item.corSelecionada
        });

        // Adiciona os adicionais deste item do carrinho
        if (item.addons && item.addons.length > 0) {
          for (const addon of item.addons) {
            const addonPrice = getProductUnitPrice(addon, effectiveQty);
            itemsList.push({
              id: `item-${addon.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              produtoId: addon.id,
              produtoNome: `Adicional: ${addon.nome}`,
              precoUn: addonPrice,
              quantidade: item.quantity,
              total: addonPrice * item.quantity
            });
          }
        }
      }
      finalItens = itemsList;
    } else {
      if (!selectedProduct) {
        setFormError('Produto não encontrado no banco de dados.');
        return;
      }
      const qtyNum = Number(quantidade);
      if (quantidade === '' || isNaN(qtyNum) || qtyNum < 1) {
        setFormError('A quantidade da venda precisa ser de no mínimo 1 item.');
        return;
      }
      if (registroTipo !== 'Orçamento' && !selectedProduct.estoqueInfinito && qtyNum > selectedProduct.estoque) {
        setFormError(`Quantidade indisponível no estoque! Estoque atual de "${selectedProduct.nome}": ${selectedProduct.estoque} un.`);
        return;
      }

      const addonItems: SaleItem[] = [];
      for (const addonId of selectedAddonIds) {
        const addon = products.find(p => p.id === addonId);
        if (addon) {
          if (registroTipo !== 'Orçamento' && !addon.estoqueInfinito && qtyNum > addon.estoque) {
            setFormError(`Quantidade de adicional indisponível! Estoque do adicional "${addon.nome}": ${addon.estoque} un. (Necessário: ${qtyNum})`);
            return;
          }
          const addonPrice = getProductUnitPrice(addon, qtyNum);
          addonItems.push({
            id: `item-${addon.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            produtoId: addon.id,
            produtoNome: `Adicional: ${addon.nome}`,
            precoUn: addonPrice,
            quantidade: qtyNum,
            total: addonPrice * qtyNum
          });
        }
      }

      const progressiveUnitPrice = getProductUnitPrice(selectedProduct, qtyNum);
      finalItens = [
        {
          id: `item-${selectedProduct.id}-${Date.now()}`,
          produtoId: selectedProduct.id,
          produtoNome: selectedProduct.nome,
          precoUn: progressiveUnitPrice,
          quantidade: qtyNum,
          total: progressiveUnitPrice * qtyNum,
          corSelecionada: selectedColor || undefined
        },
        ...addonItems
      ];
    }

    if (arteDesign) {
      finalItens.push({
        id: `item-artedesign-${Date.now()}`,
        produtoId: 'artedesign-service',
        produtoNome: 'Arte do design',
        precoUn: 5.0,
        quantidade: 1,
        total: 5.0
      });
    }

    if (segundaArte) {
      finalItens.push({
        id: `item-segundaarte-${Date.now()}`,
        produtoId: 'segundaarte-service',
        produtoNome: 'Segunda Arte',
        precoUn: 5.0,
        quantidade: 1,
        total: 5.0
      });
    }

    if (temTaxaUrgencia) {
      const urgenciaVal = parseFloat(valorTaxaUrgencia) || 0;
      if (urgenciaVal > 0) {
        finalItens.push({
          id: `item-taxaurgencia-${Date.now()}`,
          produtoId: 'taxaurgencia-service',
          produtoNome: 'Taxa de Urgência',
          precoUn: urgenciaVal,
          quantidade: 1,
          total: urgenciaVal
        });
      }
    }

    if (temTaxaCartao) {
      const cartaoVal = parseFloat(valorTaxaCartao) || 0;
      if (cartaoVal > 0) {
        finalItens.push({
          id: `item-taxacartao-${Date.now()}`,
          produtoId: 'taxacartao-service',
          produtoNome: 'Taxa do Cartão',
          precoUn: cartaoVal,
          quantidade: 1,
          total: cartaoVal
        });
      }
    }

    const valPagoNum = valorPagoInput.trim() === '' ? 0 : parseFloat(valorPagoInput);
    const finalValorPago = registroTipo === 'Orçamento' ? 0 : (isNaN(valPagoNum) ? 0 : valPagoNum);
    const finalValorFaltante = registroTipo === 'Orçamento' ? totalVenda : Math.max(0, totalVenda - finalValorPago);

    const mainItem = finalItens[0];
    const mainProdutoId = mainItem.produtoId;
    const mainProdutoNome = finalItens.length > 1
      ? `${mainItem.produtoNome} (+${finalItens.length - 1} itens)`
      : mainItem.produtoNome;
    const mainPrecoUn = mainItem.precoUn;
    const mainQuantidade = finalItens
      .filter(item => item.produtoId !== 'artedesign-service' && item.produtoId !== 'segundaarte-service' && item.produtoId !== 'taxaurgencia-service' && item.produtoId !== 'taxacartao-service')
      .reduce((sum, item) => sum + item.quantidade, 0);

    // Buscar vendas frescas da nuvem para garantir numeração de pedidos sem conflitos (conexão certa)
    let finalSalesList = sales;
    try {
      const dbSaless = await dbSupabase.fetchSales();
      if (dbSaless && dbSaless.length > 0) {
        finalSalesList = dbSaless;
      }
    } catch (err) {
      console.warn('Erro ao carregar vendas frescas da nuvem:', err);
    }

    // Gerar número de pedido sequencial automaticamente a partir de 30000
    const numericPedidoNumbers = finalSalesList
      .map(s => parseInt(s.numeroPedido || '', 10))
      .filter(num => !isNaN(num));
    const nextPedidoNumber = numericPedidoNumbers.length > 0 
      ? Math.max(...numericPedidoNumbers, 29999) + 1 
      : 30000;

    const customerFirstName = cliente.trim().split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase();
    const customerPedNum = registroTipo === 'Orçamento' ? Date.now().toString().substring(8) : String(nextPedidoNumber);
    const selfCode = `${customerFirstName}${customerPedNum}`;

    let indicatorName = '';
    let indicatorPhone = '';
    
    if (isReferralApplied) {
      const cleanCode = referralCodeInput.trim().toUpperCase();
      const matchedSale = sales.find(s => {
        if (!s.cliente) return false;
        const firstName = s.cliente.trim().split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase();
        const pedNum = s.numeroPedido || s.id.substring(s.id.length - 5).toUpperCase();
        const computedCode = `${firstName}${pedNum}`;
        return computedCode === cleanCode;
      });
      if (matchedSale) {
        indicatorName = matchedSale.cliente;
        indicatorPhone = matchedSale.telefoneCliente || '';
      }
    }

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      cliente: cliente.trim(),
      telefoneCliente: telefoneCliente.trim() ? telefoneCliente.trim() : undefined,
      produtoId: mainProdutoId,
      produtoNome: mainProdutoNome,
      precoUn: mainPrecoUn,
      quantidade: mainQuantidade,
      total: totalVenda,
      formaPagamento: formaPagamento,
      data: new Date().toISOString(),
      valorPago: finalValorPago,
      valorFaltante: finalValorFaltante,
      numeroPedido: registroTipo === 'Orçamento' ? undefined : String(nextPedidoNumber),
      status: registroTipo === 'Orçamento' ? 'Orçamento' : (finalValorFaltante > 0 ? 'Pendente' : 'Pago total'),
      itens: finalItens,
      criadoPorEmail: currentUserEmail || 'Desconhecido',
      dataRetirada: dataRetirada || undefined,
      statusProducao: registroTipo === 'Orçamento' ? undefined : 'Agendado',
      referralCode: selfCode,
      indicadoCodigo: isReferralApplied ? referralCodeInput.trim().toUpperCase() : undefined,
      descontoReferral: isReferralApplied ? referralDiscountApplied : undefined,
      cashbackGasto: appliedCashbackDiscount > 0 ? appliedCashbackDiscount : undefined,
      referralSended: false,
      pedidoVinculoNumero: pedidoVinculoNumero.trim() ? pedidoVinculoNumero.trim() : undefined,
      corSelecionada: cart.length === 0 ? (selectedColor || undefined) : (cart.find(i => i.corSelecionada)?.corSelecionada || undefined)
    };

    // Salvar venda (que agora deduz o estoque de forma atômica no pai)
    onRecordSale(newSale);

    // Play victory success sound cue if not an budget/orçamento
    if (registroTipo !== 'Orçamento') {
      playSound('success');
    } else {
      playSound('add');
    }

    // Trigger referral indicator warning message block
    if (isReferralApplied && indicatorName) {
      setReferralNotificationInfo({
        indicatorName,
        indicatorPhone,
        indicatedName: cliente.trim(),
        referralCode: referralCodeInput.trim().toUpperCase()
      });
    } else {
      setReferralNotificationInfo(null);
    }

    // Define newly registered sale as the viewed receipt
    setViewedSale(newSale);
    setTimeout(() => {
      receiptColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    setSuccessMsg(registroTipo === 'Orçamento' ? 'Orçamento gerado com sucesso! Verifique a folha de recibo ao lado.' : 'Estoque atualizado e venda processada com sucesso!');

    // Reset fields (keeping client empty)
    setSelectedProductId('');
    setQuantidade(1);
    setSelectedAddonIds([]);
    setArteDesign(false);
    setSegundaArte(false);
    setTemTaxaUrgencia(false);
    setValorTaxaUrgencia('');
    setTemTaxaCartao(false);
    setValorTaxaCartao('');
    setCliente('');
    setTelefoneCliente('');
    setValorPagoInput('');
    setNumeroPedido('');
    setPedidoVinculoNumero('');
    setDataRetirada('');
    setStatusProducao('Agendado');
    setDescontoPercent(0);
    setCustomPctInput('');
    setCustomValInput('');
    setCart([]);
    setReferralCodeInput('');
    setIsReferralApplied(false);
    setAppliedCashbackDiscount(0);
    setReferralMatchSuccess(null);
    setReferralMatchError(null);

    setTimeout(() => {
      setSuccessMsg('');
    }, 4000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;

    if (editItens.length === 0) {
      alert("O pedido precisa conter pelo menos um produto!");
      return;
    }

    const isBudget = editingSale.status === 'Orçamento' && !editConvertToOrder;

    if (editConvertToOrder) {
      let hasStockBypass = true;
      for (const item of editItens) {
        const prod = products.find(p => p.id === item.produtoId);
        if (prod && !prod.estoqueInfinito && prod.estoque < item.quantidade) {
          const confirmBypass = window.confirm(
            `Atenção: O produto "${item.produtoNome}" tem apenas ${prod.estoque} un. em estoque, mas o pedido solicita ${item.quantidade} un.\n\nDeseja realizar a conversão assim mesmo?`
          );
          if (!confirmBypass) {
            hasStockBypass = false;
            break;
          }
        }
      }
      if (!hasStockBypass) return;
    }

    const isScheduledDelivery = !isBudget && editStatusProducao === 'Agendado para Entrega';
    const valPagoNum = isBudget ? 0 : (isScheduledDelivery ? editTotal : (editValorPago.trim() === '' ? editTotal : parseFloat(editValorPago)));
    const finalValorPago = isBudget ? 0 : (isNaN(valPagoNum) ? editTotal : valPagoNum);
    const finalValorFaltante = isBudget ? editTotal : (isScheduledDelivery ? 0 : Math.max(0, editTotal - finalValorPago));

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

    const finalItensToSave = [...editItens];
    if (editArteDesign) {
      finalItensToSave.push({
        id: `item-artedesign-${Date.now()}`,
        produtoId: 'artedesign-service',
        produtoNome: 'Arte do design',
        precoUn: 5.0,
        quantidade: 1,
        total: 5.0
      });
    }
    if (editSegundaArte) {
      finalItensToSave.push({
        id: `item-segundaarte-${Date.now()}`,
        produtoId: 'segundaarte-service',
        produtoNome: 'Segunda Arte',
        precoUn: 5.0,
        quantidade: 1,
        total: 5.0
      });
    }
    if (editTemTaxaUrgencia) {
      const urgenciaVal = parseFloat(editValorTaxaUrgencia) || 0;
      if (urgenciaVal > 0) {
        finalItensToSave.push({
          id: `item-taxaurgencia-${Date.now()}`,
          produtoId: 'taxaurgencia-service',
          produtoNome: 'Taxa de Urgência',
          precoUn: urgenciaVal,
          quantidade: 1,
          total: urgenciaVal
        });
      }
    }

    if (editTemTaxaCartao) {
      const cartaoVal = parseFloat(editValorTaxaCartao) || 0;
      if (cartaoVal > 0) {
        finalItensToSave.push({
          id: `item-taxacartao-${Date.now()}`,
          produtoId: 'taxacartao-service',
          produtoNome: 'Taxa do Cartão',
          precoUn: cartaoVal,
          quantidade: 1,
          total: cartaoVal
        });
      }
    }

    const hasStructuralChanges = 
      (editingSale.cliente !== (editCliente.trim() || 'Consumidor')) ||
      (editingSale.telefoneCliente !== (editTelefone.trim() ? editTelefone.trim() : undefined)) ||
      (editingSale.total !== editTotal) ||
      (editingSale.valorPago !== finalValorPago) ||
      (JSON.stringify(editingSale.itens || []) !== JSON.stringify(finalItensToSave));

    const updatedSale: Sale = {
      ...editingSale,
      cliente: editCliente.trim() || 'Consumidor',
      telefoneCliente: editTelefone.trim() ? editTelefone.trim() : undefined,
      produtoId: mainProdutoId,
      produtoNome: mainProdutoNome,
      precoUn: mainPrecoUn,
      quantidade: mainQuantidade,
      total: editTotal,
      formaPagamento: isBudget ? editingSale.formaPagamento : editFormaPagamento,
      valorPago: finalValorPago,
      valorFaltante: finalValorFaltante,
      numeroPedido: editNumeroPedido.trim() ? editNumeroPedido.trim() : undefined,
      pedidoVinculoNumero: editPedidoVinculoNumero.trim() ? editPedidoVinculoNumero.trim() : undefined,
      status: isBudget ? 'Orçamento' : (finalValorFaltante > 0 ? 'Pendente' : 'Pago total'),
      dataRetirada: editDataRetirada || undefined,
      statusProducao: isBudget ? undefined : editStatusProducao,
      itens: finalItensToSave,
      foiAlterado: hasStructuralChanges ? true : (editingSale.foiAlterado || false),
      editadoPorEmail: hasStructuralChanges ? currentUserEmail : (editingSale.editadoPorEmail || undefined),
      editadoEm: hasStructuralChanges ? new Date().toISOString() : (editingSale.editadoEm || undefined),
      valoresOriginais: originalValues
    };

    if (onUpdateSale) {
      onUpdateSale(updatedSale);
    }

    if (editStatusProducao === 'Pronto para Retirada' || editStatusProducao === 'Entregue') {
      playAppSound('complete');
    } else {
      playAppSound('success');
    }

    // Instantly update viewed receipt if it is the active one!
    if (viewedSale && viewedSale.id === updatedSale.id) {
      setViewedSale(updatedSale);
    }

    setEditingSale(null);
  };

  const handleDeleteSaleSubmit = async (e: React.MouseEvent, saleId: string) => {
    e.stopPropagation();
    if (!onDeleteSale) return;
    setIsDeletingSaleId(saleId);
    try {
      playSound('remove');
      const success = await onDeleteSale(saleId);
      if (success) {
        setSaleIdToDelete(null);
        setSaleDeletePassword('');
        // If the deleted sale is the one currently viewed on the receipt, clear it
        if (viewedSale && viewedSale.id === saleId) {
          setViewedSale(null);
        }
      }
    } catch (err) {
      console.error('Erro ao excluir venda:', err);
    } finally {
      setIsDeletingSaleId(null);
    }
  };

  const handleSendPedidoAnotado = (sale: Sale) => {
    const cleanPhone = (sale.telefoneCliente || '').replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.length > 0) {
      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        finalPhone = `55${cleanPhone}`;
      }
    }

    const orderNum = sale.numeroPedido ? `#${sale.numeroPedido}` : 'Não informado';
    const valorPago = (sale.valorPago !== undefined ? sale.valorPago : sale.total);
    const valorFaltante = sale.valorFaltante || 0;
    
    const dataRetiradaFormatted = sale.dataRetirada 
      ? new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') 
      : 'A combinar';

    let itensDetail = sale.produtoNome;
    if (sale.itens && sale.itens.length > 0) {
      itensDetail = sale.itens.map(item => `• ${item.produtoNome} (x${item.quantidade})`).join('\n');
    }

    const trackingUrl = `${window.location.origin}/?acompanhar=${sale.id}`;

    const message = `Seu pedido foi anotado! 📝✨

*Número do Pedido:* ${orderNum}
*Produto(s) solicitado(s):*
${itensDetail}

*Quanto pagou:* R$ ${valorPago.toFixed(2)}
*Quanto falta:* R$ ${valorFaltante.toFixed(2)}
*Data de retirada:* ${dataRetiradaFormatted}

*Acompanhe o status do seu pedido em tempo real pelo link:*
${trackingUrl}

Muito obrigado pela preferência! Oxente Festeje 🎈

🎨A partir de agora, será encaminhado para fila de artes do design.

🚨 Ele poderá entrar em contato com 1 a 3 dias uteis, sem alteração da data da entrega.`;

    const encodedText = encodeURIComponent(message);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (finalPhone) {
      if (isMobile) {
        window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`, '_blank');
      } else {
        window.location.href = `whatsapp://send?phone=${finalPhone}&text=${encodedText}`;
      }
    } else {
      if (isMobile) {
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
      } else {
        window.location.href = `whatsapp://send?text=${encodedText}`;
      }
    }
    
    // Mark the sale as annotated (notified)
    markSaleAsAnnotated(sale.id);
    
    // Also save in the cloud database so all online users see it
    if (!sale.pedidoAnotado) {
      if (onUpdateSale) {
        onUpdateSale({
          ...sale,
          pedidoAnotado: true
        });
      }
    }
  };

  const getTotalsAndProfit = useMemo(() => {
    let totalRevenue = 0;
    let totalEstimatedCost = 0;

    filteredSales.forEach(sale => {
      if (sale.status === 'Orçamento') return;
      totalRevenue += sale.total;
      
      let saleCost = 0;
      if (sale.itens && sale.itens.length > 0) {
        sale.itens.forEach(item => {
          const matchingProduct = products.find(p => p.id === item.produtoId);
          const costPrice = matchingProduct?.precoCusto !== undefined ? matchingProduct.precoCusto : (item.precoUn * 0.62);
          // @ts-ignore
          const q = typeof item.quantidade === 'number' ? item.quantidade : (typeof item.quantity === 'number' ? item.quantity : 1);
          saleCost += costPrice * q;
        });
      } else {
        const matchingProduct = products.find(p => p.id === sale.produtoId);
        const costPrice = matchingProduct?.precoCusto !== undefined ? matchingProduct.precoCusto : (sale.precoUn * 0.62);
        saleCost += costPrice * sale.quantidade;
      }
      totalEstimatedCost += saleCost;
    });

    const totalNetProfit = Math.max(0, totalRevenue - totalEstimatedCost);
    const marginPercent = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

    return {
      revenue: totalRevenue,
      cost: totalEstimatedCost,
      profit: totalNetProfit,
      margin: marginPercent
    };
  }, [filteredSales, products]);

  const closedOrdersCount = useMemo(() => {
    if (!metricStartDate) return 0;
    const start = new Date(metricStartDate + 'T00:00:00');
    return sales.filter(sale => {
      if (sale.status === 'Orçamento') return false;
      const saleDate = new Date(sale.data);
      return saleDate >= start;
    }).length;
  }, [sales, metricStartDate]);

  const isBudget = editingSale !== null && editingSale.status === 'Orçamento' && !editConvertToOrder;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* CHART SECTION: Daily Revenue Chart in beautiful Premium Model */}
      {isAdmin && (
        <div className="lg:col-span-12 no-print bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          {/* Subtle glowing shadow behind */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-pink/5 rounded-full filter blur-[80px] pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-pink/10 border border-brand-pink/20 rounded-xl text-brand-pink shadow-inner shadow-brand-pink/5">
                <Activity className="h-5.5 w-5.5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-black text-lg text-zinc-100 tracking-tight">Desempenho de Faturamento</h2>
                  <span className="text-[9px] font-bold bg-brand-pink/10 border border-brand-pink/20 text-brand-pink px-2 py-0.5 rounded-full select-none uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" /> Premium Model
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">Visão analítica de faturamento diário</p>
              </div>
            </div>

            {/* Interactive Period Switcher */}
            <div className="flex bg-zinc-950 p-1 border border-zinc-850 rounded-xl self-start sm:self-auto shadow-inner select-none">
              {[7, 15, 30].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => {
                    setBillingPeriod(period as any);
                    playSound('success');
                  }}
                  className={`py-1 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    billingPeriod === period
                      ? 'bg-brand-pink text-black font-black shadow-lg scale-[1.03]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/10'
                  }`}
                >
                  {period} Dias
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end relative z-10">
            {/* Chart Area */}
            <div className="md:col-span-8 bg-black/40 border border-zinc-850/50 p-4 rounded-xl min-w-0">
              <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-[10.5px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <TrendingUp className="h-3.5 w-3.5 text-brand-pink" /> Fluxo Diário
                </span>
                <span className="text-xs text-zinc-400 font-bold font-mono">
                  Total no período: <span className="text-brand-pink font-extrabold text-sm font-sans">R$ {chartData.reduce((acc, curr) => acc + curr.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </span>
              </div>
              <div className="relative h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height={224} minWidth={0}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      dy={8}
                      fontFamily="JetBrains Mono"
                    />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => `R$ ${val}`}
                      dx={-8}
                      fontFamily="JetBrains Mono"
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ec4899', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#ec4899" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Premium Bento Grid KPIs */}
            <div className="md:col-span-4 space-y-4 self-stretch flex flex-col justify-between">
              {/* Today's revenue */}
              <div className="group border border-emerald-500/15 hover:border-emerald-500/25 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.03] rounded-xl p-4 transition-all duration-300">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block font-mono">Faturamento de Hoje</span>
                  <span className="text-[9px] font-extrabold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded tracking-wide">AO VIVO</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400 font-sans tracking-tight">R$ {todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-zinc-500 font-bold">líquido</span>
                </div>
              </div>

              {/* Average Daily */}
              <div className="group border border-zinc-800 hover:border-zinc-700 bg-zinc-950/30 hover:bg-zinc-950/55 rounded-xl p-4 transition-all duration-300">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1.5 font-mono">Média Diária ({billingPeriod}D)</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-zinc-150 tracking-tight font-sans">R$ {averageDailyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Peak Revenue day */}
              <div className="group border border-zinc-800 hover:border-zinc-700 bg-zinc-950/30 hover:bg-zinc-950/55 rounded-xl p-4 transition-all duration-300">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1.5 font-mono">Pico do Período</span>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-zinc-200">
                    R$ {peakRevenueDay.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-mono">
                    Dia {peakRevenueDay.date}
                  </span>
                </div>
              </div>

              {/* Active Pipeline Orders */}
              <div className="group border border-amber-500/15 hover:border-amber-500/25 bg-amber-500/[0.01] hover:bg-amber-500/[0.03] rounded-xl p-4 transition-all duration-300">
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block mb-1.5 font-mono">Pipeline em Andamento</span>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-amber-400">
                    {activeOrdersCount} {activeOrdersCount === 1 ? 'Pedido' : 'Pedidos'}
                  </span>
                  <span className="text-[10px] font-extrabold text-amber-500/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded tracking-wide font-mono">
                    ATIVOS
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* New Green Closed Orders Metric Section (Preserving functionality) */}
          <div id="closed-orders-metric-container" className="mt-8 pt-6 border-t border-zinc-850/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div id="closed-orders-icon-badge" className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shadow-sm shadow-emerald-500/5">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase font-black tracking-wider font-mono">Filtro de Pedidos Fechados</span>
                <span id="closed-orders-count-value" className="text-[15px] font-extrabold text-emerald-400 mt-0.5 block">
                  {closedOrdersCount} {closedOrdersCount === 1 ? 'pedido fechado' : 'pedidos fechados'} no filtro
                </span>
              </div>
            </div>
            
            <div id="closed-orders-date-selector" className="flex items-center gap-2.5 bg-black/50 px-3.5 py-2 rounded-xl border border-zinc-800/80 shadow-md">
              <span className="text-[10.5px] text-zinc-400 font-bold select-none uppercase tracking-wider font-mono">Início do Filtro:</span>
              <input
                id="metric-start-date-picker"
                type="date"
                value={metricStartDate}
                onChange={(e) => setMetricStartDate(e.target.value)}
                className="px-3 py-1 bg-zinc-950 border border-zinc-800 hover:border-zinc-700/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-pink/40 text-zinc-200 text-xs font-mono h-8 cursor-pointer transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* LEFT COLUMN: Launch Sale Form & Sales History (8 cols) */}
      <div className="lg:col-span-7 space-y-8 no-print">
        
        {/* Launch Sale Form Card */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-brand-pink/10 border border-brand-pink/20 rounded-lg text-brand-pink">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <h2 className="font-display font-semibold text-xl text-zinc-100">Lançar Nova Venda</h2>
          </div>

          <form onSubmit={handleRegisterSale} className="space-y-5">
            
            {/* Form Validation Errors & Success logs */}
            {formError && (
              <div className="p-3.5 bg-red-950/25 border-l-4 border-red-650 rounded-r-xl text-red-300 text-xs font-semibold animate-fade-in flex items-center gap-2">
                <span>⚠️ {formError}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-emerald-950/25 border-l-4 border-emerald-650 rounded-r-xl text-emerald-300 text-xs font-semibold animate-fade-in flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-450 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {referralNotificationInfo && (
              <div className="bg-purple-950/25 border border-purple-500/20 rounded-xl p-4 space-y-3 animate-fade-in no-print">
                <div className="flex items-start gap-2.5">
                  <span className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 block shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <h5 className="text-xs font-bold text-purple-400">Nova Indicação Concluída! 🎁</h5>
                    <p className="text-[11px] text-zinc-300 leading-relaxed mt-0.5 font-sans">
                      <strong>{referralNotificationInfo.indicatedName}</strong> realizou uma compra usando o cupom de <strong>{referralNotificationInfo.indicatorName}</strong>! 
                      Envie uma mensagem para o indicador avisando-o do seu novo desconto acumulado de <strong>+5%</strong>.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setReferralNotificationInfo(null)}
                    className="px-2.5 py-1 text-[10.5px] font-bold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    Ignorar
                  </button>
                  <a
                    href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(
                      referralNotificationInfo.indicatorPhone.replace(/\D/g, '').length > 0
                        ? (referralNotificationInfo.indicatorPhone.replace(/\D/g, '').startsWith('55')
                            ? `+${referralNotificationInfo.indicatorPhone.replace(/\D/g, '')}`
                            : `+55${referralNotificationInfo.indicatorPhone.replace(/\D/g, '')}`)
                        : ''
                    )}&text=${encodeURIComponent(
                      `Olá, *${referralNotificationInfo.indicatorName.split(' ')[0]}*! Boas notícias! 🎉\n\nSeu amigo(a) *${referralNotificationInfo.indicatedName}* acabou de realizar uma compra de balões e personalizados na *Oxente Festeje* usando seu código de indicação! 😍🎈\n\nCom isso, você acumulou mais *+5% de desconto* para sua próxima compra ou festa (podendo acumular até *15% de desconto total*)! Seus descontos foram creditados no seu cadastro. Muito obrigado por nos indicar! ❤️`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setReferralNotificationInfo(null)}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-550 active:scale-98 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-950/20"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Avisar no WhatsApp
                  </a>
                </div>
              </div>
            )}

            {/* Segmented control for Type of Registration: Venda vs Orçamento */}
            <div className="space-y-2 bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/60 max-w-md">
              <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 select-none">
                Tipo de Lançamento
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegistroTipo('Venda');
                    playSound('add');
                  }}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    registroTipo === 'Venda'
                      ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                      : 'border-zinc-850 text-zinc-500 bg-black/20 hover:text-zinc-300'
                  }`}
                >
                  <span>🛒 Pedido / Venda</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegistroTipo('Orçamento');
                    playSound('add');
                  }}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    registroTipo === 'Orçamento'
                      ? 'bg-amber-950/20 text-amber-500 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.05)]'
                      : 'border-zinc-850 text-zinc-500 bg-black/20 hover:text-zinc-300'
                  }`}
                >
                  <span>📄 Orçamento Sem Compromisso</span>
                </button>
              </div>
            </div>

            {/* Choose Product select box and Audio Trigger toggle */}
            <div className="space-y-3 bg-zinc-950/25 p-4 border border-zinc-900 rounded-xl">
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <label className="text-xs font-black tracking-widest text-zinc-400 uppercase flex items-center gap-1">
                  <span>🛍️</span> MARCADOR & CATÁLOGO
                </label>
                
                {/* Audio chime toggle */}
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm ${
                    soundEnabled
                      ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-950/45'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                  }`}
                  title={soundEnabled ? "Mutar sons e notificações do app" : "Ativar sons e notificações do app"}
                >
                  <span className="text-zinc-100">{soundEnabled ? '🔊' : '🔇'}</span>
                  <span>{soundEnabled ? 'Sons: Ativos' : 'Sons: Mutados'}</span>
                </button>
              </div>

              {/* Product selector dropdown */}
              <div>
                <label htmlFor="sale-p-select" className="block text-xs font-semibold text-zinc-400 mb-1">
                  Brinde / Produto Escolhido <span className="text-brand-pink font-bold">*</span>
                </label>
                {products.length === 0 ? (
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-center text-zinc-500 text-xs">
                    Nenhum produto cadastrado. Cadastre pelo menos um item para liberar as vendas.
                  </div>
                ) : availableProducts.length === 0 ? (
                  <div className="p-3 bg-red-950/10 border border-red-900/30 rounded-xl text-center text-red-400 text-xs font-medium">
                    Todos os produtos estão esgotados!
                  </div>
                ) : (
                  <select
                    id="sale-p-select"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-zinc-800 rounded-xl bg-black focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink text-zinc-150 text-sm"
                  >
                    <option value="" className="text-zinc-500">-- Selecione o item --</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-100">
                        {p.nome} (Preço: R$ {p.preco.toFixed(2)} | Estoque: {p.estoqueInfinito ? '∞ Infinito' : `${p.estoque} un.`})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Color variation selector */}
              {selectedProduct && selectedProduct.cores && selectedProduct.cores.length > 0 && (
                <div className="mt-3 animate-fade-in">
                  <label htmlFor="sale-p-color" className="block text-xs font-semibold text-zinc-400 mb-1">
                    Cor do Produto <span className="text-brand-pink font-bold">*</span>
                  </label>
                  <select
                    id="sale-p-color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full px-4 py-2.5 border border-zinc-800 rounded-xl bg-black focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink text-zinc-150 text-sm"
                  >
                    <option value="" className="text-zinc-500">-- Selecione a cor --</option>
                    {selectedProduct.cores.map(c => (
                      <option key={c.nome} value={c.nome} className="bg-zinc-900 text-zinc-100" disabled={registroTipo !== 'Orçamento' && c.estoque <= 0}>
                        {c.nome} (Estoque: {c.estoque} un.) {registroTipo !== 'Orçamento' && c.estoque <= 0 ? '-- ESGOTADO' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Seleção de Adicionais Opcionais */}
              {selectedProductId && availableAddons.length > 0 && (
                <div className="mt-3 bg-zinc-900/40 border border-zinc-800/80 p-3 rounded-xl space-y-2 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddons(prev => !prev);
                      playSound('add');
                    }}
                    className="w-full flex items-center justify-between text-left focus:outline-none select-none group"
                  >
                    <span className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span>✨ Brinde Adicional / Opcionais do Pedido:</span>
                      {selectedAddonIds.length > 0 && (
                        <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-extrabold animate-pulse">
                          {selectedAddonIds.length} selecionado{selectedAddonIds.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                    <span className="text-[10.5px] font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors flex items-center gap-1 bg-zinc-850/60 hover:bg-zinc-800/80 px-2 py-1 rounded-lg">
                      {showAddons ? (
                        <>Ocultar <span className="font-mono text-[9px]">▲</span></>
                      ) : (
                        <>Ver opcionais ({availableAddons.length}) <span className="font-mono text-[9px]">▼</span></>
                      )}
                    </span>
                  </button>

                  {showAddons && (
                    <div className="pt-2 border-t border-zinc-800/50 mt-1 animate-fade-in space-y-2 text-left">
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        A quantidade dos adicionais marcados acompanhará automaticamente a quantidade do produto principal ({quantidade || 1} un.).
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                        {availableAddons.map(addon => {
                          const isChecked = selectedAddonIds.includes(addon.id);
                          return (
                            <label
                              key={addon.id}
                              className={`flex items-center gap-2.5 px-3 py-2 border rounded-xl cursor-pointer select-none transition-all ${
                                isChecked
                                  ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.05)]'
                                  : 'bg-black/40 border-zinc-850 text-zinc-400 hover:border-zinc-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedAddonIds(prev =>
                                    prev.includes(addon.id)
                                      ? prev.filter(id => id !== addon.id)
                                      : [...prev, addon.id]
                                  );
                                }}
                                className="rounded border-zinc-800 text-emerald-500 focus:ring-0 accent-emerald-500 h-4 w-4 cursor-pointer bg-black"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold truncate text-zinc-250">
                                  {addon.nome}
                                </span>
                                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                  + R$ {addon.preco.toFixed(2)} /un
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Opções de Serviços e Taxas Adicionais */}
              {(selectedProductId || cart.length > 0) && (() => {
                const activeServicesCount = (arteDesign ? 1 : 0) + (segundaArte ? 1 : 0) + (temTaxaUrgencia ? 1 : 0) + (temTaxaCartao ? 1 : 0);
                return (
                  <div className="mt-4 bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl space-y-3 animate-fade-in text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setShowServicosTaxas(prev => !prev);
                        playSound('add');
                      }}
                      className="w-full flex items-center justify-between text-left focus:outline-none select-none group"
                    >
                      <span className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 select-none font-sans">
                        <span>✨ Serviços e Taxas Adicionais do Pedido:</span>
                        {activeServicesCount > 0 && (
                          <span className="bg-brand-pink/20 text-brand-pink px-2 py-0.5 rounded-full text-[9px] font-extrabold animate-pulse">
                            {activeServicesCount} selecionado{activeServicesCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
                      <span className="text-[10.5px] font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors flex items-center gap-1 bg-zinc-850/60 hover:bg-zinc-800/80 px-2 py-1 rounded-lg">
                        {showServicosTaxas ? (
                          <>Ocultar <span className="font-mono text-[9px]">▲</span></>
                        ) : (
                          <>Ver taxas/serviços <span className="font-mono text-[9px]">▼</span></>
                        )}
                      </span>
                    </button>
                    
                    {showServicosTaxas && (
                      <div className="pt-3 border-t border-zinc-850/50 mt-1 animate-fade-in space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {/* Botão de Arte do Design */}
                          <label
                            className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl cursor-pointer select-none transition-all ${
                              arteDesign
                                ? 'bg-brand-pink/12 border-brand-pink/40 text-brand-pink shadow-[0_0_8px_rgba(236,72,153,0.04)]'
                                : 'bg-black/30 border-zinc-850 text-zinc-400 hover:border-zinc-700/80 hover:bg-black/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={arteDesign}
                              onChange={() => {
                                setArteDesign(prev => !prev);
                                playSound(arteDesign ? 'remove' : 'add');
                              }}
                              className="rounded border-zinc-800 text-brand-pink focus:ring-0 accent-brand-pink h-4 w-4 cursor-pointer bg-black"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold truncate text-zinc-200">
                                🎨 Arte do Design
                              </span>
                              <span className="text-[10px] font-mono text-brand-pink font-bold">
                                + R$ 5,00
                              </span>
                            </div>
                          </label>

                          {/* Botão de Segunda Arte */}
                          <label
                            className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl cursor-pointer select-none transition-all ${
                              segundaArte
                                ? 'bg-purple-500/12 border-purple-500/40 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.04)]'
                                : 'bg-black/30 border-zinc-850 text-zinc-400 hover:border-zinc-700/80 hover:bg-black/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={segundaArte}
                              onChange={() => {
                                setSegundaArte(prev => !prev);
                                playSound(segundaArte ? 'remove' : 'add');
                              }}
                              className="rounded border-zinc-800 text-purple-500 focus:ring-0 accent-purple-500 h-4 w-4 cursor-pointer bg-black"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold truncate text-zinc-200">
                                🎨 Segunda Arte
                              </span>
                              <span className="text-[10px] font-mono text-purple-400 font-bold">
                                + R$ 5,00
                              </span>
                            </div>
                          </label>

                          {/* Botão de Taxa de Urgência */}
                          <label
                            className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl cursor-pointer select-none transition-all ${
                              temTaxaUrgencia
                                ? 'bg-amber-500/12 border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.04)]'
                                : 'bg-black/30 border-zinc-850 text-zinc-400 hover:border-zinc-700/80 hover:bg-black/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={temTaxaUrgencia}
                              onChange={() => {
                                const nextState = !temTaxaUrgencia;
                                setTemTaxaUrgencia(nextState);
                                playSound(nextState ? 'add' : 'remove');
                                if (!nextState) {
                                  setValorTaxaUrgencia('');
                                }
                              }}
                              className="rounded border-zinc-800 text-amber-500 focus:ring-0 accent-amber-500 h-4 w-4 cursor-pointer bg-black"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold truncate text-zinc-200">
                                ⚡ Taxa de Urgência
                              </span>
                              <span className="text-[10px] font-mono text-amber-400 font-bold">
                                {valorTaxaUrgencia ? `+ R$ ${parseFloat(valorTaxaUrgencia).toFixed(2)}` : 'Informa Valor'}
                              </span>
                            </div>
                          </label>

                          {/* Botão de Taxa do Cartão */}
                          <label
                            className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl cursor-pointer select-none transition-all ${
                              temTaxaCartao
                                ? 'bg-blue-500/12 border-blue-500/40 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.04)]'
                                : 'bg-black/30 border-zinc-850 text-zinc-400 hover:border-zinc-700/80 hover:bg-black/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={temTaxaCartao}
                              onChange={() => {
                                const nextState = !temTaxaCartao;
                                setTemTaxaCartao(nextState);
                                playSound(nextState ? 'add' : 'remove');
                                if (!nextState) {
                                  setValorTaxaCartao('');
                                }
                              }}
                              className="rounded border-zinc-800 text-blue-500 focus:ring-0 accent-blue-500 h-4 w-4 cursor-pointer bg-black"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold truncate text-zinc-200">
                                💳 Taxa do Cartão
                              </span>
                              <span className="text-[10px] font-mono text-blue-400 font-bold">
                                {valorTaxaCartao ? `+ R$ ${parseFloat(valorTaxaCartao).toFixed(2)}` : 'Informa Valor'}
                              </span>
                            </div>
                          </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                          {temTaxaUrgencia && (
                            <div className="text-left animate-fade-in pt-1">
                              <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 font-sans select-none">
                                Valor da taxa de urgência (R$):
                              </label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-2.5 text-xs text-zinc-500 font-mono font-bold">
                                  R$
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Digite o valor..."
                                  value={valorTaxaUrgencia}
                                  onChange={(e) => setValorTaxaUrgencia(e.target.value)}
                                  className="w-full bg-zinc-950 border border-amber-500/30 rounded-xl py-2 pl-9 pr-4 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                              </div>
                            </div>
                          )}

                          {temTaxaCartao && (
                            <div className="text-left animate-fade-in pt-1">
                              <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5 font-sans select-none">
                                Valor da taxa do cartão (R$):
                              </label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-2.5 text-xs text-zinc-500 font-mono font-bold">
                                  R$
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Digite o valor..."
                                  value={valorTaxaCartao}
                                  onChange={(e) => setValorTaxaCartao(e.target.value)}
                                  className="w-full bg-zinc-950 border border-blue-500/30 rounded-xl py-2 pl-9 pr-4 text-xs font-mono text-blue-300 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Client and Phone fields row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sale-client" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Nome do Cliente <span className="text-red-400 font-bold">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-zinc-500">
                    <Users className="h-4 w-4" />
                  </span>
                  <input
                    id="sale-client"
                    type="text"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink text-zinc-100 text-sm placeholder-zinc-650"
                    placeholder="Digite o nome do consumidor..."
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sale-client-phone" className="block text-sm font-medium text-zinc-300 mb-1.5 flex items-center gap-1">
                  Telefone do Cliente <span className="text-red-400 font-bold">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-zinc-500">
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    id="sale-client-phone"
                    type="tel"
                    value={telefoneCliente}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      let formatted = val;
                      if (val.length > 0) {
                        if (val.length <= 2) {
                          formatted = `(${val}`;
                        } else if (val.length <= 6) {
                          formatted = `(${val.substring(0, 2)}) ${val.substring(2)}`;
                        } else if (val.length <= 10) {
                          formatted = `(${val.substring(0, 2)}) ${val.substring(2, 6)}-${val.substring(6)}`;
                        } else {
                          formatted = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7, 11)}`;
                        }
                      }
                      setTelefoneCliente(formatted);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink text-zinc-100 text-sm placeholder-zinc-650"
                    placeholder="Ex: (83) 98885-9302"
                  />
                </div>
              </div>
            </div>

            {/* Live Referral Discount Lookup Alert */}
            {clientCashbackBalance > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Wallet className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-emerald-400">Desconto de Indicação Acumulado!</h5>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Este cliente recebeu indicações bem-sucedidas e possui <span className="font-mono font-bold text-emerald-400">{clientCashbackBalance}% de Desconto</span> acumulado!
                    </p>
                  </div>
                </div>
                <div>
                  {appliedCashbackDiscount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCashbackDiscount(0);
                        playSound('remove');
                      }}
                      className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold text-[11px] rounded-lg border border-zinc-750 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <X className="h-3 w-3" /> Remover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCashbackDiscount(clientCashbackBalance);
                        playSound('success');
                      }}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="h-3 w-3" /> Aplicar {clientCashbackBalance}%
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Quantity row */}
            <div className="w-full">
              <div>
                <label htmlFor="sale-qty" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Quantidade Vendida <span className="text-brand-pink font-bold">*</span>
                </label>
                <input
                  id="sale-qty"
                  type="number"
                  min="1"
                  max={selectedProduct?.estoqueInfinito ? undefined : selectedProduct?.estoque || 999}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink text-zinc-100 text-sm placeholder-zinc-650 font-semibold"
                  placeholder="Ex: 2"
                />
                
                {/* Dynamically display active progressive price tier */}
                {selectedProduct && (
                  <div className="mt-2 text-xs">
                    <span className="text-zinc-450 text-[11px]">Preço Unitário Aplicado: </span>
                    <span className="font-extrabold text-brand-pink font-mono">
                      R$ {getProductUnitPrice(selectedProduct, Number(quantidade) || 1).toFixed(2)}
                    </span>
                    {selectedProduct.faixasPreco && selectedProduct.faixasPreco.length > 0 && (
                      <div className="mt-1.5 bg-black border border-zinc-900/80 p-2.5 rounded-lg space-y-1 animate-fade-in">
                        <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          Tabela de Desconto Progressivo:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProduct.faixasPreco.map((faixa, idx) => {
                            const isQtyMet = (Number(quantidade) || 1) >= faixa.quantidadeMinima;
                            return (
                              <div
                                key={idx}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                  isQtyMet
                                    ? 'bg-brand-pink/10 text-brand-pink border border-brand-pink/25 font-bold'
                                    : 'bg-zinc-950 text-zinc-600 border border-zinc-900/50'
                                }`}
                              >
                                {faixa.quantidadeMinima}+ un: R$ {faixa.preco.toFixed(2)}
                                {isQtyMet && <span className="ml-1 text-[9px]">✓</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Withdrawal Date and automatically set Production Status */}
            <div>
              <label htmlFor="sale-pickup-date" className="block text-sm font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5 flex-wrap">
                <span>📅</span> Data de Retirada <span className="text-red-400 font-bold">*</span>
                <span className="text-[10px] text-zinc-400 font-sans font-normal">(Início da produção será definido automaticamente como "Agendado")</span>
              </label>
              <input
                id="sale-pickup-date"
                type="date"
                value={dataRetirada}
                onChange={(e) => {
                  setDataRetirada(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink text-zinc-100 text-sm font-semibold font-mono"
              />
            </div>

            {/* Add to Cart Trigger Button */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!selectedProductId}
                className="w-full py-3 bg-brand-pink/10 hover:bg-brand-pink/20 border border-brand-pink/30 hover:border-brand-pink text-brand-pink font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed select-none"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar ao Carrinho (Criar Venda Multi-Item)</span>
              </button>
            </div>

            {/* Visual Cart List panel */}
            {cart.length > 0 && (
              <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-zinc-350 uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <span>🛒</span> Itens do Pedido ({cart.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[10px] text-red-400 hover:text-red-300 hover:underline flex items-center gap-0.5 cursor-pointer select-none"
                  >
                    <Trash2 className="h-3 w-3 inline" /> Limpar Tudo
                  </button>
                </div>

                <div className="divide-y divide-zinc-800/40 max-h-[220px] overflow-y-auto pr-1">
                  {cart.map((item, idx) => (
                    <div key={item.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-zinc-100 truncate block">{item.product.nome}</span>
                          {item.corSelecionada && (
                            <span className="inline-flex items-center gap-1 bg-brand-pink/10 border border-brand-pink/20 text-brand-pink text-[9px] px-1.5 py-0.5 rounded-full font-bold select-none">
                              🎨 {item.corSelecionada}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const effectiveQty = getCartItemEffectiveQty(item, cart);
                          const unitPrice = getProductUnitPrice(item.product, effectiveQty);
                          return (
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {item.quantity}x de R$ {unitPrice.toFixed(2)}
                              {effectiveQty !== item.quantity && (
                                <span className="text-emerald-450 ml-1.5 font-sans font-bold">
                                  (Desconto progressivo: {effectiveQty} un.)
                                </span>
                              )}
                            </span>
                          );
                        })()}
                        {item.addons && item.addons.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {item.addons.map(addon => {
                              const effectiveQty = getCartItemEffectiveQty(item, cart);
                              return (
                                <span key={addon.id} className="inline-flex items-center gap-1 bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded-md font-medium select-none">
                                  <span className="text-[10px]">✨</span>
                                  {addon.nome} (+ R$ {getProductUnitPrice(addon, effectiveQty).toFixed(2)})
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-brand-pink font-mono">
                          R$ {(() => {
                            const effectiveQty = getCartItemEffectiveQty(item, cart);
                            const unitPrice = getProductUnitPrice(item.product, effectiveQty);
                            const addonsUnitPrice = item.addons ? item.addons.reduce((sum, addon) => sum + getProductUnitPrice(addon, effectiveQty), 0) : 0;
                            return (item.quantity * (unitPrice + addonsUnitPrice)).toFixed(2);
                          })()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCart(cart.filter(c => c.id !== item.id));
                          }}
                          className="p-1 hover:bg-zinc-800 rounded text-red-400 hover:text-red-350 transition-colors cursor-pointer text-[11px]"
                          title="Remover do carrinho"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Method Selector Grid */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Forma de Pagamento <span className="text-brand-pink font-bold">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {paymentMethods.map((m) => {
                  const isSelected = formaPagamento === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setFormaPagamento(m.value)}
                      className={`py-3 px-2 rounded-xl text-center border transition-all text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'border-brand-pink bg-brand-pink/15 text-brand-pink font-bold shadow-xs'
                          : 'border-zinc-800 text-zinc-400 hover:bg-zinc-950/40'
                      }`}
                    >
                      <span className="text-lg">{m.icon}</span>
                      <span>{m.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paid Amount and Missing Amount inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/40 border border-zinc-800/80 p-4 rounded-xl">
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-1.5 w-full">
                  <label htmlFor="sale-paid-amount" className="block text-xs font-semibold text-zinc-400">
                    Quanto o cliente pagou? (R$) <span className="text-red-400 font-bold">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setValorPagoInput(totalVenda.toFixed(2));
                      playSound('success');
                    }}
                    className="text-[10px] font-black text-brand-pink hover:text-brand-pink/80 bg-brand-pink/10 hover:bg-brand-pink/15 px-2 py-0.5 rounded transition-all cursor-pointer select-none"
                    title="Preencher o valor pago com o valor integral com desconto do pedido"
                  >
                    Quitar (Pagar Tudo)
                  </button>
                </div>
                <input
                  id="sale-paid-amount"
                  type="text"
                  value={valorPagoInput}
                  onChange={(e) => {
                    // Allow numbers and decimal points only
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setValorPagoInput(val);
                  }}
                  className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-sm"
                  placeholder={registroTipo === 'Orçamento' ? 'Não aplicável para orçamento' : 'Ex: 50.00 ou 0 se nada pago'}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Quanto falta pagar? (R$)
                </label>
                <div className="px-3 py-2 bg-black border border-zinc-850 rounded-lg text-sm text-zinc-300 flex items-center h-[38px] font-mono justify-between">
                  <span className="text-zinc-550 text-[11px] select-none uppercase">A Pagar:</span>
                  <span className={`font-bold ${(totalVenda - (valorPagoInput === '' ? 0 : parseFloat(valorPagoInput) || 0)) > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                    R$ {Math.max(0, totalVenda - (valorPagoInput === '' ? 0 : parseFloat(valorPagoInput) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Discount Preset Buttons Panel */}
            <div className="bg-zinc-950/40 border border-zinc-800 p-4 rounded-xl space-y-3">
              <span className="block text-xs font-bold text-zinc-450 uppercase select-none flex items-center gap-1">
                🏷️ Aplicar Desconto de Cortesia
              </span>
              <div className="flex flex-wrap gap-1.5 select-none text-xs">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setDescontoPercent(pct);
                      setCustomPctInput('');
                      setCustomValInput('');
                      playSound('add');
                    }}
                    className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                      descontoPercent === pct && customPctInput === '' && customValInput === ''
                        ? 'bg-brand-pink/15 text-brand-pink border-brand-pink/35 shadow-xs'
                        : 'bg-black text-zinc-400 border-zinc-850 hover:text-zinc-200'
                    }`}
                  >
                    {pct === 0 ? 'Sem Desconto' : `${pct}% Off`}
                  </button>
                ))}
              </div>

              {/* Opção de desconto personalizado */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-zinc-900 mt-2">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                    % no Teclado
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 12"
                      value={customPctInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                        setCustomPctInput(val);
                        setCustomValInput(''); // limpa o outro
                        
                        if (val === '') {
                          setDescontoPercent(0);
                          return;
                        }
                        
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) {
                          setDescontoPercent(Math.min(100, Math.max(0, parsed)));
                        } else {
                          setDescontoPercent(0);
                        }
                      }}
                      className={`w-full pl-3 pr-7 py-1.5 bg-black border rounded-lg text-xs font-semibold text-zinc-200 font-mono focus:outline-none transition-all ${
                        customPctInput !== '' 
                          ? 'border-brand-pink/60 ring-1 ring-brand-pink/20' 
                          : 'border-zinc-850 focus:border-brand-pink/40'
                      }`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold font-mono select-none">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                    Valor Fixo (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px] font-bold font-mono select-none">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 15.00"
                      value={customValInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                        setCustomValInput(val);
                        setCustomPctInput(''); // limpa o outro
                        
                        if (val === '' || totalVendaSemDesconto <= 0) {
                          setDescontoPercent(0);
                          return;
                        }
                        
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) {
                          const equivPct = (parsed / totalVendaSemDesconto) * 100;
                          setDescontoPercent(Math.min(100, Math.max(0, equivPct)));
                        } else {
                          setDescontoPercent(0);
                        }
                      }}
                      className={`w-full pl-8 pr-3 py-1.5 bg-black border rounded-lg text-xs font-semibold text-zinc-200 font-mono focus:outline-none transition-all ${
                        customValInput !== '' 
                          ? 'border-brand-pink/60 ring-1 ring-brand-pink/20' 
                          : 'border-zinc-850 focus:border-brand-pink/40'
                      }`}
                    />
                  </div>
                </div>
              </div>
              
              {descontoPercent > 0 && (
                <div className="text-[10px] text-zinc-500 font-medium flex items-center justify-between font-mono bg-black/60 p-2 rounded-lg border border-zinc-900">
                  <span>Preço original de venda:</span>
                  <span className="line-through">R$ {totalVendaSemDesconto.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Cupom de Indicação / Referral Club */}
            <div className="bg-purple-950/10 border border-purple-900/30 p-4 rounded-xl space-y-2">
              <span className="block text-xs font-bold text-purple-400 uppercase select-none flex items-center gap-1.5 font-sans">
                🎁 Programa de Indicação (Referral Club)
              </span>
              <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                Insira o código de indicação do amigo indicador para obter <strong className="text-emerald-400 font-semibold">5% de desconto imediato</strong> nesta nova compra e acumular <strong className="text-emerald-400 font-semibold">+5% de desconto</strong> para ele quando você fechar esta compra!
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: ANA30012"
                  value={referralCodeInput}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setReferralCodeInput(val);
                    if (val === '') {
                      setIsReferralApplied(false);
                      setReferralMatchSuccess(null);
                      setReferralMatchError(null);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 bg-black border border-purple-900/40 rounded-lg text-xs font-bold text-purple-300 font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-zinc-700 uppercase"
                />
                <button
                  type="button"
                  onClick={() => handleValidateReferralCode(referralCodeInput)}
                  className="px-3 bg-purple-750 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Validar
                </button>
              </div>
              
              {referralMatchSuccess && (
                <div className="text-[10px] text-emerald-450 font-bold bg-emerald-950/25 border border-emerald-900/30 p-2 rounded-lg animate-fade-in flex items-center gap-1 font-sans">
                  <span>✅</span> {referralMatchSuccess}
                </div>
              )}
              {referralMatchError && (
                <div className="text-[10px] text-red-400 font-bold bg-red-950/25 border border-red-900/30 p-2 rounded-lg animate-fade-in flex items-center gap-1 font-sans">
                  <span>❌</span> {referralMatchError}
                </div>
              )}
            </div>

            {/* Linked Order/Pedido Conjunto para Nova Venda */}
            <div className="bg-sky-950/20 border border-sky-900/40 p-4 rounded-xl space-y-2">
              <span className="block text-xs font-bold text-sky-400 uppercase select-none flex items-center gap-1.5 font-sans">
                🔗 Vínculo de Pedido Conjunto (Retirada Casada)
              </span>
              <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                Se este pedido deve ser retirado junto com outro pedido do mesmo cliente, informe o número do outro pedido. Os avisos de lembrete ficarão bloqueados até que ambos estejam prontos!
              </p>
              <div>
                <input
                  type="text"
                  placeholder="Ex: 30125"
                  value={pedidoVinculoNumero}
                  onChange={(e) => setPedidoVinculoNumero(e.target.value)}
                  className="w-full px-3 py-1.5 bg-black border border-sky-900/40 rounded-lg text-xs font-bold text-sky-300 font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-zinc-700 uppercase"
                />
                
                {/* Sibling orders helper */}
                {cliente.trim().length >= 3 && (() => {
                  const clientNamePrefix = cliente.trim().split(' ')[0].toLowerCase();
                  const siblingActiveSales = sales.filter(s => 
                    s.numeroPedido && 
                    s.cliente && 
                    s.cliente.trim().toLowerCase().includes(clientNamePrefix) && 
                    s.statusProducao !== 'Entregue'
                  );
                  
                  if (siblingActiveSales.length > 0) {
                    return (
                      <div className="mt-2 space-y-1">
                        <span className="block text-[9px] text-sky-400 font-bold uppercase select-none">
                          Sugestões de pedidos do mesmo cliente para vincular:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {siblingActiveSales.map(sib => (
                            <button
                              key={sib.id}
                              type="button"
                              onClick={() => setPedidoVinculoNumero(sib.numeroPedido || '')}
                              className="px-2 py-1 bg-sky-950/40 hover:bg-sky-900/50 text-sky-300 border border-sky-900/40 hover:border-sky-500 rounded text-[9px] font-mono transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span>#{sib.numeroPedido}</span>
                              <span className="opacity-60">({sib.produtoNome})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Total Indicator Panel */}
            <div className="bg-black/40 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-300">
                <DollarSign className="h-4.5 w-4.5 text-brand-pink" />
                <span className="text-sm font-medium">Total Calculado:</span>
              </div>
              <div className="text-right">
                {descontoPercent > 0 && (
                  <span className="text-[10px] text-emerald-450 font-bold block mb-0.5">
                    Economia: R$ {(totalVendaSemDesconto * (descontoPercent / 100)).toFixed(2)}
                  </span>
                )}
                {referralDiscountApplied > 0 && (
                  <span className="text-[10px] text-purple-400 font-bold block mb-0.5 animate-pulse font-sans">
                    🎁 Cupom/Indicação: -R$ {referralDiscountApplied.toFixed(2)}
                  </span>
                )}
                {appliedCashbackDiscount > 0 && (
                  <span className="text-[10px] text-emerald-400 font-bold block mb-0.5 animate-pulse font-sans">
                    ✨ Cashback Acumulado: -R$ {(totalVendaSemDesconto * (appliedCashbackDiscount / 100)).toFixed(2)}
                  </span>
                )}
                <span className="text-2xl font-bold text-brand-pink block font-mono">
                  R$ {totalVenda.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Finalize Button */}
            <button
              type="submit"
              disabled={!selectedProductId && cart.length === 0}
              className={`w-full flex items-center justify-center gap-2 py-3 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md transition-all transform active:scale-98 cursor-pointer ${
                registroTipo === 'Orçamento'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-955'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {registroTipo === 'Orçamento' ? (
                <>
                  <span>📄</span>
                  <span>Gerar e Salvar Orçamento</span>
                </>
              ) : (
                <>
                  <span>🤝</span>
                  <span>Finalizar Venda</span>
                </>
              )}
            </button>

          </form>
        </div>

      </div>

      {/* RIGHT COLUMN: Interactive Receipt Preview (5 cols) */}
      <div ref={receiptColRef} className="lg:col-span-5 flex flex-col justify-start scroll-mt-6">
        {viewedSale ? (
          <Receipt 
            sale={viewedSale} 
            storeInfo={storeInfo} 
            onUpdateSale={onUpdateSale} 
            products={products}
            onEdit={() => setEditingSale(viewedSale)}
          />
        ) : (
          <div className="no-print bg-zinc-900 rounded-2xl border border-zinc-800 border-dashed p-10 text-center text-zinc-500 h-full flex flex-col items-center justify-center min-h-[350px]">
            <FileText className="h-12 w-12 text-zinc-700 stroke-1 mb-3" />
            <p className="font-medium text-zinc-400 text-sm">Nenhum recibo ativo</p>
            <p className="text-xs text-zinc-500 max-w-[230px] mx-auto mt-1">
              Registre uma venda ou selecione uma compra do histórico para verificar o recibo térmico imprimível.
            </p>
          </div>
        )}
      </div>

      {/* Sales History Log Table - Spans all 12 columns for extra breathing room */}
      <div className="lg:col-span-12 no-print bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-brand-pink/10 border border-brand-pink/20 rounded-lg text-brand-pink">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="font-display font-semibold text-xl text-zinc-100">Histórico de Vendas</h2>
            </div>
            <span className="self-start sm:self-auto text-xs bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded-full text-zinc-400 font-bold whitespace-nowrap">
              {sales.length} {sales.length === 1 ? 'venda registrada' : 'vendas registradas'}
            </span>
          </div>

          {/* Search Box */}
          {sales.length > 0 && (
            <div className="space-y-3 mb-5">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-500">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Filtrar por cliente, produto, número do pedido ou telefone..."
                  value={salesSearchTerm}
                  onChange={(e) => setSalesSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-black border border-zinc-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink text-zinc-100 placeholder-zinc-650 text-xs transition-colors"
                />
              </div>

              {/* Date Filters Row */}
              <div className="flex flex-wrap gap-1.5 items-center bg-black/15 p-1.5 border border-zinc-850/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
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
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    dateFilter === 'today' 
                      ? 'bg-brand-pink text-black' 
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('yesterday')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    dateFilter === 'yesterday' 
                      ? 'bg-brand-pink text-black' 
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  Ontem
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('7days')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    dateFilter === '7days' 
                      ? 'bg-brand-pink text-black' 
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  7 Dias
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('this_month')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    dateFilter === 'this_month' 
                      ? 'bg-brand-pink text-black' 
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  Este Mês
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('custom')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    dateFilter === 'custom' 
                      ? 'bg-brand-pink text-black' 
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  Personalizado
                </button>

                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-1.5 sm:ml-auto animate-fade-in text-[10px] text-zinc-405 pr-1 py-1 sm:py-0 w-full sm:w-auto">
                    <input
                      type="date"
                      value={startDateStr}
                      onChange={(e) => setStartDateStr(e.target.value)}
                      className="px-2 py-1 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink text-zinc-200 text-[10px] font-mono h-6 shrink-0"
                    />
                    <span>até</span>
                    <input
                      type="date"
                      value={endDateStr}
                      onChange={(e) => setEndDateStr(e.target.value)}
                      className="px-2 py-1 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink text-zinc-200 text-[10px] font-mono h-6 shrink-0"
                    />
                  </div>
                )}
              </div>

              {/* Financial Performance Overview for main registered user only */}
              {isAdmin && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-950/30 p-3.5 border border-zinc-850/60 rounded-xl animate-fade-in select-none">
                  <div>
                    <span className="block text-[9px] text-zinc-500 uppercase font-black tracking-wider">Faturado Período</span>
                    <span className="text-sm font-bold text-zinc-200">R$ {getTotalsAndProfit.revenue.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-zinc-500 uppercase font-black tracking-wider">Custo Estimado</span>
                    <span className="text-sm font-bold text-zinc-400">R$ {getTotalsAndProfit.cost.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-zinc-500 uppercase font-black tracking-wider">Lucro Estimado</span>
                    <span className="text-sm font-bold text-brand-pink">R$ {getTotalsAndProfit.profit.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-zinc-500 uppercase font-black tracking-wider">Margem Líquida</span>
                    <span className="text-sm font-bold text-emerald-450">{getTotalsAndProfit.margin.toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {sales.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-sm">
              Nenhuma venda registrada ainda no sistema.
            </div>
          ) : displayedSales.length === 0 ? (
            <div className="p-8 text-center bg-black/25 rounded-xl border border-dashed border-zinc-850">
              <p className="text-zinc-450 text-sm font-medium">Nenhum resultado encontrado</p>
              <p className="text-xs text-zinc-600 mt-1">
                Tente redefinir a busca por cliente ou produto para encontrar registros históricos.
              </p>
            </div>
          ) : (
            <div 
              className="max-h-[550px] overflow-y-auto pr-1 custom-scrollbar border border-zinc-850/60 rounded-xl bg-black/10"
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollHeight - target.scrollTop <= target.clientHeight + 60) {
                  if (visibleSalesCount < displayedSales.length) {
                    setVisibleSalesCount(prev => Math.min(prev + 10, displayedSales.length));
                  }
                }
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300 border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 font-medium sticky top-0 bg-zinc-900 z-10">
                      <th className="py-2.5 px-3 font-semibold">Cliente</th>
                      <th className="py-2.5 font-semibold">Produto</th>
                      <th className="py-2.5 font-semibold text-center">Quant.</th>
                      <th className="py-2.5 font-semibold text-right">Total</th>
                      <th className="py-2.5 font-semibold text-right pr-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {[...displayedSales]
                      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                      .slice(0, visibleSalesCount)
                      .map((sale) => {
                      const isActive = viewedSale?.id === sale.id;
                      return (
                        <tr 
                          key={sale.id}
                          onClick={() => handleSelectSaleForReceipt(sale)}
                          className={`hover:bg-zinc-800/30 transition-colors cursor-pointer select-none ${
                            isActive ? 'bg-brand-pink/10 font-semibold text-brand-pink border-l-2 border-brand-pink' : ''
                          }`}
                          title="Clique neste pedido para visualizar o recibo térmico"
                        >
                          <td className="py-3 px-3 max-w-[125px] truncate">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-zinc-100">{sale.cliente}</span>
                              {sale.numeroPedido ? (
                                <span className="bg-zinc-800 text-brand-pink text-[9px] font-mono px-1 py-0.5 rounded tracking-wider leading-none" title={`Número do Pedido: ${sale.numeroPedido}`}>
                                  #{sale.numeroPedido}
                                </span>
                              ) : (
                                <span className="bg-amber-950/45 text-amber-450 border border-amber-900/40 text-[8.5px] font-bold font-sans px-1.5 py-0.5 rounded uppercase tracking-wider leading-none">
                                  Orçamento
                                </span>
                              )}
                            </div>
                            {sale.telefoneCliente && (
                              <div className="text-[10px] text-zinc-500 font-mono mt-0.5" title={sale.telefoneCliente}>
                                {sale.telefoneCliente}
                              </div>
                            )}
                            {sale.dataRetirada && (
                              <div className="text-[10px] text-amber-500 font-mono font-medium mt-0.5 flex items-center gap-1" title="Data planejada de retirada">
                                <span>📅</span>
                                <span>{new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 max-w-[140px] truncate text-zinc-200">
                            <div>{sale.produtoNome}</div>
                            {sale.status === 'Orçamento' ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-1 border border-amber-950/40 bg-amber-955/20 text-amber-400">
                                📄 Orçamento
                              </span>
                            ) : sale.statusProducao ? (
                              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-1 border border-zinc-800 ${
                                sale.statusProducao === 'Agendado' ? 'bg-blue-900/10 text-blue-400 border-blue-900/30' :
                                sale.statusProducao === 'Em Produção' ? 'bg-amber-900/10 text-amber-400 border-amber-900/30' :
                                sale.statusProducao === 'Pronto para Retirada' ? 'bg-purple-900/10 text-purple-400 border-purple-900/30 animate-pulse-slow' :
                                sale.statusProducao === 'Agendado para Entrega' ? 'bg-sky-950/20 text-sky-400 border-sky-800/30 font-bold' :
                                'bg-emerald-900/10 text-emerald-400 border-emerald-900/30'
                              }`}>
                                {sale.statusProducao === 'Agendado' ? '📅 Agendado' :
                                 sale.statusProducao === 'Em Produção' ? '🔨 Em Produção' :
                                 sale.statusProducao === 'Pronto para Retirada' ? '✨ Pronto' :
                                 sale.statusProducao === 'Agendado para Entrega' ? '🚚 Agendado Entrega' :
                                 '🤝 Entregue'}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 text-center font-bold">{sale.quantidade}</td>
                          <td className="py-3 text-right">
                            <div className="font-bold text-zinc-100">R$ {sale.total.toFixed(2)}</div>
                            {sale.status === 'Orçamento' ? (
                              <div className="text-[10px] text-zinc-500 font-medium font-mono">
                                Proposta
                              </div>
                            ) : sale.valorFaltante && sale.valorFaltante > 0 ? (
                              <div className="text-[10px] text-red-400 font-semibold font-mono" title={`Faltando: R$ ${sale.valorFaltante.toFixed(2)}`}>
                                Falta: R$ {sale.valorFaltante.toFixed(2)}
                              </div>
                            ) : (
                              <div className="text-[9px] text-emerald-500 opacity-85 font-medium" title="Pago integralmente">
                                Pago
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-right pr-3">
                            <div className="flex flex-col-reverse sm:flex-row gap-1.5 items-end sm:items-center justify-end">
                              {(() => {
                                const isAnnotated = sale.pedidoAnotado || annotatedSaleIds.includes(sale.id);
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSendPedidoAnotado(sale);
                                    }}
                                    className={`px-2 py-1 border rounded-md text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                                      isAnnotated
                                        ? 'bg-orange-950/20 border-orange-550 text-orange-400 hover:text-orange-300 hover:border-orange-400'
                                        : 'bg-zinc-950 border-zinc-800 hover:border-emerald-500 text-zinc-300 hover:text-emerald-400'
                                    }`}
                                    title={isAnnotated ? "Aviso enviado! Clique novamente para reenviar se desejar" : "Mandar confirmação via WhatsApp"}
                                  >
                                    <MessageSquare className={`h-3 w-3 ${isAnnotated ? 'text-orange-500' : 'text-emerald-500'}`} />
                                    <span>{isAnnotated ? 'Avisado / Anotado' : 'Pedido Anotado'}</span>
                                  </button>
                                );
                              })()}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSale(sale);
                                }}
                                className="px-2 py-1 bg-zinc-950 border border-zinc-805 hover:border-brand-pink text-zinc-300 hover:text-brand-pink rounded-md text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                              >
                                <Pencil className="h-3 w-3" />
                                <span>Editar</span>
                              </button>
                              {sale.statusProducao === 'Pronto para Retirada' && sale.avisoProntoSended && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const confirmSched = window.confirm(`Deseja agendar a entrega do pedido de ${sale.cliente}?`);
                                    if (confirmSched) {
                                      playAppSound('success');
                                      if (onUpdateSale) {
                                        onUpdateSale({
                                          ...sale,
                                          statusProducao: 'Agendado para Entrega',
                                          status: 'Pago total',
                                          valorPago: sale.total,
                                          valorFaltante: 0
                                        });
                                      }
                                    }
                                  }}
                                  className="px-2 py-1 bg-purple-950/45 border border-purple-800 hover:border-purple-400 text-purple-300 hover:text-purple-100 rounded-md text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0 animate-pulse-slow font-sans"
                                >
                                  <span>🚚 Agendar Entrega</span>
                                </button>
                              )}
                              {isAdmin && (
                                <>
                                  {saleIdToDelete === sale.id ? (
                                    <div 
                                      className="flex items-center gap-1.5 bg-red-950/40 border border-red-900/60 rounded px-2 py-0.5 animate-fade-in shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="password"
                                        placeholder="Senha"
                                        value={saleDeletePassword}
                                        onChange={(e) => setSaleDeletePassword(e.target.value)}
                                        className="w-16 px-1.5 py-0.5 bg-black border border-red-950 focus:border-red-905 rounded text-[9.5px] font-mono focus:outline-none text-zinc-100 placeholder-red-900/40"
                                        title="Insira a senha de administrador"
                                      />
                                      <button
                                        onClick={(e) => handleDeleteSaleSubmit(e, sale.id)}
                                        disabled={isDeletingSaleId === sale.id || saleDeletePassword !== '69apagar69'}
                                        className="p-1 hover:bg-black/40 text-emerald-400 hover:text-emerald-350 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        title={saleDeletePassword === '69apagar69' ? "Confirmar exclusão definitiva do banco" : "Digite a senha correta para destravar"}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSaleIdToDelete(null);
                                          setSaleDeletePassword('');
                                        }}
                                        disabled={isDeletingSaleId === sale.id}
                                        className="p-1 hover:bg-black/40 text-red-500 hover:text-red-400 rounded cursor-pointer"
                                        title="Cancelar"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSaleIdToDelete(sale.id);
                                        setSaleDeletePassword('');
                                      }}
                                      className="px-2 py-1 bg-zinc-950 border border-zinc-805 hover:border-red-500 text-zinc-400 hover:text-red-400 rounded-md text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                                      title="Excluir este pedido permanentemente do sistema"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      <span>Excluir</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {displayedSales.length > visibleSalesCount && (
                <div className="py-3 text-center text-[10px] text-zinc-500 font-bold border-t border-zinc-800/45 bg-zinc-950/20 select-none">
                  Role para ver mais ({visibleSalesCount} de {displayedSales.length} vendas exibidas)
                </div>
              )}
            </div>
          )}
        </div>

      {/* Edit Sale Modal Overlay */}
      <AnimatePresence>
        {editingSale && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative select-text my-8"
            >
              <div className="px-6 py-4.5 border-b border-zinc-800 flex justify-between items-center bg-black/20">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-brand-pink/10 border border-brand-pink/20 rounded-md text-brand-pink">
                    <Pencil className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100 text-sm">Editar Informações da Venda</h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5">ID: {editingSale.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                {/* Editable Items List */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                    <span className="text-zinc-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5 animate-pulse-slow">
                      <ShoppingBag className="h-3.5 w-3.5 text-brand-pink" />
                      Produtos no Pedido:
                    </span>
                    <span className="text-xs font-bold font-mono text-brand-pink">
                      Total: R$ {editTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* List of current items */}
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {editItens.map((item, idx) => {
                      return (
                        <div key={item.id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
                          {/* Product selection/name */}
                          <div className="flex-1 min-w-0 font-medium">
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
                                className="w-full bg-black border border-zinc-805 rounded-lg px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-brand-pink font-medium cursor-pointer"
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
                                className="px-2 h-full hover:bg-zinc-805 border-r border-zinc-800 text-zinc-400 font-bold hover:text-zinc-250 select-none cursor-pointer"
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
                                className="px-2 h-full hover:bg-zinc-805 border-l border-zinc-800 text-zinc-400 font-bold hover:text-zinc-250 select-none cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            {/* Price Override */}
                            <div className="relative w-20">
                              <span className="absolute left-1.5 inset-y-0 flex items-center text-[9px] text-zinc-550 select-none font-sans">R$</span>
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
                    <div className="pt-2 border-t border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                            const uniqueIdSuffix = Math.random().toString(36).substring(2, 7);
                            setEditItens([
                              ...editItens,
                              {
                                id: `item-${dbProd.id}-${Date.now()}-${uniqueIdSuffix}`,
                                produtoId: dbProd.id,
                                produtoNome: dbProd.nome,
                                precoUn: dbProd.preco,
                                quantidade: 1,
                                total: dbProd.preco
                              }
                            ]);
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

                {/* Opções de Serviços e Taxas Adicionais na Edição */}
                {(() => {
                  const activeEditServicesCount = (editArteDesign ? 1 : 0) + (editSegundaArte ? 1 : 0) + (editTemTaxaUrgencia ? 1 : 0) + (editTemTaxaCartao ? 1 : 0);
                  return (
                    <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-xl space-y-3 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          setEditShowServicosTaxas(prev => !prev);
                          playSound('add');
                        }}
                        className="w-full flex items-center justify-between text-left focus:outline-none select-none group"
                      >
                        <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 select-none font-sans">
                          <span>✨ Serviços e Taxas Adicionais do Pedido:</span>
                          {activeEditServicesCount > 0 && (
                            <span className="bg-brand-pink/20 text-brand-pink px-2 py-0.5 rounded-full text-[9px] font-extrabold animate-pulse">
                              {activeEditServicesCount} selecionado{activeEditServicesCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </span>
                        <span className="text-[10.5px] font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors flex items-center gap-1 bg-zinc-850/60 hover:bg-zinc-800/80 px-2 py-1 rounded-lg">
                          {editShowServicosTaxas ? (
                            <>Ocultar <span className="font-mono text-[9px]">▲</span></>
                          ) : (
                            <>Ver taxas/serviços <span className="font-mono text-[9px]">▼</span></>
                          )}
                        </span>
                      </button>
                      
                      {editShowServicosTaxas && (
                        <div className="pt-3 border-t border-zinc-850/50 mt-1 animate-fade-in space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Botão de Arte do Design */}
                            <label
                              className={`flex items-center gap-2.5 px-3 py-2 border rounded-xl cursor-pointer select-none transition-all ${
                                editArteDesign
                                  ? 'bg-brand-pink/12 border-brand-pink/40 text-brand-pink shadow-[0_0_8px_rgba(236,72,153,0.04)]'
                                  : 'bg-black/30 border-zinc-850 text-zinc-400 hover:border-zinc-700/80 hover:bg-black/40'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={editArteDesign}
                                onChange={() => {
                                  setEditArteDesign(prev => !prev);
                                  playSound(editArteDesign ? 'remove' : 'add');
                                }}
                                className="rounded border-zinc-800 text-brand-pink focus:ring-0 accent-brand-pink h-4 w-4 cursor-pointer bg-black"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold truncate text-zinc-200">
                                  🎨 Arte do Design
                                </span>
                                <span className="text-[10px] font-mono text-brand-pink font-bold">
                                  + R$ 5,00
                                </span>
                              </div>
                            </label>

                            {/* Botão de Segunda Arte */}
                            <label
                              className={`flex items-center gap-2.5 px-3 py-2 border rounded-xl cursor-pointer select-none transition-all ${
                                editSegundaArte
                                  ? 'bg-purple-500/12 border-purple-500/40 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.04)]'
                                  : 'bg-black/30 border-zinc-850 text-zinc-400 hover:border-zinc-700/80 hover:bg-black/40'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={editSegundaArte}
                                onChange={() => {
                                  setEditSegundaArte(prev => !prev);
                                  playSound(editSegundaArte ? 'remove' : 'add');
                                }}
                                className="rounded border-zinc-800 text-purple-500 focus:ring-0 accent-purple-500 h-4 w-4 cursor-pointer bg-black"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold truncate text-zinc-200">
                                  🎨 Segunda Arte
                                </span>
                                <span className="text-[10px] font-mono text-purple-400 font-bold">
                                  + R$ 5,00
                                </span>
                              </div>
                            </label>

                            {/* Botão de Taxa de Urgência */}
                            <label
                              className={`flex items-center gap-2.5 px-3 py-2 border rounded-xl cursor-pointer select-none transition-all ${
                                editTemTaxaUrgencia
                                  ? 'bg-amber-500/12 border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.04)]'
                                  : 'bg-black/30 border-zinc-850 text-zinc-400 hover:border-zinc-700/80 hover:bg-black/40'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={editTemTaxaUrgencia}
                                onChange={() => {
                                  const nextState = !editTemTaxaUrgencia;
                                  setEditTemTaxaUrgencia(nextState);
                                  playSound(nextState ? 'add' : 'remove');
                                  if (!nextState) {
                                    setEditValorTaxaUrgencia('');
                                  }
                                }}
                                className="rounded border-zinc-800 text-amber-500 focus:ring-0 accent-amber-500 h-4 w-4 cursor-pointer bg-black"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold truncate text-zinc-200">
                                  ⚡ Taxa de Urgência
                                </span>
                                <span className="text-[10px] font-mono text-amber-400 font-bold">
                                  {editValorTaxaUrgencia ? `+ R$ ${parseFloat(editValorTaxaUrgencia).toFixed(2)}` : 'Informa Valor'}
                                </span>
                              </div>
                            </label>

                            {/* Botão de Taxa do Cartão */}
                            <label
                              className={`flex items-center gap-2.5 px-3 py-2 border rounded-xl cursor-pointer select-none transition-all ${
                                editTemTaxaCartao
                                  ? 'bg-blue-500/12 border-blue-500/40 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.04)]'
                                  : 'bg-black/30 border-zinc-850 text-zinc-400 hover:border-zinc-700/80 hover:bg-black/40'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={editTemTaxaCartao}
                                onChange={() => {
                                  const nextState = !editTemTaxaCartao;
                                  setEditTemTaxaCartao(nextState);
                                  playSound(nextState ? 'add' : 'remove');
                                  if (!nextState) {
                                    setEditValorTaxaCartao('');
                                  }
                                }}
                                className="rounded border-zinc-800 text-blue-500 focus:ring-0 accent-blue-500 h-4 w-4 cursor-pointer bg-black"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold truncate text-zinc-200">
                                  💳 Taxa do Cartão
                                </span>
                                <span className="text-[10px] font-mono text-blue-400 font-bold">
                                  {editValorTaxaCartao ? `+ R$ ${parseFloat(editValorTaxaCartao).toFixed(2)}` : 'Informa Valor'}
                                </span>
                              </div>
                            </label>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                            {editTemTaxaUrgencia && (
                              <div className="text-left animate-fade-in pt-1">
                                <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 font-sans select-none">
                                  Valor da taxa de urgência (R$):
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3.5 top-2 text-xs text-zinc-500 font-mono font-bold">
                                    R$
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Digite o valor..."
                                    value={editValorTaxaUrgencia}
                                    onChange={(e) => setEditValorTaxaUrgencia(e.target.value)}
                                    className="w-full bg-zinc-950 border border-amber-500/30 rounded-xl py-1.5 pl-9 pr-4 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500 transition-colors"
                                  />
                                </div>
                              </div>
                            )}

                            {editTemTaxaCartao && (
                              <div className="text-left animate-fade-in pt-1">
                                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5 font-sans select-none">
                                  Valor da taxa do cartão (R$):
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3.5 top-2 text-xs text-zinc-500 font-mono font-bold">
                                    R$
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Digite o valor..."
                                    value={editValorTaxaCartao}
                                    onChange={(e) => setEditValorTaxaCartao(e.target.value)}
                                    className="w-full bg-zinc-950 border border-blue-500/30 rounded-xl py-1.5 pl-9 pr-4 text-xs font-mono text-blue-300 focus:outline-none focus:border-blue-500 transition-colors"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {editingSale && editingSale.status === 'Orçamento' && (
                  <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/40 rounded-xl flex items-center justify-between gap-3 select-none transition-all">
                    <div className="flex-1">
                      <span className="text-xs font-bold text-emerald-400 block font-display uppercase tracking-wider">
                        🛒 Converter Orçamento em Pedido
                      </span>
                      <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                        Marque para aprovar este orçamento e transformá-lo em um pedido real (com baixa automática de estoque).
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={editConvertToOrder}
                        onChange={(e) => {
                          setEditConvertToOrder(e.target.checked);
                          if (e.target.checked) {
                            setEditValorPago(editTotal.toString());
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white peer-checked:after:border-transparent"></div>
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Client Name Input */}
                  <div>
                    <label htmlFor="edit-client" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Nome do Cliente
                    </label>
                    <input
                      id="edit-client"
                      type="text"
                      value={editCliente}
                      onChange={(e) => setEditCliente(e.target.value)}
                      className="w-full px-3 py-2.5 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-xs"
                      placeholder="Ex: Maria Consumidora"
                      required
                    />
                  </div>

                  {/* Client Phone Input */}
                  <div>
                    <label htmlFor="edit-phone" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Telefone do Cliente
                    </label>
                    <input
                      id="edit-phone"
                      type="tel"
                      value={editTelefone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        let formatted = val;
                        if (val.length > 0) {
                          if (val.length <= 2) {
                            formatted = `(${val}`;
                          } else if (val.length <= 6) {
                            formatted = `(${val.substring(0, 2)}) ${val.substring(2)}`;
                          } else if (val.length <= 10) {
                            formatted = `(${val.substring(0, 2)}) ${val.substring(2, 6)}-${val.substring(6)}`;
                          } else {
                            formatted = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7, 11)}`;
                          }
                        }
                        setEditTelefone(formatted);
                      }}
                      className="w-full px-3 py-2.5 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-xs font-mono"
                      placeholder="Ex: (83) 98885-9302"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Order Number Input */}
                  <div>
                    <label htmlFor="edit-order-number" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Número do Pedido
                    </label>
                    <input
                      id="edit-order-number"
                      type="text"
                      value={editNumeroPedido}
                      onChange={(e) => setEditNumeroPedido(e.target.value)}
                      className="w-full px-3 py-2.5 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-xs font-mono"
                      placeholder="Ex: 2548"
                    />
                  </div>

                  {/* Pricing Total (ReadOnly Info) */}
                  <div>
                    <span className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Total da Venda
                    </span>
                    <div className="w-full px-3 py-2.5 bg-black/35 border border-zinc-850 rounded-lg text-brand-pink text-xs font-bold leading-normal flex items-center h-[41px] font-mono">
                      R$ {editTotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Edit Withdrawal/Pickup Date */}
                  <div className={isBudget ? 'col-span-2' : ''}>
                    <label htmlFor="edit-pickup-date" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Data da Retirada (Opcional)
                    </label>
                    <input
                      id="edit-pickup-date"
                      type="date"
                      value={editDataRetirada}
                      onChange={(e) => setEditDataRetirada(e.target.value)}
                      className="w-full px-3 py-2.5 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-xs font-mono font-semibold"
                    />
                  </div>

                  {/* Edit Production Status */}
                  {!isBudget && (
                    <div>
                      <label htmlFor="edit-production-status" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        Status de Produção
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
                  )}
                </div>

                {/* Edit Payment Method Select Options */}
                {!isBudget && (
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
                )}

                {/* Paid amount & automatic recalculation */}
                {!isBudget ? (
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
                      <div className="px-3 py-2 bg-black border border-zinc-850 rounded-lg text-sm text-zinc-300 flex items-center h-[38px] font-mono justify-between font-medium">
                        <span className="text-zinc-550 text-[10px] select-none uppercase font-bold">Restante:</span>
                        <span className={`font-bold ${(editTotal - (editValorPago === '' ? editTotal : parseFloat(editValorPago) || 0)) > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                          R$ {Math.max(0, editTotal - (editValorPago === '' ? editTotal : parseFloat(editValorPago) || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-950/15 border border-amber-900/30 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-amber-400 flex items-center justify-center gap-1.5 font-display uppercase tracking-wider select-none">
                      📄 Informativo de Orçamento Sem Compromisso
                    </span>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-normal font-medium select-none">
                      Este pedido é uma proposta de orçamento. Não há lançamento financeiro ou baixa de estoque.
                    </p>
                  </div>
                )}

                {/* Linked Order/Pedido Conjunto para Edição */}
                <div className="bg-sky-950/20 border border-sky-900/40 p-4 rounded-xl space-y-2 mt-4">
                  <span className="block text-xs font-bold text-sky-400 uppercase select-none flex items-center gap-1.5 font-sans">
                    🔗 Vínculo de Pedido Conjunto (Retirada Casada)
                  </span>
                  <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                    Vincule este pedido a outro número de pedido já cadastrado. Os lembretes de aviso de pronto para ambos os pedidos serão sincronizados e bloqueados até que ambos estejam prontos!
                  </p>
                  <div>
                    <input
                      type="text"
                      placeholder="Ex: 30125"
                      value={editPedidoVinculoNumero}
                      onChange={(e) => setEditPedidoVinculoNumero(e.target.value)}
                      className="w-full px-3 py-1.5 bg-black border border-sky-900/40 rounded-lg text-xs font-bold text-sky-300 font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-zinc-700 uppercase"
                    />
                    
                    {/* Sibling orders helper */}
                    {editingSale && (() => {
                      const clientNamePrefix = editCliente.trim().split(' ')[0].toLowerCase();
                      const siblingActiveSales = sales.filter(s => 
                        s.id !== editingSale.id &&
                        s.numeroPedido && 
                        s.cliente && 
                        s.cliente.trim().toLowerCase().includes(clientNamePrefix) && 
                        s.statusProducao !== 'Entregue'
                      );
                      
                      if (siblingActiveSales.length > 0) {
                        return (
                          <div className="mt-2 space-y-1">
                            <span className="block text-[9px] text-sky-400 font-bold uppercase select-none">
                              Sugestões de pedidos do mesmo cliente para vincular:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {siblingActiveSales.map(sib => (
                                <button
                                  key={sib.id}
                                  type="button"
                                  onClick={() => setEditPedidoVinculoNumero(sib.numeroPedido || '')}
                                  className="px-2 py-1 bg-sky-950/40 hover:bg-sky-900/50 text-sky-300 border border-sky-900/40 hover:border-sky-500 rounded text-[9px] font-mono transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <span>#{sib.numeroPedido}</span>
                                  <span className="opacity-60">({sib.produtoNome})</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
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

      <WhatsAppNotifier
        sale={whatsAppSale}
        isOpen={whatsAppSale !== null}
        onClose={() => setWhatsAppSale(null)}
        onUpdateSale={onUpdateSale}
        storeInfo={storeInfo}
      />

    </div>
  );
}
