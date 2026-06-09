/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Users, Calendar, DollarSign, Wallet, FileText, CheckCircle2, RotateCcw, Search, Phone, Pencil, X, Plus, Trash2, MessageSquare, Check, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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

export function SalesManager({ products, sales, storeInfo, onRecordSale, onUpdateStock, onUpdateSale, onDeleteSale, currentUserEmail = '' }: SalesManagerProps) {
  const isAdmin = currentUserEmail.trim().toLowerCase() === 'oxentefesteje@gmail.com' || currentUserEmail.trim().toLowerCase() === 'abraaoapp@oxente.com';
  const [selectedProductId, setSelectedProductId] = useState('');
  const [cliente, setCliente] = useState('Consumidor');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [quantidade, setQuantidade] = useState<number | ''>(1);
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>('Pix');
  const [valorPagoInput, setValorPagoInput] = useState('');
  const [numeroPedido, setNumeroPedido] = useState('');
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

  const [productFilterTerm, setProductFilterTerm] = useState('');
  const [productSortOption, setProductSortOption] = useState<'nome' | 'preco_asc' | 'preco_desc' | 'estoque_desc'>('nome');

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
  const [cart, setCart] = useState<{ id: string; product: Product; quantity: number; total: number }[]>([]);

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

  // States for editing a sale
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleIdToDelete, setSaleIdToDelete] = useState<string | null>(null);
  const [saleDeletePassword, setSaleDeletePassword] = useState('');
  const [isDeletingSaleId, setIsDeletingSaleId] = useState<string | null>(null);
  const [editCliente, setEditCliente] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editNumeroPedido, setEditNumeroPedido] = useState('');
  const [editFormaPagamento, setEditFormaPagamento] = useState<PaymentMethod>('Pix');
  const [editValorPago, setEditValorPago] = useState('');
  const [editDataRetirada, setEditDataRetirada] = useState('');
  const [editStatusProducao, setEditStatusProducao] = useState<'Agendado' | 'Em Produção' | 'Pronto para Retirada' | 'Entregue'>('Agendado');

  const [editItens, setEditItens] = useState<SaleItem[]>([]);
  const [selectedAddProductId, setSelectedAddProductId] = useState('');

  const editTotal = useMemo(() => {
    return editItens.reduce((sum, item) => sum + (item.precoUn * item.quantidade), 0);
  }, [editItens]);

  // Sync edit states when editingSale shifts
  React.useEffect(() => {
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
  
  // Keep track of the active sale being simulated in the receipt section
  const [viewedSale, setViewedSale] = useState<Sale | null>(
    sales.length > 0 ? sales[sales.length - 1] : null
  );

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
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'this_month' | 'custom'>('all');
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
    if (!term) return true;
    
    const matchName = sale.cliente.toLowerCase().includes(term);
    const matchProduct = sale.produtoNome.toLowerCase().includes(term);
    const matchOrderNum = sale.numeroPedido ? sale.numeroPedido.toLowerCase().includes(term) : false;
    const matchPhone = sale.telefoneCliente ? sale.telefoneCliente.replace(/\D/g, '').includes(term.replace(/\D/g, '')) : false;
    
    return matchName || matchProduct || matchOrderNum || matchPhone;
  });

  // Filter and Sort products that are available in stock
  const availableProducts = useMemo(() => {
    let list = products.filter(p => p.estoque > 0 || p.estoqueInfinito);
    
    // Filter
    if (productFilterTerm.trim()) {
      const term = productFilterTerm.toLowerCase().trim();
      list = list.filter(p => p.nome.toLowerCase().includes(term));
    }

    // Sort
    return [...list].sort((a, b) => {
      if (productSortOption === 'nome') {
        return a.nome.localeCompare(b.nome);
      }
      if (productSortOption === 'preco_asc') {
        return a.preco - b.preco;
      }
      if (productSortOption === 'preco_desc') {
        return b.preco - a.preco;
      }
      if (productSortOption === 'estoque_desc') {
        const estA = a.estoqueInfinito ? 999999 : a.estoque;
        const estB = b.estoqueInfinito ? 999999 : b.estoque;
        return estB - estA;
      }
      return 0;
    });
  }, [products, productFilterTerm, productSortOption]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const totalVendaSemDesconto = useMemo(() => {
    if (cart.length > 0) {
      return cart.reduce((sum, item) => sum + item.total, 0);
    }
    return selectedProduct && typeof quantidade === 'number' 
      ? getProductUnitPrice(selectedProduct, quantidade) * quantidade 
      : 0;
  }, [cart, selectedProduct, quantidade]);

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

  const totalVenda = useMemo(() => {
    const discountedValue = totalVendaSemDesconto * (1 - descontoPercent / 100);
    return Number(Math.max(0, discountedValue).toFixed(2));
  }, [totalVendaSemDesconto, descontoPercent]);

  // Calcule o faturamento diário dos últimos 7 dias
  const getDailyRevenueData = () => {
    const dataMap: { [dateStr: string]: number } = {};
    
    // Inicializar os últimos 7 dias com 0
    for (let i = 6; i >= 0; i--) {
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

  const chartData = getDailyRevenueData();

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

    const alreadyInCartQty = cart
      .filter(item => item.product.id === prod.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    if (registroTipo !== 'Orçamento' && !prod.estoqueInfinito && (qtyNum + alreadyInCartQty) > prod.estoque) {
      setFormError(`Quantidade indisponível no estoque! Estoque atual de "${prod.nome}": ${prod.estoque} un. (Já possui ${alreadyInCartQty} no carrinho).`);
      return;
    }

    setFormError('');

    const existingIdx = cart.findIndex(c => c.product.id === prod.id);
    if (existingIdx > -1) {
      const updatedCart = [...cart];
      const newQuantity = updatedCart[existingIdx].quantity + qtyNum;
      const unitPrice = getProductUnitPrice(prod, newQuantity);
      updatedCart[existingIdx].quantity = newQuantity;
      updatedCart[existingIdx].total = newQuantity * unitPrice;
      setCart(updatedCart);
    } else {
      const unitPrice = getProductUnitPrice(prod, qtyNum);
      setCart([
        ...cart,
        {
          id: `item-${prod.id}-${Date.now()}`,
          product: prod,
          quantity: qtyNum,
          total: qtyNum * unitPrice
        }
      ]);
    }

    // Play subtle audio cue
    playSound('add');

    // Reset single item selector fields
    setSelectedProductId('');
    setQuantidade(1);
    setSuccessMsg(`"${prod.nome}" adicionado ao carrinho!`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleRegisterSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (cart.length === 0 && !selectedProductId) {
      setFormError('Escolha um brinde/produto ou adicione itens ao carrinho.');
      return;
    }

    let finalItens: SaleItem[] = [];

    if (cart.length > 0) {
      finalItens = cart.map(item => ({
        id: item.id,
        produtoId: item.product.id,
        produtoNome: item.product.nome,
        precoUn: getProductUnitPrice(item.product, item.quantity),
        quantidade: item.quantity,
        total: item.total
      }));
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
      const progressiveUnitPrice = getProductUnitPrice(selectedProduct, qtyNum);
      finalItens = [{
        id: `item-${selectedProduct.id}-${Date.now()}`,
        produtoId: selectedProduct.id,
        produtoNome: selectedProduct.nome,
        precoUn: progressiveUnitPrice,
        quantidade: qtyNum,
        total: progressiveUnitPrice * qtyNum
      }];
    }

    const valPagoNum = valorPagoInput.trim() === '' ? totalVenda : parseFloat(valorPagoInput);
    const finalValorPago = registroTipo === 'Orçamento' ? 0 : (isNaN(valPagoNum) ? totalVenda : valPagoNum);
    const finalValorFaltante = registroTipo === 'Orçamento' ? totalVenda : Math.max(0, totalVenda - finalValorPago);

    const mainItem = finalItens[0];
    const mainProdutoId = mainItem.produtoId;
    const mainProdutoNome = finalItens.length > 1
      ? `${mainItem.produtoNome} (+${finalItens.length - 1} itens)`
      : mainItem.produtoNome;
    const mainPrecoUn = mainItem.precoUn;
    const mainQuantidade = finalItens.reduce((sum, item) => sum + item.quantidade, 0);

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

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      cliente: cliente.trim() || 'Consumidor',
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
      numeroPedido: String(nextPedidoNumber),
      status: registroTipo === 'Orçamento' ? 'Orçamento' : (finalValorFaltante > 0 ? 'Pendente' : 'Pago total'),
      itens: finalItens,
      criadoPorEmail: currentUserEmail || 'Desconhecido',
      dataRetirada: dataRetirada || undefined,
      statusProducao: registroTipo === 'Orçamento' ? undefined : statusProducao
    };

    // Salvar venda (que agora deduz o estoque de forma atômica no pai)
    onRecordSale(newSale);

    // Play victory success sound cue
    playSound('success');

    // Define newly registered sale as the viewed receipt
    setViewedSale(newSale);
    setTimeout(() => {
      receiptColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    setSuccessMsg(registroTipo === 'Orçamento' ? 'Orçamento gerado com sucesso! Verifique a folha de recibo ao lado.' : 'Estoque atualizado e venda processada com sucesso!');

    // Reset fields (keeping client as Consumidor)
    setSelectedProductId('');
    setQuantidade(1);
    setCliente('Consumidor');
    setTelefoneCliente('');
    setValorPagoInput('');
    setNumeroPedido('');
    setDataRetirada('');
    setStatusProducao('Agendado');
    setDescontoPercent(0);
    setCustomPctInput('');
    setCustomValInput('');
    setCart([]);

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
      status: finalValorFaltante > 0 ? 'Pendente' : 'Pago total',
      dataRetirada: editDataRetirada || undefined,
      statusProducao: editStatusProducao,
      itens: editItens,
      foiAlterado: true,
      editadoPorEmail: currentUserEmail,
      editadoEm: new Date().toISOString(),
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

    const message = `Seu pedido foi anotado! 📝✨

*Número do Pedido:* ${orderNum}
*Produto(s) solicitado(s):*
${itensDetail}

*Quanto pagou:* R$ ${valorPago.toFixed(2)}
*Quanto falta:* R$ ${valorFaltante.toFixed(2)}
*Data de retirada:* ${dataRetiradaFormatted}

Muito obrigado pela preferência! Oxente Festeje 🎈`;

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* CHART SECTION: Daily Revenue Chart in beautiful Gold Style */}
      {isAdmin && (
        <div className="lg:col-span-12 no-print bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-brand-pink/10 border border-brand-pink/20 rounded-lg text-brand-pink">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-lg text-zinc-100">Desempenho de Faturamento</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Faturamento diário dos últimos 7 dias</p>
              </div>
            </div>
            <div className="flex flex-col text-left sm:text-right">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total Acumulado (7 Dias)</span>
              <span className="text-xl font-extrabold text-brand-pink mt-0.5">
                R$ {chartData.reduce((acc, curr) => acc + curr.value, 0).toFixed(2)}
              </span>
            </div>
          </div>
          
          {/* Chart Area */}
          <div className="relative h-48 w-full min-w-0 mt-6">
            <ResponsiveContainer width="100%" height={192} minWidth={0}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  dy={8}
                  fontFamily="JetBrains Mono"
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `R$ ${val}`}
                  dx={-8}
                  fontFamily="JetBrains Mono"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(197, 146, 24, 0.05)' }} />
                <Bar 
                  dataKey="value" 
                  fill="#c59218" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* New Green Closed Orders Metric Section */}
          <div id="closed-orders-metric-container" className="mt-6 pt-6 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div id="closed-orders-icon-badge" className="p-2 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-emerald-400">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Pedidos Fechados</span>
                <span id="closed-orders-count-value" className="text-xl font-extrabold text-emerald-400 mt-0.5 block">
                  {closedOrdersCount} {closedOrdersCount === 1 ? 'pedido fechado' : 'pedidos fechados'}
                </span>
              </div>
            </div>
            
            <div id="closed-orders-date-selector" className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-xl border border-zinc-800/80">
              <span className="text-[10px] text-zinc-400 font-medium">A partir de:</span>
              <input
                id="metric-start-date-picker"
                type="date"
                value={metricStartDate}
                onChange={(e) => setMetricStartDate(e.target.value)}
                className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink text-zinc-200 text-xs font-mono h-7"
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

              {/* Filtering and Sorting control panel */}
              {products.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <input
                      type="text"
                      placeholder="🔍 Filtrar produtos..."
                      value={productFilterTerm}
                      onChange={(e) => setProductFilterTerm(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/60 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-brand-pink text-xs"
                    />
                  </div>
                  <div>
                    <select
                      value={productSortOption}
                      onChange={(e) => setProductSortOption(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-black border border-zinc-800 rounded-lg text-zinc-350 focus:outline-none focus:border-brand-pink text-xs"
                    >
                      <option value="nome">Sort: Nome [A-Z]</option>
                      <option value="preco_asc">Sort: Menor Preço</option>
                      <option value="preco_desc">Sort: Maior Preço</option>
                      <option value="estoque_desc">Sort: Maior Estoque</option>
                    </select>
                  </div>
                </div>
              )}

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
                    {productFilterTerm ? 'Nenhum resultado corresponde ao filtro!' : 'Todos os produtos estão esgotados!'}
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
            </div>

            {/* Client and Phone fields row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sale-client" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Nome do Cliente
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
                    placeholder="Ex: Maria Consumidora"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sale-client-phone" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Telefone do Cliente
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

            {/* Withdrawal Date and initial Production Status row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sale-pickup-date" className="block text-sm font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <span>📅</span> Data de Retirada (Opcional)
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

              <div>
                <label htmlFor="sale-initial-prod-status" className="block text-sm font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <span>⚙️</span> Status de Produção Inicial
                </label>
                <select
                  id="sale-initial-prod-status"
                  value={statusProducao}
                  onChange={(e) => setStatusProducao(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink text-zinc-150 text-sm font-semibold"
                >
                  <option value="Agendado">📅 Agendado / Reservado</option>
                  <option value="Em Produção">🔨 Em Produção Interna</option>
                  <option value="Pronto para Retirada">✨ Pronto para Retirada</option>
                  <option value="Agendado para Entrega">🚚 Agendado para Entrega</option>
                  <option value="Entregue">🤝 Entregue ao Cliente</option>
                </select>
              </div>
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
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-zinc-100 truncate block">{item.product.nome}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {item.quantity}x de R$ {item.product.preco.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-brand-pink font-mono">
                          R$ {item.total.toFixed(2)}
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
              <div>
                <label htmlFor="sale-paid-amount" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Quanto o cliente pagou? (R$)
                </label>
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
                  placeholder={`Vazio = Integral (R$ ${totalVenda.toFixed(2)})`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Quanto falta pagar? (R$)
                </label>
                <div className="px-3 py-2 bg-black border border-zinc-850 rounded-lg text-sm text-zinc-300 flex items-center h-[38px] font-mono justify-between">
                  <span className="text-zinc-550 text-[11px] select-none uppercase">A Pagar:</span>
                  <span className={`font-bold ${(totalVenda - (valorPagoInput === '' ? totalVenda : parseFloat(valorPagoInput) || 0)) > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                    R$ {Math.max(0, totalVenda - (valorPagoInput === '' ? totalVenda : parseFloat(valorPagoInput) || 0)).toFixed(2)}
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
          <Receipt sale={viewedSale} storeInfo={storeInfo} onUpdateSale={onUpdateSale} />
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
          ) : filteredSales.length === 0 ? (
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
                  if (visibleSalesCount < filteredSales.length) {
                    setVisibleSalesCount(prev => Math.min(prev + 10, filteredSales.length));
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
                    {[...filteredSales].reverse().slice(0, visibleSalesCount).map((sale) => {
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
                              {sale.numeroPedido && (
                                <span className="bg-zinc-800 text-brand-pink text-[9px] font-mono px-1 py-0.5 rounded tracking-wider leading-none" title={`Número do Pedido: ${sale.numeroPedido}`}>
                                  #{sale.numeroPedido}
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
                                          statusProducao: 'Agendado para Entrega'
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

              {filteredSales.length > visibleSalesCount && (
                <div className="py-3 text-center text-[10px] text-zinc-500 font-bold border-t border-zinc-800/45 bg-zinc-950/20 select-none">
                  Role para ver mais ({visibleSalesCount} de {filteredSales.length} vendas exibidas)
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
                  <div>
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
                    <div className="px-3 py-2 bg-black border border-zinc-850 rounded-lg text-sm text-zinc-300 flex items-center h-[38px] font-mono justify-between font-medium">
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
