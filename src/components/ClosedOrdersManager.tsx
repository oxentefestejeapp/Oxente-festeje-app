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
  Smartphone,
  Trophy,
  Filter,
  EyeOff,
  Flame,
  Lock,
  Unlock,
  Crown,
  ShieldCheck,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sale, StoreInfo, Product, SaleItem, formatCpfCnpj, calculateSaleItemUnitCost, SaleProfitAdjustment, getSaleCostInfo, findAddedItemsSummary, getSaleAdjustments, getSaleAdjustmentsForDate } from '../types';
import { Receipt } from './Receipt';
import { CelebrationOverlay, UrgentArtOrderInfo } from './CelebrationOverlay';
import { playAppSound } from '../lib/audio';
import { supabase } from '../lib/supabase';
import QRCode from 'qrcode';

interface ClosedOrdersManagerProps {
  products: Product[];
  sales: Sale[];
  storeInfo: StoreInfo;
  onUpdateSale: (updatedSale: Sale) => void;
  currentUserEmail: string;
  isAdmin?: boolean;
}

export function ClosedOrdersManager({ products, sales, storeInfo, onUpdateSale, currentUserEmail, isAdmin = false }: ClosedOrdersManagerProps) {
  const isAdminUser = Boolean(isAdmin) || currentUserEmail === 'oxentefesteje@gmail.com' || currentUserEmail === 'abraaoapp@oxente.com';
  const [searchTerm, setSearchTerm] = useState('');
  const [viewedSale, setViewedSale] = useState<Sale | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);
  const [copiedApprovalMsg, setCopiedApprovalMsg] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const receiptContainerRef = useRef<HTMLDivElement>(null);

  // States for editing a sale inside ClosedOrdersManager
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editCliente, setEditCliente] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editDocumentoCliente, setEditDocumentoCliente] = useState('');
  const [showEditDocumentoInput, setShowEditDocumentoInput] = useState(false);
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
  const [hideFinishedInColumns, setHideFinishedInColumns] = useState(false);
  const [filterUrgentOnly, setFilterUrgentOnly] = useState(false);
  const [urgentMaxDays, setUrgentMaxDays] = useState<'all' | number>('all');
  const [customUrgentDaysInput, setCustomUrgentDaysInput] = useState('');
  const [selectedUrgentChipId, setSelectedUrgentChipId] = useState<string | null>(null);
  const [sortByPriority, setSortByPriority] = useState(true);
  const [filterPendingApprovalOnly, setFilterPendingApprovalOnly] = useState(false);
  const [col1Limit, setCol1Limit] = useState(35);
  const [col2Limit, setCol2Limit] = useState(35);
  const [col3Limit, setCol3Limit] = useState(35);
  const [colAdminLimit, setColAdminLimit] = useState(35);

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
      const doc = editingSale.documentoCliente || editingSale.cpfCnpj || '';
      setEditDocumentoCliente(doc);
      setShowEditDocumentoInput(!!doc);
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
          total: (editingSale.precoUn || 0) * (editingSale.quantidade || 1),
          custoUn: editingSale.custoUn
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
      documentoCliente: editingSale.documentoCliente || editingSale.cpfCnpj,
      cpfCnpj: editingSale.documentoCliente || editingSale.cpfCnpj,
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

    const finalEditDoc = editDocumentoCliente.trim() ? editDocumentoCliente.trim() : undefined;

    const finalItensToSave = editItens.map(item => {
      const hasExistingCost = item.custoUn !== undefined && item.custoUn !== null && !isNaN(item.custoUn) && item.custoUn >= 0;
      const itemCost = hasExistingCost
        ? item.custoUn
        : calculateSaleItemUnitCost(item, editingSale.data || new Date().toISOString(), products);
      return {
        ...item,
        custoUn: itemCost
      };
    });

    // 💰 Rastreamento de acréscimo de produtos e atribuição de lucro ao dia da alteração
    const oldCostInfo = getSaleCostInfo(editingSale, products);
    const oldTotal = editingSale.total || 0;
    const oldLucro = oldCostInfo.lucro;
    const oldCusto = oldCostInfo.totalCusto;

    const tempUpdatedSale: Sale = {
      ...editingSale,
      total: editTotal,
      itens: finalItensToSave
    };
    const newCostInfo = getSaleCostInfo(tempUpdatedSale, products);
    const newTotal = editTotal;
    const newCusto = newCostInfo.totalCusto;
    const newLucro = newCostInfo.lucro;

    const diffTotal = Number((newTotal - oldTotal).toFixed(2));
    const diffCusto = Number((newCusto - oldCusto).toFixed(2));
    const diffLucro = Number((newLucro - oldLucro).toFixed(2));

    const currentAjustes: SaleProfitAdjustment[] = [...getSaleAdjustments(editingSale)];

    // Se houve alteração (acréscimo OU diminuição) no valor ou no lucro do pedido
    if (Math.abs(diffTotal) >= 0.01 || Math.abs(diffLucro) >= 0.01) {
      const changeDesc = findAddedItemsSummary(editingSale.itens || [], finalItensToSave);
      const newAdjustment: SaleProfitAdjustment = {
        id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        data: new Date().toISOString(),
        valorAdicional: diffTotal,
        custoAdicional: diffCusto,
        lucroAdicional: diffLucro,
        descricao: changeDesc,
        editadoPorEmail: currentUserEmail
      };
      currentAjustes.push(newAdjustment);
      originalValues.ajustesLucro = currentAjustes;
    }

    const updatedSale: Sale = {
      ...editingSale,
      cliente: editCliente.trim() || 'Consumidor',
      telefoneCliente: editTelefone.trim() ? editTelefone.trim() : undefined,
      documentoCliente: finalEditDoc,
      cpfCnpj: finalEditDoc,
      produtoId: mainProdutoId,
      produtoNome: mainProdutoNome,
      precoUn: mainPrecoUn,
      quantidade: mainQuantidade,
      total: editTotal,
      custoUn: editingSale.custoUn !== undefined ? editingSale.custoUn : finalItensToSave[0]?.custoUn,
      formaPagamento: editFormaPagamento,
      valorPago: finalValorPago,
      valorFaltante: finalValorFaltante,
      numeroPedido: editNumeroPedido.trim() ? editNumeroPedido.trim() : undefined,
      dataRetirada: editDataRetirada || undefined,
      statusProducao: editStatusProducao,
      itens: finalItensToSave,
      foiAlterado: true,
      editadoPorEmail: currentUserEmail,
      editadoEm: new Date().toISOString(),
      ajustesLucro: currentAjustes.length > 0 ? currentAjustes : undefined,
      valoresOriginais: originalValues
    };

    onUpdateSale(updatedSale);
    if (viewedSale && viewedSale.id === updatedSale.id) {
      setViewedSale(updatedSale);
    }
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

  // Helper: check if an order has been in "Arte em Produção" for more than 96 hours
  const checkArteDelay = (sale: Sale) => {
    if (sale.statusArte === 'Arte Finalizada') return { isDelayed: false, hours: 0 };
    if (!sale.puxadoEm) return { isDelayed: false, hours: 0 };
    try {
      const start = new Date(sale.puxadoEm).getTime();
      const now = Date.now();
      const diffMs = now - start;
      const diffHours = diffMs / (1000 * 60 * 60);
      return {
        isDelayed: diffHours >= 96,
        hours: Math.floor(diffHours)
      };
    } catch {
      return { isDelayed: false, hours: 0 };
    }
  };

  // User simple display label from email
  const getUserFriendlyName = (email: string) => {
    if (!email) return 'Sistema';
    if (email === 'oxentefesteje@gmail.com' || email === 'abraaoapp@oxente.com') return 'Dona / Admin';
    return email.split('@')[0];
  };

  // Assign or Pull order
  const handlePullOrder = (sale: Sale, targetDesigner: 'designer1' | 'designer2' | 'admin' | null) => {
    if ((targetDesigner === 'admin' || sale.designerId === 'admin') && !isAdminUser) {
      return;
    }
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

  // Formata o número para padrão internacional do WhatsApp (55 + DDD + dígitos)
  const formatWhatsappNumber = (phoneStr?: string): string => {
    if (!phoneStr) return '';
    let digits = phoneStr.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 11 && !digits.startsWith('55')) {
      digits = `55${digits}`;
    }
    return digits;
  };

  // Gera a mensagem de aprovação de arte contendo confirmação de layout, cores e ortografia
  const getLayoutApprovalMessage = (sale: Sale): string => {
    const clientName = sale.cliente || 'Cliente';
    const storeName = storeInfo?.nome && !/^\d{10,}$/.test(storeInfo.nome.trim()) ? storeInfo.nome : 'Oxente Festeje';
    const baseUrl = window.location.origin;
    const approvalParam = encodeURIComponent(sale.numeroPedido || sale.id);
    const approvalLink = `${baseUrl}/?aprovar=${approvalParam}`;

    return `Olá, *${clientName}*! Tudo bem? 🎨✨

📌 *Confirmação de Aprovação do Layout:*
Informamos que, ao clicar no link, *você CONFIRMA* que conferiu com atenção todas as informações mostradas no layout, inclusive:

✅ Cores do produto e modelos;
✅️ Possíveis erros de digitação;
✅ Textos, nomes, idades, datas;
✅ Todos os detalhes;
✅️ O produto será como foi aprovado;


👉 *Para registrar formalmente sua aprovação e liberar para a produção, clique no link abaixo e confirme em 1 toque:*
🔗 ${approvalLink}
 
Muito obrigado pela confiança e preferência!
*${storeName}*🎈`;
  };

  // Disparo automático via WhatsApp
  const sendLayoutApprovalWhatsapp = (sale: Sale) => {
    const numToUse = formatWhatsappNumber(sale.telefoneCliente);
    const text = getLayoutApprovalMessage(sale);
    const encodedText = encodeURIComponent(text);

    let url = '';
    if (numToUse) {
      url = `https://api.whatsapp.com/send?phone=${numToUse}&text=${encodedText}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    try {
      window.open(url, '_blank');
    } catch (e) {
      console.warn('Erro ao abrir WhatsApp automaticamente:', e);
    }
  };

  // Quantas horas se passaram desde o envio/finalização da arte sem aprovação do cliente
  const getHoursWaitingApproval = (sale: Sale): number => {
    if (sale.statusArte !== 'Arte Finalizada' || sale.clienteAprovouLayout) return 0;
    const refDateStr = sale.arteFinalizadaEm || sale.puxadoEm || sale.data;
    if (!refDateStr) return 0;
    try {
      const diffMs = Date.now() - new Date(refDateStr).getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    } catch {
      return 0;
    }
  };

  const formatWaitingTime = (hours: number): string => {
    if (hours < 1) return 'agora';
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `há ${days}d ${remHours}h` : `há ${days}d`;
  };

  // Mensagem de cobrança rápida no WhatsApp para artes paradas aguardando aprovação (+24h/+48h)
  const sendLayoutApprovalReminderWhatsapp = (sale: Sale, waitingHours: number) => {
    const clientName = sale.cliente || 'Cliente';
    const storeName = storeInfo?.nome && !/^\d{10,}$/.test(storeInfo.nome.trim()) ? storeInfo.nome : 'Oxente Festeje';
    const baseUrl = window.location.origin;
    const approvalParam = encodeURIComponent(sale.numeroPedido || sale.id);
    const approvalLink = `${baseUrl}/?aprovar=${approvalParam}`;
    const pickupText = sale.dataRetirada
      ? new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')
      : null;

    const tempoMsg = waitingHours >= 24
      ? `já faz cerca de *${waitingHours >= 48 ? `${Math.floor(waitingHours / 24)} dias` : `${waitingHours} horas`}* que enviamos a prévia da sua arte`
      : 'enviamos a prévia da sua arte recentemente';

    const text = `Olá, *${clientName}*! Tudo bem? 🎨✨

Passando com carinho para lembrar do seu pedido *#${sale.numeroPedido || sale.id.substring(0, 5)}* — ${tempoMsg} e ele ainda aguarda sua confirmação para entrarmos na produção!${pickupText ? `\n\n📅 *Data prevista de entrega/retirada:* ${pickupText}` : ''}

⚠️ Como a confecção só é liberada após a aprovação, confirme assim que puder pelo link abaixo (leva 1 clique) para não atrasar o seu prazo:
🔗 ${approvalLink}

Qualquer ajuste que precisar, estamos por aqui!
*${storeName}* 🎈`;

    const numToUse = formatWhatsappNumber(sale.telefoneCliente);
    const encodedText = encodeURIComponent(text);
    const url = numToUse
      ? `https://api.whatsapp.com/send?phone=${numToUse}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    try {
      window.open(url, '_blank');
    } catch (e) {
      console.warn('Erro ao abrir WhatsApp para cobrança de aprovação:', e);
    }
  };

  // Toggle Artwork Finished Status
  const handleToggleArtworkStatus = async (sale: Sale) => {
    const nextStatus = sale.statusArte === 'Arte Finalizada' ? 'Pendente' : 'Arte Finalizada';
    if (nextStatus === 'Arte Finalizada') {
      const updated: Sale = {
        ...sale,
        statusArte: nextStatus,
        statusProducao: 'Em Produção', // Already set to in production when art is completed
        clienteAprovouLayout: false, // Toda vez que a arte é finalizada/concluída, exige nova aprovação do cliente
        clienteAprovouLayoutEm: undefined,
        arteFinalizadaPorEmail: currentUserEmail,
        arteFinalizadaEm: new Date().toISOString()
      };
      onUpdateSale(updated);
      playAppSound('complete');

      // Atualização imediata no Supabase
      try {
        await supabase
          .from('oxente_sales')
          .update({
            status_arte: 'Arte Finalizada',
            status_producao: 'Em Produção',
            cliente_aprovou_layout: false,
            cliente_aprovou_layout_em: null,
            arte_finalizada_por_email: currentUserEmail,
            arte_finalizada_em: new Date().toISOString()
          })
          .eq('id', sale.id);
      } catch (err) {
        console.warn('Erro ao atualizar arte no Supabase:', err);
      }

      // Disparo automático da mensagem no WhatsApp do cliente da arte
      sendLayoutApprovalWhatsapp(updated);
    } else {
      // Reabrindo arte para edição: ZERA status da arte, remove a finalização e ZERA completamente a aprovação do cliente
      const updated: Sale = {
        ...sale,
        statusArte: 'Pendente',
        removerDoDesign: false,
        clienteAprovouLayout: false,
        clienteAprovouLayoutEm: undefined,
        arteFinalizadaPorEmail: undefined,
        arteFinalizadaEm: undefined,
        // Se a produção estava 'Em Produção' por ter sido finalizada, voltamos para 'Agendado'
        statusProducao: sale.statusProducao === 'Em Produção' ? 'Agendado' : sale.statusProducao
      };
      onUpdateSale(updated);
      playAppSound('click');

      // Atualização imediata no Supabase garantindo que cliente_aprovou_layout seja zerado na nuvem
      try {
        await supabase
          .from('oxente_sales')
          .update({
            status_arte: 'Pendente',
            remover_do_design: false,
            cliente_aprovou_layout: false,
            cliente_aprovou_layout_em: null,
            arte_finalizada_por_email: null,
            arte_finalizada_em: null,
            status_producao: sale.statusProducao === 'Em Produção' ? 'Agendado' : sale.statusProducao
          })
          .eq('id', sale.id);
      } catch (err) {
        console.warn('Erro ao zerar aprovação de layout no Supabase ao reabrir arte:', err);
      }
    }
  };

  // Exclusivo Mesa Admin: concluir arte e liberar aprovação direto sem exigir clique do cliente no link
  const handleAdminCompleteWithoutLink = async (sale: Sale) => {
    if (!isAdminUser || sale.designerId !== 'admin') return;
    const nowIso = new Date().toISOString();
    const keepAdvancedProd =
      sale.statusProducao === 'Entregue' ||
      sale.statusProducao === 'Pronto para Retirada' ||
      sale.statusProducao === 'Agendado para Entrega';
    const nextProdStatus = keepAdvancedProd ? sale.statusProducao : 'Em Produção';

    const updated: Sale = {
      ...sale,
      statusArte: 'Arte Finalizada',
      statusProducao: nextProdStatus,
      clienteAprovouLayout: true,
      clienteAprovouLayoutEm: nowIso,
      arteFinalizadaPorEmail: currentUserEmail,
      arteFinalizadaEm: sale.arteFinalizadaEm || nowIso
    };
    onUpdateSale(updated);
    playAppSound('complete');

    try {
      await supabase
        .from('oxente_sales')
        .update({
          status_arte: 'Arte Finalizada',
          status_producao: nextProdStatus,
          cliente_aprovou_layout: true,
          cliente_aprovou_layout_em: nowIso,
          arte_finalizada_por_email: currentUserEmail,
          arte_finalizada_em: sale.arteFinalizadaEm || nowIso
        })
        .eq('id', sale.id);
    } catch (err) {
      console.warn('Erro ao concluir arte sem link (Admin) no Supabase:', err);
    }
  };

  // Exclusivo Mesa Admin: liberar aprovação de uma arte já enviada sem aguardar clique no link
  const handleAdminUnlockApproval = async (sale: Sale) => {
    if (!isAdminUser || sale.designerId !== 'admin') return;
    const nowIso = new Date().toISOString();
    const updated: Sale = {
      ...sale,
      statusArte: 'Arte Finalizada',
      clienteAprovouLayout: true,
      clienteAprovouLayoutEm: nowIso,
      arteFinalizadaPorEmail: sale.arteFinalizadaPorEmail || currentUserEmail,
      arteFinalizadaEm: sale.arteFinalizadaEm || nowIso
    };
    onUpdateSale(updated);
    playAppSound('complete');

    try {
      await supabase
        .from('oxente_sales')
        .update({
          status_arte: 'Arte Finalizada',
          cliente_aprovou_layout: true,
          cliente_aprovou_layout_em: nowIso,
          arte_finalizada_por_email: sale.arteFinalizadaPorEmail || currentUserEmail,
          arte_finalizada_em: sale.arteFinalizadaEm || nowIso
        })
        .eq('id', sale.id);
    } catch (err) {
      console.warn('Erro ao liberar aprovação (Admin) no Supabase:', err);
    }
  };

  const handleConfirmRemoveFromDesign = (sale: Sale, shouldRemove: boolean) => {
    const canBypassClientApproval = isAdminUser && sale.designerId === 'admin';
    // Bloqueia ocultação nas mesas D1/D2 se o cliente ainda não tiver aprovado formalmente o layout
    if (shouldRemove && !sale.clienteAprovouLayout && !canBypassClientApproval) {
      return;
    }
    const updated: Sale = {
      ...sale,
      removerDoDesign: shouldRemove
    };
    onUpdateSale(updated);
    setSaleToRemovePrompt(null);
  };

  // Pre-filter database to only active or closed orders that are registered (all registered orders/sales are fechados)
  const filteredSales = useMemo(() => {
    const normalize = (str?: string) =>
      (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const rawTerm = searchTerm.trim();
    const normalizedTerm = normalize(rawTerm);
    const termWords = normalizedTerm.split(/\s+/).filter(Boolean);
    const cleanDigits = rawTerm.replace(/\D/g, '');

    return sales.filter(sale => {
      if (sale.status === 'Orçamento') return false;
      if (sale.removerDoDesign && !showRemovedFromDesign) return false;

      if (!rawTerm) return true;

      const clientNorm = normalize(sale.cliente);
      const matchName = clientNorm.includes(normalizedTerm) ||
        (termWords.length > 1 && termWords.every(w => clientNorm.includes(w)));

      const cleanOrder = sale.numeroPedido ? sale.numeroPedido.replace(/\D/g, '') : '';
      const matchOrderNum = Boolean(
        (sale.numeroPedido && normalize(sale.numeroPedido).includes(normalizedTerm)) ||
        (cleanDigits.length > 0 && (cleanOrder === cleanDigits || cleanOrder.includes(cleanDigits))) ||
        (sale.id && sale.id.toLowerCase().includes(normalizedTerm))
      );

      const cleanPhone = sale.telefoneCliente ? sale.telefoneCliente.replace(/\D/g, '') : '';
      const matchPhone = Boolean(cleanDigits.length >= 3 && cleanPhone.includes(cleanDigits));

      const matchProduct = normalize(sale.produtoNome).includes(normalizedTerm);
      const matchItens = Boolean(sale.itens && sale.itens.some(item => normalize(item.produtoNome).includes(normalizedTerm)));

      return matchName || matchOrderNum || matchPhone || matchProduct || matchItens;
    });
  }, [sales, searchTerm, showRemovedFromDesign]);

  // Split into columns
  const isUrgent = (sale: Sale) => {
    if (sale.temTaxaUrgencia) return true;
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

  // Calcula quantos dias faltam até a data de retirada (negativo = atrasado)
  const getDaysUntilPickup = (sale: Sale): number | null => {
    if (!sale.dataRetirada) return null;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pickupDate = new Date(sale.dataRetirada + 'T12:00:00');
      pickupDate.setHours(0, 0, 0, 0);
      return Math.round((pickupDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  // Ordenação por prioridade real da Fila de Artes:
  // 1) Artes pendentes de finalização no topo, ordenadas pela entrega mais próxima + taxa de urgência
  // 2) Artes finalizadas aguardando aprovação há +48h / +24h / <24h
  // 3) Artes já aprovadas pelo cliente por último
  const compareByArtPriority = (a: Sale, b: Sale): number => {
    const getBucket = (s: Sale) => {
      if (s.statusArte !== 'Arte Finalizada') return 0; // Pendente de criação -> prioridade máxima
      if (!s.clienteAprovouLayout) {
        const hrs = getHoursWaitingApproval(s);
        if (hrs >= 48) return 1; // Aprovação travada +48h
        if (hrs >= 24) return 2; // Aprovação travada +24h
        return 3; // Aguardando aprovação recente
      }
      return 4; // Arte já aprovada
    };

    const bucketA = getBucket(a);
    const bucketB = getBucket(b);
    if (bucketA !== bucketB) return bucketA - bucketB;

    const daysA = getDaysUntilPickup(a);
    const daysB = getDaysUntilPickup(b);

    // Dentro de artes pendentes (bucket 0): considerar entrega mais próxima + taxa de urgência
    if (bucketA === 0) {
      const scoreA = daysA !== null ? daysA - (a.temTaxaUrgencia ? 2 : 0) : (a.temTaxaUrgencia ? 0 : 9999);
      const scoreB = daysB !== null ? daysB - (b.temTaxaUrgencia ? 2 : 0) : (b.temTaxaUrgencia ? 0 : 9999);
      if (scoreA !== scoreB) return scoreA - scoreB;
    }

    // Dentro dos grupos aguardando aprovação (buckets 1-3): entrega mais próxima e maior tempo de espera
    if (bucketA >= 1 && bucketA <= 3) {
      const dA = daysA !== null ? daysA : 9999;
      const dB = daysB !== null ? daysB : 9999;
      if (dA !== dB) return dA - dB;
      const wA = getHoursWaitingApproval(a);
      const wB = getHoursWaitingApproval(b);
      if (wA !== wB) return wB - wA;
    }

    // Por data de retirada exata
    if (a.dataRetirada && b.dataRetirada && a.dataRetirada !== b.dataRetirada) {
      return a.dataRetirada.localeCompare(b.dataRetirada);
    }
    if (a.dataRetirada && !b.dataRetirada) return -1;
    if (!a.dataRetirada && b.dataRetirada) return 1;

    // Desempate: pedido mais antigo primeiro (evita pedido antigo ficar esquecido)
    return new Date(a.data || 0).getTime() - new Date(b.data || 0).getTime();
  };

  // Urgent orders that still have pending artwork (ordenadas por entrega mais próxima)
  const urgentArtOrders = useMemo(() => {
    return sales
      .filter(s => {
        if (s.status === 'Orçamento') return false;
        if (s.removerDoDesign) return false;
        if (s.statusArte === 'Arte Finalizada') return false;
        if (!isAdminUser && s.designerId === 'admin') return false;
        return isUrgent(s);
      })
      .sort(compareByArtPriority);
  }, [sales, products, isAdminUser]);

  const urgentDeadlinePresets: { value: 'all' | number; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 0, label: 'Hoje / Atras.' },
    { value: 3, label: 'Até 3 dias' },
    { value: 5, label: 'Até 5 dias' },
    { value: 7, label: 'Até 7 dias' },
    { value: 10, label: 'Até 10 dias' },
    { value: 15, label: 'Até 15 dias' },
  ];

  const matchesUrgentDeadline = (sale: Sale, maxDays: 'all' | number): boolean => {
    if (maxDays === 'all') return true;
    const days = getDaysUntilPickup(sale);
    if (days === null) return Boolean(sale.temTaxaUrgencia);
    return days <= maxDays;
  };

  const displayedUrgentArtOrders = useMemo(() => {
    return urgentArtOrders.filter(s => matchesUrgentDeadline(s, urgentMaxDays));
  }, [urgentArtOrders, urgentMaxDays]);

  // Artes finalizadas/enviadas em que o cliente ainda não aprovou o layout (+24h / +48h)
  const pendingApprovalOrders = useMemo(() => {
    return sales
      .filter(s => {
        if (s.status === 'Orçamento') return false;
        if (s.removerDoDesign) return false;
        if (s.statusArte !== 'Arte Finalizada') return false;
        if (!isAdminUser && s.designerId === 'admin') return false;
        return !s.clienteAprovouLayout;
      })
      .map(sale => ({
        sale,
        waitingHours: getHoursWaitingApproval(sale)
      }))
      .sort((a, b) => {
        // Prioriza quem espera há mais tempo e tem entrega mais próxima
        const dA = getDaysUntilPickup(a.sale) ?? 9999;
        const dB = getDaysUntilPickup(b.sale) ?? 9999;
        const critA = a.waitingHours >= 48 ? 2 : a.waitingHours >= 24 ? 1 : 0;
        const critB = b.waitingHours >= 48 ? 2 : b.waitingHours >= 24 ? 1 : 0;
        if (critA !== critB) return critB - critA;
        if (dA !== dB) return dA - dB;
        return b.waitingHours - a.waitingHours;
      });
  }, [sales, isAdminUser]);

  const delayedApprovalOrders = useMemo(() => {
    return pendingApprovalOrders.filter(item => item.waitingHours >= 24);
  }, [pendingApprovalOrders]);

  const critical48hApprovalCount = useMemo(() => {
    return pendingApprovalOrders.filter(item => item.waitingHours >= 48).length;
  }, [pendingApprovalOrders]);

  const urgentOrdersInfoList: UrgentArtOrderInfo[] = useMemo(() => {
    return urgentArtOrders.map(s => ({
      id: s.id,
      cliente: s.cliente,
      numeroPedido: s.numeroPedido,
      produtoNome: s.produtoNome,
      dataRetirada: s.dataRetirada,
      turnoEntrega: s.turnoEntrega,
      temTaxaUrgencia: s.temTaxaUrgencia,
      designerId: s.designerId,
      statusArte: s.statusArte
    }));
  }, [urgentArtOrders]);

  // Helper to get today's date in YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to filter out orders already alerted today
  const getOrdersNeedingDailyAlert = (orders: UrgentArtOrderInfo[]) => {
    if (orders.length === 0) return [];
    const today = getTodayStr();
    let history: Record<string, string> = {};
    try {
      const raw = localStorage.getItem('urgent_art_alert_daily_history');
      if (raw) history = JSON.parse(raw);
    } catch {
      history = {};
    }
    return orders.filter(o => history[o.id] !== today);
  };

  // Helper to mark orders as alerted today
  const markOrdersAlertedToday = (orders: UrgentArtOrderInfo[]) => {
    if (orders.length === 0) return;
    const today = getTodayStr();
    let history: Record<string, string> = {};
    try {
      const raw = localStorage.getItem('urgent_art_alert_daily_history');
      if (raw) history = JSON.parse(raw);
    } catch {
      history = {};
    }
    orders.forEach(o => {
      history[o.id] = today;
    });
    try {
      localStorage.setItem('urgent_art_alert_daily_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save urgent art alert history to localStorage', e);
    }
  };

  const [showUrgentArtOverlay, setShowUrgentArtOverlay] = useState(false);
  const knownUrgentIdsRef = useRef<Set<string>>(new Set());

  // 🔔 Dispara alerta ao entrar na aba SE houver pedidos urgentes que ainda NÃO foram alertados hoje
  useEffect(() => {
    const unnotified = getOrdersNeedingDailyAlert(urgentOrdersInfoList);
    if (unnotified.length > 0) {
      setShowUrgentArtOverlay(true);
      markOrdersAlertedToday(unnotified);
    }
    knownUrgentIdsRef.current = new Set(urgentArtOrders.map(s => s.id));
  }, []);

  // 🔔 Também avisa se um NOVO pedido urgente entrar enquanto o usuário estiver navegando
  useEffect(() => {
    const currentIds = new Set(urgentArtOrders.map(s => s.id));
    const newOrders = urgentOrdersInfoList.filter(o => !knownUrgentIdsRef.current.has(o.id));
    
    if (newOrders.length > 0) {
      const unnotifiedNew = getOrdersNeedingDailyAlert(newOrders);
      if (unnotifiedNew.length > 0) {
        setShowUrgentArtOverlay(true);
        markOrdersAlertedToday(unnotifiedNew);
      }
    }
    knownUrgentIdsRef.current = currentIds;
  }, [urgentArtOrders, urgentOrdersInfoList]);

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

  const getRetiradaBadgeStyle = (dataRetirada?: string) => {
    if (!dataRetirada) return 'text-zinc-500 bg-zinc-950/60 border-zinc-850';
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pickupDate = new Date(dataRetirada + 'T12:00:00');
      pickupDate.setHours(0, 0, 0, 0);
      const diffTime = pickupDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      } else if (diffDays === 0) {
        return 'text-red-400 bg-red-500/20 border-red-500/40 font-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.15)]';
      } else if (diffDays === 1) {
        return 'text-orange-400 bg-orange-500/10 border-orange-500/25 font-extrabold';
      } else if (diffDays === 2) {
        return 'text-amber-400 bg-amber-500/10 border-amber-500/25 font-bold';
      } else {
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 font-medium';
      }
    } catch {
      return 'text-zinc-400 bg-zinc-900 border-zinc-800';
    }
  };

  const getRetiradaBadgeText = (dataRetirada?: string, turnoEntrega?: 'Manhã' | 'Tarde') => {
    if (!dataRetirada) return '';
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pickupDate = new Date(dataRetirada + 'T12:00:00');
      pickupDate.setHours(0, 0, 0, 0);
      const diffTime = pickupDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const dateFormatted = new Date(dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR');
      const turnoText = turnoEntrega ? ` (${turnoEntrega})` : '';

      if (diffDays < 0) {
        return `🚨 Atrasado há ${Math.abs(diffDays)}d - ${dateFormatted}${turnoText}`;
      } else if (diffDays === 0) {
        return `🔥 RETIRADA HOJE! - ${dateFormatted}${turnoText}`;
      } else if (diffDays === 1) {
        return `⚡ Retirada Amanhã! - ${dateFormatted}${turnoText}`;
      } else if (diffDays === 2) {
        return `📅 Retirada em 2 dias - ${dateFormatted}${turnoText}`;
      } else {
        return `📅 Retirada: ${dateFormatted}${turnoText}`;
      }
    } catch {
      return `📅 Retirada: ${dataRetirada}`;
    }
  };

  const unassignedOrders = useMemo(() => {
    let list = filteredSales.filter(s => !s.designerId);
    if (filterUrgentOnly) {
      list = list.filter(s => isUrgent(s) && matchesUrgentDeadline(s, urgentMaxDays));
    }
    if (filterPendingApprovalOnly) {
      list = list.filter(s => s.statusArte === 'Arte Finalizada' && !s.clienteAprovouLayout);
    }
    if (sortByPriority) {
      return [...list].sort(compareByArtPriority);
    }
    return [...list].sort((a, b) => {
      if (!a.dataRetirada && !b.dataRetirada) return 0;
      if (!a.dataRetirada) return 1;
      if (!b.dataRetirada) return -1;
      return a.dataRetirada.localeCompare(b.dataRetirada);
    });
  }, [filteredSales, filterUrgentOnly, urgentMaxDays, filterPendingApprovalOnly, sortByPriority, products]);

  const rawDesigner1Orders = useMemo(() => {
    return filteredSales.filter(s => s.designerId === 'designer1');
  }, [filteredSales]);

  const rawDesigner2Orders = useMemo(() => {
    return filteredSales.filter(s => s.designerId === 'designer2');
  }, [filteredSales]);

  const rawAdminOrders = useMemo(() => {
    if (!isAdminUser) return [];
    return filteredSales.filter(s => s.designerId === 'admin');
  }, [filteredSales, isAdminUser]);

  const designer1Orders = useMemo(() => {
    let list = rawDesigner1Orders;
    if (hideFinishedInColumns) {
      list = list.filter(s => s.statusArte !== 'Arte Finalizada');
    }
    if (filterUrgentOnly) {
      list = list.filter(s => isUrgent(s) && matchesUrgentDeadline(s, urgentMaxDays));
    }
    if (filterPendingApprovalOnly) {
      list = list.filter(s => s.statusArte === 'Arte Finalizada' && !s.clienteAprovouLayout);
    }
    if (sortByPriority) {
      return [...list].sort(compareByArtPriority);
    }
    return list;
  }, [rawDesigner1Orders, hideFinishedInColumns, filterUrgentOnly, urgentMaxDays, filterPendingApprovalOnly, sortByPriority, products]);

  const designer2Orders = useMemo(() => {
    let list = rawDesigner2Orders;
    if (hideFinishedInColumns) {
      list = list.filter(s => s.statusArte !== 'Arte Finalizada');
    }
    if (filterUrgentOnly) {
      list = list.filter(s => isUrgent(s) && matchesUrgentDeadline(s, urgentMaxDays));
    }
    if (filterPendingApprovalOnly) {
      list = list.filter(s => s.statusArte === 'Arte Finalizada' && !s.clienteAprovouLayout);
    }
    if (sortByPriority) {
      return [...list].sort(compareByArtPriority);
    }
    return list;
  }, [rawDesigner2Orders, hideFinishedInColumns, filterUrgentOnly, urgentMaxDays, filterPendingApprovalOnly, sortByPriority, products]);

  const adminOrders = useMemo(() => {
    if (!isAdminUser) return [];
    let list = rawAdminOrders;
    if (hideFinishedInColumns) {
      list = list.filter(s => s.statusArte !== 'Arte Finalizada');
    }
    if (filterUrgentOnly) {
      list = list.filter(s => isUrgent(s) && matchesUrgentDeadline(s, urgentMaxDays));
    }
    if (filterPendingApprovalOnly) {
      list = list.filter(s => s.statusArte === 'Arte Finalizada' && !s.clienteAprovouLayout);
    }
    if (sortByPriority) {
      return [...list].sort(compareByArtPriority);
    }
    return list;
  }, [rawAdminOrders, isAdminUser, hideFinishedInColumns, filterUrgentOnly, urgentMaxDays, filterPendingApprovalOnly, sortByPriority, products]);

  // Metrics calculations
  const totalUnassigned = useMemo(() => filteredSales.filter(s => !s.designerId).length, [filteredSales]);
  const totalD1 = rawDesigner1Orders.length;
  const finishedD1 = rawDesigner1Orders.filter(s => s.statusArte === 'Arte Finalizada').length;
  const totalD2 = rawDesigner2Orders.length;
  const finishedD2 = rawDesigner2Orders.filter(s => s.statusArte === 'Arte Finalizada').length;
  const totalAdmin = rawAdminOrders.length;
  const finishedAdmin = rawAdminOrders.filter(s => s.statusArte === 'Arte Finalizada').length;

  const activeD1 = totalD1 - finishedD1;
  const activeD2 = totalD2 - finishedD2;
  const activeAdmin = totalAdmin - finishedAdmin;

  const monthlyFinishedD1 = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return sales.filter(s => {
      if (s.status === 'Orçamento') return false;
      if (s.designerId !== 'designer1') return false;
      if (s.statusArte !== 'Arte Finalizada') return false;
      const dateStr = s.arteFinalizadaEm || s.data;
      if (!dateStr) return false;
      try {
        const d = new Date(dateStr);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      } catch {
        return false;
      }
    }).length;
  }, [sales]);

  const monthlyFinishedD2 = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return sales.filter(s => {
      if (s.status === 'Orçamento') return false;
      if (s.designerId !== 'designer2') return false;
      if (s.statusArte !== 'Arte Finalizada') return false;
      const dateStr = s.arteFinalizadaEm || s.data;
      if (!dateStr) return false;
      try {
        const d = new Date(dateStr);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      } catch {
        return false;
      }
    }).length;
  }, [sales]);

  const monthlyFinishedAdmin = useMemo(() => {
    if (!isAdminUser) return 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return sales.filter(s => {
      if (s.status === 'Orçamento') return false;
      if (s.designerId !== 'admin') return false;
      if (s.statusArte !== 'Arte Finalizada') return false;
      const dateStr = s.arteFinalizadaEm || s.data;
      if (!dateStr) return false;
      try {
        const d = new Date(dateStr);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      } catch {
        return false;
      }
    }).length;
  }, [sales, isAdminUser]);

  const totalFinishedEverD1 = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'Orçamento') return false;
      if (s.designerId !== 'designer1') return false;
      return s.statusArte === 'Arte Finalizada';
    }).length;
  }, [sales]);

  const totalFinishedEverD2 = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'Orçamento') return false;
      if (s.designerId !== 'designer2') return false;
      return s.statusArte === 'Arte Finalizada';
    }).length;
  }, [sales]);

  const totalFinishedEverAdmin = useMemo(() => {
    if (!isAdminUser) return 0;
    return sales.filter(s => {
      if (s.status === 'Orçamento') return false;
      if (s.designerId !== 'admin') return false;
      return s.statusArte === 'Arte Finalizada';
    }).length;
  }, [sales, isAdminUser]);

  return (
    <div className="space-y-6">
      
      {/* 🚨 ALERTA VISUAL ANIMADO DE PEDIDOS URGENTES PENDENTES DE ARTE */}
      {urgentArtOrders.length > 0 && (
        <div className="bg-gradient-to-r from-red-950/60 via-red-900/30 to-amber-950/40 border-2 border-red-500/50 rounded-2xl p-4 sm:p-5 shadow-[0_0_30px_rgba(239,68,68,0.25)] space-y-3 relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full filter blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner animate-pulse">
                <Flame className="h-6 w-6 text-red-400 fill-red-400/40 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-300 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/30">
                    🚨 Atenção Designers
                  </span>
                  <span className="text-[11px] font-extrabold text-amber-400 font-mono">
                    {urgentArtOrders.length} {urgentArtOrders.length === 1 ? 'pedido urgente pendente' : 'pedidos urgentes pendentes'}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-zinc-100 mt-1">
                  Existem pedidos urgentes com arte pendente de finalização!
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setFilterUrgentOnly(prev => !prev);
                  playAppSound('click');
                }}
                className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans border shadow-sm ${
                  filterUrgentOnly
                    ? 'bg-brand-pink text-white border-brand-pink ring-2 ring-brand-pink/30'
                    : 'bg-red-500/20 text-red-200 border-red-500/30 hover:bg-red-500/30'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                <span>
                  {filterUrgentOnly
                    ? 'Ver Todos os Pedidos'
                    : urgentMaxDays === 'all'
                      ? 'Filtrar Urgentes'
                      : urgentMaxDays === 0
                        ? 'Filtrar Fila (Hoje/Atras.)'
                        : `Filtrar Fila (≤ ${urgentMaxDays}d)`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUrgentArtOverlay(true);
                  playAppSound('alert');
                }}
                className="px-3.5 py-2 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/70 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Abrir Alerta em Tela Cheia"
              >
                <Paintbrush className="h-3.5 w-3.5 text-red-400 animate-pulse" />
                <span className="hidden sm:inline">Ver Alerta</span>
              </button>
            </div>
          </div>

          {/* Seletor de Prazo dentro dos Pedidos Urgentes */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-red-500/20 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1 mr-1">
              <Calendar className="h-3 w-3 text-amber-400" />
              Filtrar Prazo:
            </span>
            {urgentDeadlinePresets.map((preset) => {
              const count = urgentArtOrders.filter(s => matchesUrgentDeadline(s, preset.value)).length;
              const isActive = urgentMaxDays === preset.value && customUrgentDaysInput === '';
              return (
                <button
                  key={String(preset.value)}
                  type="button"
                  onClick={() => {
                    setUrgentMaxDays(preset.value);
                    setCustomUrgentDaysInput('');
                    playAppSound('click');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer border flex items-center gap-1.5 active:scale-95 ${
                    isActive
                      ? 'bg-red-500 text-white border-red-400 shadow-sm'
                      : 'bg-zinc-950/85 text-zinc-300 border-red-500/25 hover:border-red-400/60 hover:text-white'
                  }`}
                >
                  <span>{preset.label}</span>
                  <span className={`font-mono text-[9.5px] px-1 rounded ${isActive ? 'bg-black/25 text-white' : 'bg-zinc-900 text-zinc-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Prazo personalizado em dias */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors ${
              customUrgentDaysInput !== ''
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-zinc-950/85 border-red-500/25 text-zinc-400'
            }`}>
              <span className="text-[10px] font-bold">Outro: até</span>
              <input
                type="number"
                min={0}
                max={365}
                value={customUrgentDaysInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomUrgentDaysInput(raw);
                  if (raw.trim() === '') {
                    setUrgentMaxDays('all');
                  } else {
                    const parsed = parseInt(raw, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      setUrgentMaxDays(parsed);
                    }
                  }
                }}
                placeholder="ex: 4"
                className="w-11 bg-black/50 border border-zinc-800 rounded px-1 py-0.5 text-[10.5px] font-mono font-bold text-amber-300 placeholder-zinc-600 focus:outline-none focus:border-amber-400 text-center"
                title="Digite qualquer número de dias para filtrar urgentes até esse prazo"
              />
              <span className="text-[10px] font-bold">dias</span>
              {customUrgentDaysInput !== '' && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomUrgentDaysInput('');
                    setUrgentMaxDays('all');
                  }}
                  className="text-amber-300 hover:text-white ml-0.5 cursor-pointer"
                  title="Limpar prazo personalizado"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {urgentMaxDays !== 'all' && (
              <span className="text-[10px] font-mono font-bold text-amber-300/90 ml-auto">
                Exibindo {displayedUrgentArtOrders.length} de {urgentArtOrders.length} urgentes
              </span>
            )}
          </div>

          {/* Chips interativos de pedidos urgentes */}
          <div className="space-y-2.5 pt-2 border-t border-red-500/20 relative z-10">
            {displayedUrgentArtOrders.length === 0 ? (
              <div className="w-full py-3 px-4 bg-zinc-950/60 border border-dashed border-red-500/25 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-400 font-medium">
                  Nenhum pedido urgente pendente de arte para o prazo selecionado ({urgentMaxDays === 0 ? 'Hoje / Atrasados' : `até ${urgentMaxDays} dias`}).
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUrgentMaxDays('all');
                    setCustomUrgentDaysInput('');
                  }}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Mostrar todos os {urgentArtOrders.length} urgentes
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {displayedUrgentArtOrders.map((sale) => {
                    const isSelectedChip = selectedUrgentChipId === sale.id;
                    return (
                      <button
                        key={sale.id}
                        type="button"
                        onClick={() => {
                          setSelectedUrgentChipId(prev => (prev === sale.id ? null : sale.id));
                          playAppSound('click');
                        }}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer text-left shadow-sm border ${
                          isSelectedChip
                            ? 'bg-red-500/25 border-amber-400 ring-2 ring-amber-400/35 text-white'
                            : 'bg-zinc-950/80 hover:bg-zinc-900 border-red-500/30 hover:border-red-400'
                        }`}
                        title="Clique para puxar direto para uma mesa ou ver o recibo"
                      >
                        <span className="font-extrabold text-zinc-200 group-hover:text-white">
                          {sale.cliente} {sale.numeroPedido ? `(#${sale.numeroPedido})` : ''}
                        </span>
                        <span className="text-[10.5px] text-zinc-400 font-sans truncate max-w-[150px]">
                          {sale.produtoNome}
                        </span>
                        {sale.designerId && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                            sale.designerId === 'designer1'
                              ? 'bg-brand-pink/20 text-brand-pink border border-brand-pink/35'
                              : sale.designerId === 'designer2'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                          }`}>
                            {sale.designerId === 'designer1' ? 'D1' : sale.designerId === 'designer2' ? 'D2' : 'ADM'}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                          {sale.temTaxaUrgencia
                            ? (sale.dataRetirada ? `⚡ ${getUrgentText(sale.dataRetirada)}` : '⚡ Taxa Urgência')
                            : getUrgentText(sale.dataRetirada)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Painel rápido ao clicar em um pedido urgente: puxar direto para Mesa D1, D2 ou Admin */}
                {(() => {
                  const selectedUrgentSale = displayedUrgentArtOrders.find(s => s.id === selectedUrgentChipId);
                  if (!selectedUrgentSale) return null;
                  const currentDeskLabel =
                    selectedUrgentSale.designerId === 'designer1'
                      ? 'Mesa D1'
                      : selectedUrgentSale.designerId === 'designer2'
                        ? 'Mesa D2'
                        : selectedUrgentSale.designerId === 'admin'
                          ? 'Mesa Admin'
                          : 'Fila de Triagem';
                  return (
                    <div className="p-3 bg-zinc-950/95 border border-amber-500/45 rounded-xl shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-fade-in">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-zinc-100">
                            {selectedUrgentSale.cliente}
                            {selectedUrgentSale.numeroPedido ? ` (#${selectedUrgentSale.numeroPedido})` : ''}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
                            Atual: {currentDeskLabel}
                          </span>
                          {selectedUrgentSale.dataRetirada && (
                            <span className="text-[10px] font-mono font-bold text-amber-300">
                              📅 {new Date(selectedUrgentSale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {selectedUrgentSale.itens && selectedUrgentSale.itens.length > 0
                            ? selectedUrgentSale.itens.map(it => `${it.quantidade}x ${it.produtoNome}`).join(', ')
                            : `${selectedUrgentSale.quantidade}x ${selectedUrgentSale.produtoNome}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={selectedUrgentSale.designerId === 'designer1'}
                          onClick={() => {
                            handlePullOrder(selectedUrgentSale, 'designer1');
                            setSelectedUrgentChipId(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                            selectedUrgentSale.designerId === 'designer1'
                              ? 'bg-brand-pink/20 border border-brand-pink/40 text-brand-pink cursor-not-allowed opacity-70'
                              : 'bg-brand-pink hover:brightness-110 text-black shadow-sm'
                          }`}
                        >
                          <span>{selectedUrgentSale.designerId === 'designer1' ? '✓ Já na D1' : 'Puxar p/ Mesa D1'}</span>
                          {selectedUrgentSale.designerId !== 'designer1' && <ChevronRight className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          type="button"
                          disabled={selectedUrgentSale.designerId === 'designer2'}
                          onClick={() => {
                            handlePullOrder(selectedUrgentSale, 'designer2');
                            setSelectedUrgentChipId(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                            selectedUrgentSale.designerId === 'designer2'
                              ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 cursor-not-allowed opacity-70'
                              : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-sm'
                          }`}
                        >
                          <span>{selectedUrgentSale.designerId === 'designer2' ? '✓ Já na D2' : 'Puxar p/ Mesa D2'}</span>
                          {selectedUrgentSale.designerId !== 'designer2' && <ChevronRight className="h-3.5 w-3.5" />}
                        </button>

                        {isAdminUser && (
                          <button
                            type="button"
                            disabled={selectedUrgentSale.designerId === 'admin'}
                            onClick={() => {
                              handlePullOrder(selectedUrgentSale, 'admin');
                              setSelectedUrgentChipId(null);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 border ${
                              selectedUrgentSale.designerId === 'admin'
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 cursor-not-allowed opacity-70'
                                : 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-black shadow-sm'
                            }`}
                          >
                            <Crown className="h-3 w-3" />
                            <span>{selectedUrgentSale.designerId === 'admin' ? '✓ Já na Admin' : 'Puxar p/ Mesa Admin'}</span>
                          </button>
                        )}

                        {selectedUrgentSale.designerId && (
                          <button
                            type="button"
                            onClick={() => {
                              handlePullOrder(selectedUrgentSale, null);
                              setSelectedUrgentChipId(null);
                            }}
                            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-red-500/50 text-zinc-300 hover:text-red-300 rounded-lg text-[10.5px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="Devolver pedido para a Fila de Triagem"
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                            <span>Triagem</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            handleSelectSaleForReceipt(selectedUrgentSale);
                            setSelectedUrgentChipId(null);
                          }}
                          className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg text-[10.5px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Abrir recibo e observações deste pedido"
                        >
                          <FileText className="h-3 w-3 text-brand-pink" />
                          <span>Ver Recibo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedUrgentChipId(null)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                          title="Fechar opções"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* ⏳ ALERTA DE ARTES ENVIADAS AGUARDANDO APROVAÇÃO DO CLIENTE HÁ +24h / +48h */}
      {delayedApprovalOrders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/50 via-orange-950/25 to-zinc-950 border-2 border-amber-500/45 rounded-2xl p-4 sm:p-5 shadow-[0_0_24px_rgba(245,158,11,0.16)] space-y-3 relative overflow-hidden animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                    ⏳ Cobrança de Aprovação
                  </span>
                  <span className="text-[11px] font-extrabold text-amber-400 font-mono">
                    {delayedApprovalOrders.length} {delayedApprovalOrders.length === 1 ? 'arte parada há +24h' : 'artes paradas há +24h'}
                  </span>
                  {critical48hApprovalCount > 0 && (
                    <span className="text-[10px] font-black text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-full animate-pulse">
                      🚨 {critical48hApprovalCount} com +48h
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-black text-zinc-100 mt-1">
                  Clientes que receberam a arte e ainda não aprovaram o layout
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Cobre a aprovação em 1 clique no WhatsApp para liberar a confecção e não atrasar a entrega
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playAppSound('click');
                setFilterPendingApprovalOnly(prev => !prev);
                if (hideFinishedInColumns) setHideFinishedInColumns(false);
              }}
              className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border shadow-sm ${
                filterPendingApprovalOnly
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-amber-500/15 text-amber-200 border-amber-500/35 hover:bg-amber-500/25'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{filterPendingApprovalOnly ? 'Mostrar Toda a Fila' : 'Filtrar Aguardando Aprovação'}</span>
            </button>
          </div>

          {/* Cards compactos com botão de cobrança em 1 clique */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 pt-2 border-t border-amber-500/20">
            {delayedApprovalOrders.map(({ sale, waitingHours }) => {
              const is48h = waitingHours >= 48;
              return (
                <div
                  key={sale.id}
                  onClick={() => handleSelectSaleForReceipt(sale)}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    is48h
                      ? 'bg-rose-950/35 border-rose-500/45 hover:border-rose-400'
                      : 'bg-zinc-950/85 border-amber-500/30 hover:border-amber-400'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-zinc-100 truncate max-w-[130px]">
                        {sale.cliente}
                      </span>
                      <span className="text-[9.5px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded">
                        #{sale.numeroPedido || sale.id.substring(0, 5)}
                      </span>
                      {sale.designerId && (
                        <span className={`text-[9px] font-black px-1 py-0.5 rounded ${
                          sale.designerId === 'designer1'
                            ? 'bg-brand-pink/20 text-brand-pink'
                            : sale.designerId === 'designer2'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {sale.designerId === 'designer1' ? 'D1' : sale.designerId === 'designer2' ? 'D2' : 'ADM'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] flex-wrap">
                      <span className={`font-black font-mono ${is48h ? 'text-rose-300' : 'text-amber-300'}`}>
                        {is48h ? '🚨' : '⚠️'} Enviada {formatWaitingTime(waitingHours)}
                      </span>
                      {sale.dataRetirada && (
                        <span className="text-zinc-400 font-mono">
                          • Entrega: {new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playAppSound('click');
                      sendLayoutApprovalReminderWhatsapp(sale, waitingHours);
                    }}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                      is48h
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                        : 'bg-amber-500 hover:bg-amber-400 text-black shadow-sm'
                    }`}
                    title="Enviar cobrança de aprovação no WhatsApp do cliente"
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span>Cobrar Zap</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. Dashboard Metrics Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Waiting card - Spans 1 column */}
        <div className="bg-zinc-950 border border-zinc-800 p-4.5 rounded-2xl shadow-sm flex items-center justify-between relative overflow-hidden group hover:border-zinc-700/60 transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-zinc-800/5 rounded-full filter blur-lg pointer-events-none" />
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block font-mono">Fila de Triagem</span>
            <span className="text-3xl font-black text-zinc-100 font-mono tracking-tight">{totalUnassigned}</span>
            <p className="text-[10px] text-zinc-500 font-medium">Aguardando designer puxar a arte</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl relative z-10 shadow-inner">
            <Clock className="h-5 w-5 animate-pulse text-brand-pink" />
          </div>
        </div>

        {/* 🏆 Mini Leaderboard de Produtividade dos Designers - Spans 2 columns */}
        <div className="lg:col-span-2 bg-zinc-950/40 backdrop-blur-md border border-zinc-800/80 p-4.5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-brand-pink/20 transition-all duration-300">
          {/* subtle glowing background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink/5 rounded-full filter blur-[32px] pointer-events-none group-hover:bg-brand-pink/10 transition-colors" />
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-brand-pink/10 rounded-xl text-brand-pink flex items-center justify-center">
                <Trophy className="h-4 w-4 text-amber-400" />
              </span>
              <div>
                <span className="text-[10px] text-zinc-300 uppercase font-black tracking-wider block font-mono">Leaderboard de Produtividade</span>
                <p className="text-[10px] text-zinc-500 font-bold">Desempenho mensal e balanceamento de carga</p>
              </div>
            </div>
            {/* Dynamic Advice/Status Badge */}
            <div className="hidden sm:block">
              {activeD1 - activeD2 >= 3 ? (
                <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded-lg font-bold font-mono">
                  ⚠️ Direcione novas artes ao Designer 2
                </span>
              ) : activeD2 - activeD1 >= 3 ? (
                <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded-lg font-bold font-mono">
                  ⚠️ Direcione novas artes ao Designer 1
                </span>
              ) : (
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-1 rounded-lg font-bold font-mono">
                  ✨ Fila de Trabalho Equilibrada
                </span>
              )}
            </div>
          </div>

          {/* Designer Side-by-Side Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            
            {/* Designer 1 Panel */}
            <div className="bg-zinc-950/60 border border-zinc-850 p-3 rounded-xl flex flex-col justify-between hover:border-brand-pink/30 transition-all duration-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6.5 h-6.5 rounded-lg bg-brand-pink/10 text-brand-pink flex items-center justify-center font-black text-xs font-mono shadow-inner border border-brand-pink/20">
                    D1
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-zinc-100 block">Designer 1</span>
                    <span className="text-[9px] text-zinc-400 block font-semibold">Criação &amp; Personalizados</span>
                  </div>
                </div>
                
                {/* Winner Badge */}
                {monthlyFinishedD1 > monthlyFinishedD2 && monthlyFinishedD1 > 0 && (
                  <span className="text-[9px] bg-amber-400/10 border border-amber-400/30 text-amber-400 px-1.5 py-0.5 rounded-md font-black flex items-center gap-0.5 animate-bounce font-mono">
                    👑 LÍDER
                  </span>
                )}
              </div>

              {/* Progress and Stats */}
              <div className="space-y-1.5 mt-2">
                {/* Fila Ativa */}
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-zinc-500 font-bold">Fila Ativa (Pendentes):</span>
                  <span className={`font-black font-mono ${activeD1 > 4 ? 'text-red-400' : activeD1 > 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {activeD1} {activeD1 === 1 ? 'arte' : 'artes'}
                  </span>
                </div>
                {/* Progress bar for active workload */}
                <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${activeD1 > 4 ? 'bg-red-500' : activeD1 > 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (activeD1 / 8) * 100)}%` }}
                  />
                </div>

                {/* Monthly Deliveries */}
                <div className="flex justify-between items-center text-[10px] pt-1">
                  <span className="text-zinc-500 font-bold">Entregas no Mês:</span>
                  <span className="text-zinc-100 font-extrabold font-mono">
                    {monthlyFinishedD1} concluintes
                  </span>
                </div>
                {/* Historic Deliveries */}
                <div className="flex justify-between items-center text-[10px] pt-1">
                  <span className="text-zinc-500 font-bold font-semibold text-brand-pink/90">Artes Totais (Desde Sempre):</span>
                  <span className="text-brand-pink font-extrabold font-mono">
                    {totalFinishedEverD1} concluídas 🎨
                  </span>
                </div>
                {/* Completion general */}
                <div className="flex justify-between items-center text-[9px] pt-1 border-t border-zinc-900">
                  <span className="text-zinc-500">Workspace Geral:</span>
                  <span className="text-zinc-400 font-bold font-mono">
                    {finishedD1} finalizadas / {totalD1} total
                  </span>
                </div>
              </div>
            </div>

            {/* Designer 2 Panel */}
            <div className="bg-zinc-950/60 border border-zinc-850 p-3 rounded-xl flex flex-col justify-between hover:border-cyan-500/30 transition-all duration-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6.5 h-6.5 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-black text-xs font-mono shadow-inner border border-cyan-500/20">
                    D2
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-zinc-100 block">Designer 2</span>
                    <span className="text-[9px] text-zinc-400 block font-semibold">Criação &amp; Personalizados</span>
                  </div>
                </div>
                
                {/* Winner Badge */}
                {monthlyFinishedD2 > monthlyFinishedD1 && monthlyFinishedD2 > 0 && (
                  <span className="text-[9px] bg-amber-400/10 border border-amber-400/30 text-amber-400 px-1.5 py-0.5 rounded-md font-black flex items-center gap-0.5 animate-bounce font-mono">
                    👑 LÍDER
                  </span>
                )}
              </div>

              {/* Progress and Stats */}
              <div className="space-y-1.5 mt-2">
                {/* Fila Ativa */}
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-zinc-500 font-bold">Fila Ativa (Pendentes):</span>
                  <span className={`font-black font-mono ${activeD2 > 4 ? 'text-red-400' : activeD2 > 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {activeD2} {activeD2 === 1 ? 'arte' : 'artes'}
                  </span>
                </div>
                {/* Progress bar for active workload */}
                <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${activeD2 > 4 ? 'bg-red-500' : activeD2 > 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (activeD2 / 8) * 100)}%` }}
                  />
                </div>

                {/* Monthly Deliveries */}
                <div className="flex justify-between items-center text-[10px] pt-1">
                  <span className="text-zinc-500 font-bold">Entregas no Mês:</span>
                  <span className="text-zinc-100 font-extrabold font-mono">
                    {monthlyFinishedD2} concluintes
                  </span>
                </div>
                {/* Historic Deliveries */}
                <div className="flex justify-between items-center text-[10px] pt-1">
                  <span className="text-zinc-500 font-bold font-semibold text-cyan-400/90">Artes Totais (Desde Sempre):</span>
                  <span className="text-cyan-400 font-extrabold font-mono">
                    {totalFinishedEverD2} concluídas 🎨
                  </span>
                </div>
                {/* Completion general */}
                <div className="flex justify-between items-center text-[9px] pt-1 border-t border-zinc-900">
                  <span className="text-zinc-500">Workspace Geral:</span>
                  <span className="text-zinc-400 font-bold font-mono">
                    {finishedD2} finalizadas / {totalD2} total
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Mobile Balance Advice */}
          <div className="mt-3 block sm:hidden relative z-10 border-t border-zinc-900 pt-2 text-center">
            {activeD1 - activeD2 >= 3 ? (
              <span className="text-[9px] text-amber-400 font-bold font-mono">
                ⚠️ Direcione novas artes ao Designer 2
              </span>
            ) : activeD2 - activeD1 >= 3 ? (
              <span className="text-[9px] text-amber-400 font-bold font-mono">
                ⚠️ Direcione novas artes ao Designer 1
              </span>
            ) : (
              <span className="text-[9px] text-emerald-400 font-bold font-mono">
                ✨ Fila de Trabalho Equilibrada
              </span>
            )}
          </div>
        </div>

      </div>

      {/* 2. Top search and filter utility panel */}
      <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-brand-pink" />
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Controle de Arte &amp; Criação</h2>
              <p className="text-[10.5px] text-zinc-500">Puxe os pedidos para a sua camada, crie a arte e mude para finalizado</p>
            </div>
          </div>

          {/* Actions & Search */}
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2.5 w-full xl:w-auto flex-wrap">
            {/* Toggle sort by priority/urgency */}
            <button
              type="button"
              onClick={() => {
                setSortByPriority(prev => !prev);
                playAppSound('click');
              }}
              className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 select-none ${
                sortByPriority
                  ? 'bg-sky-500/15 border-sky-500/50 text-sky-300 font-extrabold shadow-[0_0_12px_rgba(14,165,233,0.08)]'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
              }`}
              title="Ordena todas as colunas com artes pendentes de entrega mais próxima e taxa de urgência no topo"
            >
              <ArrowUpDown className={`h-3.5 w-3.5 ${sortByPriority ? 'text-sky-400' : 'text-zinc-500'}`} />
              <span>{sortByPriority ? 'Ordem: Urgência' : 'Ordem: Padrão'}</span>
            </button>

            {/* Toggle pending client approval filter */}
            {pendingApprovalOrders.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilterPendingApprovalOnly(prev => !prev);
                  if (hideFinishedInColumns) setHideFinishedInColumns(false);
                  playAppSound('click');
                }}
                className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 select-none ${
                  filterPendingApprovalOnly
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-extrabold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                }`}
                title="Filtrar apenas artes enviadas que ainda aguardam aprovação do cliente"
              >
                <Clock className={`h-3.5 w-3.5 ${filterPendingApprovalOnly ? 'text-amber-300' : 'text-amber-500/80'}`} />
                <span>Sem Aprovação ({pendingApprovalOrders.length})</span>
              </button>
            )}

            {/* Toggle only urgent */}
            <button
              type="button"
              onClick={() => {
                setFilterUrgentOnly(prev => !prev);
                playAppSound('click');
              }}
              className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 select-none ${
                filterUrgentOnly
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.05)]'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
              }`}
            >
              <AlertTriangle className={`h-3.5 w-3.5 ${filterUrgentOnly ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
              <span>
                {filterUrgentOnly && urgentMaxDays !== 'all'
                  ? (urgentMaxDays === 0 ? 'Urgentes (Hoje/Atras.)' : `Urgentes (≤ ${urgentMaxDays}d)`)
                  : 'Somente Urgentes'}
              </span>
            </button>

            {/* Toggle hide finished */}
            <button
              type="button"
              onClick={() => {
                setHideFinishedInColumns(prev => !prev);
                playAppSound('click');
              }}
              className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 select-none ${
                hideFinishedInColumns
                  ? 'bg-brand-pink/10 border-brand-pink/50 text-brand-pink font-extrabold shadow-[0_0_12px_rgba(219,39,119,0.05)]'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
              }`}
            >
              <EyeOff className={`h-3.5 w-3.5 ${hideFinishedInColumns ? 'text-brand-pink' : 'text-zinc-550'}`} />
              <span>Ocultar Prontas</span>
            </button>

            {/* Toggle show/hide archived design items */}
            <button
              type="button"
              onClick={() => setShowRemovedFromDesign(prev => !prev)}
              className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 select-none ${
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
                  <span>Ver Ocultos</span>
                </>
              )}
            </button>

            {/* Search */}
            <div className="relative w-full xl:w-64">
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

        {/* Barra de seleção de prazo ativa quando "Somente Urgentes" está ligado */}
        {filterUrgentOnly && (
          <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-1.5 animate-fade-in">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 mr-1">
              <Calendar className="h-3 w-3" />
              Prazo dos Urgentes na Fila:
            </span>
            {urgentDeadlinePresets.map((preset) => {
              const count = urgentArtOrders.filter(s => matchesUrgentDeadline(s, preset.value)).length;
              const isActive = urgentMaxDays === preset.value && customUrgentDaysInput === '';
              return (
                <button
                  key={`bar-${String(preset.value)}`}
                  type="button"
                  onClick={() => {
                    setUrgentMaxDays(preset.value);
                    setCustomUrgentDaysInput('');
                    playAppSound('click');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer border flex items-center gap-1.5 active:scale-95 ${
                    isActive
                      ? 'bg-amber-500 text-black border-amber-400 font-black shadow-sm'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-amber-500/40 hover:text-amber-300'
                  }`}
                >
                  <span>{preset.label}</span>
                  <span className={`font-mono text-[9.5px] px-1 rounded ${isActive ? 'bg-black/20 text-black' : 'bg-zinc-900 text-zinc-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors ${
              customUrgentDaysInput !== ''
                ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400'
            }`}>
              <span className="text-[10px] font-bold">Até</span>
              <input
                type="number"
                min={0}
                max={365}
                value={customUrgentDaysInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomUrgentDaysInput(raw);
                  if (raw.trim() === '') {
                    setUrgentMaxDays('all');
                  } else {
                    const parsed = parseInt(raw, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      setUrgentMaxDays(parsed);
                    }
                  }
                }}
                placeholder="dias"
                className="w-11 bg-black/60 border border-zinc-800 rounded px-1 py-0.5 text-[10.5px] font-mono font-bold text-amber-300 placeholder-zinc-600 focus:outline-none focus:border-amber-400 text-center"
              />
              <span className="text-[10px] font-bold">dias</span>
              {customUrgentDaysInput !== '' && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomUrgentDaysInput('');
                    setUrgentMaxDays('all');
                  }}
                  className="text-amber-300 hover:text-white ml-0.5 cursor-pointer"
                  title="Limpar prazo personalizado"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Three Columns Kanban Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* COLUMN 1: Aguardando Arte (Orders without designer assigned) */}
        <div className="xl:col-span-4 space-y-3.5 bg-zinc-950/20 p-4 border border-zinc-900/60 rounded-2xl">
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
              <>
                {unassignedOrders.slice(0, col1Limit).map((sale) => {
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
                            🚨 Urgente: {sale.temTaxaUrgencia && !sale.dataRetirada ? 'Taxa Urgência' : getUrgentText(sale.dataRetirada)}
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
                        <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border w-fit ${getRetiradaBadgeStyle(sale.dataRetirada)}`}>
                          <Calendar className="h-3 w-3" />
                          <span>{getRetiradaBadgeText(sale.dataRetirada, sale.turnoEntrega)}</span>
                        </div>
                      )}

                      {/* Designer Notes preview directly on card */}
                      {sale.observacoesDesign && (
                        <div className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-1.5 rounded-lg font-mono line-clamp-2" title={sale.observacoesDesign}>
                          📝 {sale.observacoesDesign}
                        </div>
                      )}

                      {/* Item colors list */}
                      {sale.itens && sale.itens.some(it => it.corSelecionada) && (
                        <div className="flex flex-wrap gap-1">
                          {sale.itens.filter(it => it.corSelecionada).map((it, itemIdx) => (
                            <span key={itemIdx} className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-zinc-400">
                              🎨 {it.corSelecionada}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Badge de Acréscimo ou Diminuição ajustado hoje no lucro do dia */}
                      {(() => {
                        const ajustes = getSaleAdjustments(sale);
                        if (ajustes.length === 0) return null;
                        const now = new Date();
                        const todayAdjustments = getSaleAdjustmentsForDate(sale, now);
                        if (todayAdjustments.length > 0) {
                          const todayLucroInc = todayAdjustments.reduce((sum, a) => sum + (a.lucroAdicional || 0), 0);
                          if (Math.abs(todayLucroInc) < 0.005) return null;
                          const isPositive = todayLucroInc >= 0;
                          const formattedVal = Math.abs(todayLucroInc).toFixed(2);
                          return (
                            <div 
                              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 border ${
                                isPositive
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                  : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                              }`}
                              title={todayAdjustments.map(a => `${a.descricao || 'Ajuste'}: ${a.valorAdicional >= 0 ? '+' : ''}R$ ${a.valorAdicional.toFixed(2)} (${a.lucroAdicional >= 0 ? '+' : ''}R$ ${a.lucroAdicional.toFixed(2)} no lucro)`).join('\n')}
                            >
                              <span>{isPositive ? '✨ +' : '📉 -'}R$ {formattedVal} no lucro de hoje</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                    {/* Actions to Drag / Pull */}
                    <div className="space-y-1.5 pt-2 border-t border-zinc-900">
                      <div className="grid grid-cols-2 gap-2">
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
                      {isAdminUser && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePullOrder(sale, 'admin');
                          }}
                          className="w-full py-1.5 px-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-extrabold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          title="Puxar pedido para sua Mesa Exclusiva do Administrador"
                        >
                          <Crown className="h-3 w-3 text-amber-400" />
                          <span>Puxar p/ Mesa Admin</span>
                        </button>
                      )}
                    </div>
                  </div>
                )})}
                {unassignedOrders.length > col1Limit && (
                  <button
                    type="button"
                    onClick={() => setCol1Limit(prev => prev + 35)}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Mostrar mais pedidos ({col1Limit} de {unassignedOrders.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* WORKSTATIONS CONTAINER: Groups and clearly separates the two designers */}
        <div className="xl:col-span-8 bg-zinc-950/40 border border-zinc-800/80 p-5 rounded-3xl relative shadow-2xl space-y-4">
          <div className="absolute -top-3 left-6 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-full text-[9px] font-black uppercase tracking-widest text-brand-pink flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-pink animate-ping"></span>
            Estações de Trabalho Separadas
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start md:divide-x divide-zinc-900/80">
            
            {/* COLUMN 2: Designer 1 Workspace */}
            <div className="space-y-4">
              {/* MINI PAINEL PREMIUM DESIGNER 1 */}
              <div className="bg-gradient-to-br from-zinc-950 to-zinc-900/60 border border-brand-pink/20 p-4 rounded-2xl space-y-3.5 shadow-md relative overflow-hidden group hover:border-brand-pink/35 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-pink/5 rounded-full filter blur-xl pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-brand-pink/10 text-brand-pink border border-brand-pink/20 flex items-center justify-center font-black text-xs font-mono shadow-inner">
                      D1
                    </div>
                    <div>
                      <h3 className="text-[11px] font-black text-zinc-100 uppercase tracking-wider">Mesa de Trabalho D1</h3>
                      <span className="text-[9.5px] text-zinc-400 font-bold block">Designer 1 ({totalD1} pedidos)</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-brand-pink/10 text-brand-pink border border-brand-pink/20 px-2 py-0.5 rounded-md font-bold font-mono">
                    {finishedD1}/{totalD1} Prontas
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400">
                    <span>Aproveitamento Geral:</span>
                    <span>{totalD1 > 0 ? Math.round((finishedD1 / totalD1) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className="h-full bg-brand-pink rounded-full transition-all duration-500"
                      style={{ width: `${totalD1 > 0 ? (finishedD1 / totalD1) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-1 pt-2.5">
            {designer1Orders.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/20 border border-dashed border-zinc-850 rounded-xl text-zinc-500 text-[10.5px]">
                Nenhum pedido com o Designer 1.
              </div>
            ) : (
              <>
              {designer1Orders.slice(0, col2Limit).map((sale) => {
                const isFinished = sale.statusArte === 'Arte Finalizada';
                const isPendingClientApproval = isFinished && !sale.clienteAprovouLayout;
                const isApprovedByClient = isFinished && Boolean(sale.clienteAprovouLayout);
                const waitingApprovalHours = isPendingClientApproval ? getHoursWaitingApproval(sale) : 0;
                const isApprovalDelayed24h = waitingApprovalHours >= 24;
                const isApprovalCritical48h = waitingApprovalHours >= 48;
                const delayInfo = checkArteDelay(sale);
                return (
                  <div 
                    key={sale.id}
                    onClick={() => handleSelectSaleForReceipt(sale)}
                    className={`border border-l-4 rounded-xl p-4 space-y-3 transition-all cursor-pointer relative group ${
                      isApprovalCritical48h
                        ? 'bg-rose-950/30 border-rose-500/60 border-l-rose-500 hover:border-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.2)] ring-1 ring-rose-500/30'
                        : isPendingClientApproval
                          ? 'bg-amber-950/30 border-amber-500/50 border-l-amber-500 hover:border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/25'
                          : isApprovedByClient
                            ? 'bg-emerald-950/20 border-emerald-500/40 border-l-emerald-500 hover:border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                            : delayInfo.isDelayed
                              ? 'bg-red-950/10 border-brand-pink/20 border-l-red-500 hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.12)]'
                              : 'bg-gradient-to-br from-zinc-950 to-brand-pink/[0.02] border-brand-pink/25 border-l-brand-pink hover:border-brand-pink/40 shadow-[0_0_10px_rgba(236,72,153,0.03)]'
                    }`}
                  >
                    {/* Floating Designer Badge */}
                    <div className="absolute top-0 right-4 -translate-y-1/2 flex items-center gap-1 bg-brand-pink text-black text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-md select-none z-10">
                      <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-pulse"></span>
                      <span>MESA D1</span>
                    </div>

                    <div className="flex justify-between items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-450 px-1.5 py-0.5 rounded">
                        Pedido #{sale.numeroPedido || sale.id.substring(0, 5)}
                      </span>
                      {isPendingClientApproval ? (
                        <span className={`text-[9px] font-black uppercase flex items-center gap-1 px-2 py-0.5 rounded-sm animate-pulse shadow-sm border ${
                          isApprovalCritical48h
                            ? 'text-rose-200 bg-rose-500/25 border-rose-500/60'
                            : 'text-amber-300 bg-amber-500/20 border-amber-500/50'
                        }`}>
                          <Clock className={`h-2.5 w-2.5 ${isApprovalCritical48h ? 'text-rose-300' : 'text-amber-400'}`} />
                          {isApprovalDelayed24h ? `Sem Aprovação (${formatWaitingTime(waitingApprovalHours)})` : 'Pendente de Aprovação'}
                        </span>
                      ) : isApprovedByClient ? (
                        <span className="text-[9px] font-bold text-emerald-350 uppercase flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-sm shadow-sm">
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> Arte Aprovada
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {delayInfo.isDelayed && (
                            <span 
                              title={`Este pedido está há ${delayInfo.hours} horas em produção!`}
                              className="text-[8.5px] font-black text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded-sm flex items-center gap-1 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                            >
                              <AlertTriangle className="h-2.5 w-2.5 text-red-500 animate-bounce" />
                              {delayInfo.hours}h ATRASADO
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-sm animate-pulse">
                            🎨 Em Produção
                          </span>
                        </div>
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
                      <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border w-fit ${getRetiradaBadgeStyle(sale.dataRetirada)}`}>
                        <Calendar className="h-3 w-3" />
                        <span>{getRetiradaBadgeText(sale.dataRetirada, sale.turnoEntrega)}</span>
                      </div>
                    )}

                    {/* Designer Notes preview directly on card */}
                    {sale.observacoesDesign && (
                      <div className="text-[10px] bg-brand-pink/5 border border-brand-pink/15 text-brand-pink/90 px-2 py-1.5 rounded-lg font-mono line-clamp-2" title={sale.observacoesDesign}>
                        📝 {sale.observacoesDesign}
                      </div>
                    )}

                    {/* Item colors list */}
                    {sale.itens && sale.itens.some(it => it.corSelecionada) && (
                      <div className="flex flex-wrap gap-1">
                        {sale.itens.filter(it => it.corSelecionada).map((it, itemIdx) => (
                          <span key={itemIdx} className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-brand-pink/10 border border-brand-pink/20 text-brand-pink">
                            🎨 {it.corSelecionada}
                          </span>
                        ))}
                      </div>
                    )}

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

                    {/* Status de Confirmação pelo Cliente */}
                    {sale.clienteAprovouLayout ? (
                      <div className="text-[9.5px] bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-1 shadow-sm">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>Arte Confirmada pelo Cliente ✨</span>
                        </span>
                        {sale.clienteAprovouLayoutEm && (
                          <span className="text-[8px] font-mono text-emerald-400/80">
                            {formatDateTime(sale.clienteAprovouLayoutEm)}
                          </span>
                        )}
                      </div>
                    ) : isFinished ? (
                      <div className={`text-[9.5px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-1.5 border ${
                        isApprovalCritical48h
                          ? 'bg-rose-950/60 border-rose-500/60 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.18)]'
                          : isApprovalDelayed24h
                            ? 'bg-amber-950/60 border-amber-500/60 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.14)]'
                            : 'bg-amber-950/50 border-amber-500/50 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.08)]'
                      }`}>
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Clock className={`h-3.5 w-3.5 shrink-0 animate-pulse ${isApprovalCritical48h ? 'text-rose-400' : 'text-amber-400'}`} />
                          <span className="truncate">
                            {isApprovalCritical48h
                              ? `🚨 Parada ${formatWaitingTime(waitingApprovalHours)}`
                              : isApprovalDelayed24h
                                ? `⚠️ Parada ${formatWaitingTime(waitingApprovalHours)}`
                                : 'Aguardando Aprovação'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playAppSound('click');
                            sendLayoutApprovalReminderWhatsapp(sale, waitingApprovalHours);
                          }}
                          className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                            isApprovalCritical48h
                              ? 'bg-rose-600 hover:bg-rose-500 text-white'
                              : isApprovalDelayed24h
                                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                                : 'bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40'
                          }`}
                          title="Enviar cobrança rápida de aprovação no WhatsApp"
                        >
                          <MessageSquare className="h-2.5 w-2.5" />
                          <span>{isApprovalDelayed24h ? 'Cobrar Zap' : 'Lembrar'}</span>
                        </button>
                      </div>
                    ) : null}

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
                          <>
                            <button
                              type="button"
                              title="Reenviar mensagem de aprovação de arte no WhatsApp do cliente"
                              onClick={(e) => {
                                e.stopPropagation();
                                sendLayoutApprovalWhatsapp(sale);
                              }}
                              className="py-1.5 px-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0 text-[10px] font-bold"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span className="hidden sm:inline">Zap Aprovação</span>
                            </button>
                            {sale.clienteAprovouLayout ? (
                              <button
                                type="button"
                                title={sale.removerDoDesign ? "Mostrar na lista de design" : "Ocultar da mesa de design"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmRemoveFromDesign(sale, !sale.removerDoDesign);
                                }}
                                className={`py-1.5 px-2.5 border rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0 text-[10px] font-bold ${
                                  sale.removerDoDesign
                                    ? 'bg-emerald-950/20 border-emerald-950/40 hover:border-emerald-650 hover:text-emerald-300 text-emerald-400'
                                    : 'bg-red-950/20 border-red-900/30 hover:border-red-650 hover:text-red-300 text-red-400'
                                }`}
                              >
                                <Trash className="h-3.5 w-3.5" />
                                <span>{sale.removerDoDesign ? 'Mostrar' : 'Ocultar'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                title="Ocultar bloqueado: Aguardando o cliente aprovar a arte para liberar a remoção da mesa"
                                className="py-1.5 px-2.5 border border-zinc-800 bg-zinc-900/60 text-zinc-600 rounded-lg flex items-center justify-center gap-1 shrink-0 text-[10px] font-bold cursor-not-allowed opacity-50 select-none"
                              >
                                <Lock className="h-3 w-3 text-zinc-600" />
                                <span>Ocultar</span>
                              </button>
                            )}
                          </>
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

                      {isAdminUser && (
                        <button
                          type="button"
                          title="Transferir para Mesa do Administrador"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePullOrder(sale, 'admin');
                          }}
                          className="py-1 px-1.5 bg-amber-500/10 border border-amber-500/35 hover:bg-amber-500/20 hover:border-amber-400 text-amber-300 text-[9px] font-black rounded-lg transition-colors cursor-pointer"
                        >
                          ADM
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {designer1Orders.length > col2Limit && (
                <button
                  type="button"
                  onClick={() => setCol2Limit(prev => prev + 35)}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Mostrar mais pedidos ({col2Limit} de {designer1Orders.length})
                </button>
              )}
              </>
            )}
          </div>
        </div>

        {/* COLUMN 3: Designer 2 Workspace */}
        <div className="space-y-4 pt-4 md:pt-0 md:pl-6">
          {/* MINI PAINEL PREMIUM DESIGNER 2 */}
          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900/60 border border-cyan-500/20 p-4 rounded-2xl space-y-3.5 shadow-md relative overflow-hidden group hover:border-cyan-500/35 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full filter blur-xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-black text-xs font-mono shadow-inner">
                  D2
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-zinc-100 uppercase tracking-wider">Mesa de Trabalho D2</h3>
                  <span className="text-[9.5px] text-zinc-400 font-bold block">Designer 2 ({totalD2} pedidos)</span>
                </div>
              </div>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-md font-bold font-mono">
                {finishedD2}/{totalD2} Prontas
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400">
                <span>Aproveitamento Geral:</span>
                <span>{totalD2 > 0 ? Math.round((finishedD2 / totalD2) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                <div 
                  className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${totalD2 > 0 ? (finishedD2 / totalD2) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-1 pt-2.5">
            {designer2Orders.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/20 border border-dashed border-zinc-850 rounded-xl text-zinc-500 text-[10.5px]">
                Nenhum pedido com o Designer 2.
              </div>
            ) : (
              <>
              {designer2Orders.slice(0, col3Limit).map((sale) => {
                const isFinished = sale.statusArte === 'Arte Finalizada';
                const isPendingClientApproval = isFinished && !sale.clienteAprovouLayout;
                const isApprovedByClient = isFinished && Boolean(sale.clienteAprovouLayout);
                const waitingApprovalHours = isPendingClientApproval ? getHoursWaitingApproval(sale) : 0;
                const isApprovalDelayed24h = waitingApprovalHours >= 24;
                const isApprovalCritical48h = waitingApprovalHours >= 48;
                const delayInfo = checkArteDelay(sale);
                return (
                  <div 
                    key={sale.id}
                    onClick={() => handleSelectSaleForReceipt(sale)}
                    className={`border border-l-4 rounded-xl p-4 space-y-3 transition-all cursor-pointer relative group ${
                      isApprovalCritical48h
                        ? 'bg-rose-950/30 border-rose-500/60 border-l-rose-500 hover:border-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.2)] ring-1 ring-rose-500/30'
                        : isPendingClientApproval
                          ? 'bg-amber-950/30 border-amber-500/50 border-l-amber-500 hover:border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/25'
                          : isApprovedByClient
                            ? 'bg-emerald-950/20 border-emerald-500/40 border-l-emerald-500 hover:border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                            : delayInfo.isDelayed
                              ? 'bg-red-950/10 border-cyan-500/20 border-l-red-500 hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.12)]'
                              : 'bg-gradient-to-br from-zinc-950 to-cyan-500/[0.02] border-cyan-500/25 border-l-cyan-400 hover:border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.03)]'
                    }`}
                  >
                    {/* Floating Designer Badge */}
                    <div className="absolute top-0 right-4 -translate-y-1/2 flex items-center gap-1 bg-cyan-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-md select-none z-10">
                      <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-pulse"></span>
                      <span>Mesa D2</span>
                    </div>

                    <div className="flex justify-between items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-450 px-1.5 py-0.5 rounded">
                        Pedido #{sale.numeroPedido || sale.id.substring(0, 5)}
                      </span>
                      {isPendingClientApproval ? (
                        <span className={`text-[9px] font-black uppercase flex items-center gap-1 px-2 py-0.5 rounded-sm animate-pulse shadow-sm border ${
                          isApprovalCritical48h
                            ? 'text-rose-200 bg-rose-500/25 border-rose-500/60'
                            : 'text-amber-300 bg-amber-500/20 border-amber-500/50'
                        }`}>
                          <Clock className={`h-2.5 w-2.5 ${isApprovalCritical48h ? 'text-rose-300' : 'text-amber-400'}`} />
                          {isApprovalDelayed24h ? `Sem Aprovação (${formatWaitingTime(waitingApprovalHours)})` : 'Pendente de Aprovação'}
                        </span>
                      ) : isApprovedByClient ? (
                        <span className="text-[9px] font-bold text-emerald-350 uppercase flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-sm shadow-sm">
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> Arte Aprovada
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {delayInfo.isDelayed && (
                            <span 
                              title={`Este pedido está há ${delayInfo.hours} horas em produção!`}
                              className="text-[8.5px] font-black text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded-sm flex items-center gap-1 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                            >
                              <AlertTriangle className="h-2.5 w-2.5 text-red-500 animate-bounce" />
                              {delayInfo.hours}h ATRASADO
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-sm animate-pulse">
                            🎨 Em Produção
                          </span>
                        </div>
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

                    {sale.dataRetirada && (
                      <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border w-fit ${getRetiradaBadgeStyle(sale.dataRetirada)}`}>
                        <Calendar className="h-3 w-3" />
                        <span>{getRetiradaBadgeText(sale.dataRetirada, sale.turnoEntrega)}</span>
                      </div>
                    )}

                    {/* Designer Notes preview directly on card */}
                    {sale.observacoesDesign && (
                      <div className="text-[10px] bg-cyan-500/5 border border-cyan-500/15 text-cyan-400 px-2 py-1.5 rounded-lg font-mono line-clamp-2" title={sale.observacoesDesign}>
                        📝 {sale.observacoesDesign}
                      </div>
                    )}

                    {/* Item colors list */}
                    {sale.itens && sale.itens.some(it => it.corSelecionada) && (
                      <div className="flex flex-wrap gap-1">
                        {sale.itens.filter(it => it.corSelecionada).map((it, itemIdx) => (
                          <span key={itemIdx} className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                            🎨 {it.corSelecionada}
                          </span>
                        ))}
                      </div>
                    )}

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

                    {/* Status de Confirmação pelo Cliente */}
                    {sale.clienteAprovouLayout ? (
                      <div className="text-[9.5px] bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-1 shadow-sm">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>Arte Confirmada pelo Cliente ✨</span>
                        </span>
                        {sale.clienteAprovouLayoutEm && (
                          <span className="text-[8px] font-mono text-emerald-400/80">
                            {formatDateTime(sale.clienteAprovouLayoutEm)}
                          </span>
                        )}
                      </div>
                    ) : isFinished ? (
                      <div className={`text-[9.5px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-1.5 border ${
                        isApprovalCritical48h
                          ? 'bg-rose-950/60 border-rose-500/60 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.18)]'
                          : isApprovalDelayed24h
                            ? 'bg-amber-950/60 border-amber-500/60 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.14)]'
                            : 'bg-amber-950/50 border-amber-500/50 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.08)]'
                      }`}>
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Clock className={`h-3.5 w-3.5 shrink-0 animate-pulse ${isApprovalCritical48h ? 'text-rose-400' : 'text-amber-400'}`} />
                          <span className="truncate">
                            {isApprovalCritical48h
                              ? `🚨 Parada ${formatWaitingTime(waitingApprovalHours)}`
                              : isApprovalDelayed24h
                                ? `⚠️ Parada ${formatWaitingTime(waitingApprovalHours)}`
                                : 'Aguardando Aprovação'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playAppSound('click');
                            sendLayoutApprovalReminderWhatsapp(sale, waitingApprovalHours);
                          }}
                          className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                            isApprovalCritical48h
                              ? 'bg-rose-600 hover:bg-rose-500 text-white'
                              : isApprovalDelayed24h
                                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                                : 'bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40'
                          }`}
                          title="Enviar cobrança rápida de aprovação no WhatsApp"
                        >
                          <MessageSquare className="h-2.5 w-2.5" />
                          <span>{isApprovalDelayed24h ? 'Cobrar Zap' : 'Lembrar'}</span>
                        </button>
                      </div>
                    ) : null}

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
                          <>
                            <button
                              type="button"
                              title="Reenviar mensagem de aprovação de arte no WhatsApp do cliente"
                              onClick={(e) => {
                                e.stopPropagation();
                                sendLayoutApprovalWhatsapp(sale);
                              }}
                              className="py-1.5 px-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0 text-[10px] font-bold"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span className="hidden sm:inline">Zap Aprovação</span>
                            </button>
                            {sale.clienteAprovouLayout ? (
                              <button
                                type="button"
                                title={sale.removerDoDesign ? "Mostrar na lista de design" : "Remover da lista de design"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmRemoveFromDesign(sale, !sale.removerDoDesign);
                                }}
                                className={`py-1.5 px-2.5 border rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0 text-[10px] font-bold ${
                                  sale.removerDoDesign
                                    ? 'bg-emerald-950/20 border-emerald-950/40 hover:border-emerald-650 hover:text-emerald-300 text-emerald-400'
                                    : 'bg-red-950/20 border-red-900/30 hover:border-red-650 hover:text-red-300 text-red-400'
                                }`}
                              >
                                <Trash className="h-3.5 w-3.5" />
                                <span>{sale.removerDoDesign ? 'Mostrar' : 'Ocultar'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                title="Ocultar bloqueado: Aguardando o cliente aprovar a arte para liberar a remoção da mesa"
                                className="py-1.5 px-2.5 border border-zinc-800 bg-zinc-900/60 text-zinc-600 rounded-lg flex items-center justify-center gap-1 shrink-0 text-[10px] font-bold cursor-not-allowed opacity-50 select-none"
                              >
                                <Lock className="h-3 w-3 text-zinc-600" />
                                <span>Ocultar</span>
                              </button>
                            )}
                          </>
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

                      {isAdminUser && (
                        <button
                          type="button"
                          title="Transferir para Mesa do Administrador"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePullOrder(sale, 'admin');
                          }}
                          className="py-1 px-1.5 bg-amber-500/10 border border-amber-500/35 hover:bg-amber-500/20 hover:border-amber-400 text-amber-300 text-[9px] font-black rounded-lg transition-colors cursor-pointer"
                        >
                          ADM
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {designer2Orders.length > col3Limit && (
                <button
                  type="button"
                  onClick={() => setCol3Limit(prev => prev + 35)}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Mostrar mais pedidos ({col3Limit} de {designer2Orders.length})
                </button>
              )}
              </>
            )}
          </div>
        </div>

          </div>
        </div>

      </div>

      {/* 3.5 EXCLUSIVE ADMIN WORKSPACE (Rendered below D1/D2, visible ONLY to Admin) */}
      {isAdminUser && (
        <div className="bg-zinc-950/55 border border-amber-500/35 p-5 rounded-3xl relative shadow-2xl space-y-4 mt-2">
          <div className="absolute -top-3 left-6 px-3 py-1 bg-zinc-950 border border-amber-500/40 rounded-full text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5 shadow-md">
            <Crown className="h-3 w-3 text-amber-400" />
            <span>Mesa Exclusiva do Administrador • Visível apenas para você</span>
          </div>

          {/* Header Panel Admin Desk */}
          <div className="bg-gradient-to-br from-zinc-950 via-zinc-900/70 to-amber-950/20 border border-amber-500/25 p-4 rounded-2xl space-y-3 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full filter blur-2xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-xs font-mono shadow-inner shrink-0">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-black text-zinc-100 uppercase tracking-wider">Mesa de Trabalho Admin</h3>
                    <span className="text-[9px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Unlock className="h-2.5 w-2.5" />
                      Conclusão com ou sem link liberada
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">
                    Suas artes de apoio ({totalAdmin} {totalAdmin === 1 ? 'pedido' : 'pedidos'} • {activeAdmin} em produção • {monthlyFinishedAdmin} concluídas no mês • {totalFinishedEverAdmin} no total)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10.5px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold font-mono">
                  {finishedAdmin}/{totalAdmin} Prontas
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 relative z-10">
              <div className="flex justify-between items-center text-[9.5px] font-bold text-zinc-400">
                <span>Aproveitamento da Mesa Admin:</span>
                <span className="text-amber-300 font-mono">{totalAdmin > 0 ? Math.round((finishedAdmin / totalAdmin) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${totalAdmin > 0 ? (finishedAdmin / totalAdmin) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Admin Desk Orders Grid */}
          <div className="max-h-[620px] overflow-y-auto pr-1 pt-2.5">
            {adminOrders.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/20 border border-dashed border-amber-500/25 rounded-xl text-zinc-400 text-[11px] space-y-1">
                <p className="font-bold text-zinc-300">Nenhum pedido na sua Mesa do Administrador.</p>
                <p className="text-[10px] text-zinc-500">
                  Clique em <strong className="text-amber-400">Puxar p/ Mesa Admin</strong> na Fila de Triagem ou em <strong className="text-amber-400">ADM</strong> nos cards de D1/D2 para assumir uma arte aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                  {adminOrders.slice(0, colAdminLimit).map((sale) => {
                    const isFinished = sale.statusArte === 'Arte Finalizada';
                    const isPendingClientApproval = isFinished && !sale.clienteAprovouLayout;
                    const isApprovedByClient = isFinished && Boolean(sale.clienteAprovouLayout);
                    const waitingApprovalHours = isPendingClientApproval ? getHoursWaitingApproval(sale) : 0;
                    const isApprovalDelayed24h = waitingApprovalHours >= 24;
                    const isApprovalCritical48h = waitingApprovalHours >= 48;
                    const delayInfo = checkArteDelay(sale);
                    return (
                      <div
                        key={sale.id}
                        onClick={() => handleSelectSaleForReceipt(sale)}
                        className={`border border-l-4 rounded-xl p-4 space-y-3 transition-all cursor-pointer relative group ${
                          isApprovalCritical48h
                            ? 'bg-rose-950/30 border-rose-500/60 border-l-rose-500 hover:border-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.2)] ring-1 ring-rose-500/30'
                            : isPendingClientApproval
                              ? 'bg-amber-950/30 border-amber-500/50 border-l-amber-500 hover:border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/25'
                              : isApprovedByClient
                                ? 'bg-emerald-950/20 border-emerald-500/40 border-l-emerald-500 hover:border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                                : delayInfo.isDelayed
                                  ? 'bg-red-950/10 border-amber-500/25 border-l-red-500 hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.12)]'
                                  : 'bg-gradient-to-br from-zinc-950 to-amber-500/[0.04] border-amber-500/30 border-l-amber-400 hover:border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.05)]'
                        }`}
                      >
                        {/* Floating Admin Badge */}
                        <div className="absolute top-0 right-4 -translate-y-1/2 flex items-center gap-1 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md select-none z-10">
                          <Crown className="h-2.5 w-2.5" />
                          <span>MESA ADMIN</span>
                        </div>

                        <div className="flex justify-between items-center gap-1 flex-wrap">
                          <span className="text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-450 px-1.5 py-0.5 rounded">
                            Pedido #{sale.numeroPedido || sale.id.substring(0, 5)}
                          </span>
                          {isPendingClientApproval ? (
                            <span className={`text-[9px] font-black uppercase flex items-center gap-1 px-2 py-0.5 rounded-sm animate-pulse shadow-sm border ${
                              isApprovalCritical48h
                                ? 'text-rose-200 bg-rose-500/25 border-rose-500/60'
                                : 'text-amber-300 bg-amber-500/20 border-amber-500/50'
                            }`}>
                              <Clock className={`h-2.5 w-2.5 ${isApprovalCritical48h ? 'text-rose-300' : 'text-amber-400'}`} />
                              {isApprovalDelayed24h ? `Sem Aprovação (${formatWaitingTime(waitingApprovalHours)})` : 'Pendente de Aprovação'}
                            </span>
                          ) : isApprovedByClient ? (
                            <span className="text-[9px] font-bold text-emerald-350 uppercase flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-sm shadow-sm">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> Arte Aprovada
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {delayInfo.isDelayed && (
                                <span
                                  title={`Este pedido está há ${delayInfo.hours} horas em produção!`}
                                  className="text-[8.5px] font-black text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded-sm flex items-center gap-1 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5 text-red-500 animate-bounce" />
                                  {delayInfo.hours}h ATRASADO
                                </span>
                              )}
                              <span className="text-[9px] font-bold text-amber-400 uppercase flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-sm animate-pulse">
                                🎨 Em Produção
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-bold text-zinc-200 group-hover:text-amber-400 transition-colors truncate">
                            {sale.cliente}
                          </p>
                          <p className="text-[10.5px] text-zinc-400 leading-snug line-clamp-2">
                            {sale.itens && sale.itens.length > 0
                              ? sale.itens.map(it => `${it.quantidade}x ${it.produtoNome}`).join(', ')
                              : `${sale.quantidade}x ${sale.produtoNome}`}
                          </p>
                        </div>

                        {sale.dataRetirada && (
                          <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border w-fit ${getRetiradaBadgeStyle(sale.dataRetirada)}`}>
                            <Calendar className="h-3 w-3" />
                            <span>{getRetiradaBadgeText(sale.dataRetirada, sale.turnoEntrega)}</span>
                          </div>
                        )}

                        {/* Designer Notes preview directly on card */}
                        {sale.observacoesDesign && (
                          <div className="text-[10px] bg-amber-500/5 border border-amber-500/20 text-amber-300/90 px-2 py-1.5 rounded-lg font-mono line-clamp-2" title={sale.observacoesDesign}>
                            📝 {sale.observacoesDesign}
                          </div>
                        )}

                        {/* Item colors list */}
                        {sale.itens && sale.itens.some(it => it.corSelecionada) && (
                          <div className="flex flex-wrap gap-1">
                            {sale.itens.filter(it => it.corSelecionada).map((it, itemIdx) => (
                              <span key={itemIdx} className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300">
                                🎨 {it.corSelecionada}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Metadata: who pulled and date */}
                        {sale.puxadoPor && (
                          <div className="text-[9.5px] text-zinc-500 bg-zinc-900/60 p-1.5 rounded-md border border-zinc-850 flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1 truncate">
                              <User className="h-2.5 w-2.5 shrink-0 text-amber-400" />
                              <span>Puxado por: <strong>{sale.puxadoPor}</strong></span>
                            </span>
                            {sale.puxadoEm && (
                              <span className="text-[8.5px] font-mono flex-shrink-0">
                                {formatDateTime(sale.puxadoEm)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Status de Confirmação / Aprovação */}
                        {sale.clienteAprovouLayout ? (
                          <div className="text-[9.5px] bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-1 shadow-sm">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              <span>Arte Aprovada / Liberada ✨</span>
                            </span>
                            {sale.clienteAprovouLayoutEm && (
                              <span className="text-[8px] font-mono text-emerald-400/80">
                                {formatDateTime(sale.clienteAprovouLayoutEm)}
                              </span>
                            )}
                          </div>
                        ) : isFinished ? (
                          <div className={`text-[9.5px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-1.5 border ${
                            isApprovalCritical48h
                              ? 'bg-rose-950/60 border-rose-500/60 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.18)]'
                              : isApprovalDelayed24h
                                ? 'bg-amber-950/60 border-amber-500/60 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.14)]'
                                : 'bg-amber-950/50 border-amber-500/50 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.08)]'
                          }`}>
                            <span className="flex items-center gap-1.5 min-w-0">
                              <Clock className={`h-3.5 w-3.5 shrink-0 animate-pulse ${isApprovalCritical48h ? 'text-rose-400' : 'text-amber-400'}`} />
                              <span className="truncate">
                                {isApprovalCritical48h
                                  ? `🚨 Parada ${formatWaitingTime(waitingApprovalHours)}`
                                  : isApprovalDelayed24h
                                    ? `⚠️ Parada ${formatWaitingTime(waitingApprovalHours)}`
                                    : 'Aguardando Aprovação'}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playAppSound('click');
                                sendLayoutApprovalReminderWhatsapp(sale, waitingApprovalHours);
                              }}
                              className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                                isApprovalCritical48h
                                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                  : isApprovalDelayed24h
                                    ? 'bg-amber-500 hover:bg-amber-400 text-black'
                                    : 'bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40'
                              }`}
                              title="Enviar cobrança rápida de aprovação no WhatsApp"
                            >
                              <MessageSquare className="h-2.5 w-2.5" />
                              <span>{isApprovalDelayed24h ? 'Cobrar Zap' : 'Lembrar'}</span>
                            </button>
                          </div>
                        ) : null}

                        {/* Control Panel actions — Full parity with D1/D2 + Admin direct unlock */}
                        <div className="space-y-2 pt-2 border-t border-zinc-900 no-print">
                          {!isFinished ? (
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleArtworkStatus(sale);
                                }}
                                title="Concluir arte e enviar link de aprovação no WhatsApp do cliente (fluxo padrão)"
                                className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                              >
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                <span>Concluir (Zap)</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdminCompleteWithoutLink(sale);
                                }}
                                title="Exclusivo Admin: conclui e aprova a arte direto sem precisar que o cliente clique no link"
                                className="py-1.5 px-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                              >
                                <ShieldCheck className="h-3 w-3 shrink-0" />
                                <span>Concluir s/ Link</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleArtworkStatus(sale);
                                }}
                                className="flex-1 min-w-[90px] py-1.5 px-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-500 hover:border-amber-500/30 font-bold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                              >
                                <RefreshCw className="h-3 w-3" />
                                <span>Reabrir Arte</span>
                              </button>

                              <button
                                type="button"
                                title="Enviar ou reenviar mensagem de aprovação de arte no WhatsApp do cliente"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendLayoutApprovalWhatsapp(sale);
                                }}
                                className="py-1.5 px-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0 text-[10px] font-bold"
                              >
                                <MessageSquare className="h-3 w-3" />
                                <span>Zap</span>
                              </button>

                              {!sale.clienteAprovouLayout && (
                                <button
                                  type="button"
                                  title="Liberar aprovação imediatamente sem aguardar o clique do cliente no link"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAdminUnlockApproval(sale);
                                  }}
                                  className="py-1.5 px-2 bg-amber-500/20 border border-amber-500/50 hover:bg-amber-500 hover:text-black text-amber-300 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0 text-[10px] font-black"
                                >
                                  <Unlock className="h-3 w-3" />
                                  <span>Liberar s/ Link</span>
                                </button>
                              )}

                              <button
                                type="button"
                                title={sale.removerDoDesign ? "Mostrar na mesa do administrador" : "Ocultar da mesa (liberado sem bloqueio para o Admin)"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmRemoveFromDesign(sale, !sale.removerDoDesign);
                                }}
                                className={`py-1.5 px-2.5 border rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0 text-[10px] font-bold ${
                                  sale.removerDoDesign
                                    ? 'bg-emerald-950/20 border-emerald-950/40 hover:border-emerald-650 hover:text-emerald-300 text-emerald-400'
                                    : 'bg-red-950/20 border-red-900/30 hover:border-red-650 hover:text-red-300 text-red-400'
                                }`}
                              >
                                <Trash className="h-3.5 w-3.5" />
                                <span>{sale.removerDoDesign ? 'Mostrar' : 'Ocultar'}</span>
                              </button>
                            </div>
                          )}

                          {/* Devolve / Transfer row */}
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-zinc-900/70">
                            <span className="text-[9px] text-zinc-500 font-semibold">Mover pedido:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="Devolver para Fila de Triagem (Aguardando Designer)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePullOrder(sale, null);
                                }}
                                className="py-1 px-2 bg-zinc-900 border border-zinc-800 hover:border-red-500 hover:text-red-400 text-zinc-400 text-[9px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                                <span>Triagem</span>
                              </button>
                              <button
                                type="button"
                                title="Transferir para Designer 1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePullOrder(sale, 'designer1');
                                }}
                                className="py-1 px-2 bg-zinc-900 border border-zinc-800 hover:border-brand-pink hover:text-brand-pink text-zinc-400 text-[9px] font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                D1
                              </button>
                              <button
                                type="button"
                                title="Transferir para Designer 2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePullOrder(sale, 'designer2');
                                }}
                                className="py-1 px-2 bg-zinc-900 border border-zinc-800 hover:border-cyan-400 hover:text-cyan-400 text-zinc-400 text-[9px] font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                D2
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {adminOrders.length > colAdminLimit && (
                  <button
                    type="button"
                    onClick={() => setColAdminLimit(prev => prev + 35)}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Mostrar mais pedidos ({colAdminLimit} de {adminOrders.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
                            <span>Finalizada e Concluída por <strong className="text-emerald-400">{viewedSale.arteFinalizadaPorEmail || viewedSale.puxadoPor || 'Designer'}</strong>{viewedSale.arteFinalizadaEm && ` em ${new Date(viewedSale.arteFinalizadaEm).toLocaleString('pt-BR')}`}</span>
                          ) : viewedSale.puxadoPor ? (
                            <span>Em elaboração por <strong className="text-blue-400">{viewedSale.puxadoPor}</strong>{viewedSale.puxadoEm && ` desde ${new Date(viewedSale.puxadoEm).toLocaleString('pt-BR')}`}</span>
                          ) : (
                            <span className="text-amber-500/80">Aguardando designer puxar a arte</span>
                          )}
                        </p>
                      </div>

                      {/* Step 3: Aprovação de Layout pelo Cliente (Apenas quando a arte estiver finalizada ou aprovada) */}
                      {(viewedSale.statusArte === 'Arte Finalizada' || viewedSale.clienteAprovouLayout) && (
                        <div className="relative font-sans">
                          <div className={`absolute -left-[25.5px] top-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                            viewedSale.clienteAprovouLayout
                              ? 'bg-emerald-500'
                              : 'bg-amber-500 animate-pulse'
                          }`} />
                          <h5 className="text-[10.5px] font-bold text-zinc-200">✨ Aprovação de Layout pelo Cliente</h5>
                          <div className="text-[9px] text-zinc-550 mt-0.5 leading-normal space-y-1">
                            {viewedSale.clienteAprovouLayout ? (
                              <div className="text-emerald-300 font-bold bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded-md">
                                ✅ Arte Confirmada pelo Cliente{viewedSale.clienteAprovouLayoutEm && ` em ${new Date(viewedSale.clienteAprovouLayoutEm).toLocaleString('pt-BR')}`}. Liberado para confecção!
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <span className="text-amber-400 font-medium block">
                                  ⏳ Arte finalizada! Aguardando cliente clicar no link de confirmação no WhatsApp
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => sendLayoutApprovalWhatsapp(viewedSale)}
                                    className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                  >
                                    <MessageSquare className="h-2.5 w-2.5" />
                                    <span>Reenviar Confirmação de Layout (WhatsApp)</span>
                                  </button>
                                  {isAdminUser && viewedSale.designerId === 'admin' && (
                                    <button
                                      type="button"
                                      onClick={() => handleAdminUnlockApproval(viewedSale)}
                                      className="inline-flex items-center gap-1 text-[9.5px] font-black text-amber-300 bg-amber-500/15 hover:bg-amber-500 hover:text-black border border-amber-500/40 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                    >
                                      <Unlock className="h-2.5 w-2.5" />
                                      <span>Liberar s/ Link (Admin)</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Step 4: Produção Física */}
                      <div className="relative font-sans">
                        <div className={`absolute -left-[25.5px] top-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                          viewedSale.statusProducao === 'Entregue'
                            ? 'bg-emerald-500'
                            : ['Pronto para Retirada', 'Agendado para Entrega'].includes(viewedSale.statusProducao || '')
                              ? 'bg-amber-400'
                              : viewedSale.clienteAprovouLayout
                                ? (viewedSale.statusProducao === 'Em Produção' ? 'bg-amber-500 animate-pulse' : 'bg-blue-500 animate-pulse')
                                : 'bg-zinc-800'
                        }`} />
                        <h5 className="text-[10.5px] font-bold text-zinc-200">🧵 Produção & Confecção Física</h5>
                        <p className="text-[9px] text-zinc-550 mt-0.5 leading-normal">
                          {viewedSale.clienteAprovouLayout ? (
                            viewedSale.statusProducao === 'Em Produção' ? (
                              <span className="text-amber-400 font-bold">⚙️ Em confecção e produção na oficina.</span>
                            ) : (!viewedSale.statusProducao || viewedSale.statusProducao === 'Agendado') ? (
                              <span className="text-blue-400 font-bold">🚀 Passado para fase de produção! Na fila de confecção.</span>
                            ) : (
                              <>Etapa atual: <strong className="text-zinc-300 font-mono text-[9px]">{viewedSale.statusProducao}</strong>{viewedSale.dataRetirada && ` (Previsão: ${new Date(viewedSale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')})`}</>
                            )
                          ) : (
                            <span className="text-zinc-500">Aguardando aprovação do layout pelo cliente para liberar confecção.</span>
                          )}
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-start justify-center p-4 z-50 overflow-y-auto no-print py-6 sm:py-12">
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
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
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
                                  total: dbProd.preco,
                                  custoUn: dbProd.precoCusto
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

                {/* Optional CPF / CNPJ for Edit Modal (Hidden by default, expandable) */}
                {!showEditDocumentoInput && !editDocumentoCliente ? (
                  <div className="flex items-center justify-start pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowEditDocumentoInput(true)}
                      className="text-xs font-semibold text-zinc-400 hover:text-brand-pink transition-colors flex items-center gap-1.5 py-1 px-1 cursor-pointer select-none group"
                    >
                      <span className="p-1 rounded bg-zinc-800/80 group-hover:bg-brand-pink/20 text-zinc-400 group-hover:text-brand-pink transition-colors">
                        <FileText className="h-3 w-3" />
                      </span>
                      <span>+ Adicionar CPF ou CNPJ no recibo <span className="text-[11px] text-zinc-500 font-normal">(Opcional)</span></span>
                    </button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <label htmlFor="closed-edit-client-document" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-brand-pink" />
                        <span>CPF ou CNPJ do Cliente <span className="text-[11px] text-zinc-500 font-normal">(Opcional - sairá no recibo)</span></span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditDocumentoCliente('');
                          setShowEditDocumentoInput(false);
                        }}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <X className="h-3 w-3" />
                        <span>Limpar e Ocultar</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="closed-edit-client-document"
                        type="text"
                        value={editDocumentoCliente}
                        onChange={(e) => {
                          const formatted = formatCpfCnpj(e.target.value);
                          setEditDocumentoCliente(formatted);
                        }}
                        className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-xs font-mono placeholder-zinc-650"
                        placeholder="Ex: 00.000.000/0001-00 ou 000.000.000-00"
                      />
                      {editDocumentoCliente && (
                        <button
                          type="button"
                          onClick={() => setEditDocumentoCliente('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs p-1"
                          title="Limpar campo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

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
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-1.5">
                    <span>✨ Arte Concluída & Aprovada!</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Pedido <strong className="text-zinc-200 font-mono">#{saleToRemovePrompt.numeroPedido || saleToRemovePrompt.id.substring(0, 5)}</strong> • <strong className="text-zinc-200 font-bold">{saleToRemovePrompt.cliente}</strong>
                  </p>
                </div>
              </div>

              {/* Card de Notificação Automática do WhatsApp */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black uppercase tracking-wider">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Disparo Automático de WhatsApp</span>
                  </div>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                    Aprovação de Layout
                  </span>
                </div>

                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  {saleToRemovePrompt.telefoneCliente ? (
                    <>
                      Mensagem gerada para o WhatsApp <strong className="text-emerald-300 font-mono font-bold">{saleToRemovePrompt.telefoneCliente}</strong> com o link direto para o cliente confirmar o layout com 1 toque e registrar a aprovação no sistema!
                    </>
                  ) : (
                    <span className="text-amber-400 font-medium">
                      ⚠️ Este pedido não possui telefone cadastrado. Clique no botão abaixo para abrir o WhatsApp e selecionar o contato.
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-500/20">
                  <button
                    type="button"
                    onClick={() => sendLayoutApprovalWhatsapp(saleToRemovePrompt)}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-550 text-white font-black text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>{saleToRemovePrompt.telefoneCliente ? 'Reenviar no WhatsApp' : 'Abrir WhatsApp'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getLayoutApprovalMessage(saleToRemovePrompt));
                      setCopiedApprovalMsg(true);
                      playAppSound('pop');
                      setTimeout(() => setCopiedApprovalMsg(false), 2500);
                    }}
                    className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    {copiedApprovalMsg ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Copiar Texto</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-850 p-3.5 rounded-xl text-xs text-zinc-400 space-y-1 leading-relaxed">
                <p className="font-bold text-zinc-300">Deseja remover da mesa do design?</p>
                <p className="text-[10.5px] text-zinc-500">
                  Ocultar este pedido libera espaço na mesa do designer. O pedido continuará ativo e visível na lista de vendas e produção.
                </p>
              </div>

              <div className="flex gap-2.5 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleConfirmRemoveFromDesign(saleToRemovePrompt, false)}
                  className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold rounded-lg text-xs transition-colors cursor-pointer select-none"
                >
                  Manter na mesa
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmRemoveFromDesign(saleToRemovePrompt, true)}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-550 text-white font-extrabold rounded-lg text-xs shadow-md transition-colors cursor-pointer select-none"
                >
                  Ocultar da mesa 🚫
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 MODAL / OVERLAY DE ALERTA DE PEDIDOS URGENTES DE ARTE */}
      {showUrgentArtOverlay && urgentArtOrders.length > 0 && (
        <CelebrationOverlay
          type="urgent_art_alert"
          urgentOrders={urgentOrdersInfoList}
          initialUrgentMaxDays={urgentMaxDays}
          onSelectUrgentMaxDays={(maxDays) => {
            setUrgentMaxDays(maxDays);
            setCustomUrgentDaysInput(
              typeof maxDays === 'number' && ![0, 3, 5, 7, 10, 15].includes(maxDays)
                ? String(maxDays)
                : ''
            );
          }}
          onClose={() => setShowUrgentArtOverlay(false)}
          onActionClick={() => {
            setFilterUrgentOnly(true);
            setShowUrgentArtOverlay(false);
          }}
        />
      )}

    </div>
  );
}
