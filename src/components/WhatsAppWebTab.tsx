import React, { useState, useMemo } from 'react';
import { MessageSquare, Search, Phone, User, Send, FileText, Settings, Plus, Trash2, RotateCcw, Check, X } from 'lucide-react';
import { Sale, StoreInfo } from '../types';

interface MessageTemplate {
  id: string;
  title: string;
  text: string;
  isDefault?: boolean;
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'anotado',
    title: 'Pedido Anotado 📝',
    text: 'Olá, {cliente}! Seu pedido foi anotado com sucesso e já está em nossa linha de produção! Logo entraremos em contato com mais novidades. Muito obrigado pela preferência! Oxente Festeje 🎈\n\n🎨A partir de agora, será encaminhado para fila de artes do design.\n\n🚨 Ele poderá entrar em contato com 1 a 3 dias uteis, sem alteração da data da entrega.',
    isDefault: true
  },
  {
    id: 'retirada',
    title: 'Pronto para Retirada 📦',
    text: 'Olá, {cliente}! Passando para avisar que o seu pedido está prontinho e embalado para retirada! Aguardamos por você! Oxente Festeje ✨',
    isDefault: true
  },
  {
    id: 'entregue',
    title: 'Pedido Entregue 🎉',
    text: 'Olá, *{cliente}*! 🌟\n\nSeu pedido *#{pedido}* foi entregue e finalizado com sucesso! 🎉\n\n*Detalhes:*\n📦 Produto: {produto}\n\nAgradecemos imensamente pela preferência e confiança em nosso trabalho. Esperamos que tenha uma excelente experiência com seus produtos! 🥰\n\nAtenciosamente,\n*Oxente Festeje* 🌸',
    isDefault: true
  },
  {
    id: 'pendente_pagamento',
    title: 'Pendente de Pagamento ⚠️',
    text: 'Olá, {cliente}! Lembramos que há um saldo em aberto referente ao seu pedido. Poderia nos enviar o comprovante de pagamento para confirmarmos a liberação do seu pedido? Muito obrigado!',
    isDefault: true
  },
  {
    id: 'pos_venda',
    title: 'Pós-Venda / Agradecimento 🥰',
    text: 'Olá, {cliente}! Esperamos que tenha gostado das suas decorações e que sua festa tenha sido maravilhosa! Agradecemos muito pela confiança no trabalho da Oxente Festeje. Até a próxima! ❤',
    isDefault: true
  }
];

interface WhatsAppWebTabProps {
  sales: Sale[];
  storeInfo: StoreInfo;
}

export function WhatsAppWebTab({ sales, storeInfo }: WhatsAppWebTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sendMethod, setSendMethod] = useState<'web' | 'api'>('web');

  // Custom template state
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    const stored = localStorage.getItem('oxente_whatsapp_templates');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn('Erro ao carregar templates do localStorage', e);
      }
    }
    return DEFAULT_TEMPLATES;
  });

  // Template Manager Modal states
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');

  // Custom Alert & Confirm overlay states to avoid standard window.alert/window.confirm blockages in iframe
  const [modalAlert, setModalAlert] = useState<{ title?: string; message: string } | null>(null);
  const [modalConfirm, setModalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const saveTemplatesToStorage = (newTemplates: MessageTemplate[]) => {
    setTemplates(newTemplates);
    localStorage.setItem('oxente_whatsapp_templates', JSON.stringify(newTemplates));
  };

  // Extract unique active customers with a valid phone number from sales
  const uniqueContacts = useMemo(() => {
    const contactsMap = new Map<string, { name: string; phone: string; latestOrder?: string }>();
    
    // Process sales to find unique client phones
    sales.forEach(sale => {
      const rawPhone = sale.telefoneCliente || '';
      const clean = rawPhone.replace(/\D/g, '');
      if (clean && clean.length >= 8) {
        const clientName = sale.cliente || 'Consumidor';
        const key = clean;
        // Keep the latest or most complete entry
        if (!contactsMap.has(key) || clientName !== 'Consumidor') {
          contactsMap.set(key, {
            name: clientName,
            phone: rawPhone,
            latestOrder: sale.numeroPedido ? `#${sale.numeroPedido}` : undefined
          });
        }
      }
    });

    return Array.from(contactsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sales]);

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return uniqueContacts;
    const lower = searchQuery.toLowerCase();
    return uniqueContacts.filter(c => 
      c.name.toLowerCase().includes(lower) || 
      c.phone.replace(/\D/g, '').includes(lower)
    );
  }, [uniqueContacts, searchQuery]);

  const handleSelectContact = (contact: { name: string; phone: string }) => {
    setSelectedPhone(contact.phone);
    setSelectedClientName(contact.name);
  };

  const handleApplyTemplate = (templateText: string) => {
    let text = templateText;
    
    const contact = uniqueContacts.find(c => c.phone === selectedPhone || c.name === selectedClientName);
    const orderNum = contact?.latestOrder || '';
    
    const associatedSale = sales.find(s => s.telefoneCliente === selectedPhone || s.cliente === selectedClientName);
    const productLine = associatedSale 
      ? `${associatedSale.produtoNome || 'Personalizado'} (qtd: ${associatedSale.quantidade || 1})` 
      : 'Personalizado';

    if (selectedClientName) {
      text = text.replace(/{cliente}/g, selectedClientName);
    } else {
      text = text.replace(/Olá, {cliente}!/g, 'Olá!').replace(/{cliente}/g, 'cliente');
    }
    
    if (orderNum) {
      const cleanNum = orderNum.replace('#', '');
      text = text.replace(/{pedido}/g, cleanNum);
    } else {
      text = text.replace(/{pedido}/g, '_____');
    }
    
    text = text.replace(/{produto}/g, productLine);

    if (selectedPhone) {
      text = text.replace(/{telefone}/g, selectedPhone);
    } else {
      text = text.replace(/{telefone}/g, '');
    }
    
    setCustomMessage(text);
  };

  const handleOpenManager = () => {
    setIsManagerOpen(true);
    if (templates.length > 0) {
      const first = templates[0];
      setEditingTemplateId(first.id);
      setEditTitle(first.title);
      setEditText(first.text);
    } else {
      setEditingTemplateId(null);
      setEditTitle('');
      setEditText('');
    }
  };

  const handleSelectToEdit = (tmpl: MessageTemplate) => {
    setEditingTemplateId(tmpl.id);
    setEditTitle(tmpl.title);
    setEditText(tmpl.text);
  };

  const handleSaveEditedTemplate = () => {
    if (!editTitle.trim()) {
      setModalAlert({ title: 'Atenção ⚠️', message: 'Por favor, defina um título para o modelo.' });
      return;
    }
    if (!editText.trim()) {
      setModalAlert({ title: 'Atenção ⚠️', message: 'Por favor, defina o corpo da mensagem.' });
      return;
    }

    let updated: MessageTemplate[];
    if (editingTemplateId) {
      updated = templates.map(t => {
        if (t.id === editingTemplateId) {
          return { ...t, title: editTitle, text: editText };
        }
        return t;
      });
    } else {
      const newId = `custom-${Date.now()}`;
      updated = [
        ...templates,
        { id: newId, title: editTitle, text: editText, isDefault: false }
      ];
      setEditingTemplateId(newId);
    }
    saveTemplatesToStorage(updated);
  };

  const handleCreateNewTemplate = () => {
    setEditingTemplateId(null);
    setEditTitle('Novo Modelo ✨');
    setEditText('Olá, {cliente}! Seu pedido {pedido} ...');
  };

  const handleDeleteTemplate = (idForDeletion: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalConfirm({
      title: 'Excluir Modelo 🗑️',
      message: 'Deseja realmente excluir este modelo definitivamente?',
      onConfirm: () => {
        const updated = templates.filter(t => t.id !== idForDeletion);
        saveTemplatesToStorage(updated);
        if (editingTemplateId === idForDeletion) {
          if (updated.length > 0) {
            handleSelectToEdit(updated[0]);
          } else {
            setEditingTemplateId(null);
            setEditTitle('');
            setEditText('');
          }
        }
      }
    });
  };

  const handleResetToDefaults = () => {
    setModalConfirm({
      title: 'Restaurar Padrões 🔄',
      message: 'Deseja realmente redefinir todos os modelos para os padrões originais do Oxente Festeje? Todas as suas edições personalizadas serão descartadas.',
      onConfirm: () => {
        saveTemplatesToStorage(DEFAULT_TEMPLATES);
        const first = DEFAULT_TEMPLATES[0];
        setEditingTemplateId(first.id);
        setEditTitle(first.title);
        setEditText(first.text);
      }
    });
  };

  const handleSendAndLaunch = () => {
    const cleanPhone = selectedPhone.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.length > 0) {
      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        finalPhone = `55${cleanPhone}`;
      }
    }
    
    const encodedText = encodeURIComponent(customMessage);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    let url = '';
    
    if (sendMethod === 'web') {
      // Direct Web WhatsApp window send flow
      if (finalPhone) {
        url = `https://web.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`;
      } else {
        url = `https://web.whatsapp.com/send?text=${encodedText}`;
      }
    } else {
      // Native App URL Protocol launcher / mobile launcher redirect
      if (finalPhone) {
        url = isMobile 
          ? `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`
          : `whatsapp://send?phone=${finalPhone}&text=${encodedText}`;
      } else {
        url = isMobile 
          ? `https://api.whatsapp.com/send?text=${encodedText}`
          : `whatsapp://send?text=${encodedText}`;
      }
    }

    window.open(url, '_blank');
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-xl no-print max-w-5xl mx-auto animate-in fade-in duration-200">
      
      {/* Header decoration */}
      <div className="bg-zinc-900 border-b border-zinc-850 p-6 flex items-center gap-3">
        <div className="p-2.5 bg-brand-pink/10 border border-brand-pink/20 text-brand-pink rounded-xl">
          <MessageSquare className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg text-white flex items-center gap-1.5">
            Assistente de Mensagens WhatsApp
            <span className="text-[10px] bg-brand-pink/20 text-brand-pink px-2.5 py-0.5 rounded-full font-bold">Oxente</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Prepare e envie mensagens rápidas para seus clientes de forma simplificada</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 md:divide-x md:divide-zinc-900">
        {/* LEFT COLUMN: Message Editor & Actions (7 cols) */}
        <div className="md:col-span-7 p-6 space-y-5 bg-zinc-950">
          
          {/* Quick client select input */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-zinc-400 tracking-wide uppercase">
              Destinatário
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold tracking-wide uppercase">Nome do Cliente</span>
                <input
                  type="text"
                  placeholder="Nome do cliente"
                  value={selectedClientName}
                  onChange={(e) => setSelectedClientName(e.target.value)}
                  className="px-3.5 py-2.5 bg-zinc-905 border border-zinc-850 hover:border-zinc-800 focus:border-brand-pink rounded-xl text-xs text-zinc-100 placeholder-zinc-650 focus:ring-1 focus:ring-brand-pink focus:outline-hidden transition-all w-full font-medium"
                />
              </div>
              
              <div className="space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold tracking-wide uppercase font-mono">Telefone (DDD + Número)</span>
                <input
                  type="text"
                  placeholder="Tel (DDD + Número)"
                  value={selectedPhone}
                  onChange={(e) => setSelectedPhone(e.target.value)}
                  className="px-3.5 py-2.5 bg-zinc-905 border border-zinc-850 hover:border-zinc-800 focus:border-brand-pink rounded-xl text-xs tracking-wide text-zinc-100 placeholder-zinc-650 focus:ring-1 focus:ring-brand-pink focus:outline-hidden transition-all font-mono font-medium w-full"
                />
              </div>
            </div>
          </div>

          {/* Quick Message Input Area */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-zinc-400 tracking-wide uppercase">
              Mensagem para Enviar
            </label>
            <textarea
              rows={6}
              placeholder="Digite aqui sua mensagem personalizada..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="px-4 py-3 bg-zinc-905 border border-zinc-855 hover:border-zinc-800 focus:border-brand-pink rounded-xl text-xs text-zinc-200 placeholder-zinc-650 focus:ring-1 focus:ring-brand-pink focus:outline-hidden transition-all w-full resize-none leading-relaxed"
            />
          </div>

          {/* Destination Dispatch Selection */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-zinc-400 tracking-wide uppercase select-none">
              Enviar através do:
            </label>
            <div className="grid grid-cols-2 gap-2 bg-zinc-905 p-1.5 rounded-xl border border-zinc-850">
              <button
                type="button"
                onClick={() => setSendMethod('web')}
                className={`py-2 px-3 rounded-lg text-[10px] font-extrabold tracking-wider uppercase transition-all active:scale-95 cursor-pointer ${
                  sendMethod === 'web'
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
                }`}
                title="Abre a conversa diretamente no WhatsApp Web no seu navegador Chrome/Firefox"
              >
                🌐 WhatsApp Web
              </button>
              <button
                type="button"
                onClick={() => setSendMethod('api')}
                className={`py-2 px-3 rounded-lg text-[10px] font-extrabold tracking-wider uppercase transition-all active:scale-95 cursor-pointer ${
                  sendMethod === 'api'
                    ? 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
                }`}
                title="Dispara o protocolo para abrir o aplicativo nativo instalado no celular ou no computador"
              >
                📱 Aplicativo
              </button>
            </div>
          </div>

          {/* Send Trigger */}
          <button
            onClick={handleSendAndLaunch}
            disabled={!customMessage.trim()}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-900 disabled:text-zinc-650 disabled:border-transparent text-white font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-97 border border-emerald-550/20"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Disparar Mensagem no WhatsApp</span>
          </button>
        </div>

        {/* RIGHT COLUMN: Contact Book & Fast Messages Assistant (5 cols) */}
        <div className="md:col-span-12 lg:col-span-5 flex flex-col min-h-0 bg-zinc-900/10">
          
          {/* Customers panel title */}
          <div className="p-4 bg-zinc-950/45 border-b border-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-zinc-350 tracking-wider uppercase flex items-center gap-1.5">
                <User className="h-4 w-4 text-brand-pink" />
                Clientes Recentes
              </span>
              <span className="text-[10px] bg-zinc-805 px-2 py-0.5 rounded-full font-bold text-zinc-400">
                {filteredContacts.length} contatos
              </span>
            </div>
            
            {/* Search Contacts Directory */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Pesquisar cliente ou número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-905 border border-zinc-850 hover:border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink rounded-xl text-xs text-zinc-300 placeholder-zinc-600 focus:outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Dynamic Scroll Contacts */}
          <div className="flex-1 p-3 space-y-1.5 overflow-y-auto max-h-[280px] min-h-[180px] scrollbar-thin border-b border-zinc-900">
            {filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Nenhum telefone encontrado nas vendas.
              </div>
            ) : (
              filteredContacts.map((contact, idx) => {
                const isSelected = selectedPhone === contact.phone;
                return (
                  <button
                    key={`${contact.phone}-${idx}`}
                    onClick={() => handleSelectContact(contact)}
                    className={`w-full text-left p-3 rounded-2xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer border ${
                      isSelected 
                        ? 'bg-brand-pink/10 border-brand-pink/30 text-brand-pink font-semibold' 
                        : 'bg-zinc-900 border-zinc-850/60 hover:border-zinc-800 hover:bg-zinc-900/60 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <p className="font-bold truncate text-[11.5px] leading-tight">
                        {contact.name}
                      </p>
                      <p className="text-[10px] text-zinc-550 font-mono mt-1 flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-zinc-600" />
                        {contact.phone}
                      </p>
                    </div>
                    {contact.latestOrder && (
                      <span className="shrink-0 text-[9px] bg-zinc-905 border border-zinc-850 text-zinc-400 px-2 py-0.5 rounded-md font-mono self-start mt-0.5">
                        {contact.latestOrder}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Templates container */}
          <div className="p-4 bg-zinc-950/20">
            <div className="flex items-center justify-between mb-3 gap-2">
              <span className="block text-[11px] font-bold text-zinc-350 tracking-wider uppercase flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-brand-pink" />
                Modelos Rápidos (Clique para aplicar):
              </span>
              <button
                type="button"
                onClick={handleOpenManager}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-colors cursor-pointer border border-zinc-800"
              >
                <Settings className="h-3 w-3 text-brand-pink" />
                Configurar Modelos
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl.text)}
                  className="p-2.5 text-left bg-zinc-900 border border-zinc-850 hover:border-zinc-800/80 rounded-xl hover:bg-zinc-950 transition-colors cursor-pointer text-wrap"
                >
                  <p className="text-[10px] font-bold text-zinc-300 truncate">
                    {tmpl.title}
                  </p>
                  <p className="text-[9px] text-zinc-500 line-clamp-1 mt-1 font-medium">
                    {tmpl.text}
                  </p>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Template Manager Modal Overlay */}
      {isManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-zinc-900 border-b border-zinc-850 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-pink/10 border border-brand-pink/20 text-brand-pink rounded-xl">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-white">Gerenciar Modelos de Mensagens</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-sans">Crie, edite e personalize suas mensagens pré-programadas do WhatsApp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManagerOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content Column Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-zinc-900">
              
              {/* Left Column: List of templates */}
              <div className="md:col-span-5 p-4 flex flex-col min-h-0 space-y-2.5">
                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans">Modelos Salvos</span>
                  <button
                    type="button"
                    onClick={handleCreateNewTemplate}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-350 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    Novo Modelo
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 max-h-[220px] md:max-h-[320px] pr-1 scrollbar-thin">
                  {templates.map((tmpl) => {
                    const isSelected = editingTemplateId === tmpl.id;
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => handleSelectToEdit(tmpl)}
                        className={`group p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-brand-pink/10 border-brand-pink/30 text-brand-pink font-semibold'
                            : 'bg-zinc-900 border-zinc-850 hover:bg-zinc-850/60 text-zinc-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[11px] truncate leading-tight">{tmpl.title}</p>
                          <p className="text-[9px] text-zinc-500 line-clamp-1 mt-1 font-mono">{tmpl.text}</p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                          className="shrink-0 p-1 text-zinc-650 hover:text-rose-450 hover:bg-rose-950/20 rounded-md transition-all cursor-pointer opacity-85 hover:opacity-100"
                          title="Excluir Modelo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-zinc-900">
                  <button
                    type="button"
                    onClick={handleResetToDefaults}
                    className="w-full py-2 bg-zinc-900 hover:bg-rose-950/20 text-zinc-400 hover:text-zinc-300 rounded-xl text-[10px] font-bold transition-all border border-zinc-850/60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3 text-brand-pink" />
                    Restaurar Padrões Oxente
                  </button>
                </div>
              </div>

              {/* Right Column: Active Editor form */}
              <div className="md:col-span-7 p-4 flex flex-col space-y-4">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-sans">
                  {editingTemplateId ? 'Editar Modelo Selecionado' : 'Criar Novo Modelo Personalizado'}
                </span>

                <div className="space-y-3 flex-1">
                  <div className="space-y-1">
                    <span className="text-[9.5px] text-zinc-500 font-bold uppercase tracking-wider block">Título do Modelo</span>
                    <input
                      type="text"
                      placeholder="Ex: Confirmação de Entrega 🚚"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-850 hover:border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink rounded-xl text-xs text-zinc-100 placeholder-zinc-650 focus:outline-hidden transition-all font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9.5px] text-zinc-500 font-bold uppercase tracking-wider block">Texto da Mensagem</span>
                    <textarea
                      rows={5}
                      placeholder="Olá, {cliente}! Seu pedido número {pedido} para o produto {produto} foi recebido."
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-850 hover:border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink rounded-xl text-xs text-zinc-205 placeholder-zinc-650 focus:outline-hidden transition-all font-sans leading-relaxed resize-none"
                    />
                  </div>

                  {/* tags guides */}
                  <div className="p-3 bg-zinc-900/60 border border-zinc-850/80 rounded-xl space-y-1">
                    <span className="text-[9.5px] font-extrabold text-brand-pink tracking-wider uppercase block">🏷️ Substituições Automáticas:</span>
                    <p className="text-[9.5px] text-zinc-450 leading-relaxed">
                      Coloque estes termos com chaves no texto do modelo para serem preenchidos sozinhos ao aplicar:
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-zinc-500 pt-1">
                      <div><span className="text-emerald-400 font-bold">{'{cliente}'}</span> : Nome do cliente</div>
                      <div><span className="text-emerald-400 font-bold">{'{pedido}'}</span> : Número do pedido (#)</div>
                      <div><span className="text-emerald-400 font-bold">{'{produto}'}</span> : Nome/Qtd do item</div>
                      <div><span className="text-emerald-400 font-bold">{'{telefone}'}</span> : Tel do cliente</div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-900 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSaveEditedTemplate}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold rounded-xl transition-all shadow-md active:scale-97 cursor-pointer"
                  >
                    Salvar Modelo
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Overlay */}
      {modalAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div>
              <h4 className="font-display font-bold text-sm text-zinc-100 flex items-center gap-1.5">
                {modalAlert.title || 'Aviso ℹ️'}
              </h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{modalAlert.message}</p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setModalAlert(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 text-[10.5px] font-bold rounded-xl border border-zinc-800 transition-colors cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Overlay */}
      {modalConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div>
              <h4 className="font-display font-bold text-sm text-zinc-100 flex items-center gap-1.5">
                {modalConfirm.title}
              </h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{modalConfirm.message}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalConfirm(null)}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-450 hover:text-zinc-350 text-[10.5px] font-bold rounded-xl border border-zinc-800/80 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  modalConfirm.onConfirm();
                  setModalConfirm(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold rounded-xl transition-colors cursor-pointer shadow-md"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
