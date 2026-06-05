import React, { useState, useMemo } from 'react';
import { MessageSquare, ExternalLink, Search, Phone, User, Send, Info, AlertCircle, FileText } from 'lucide-react';
import { Sale, StoreInfo } from '../types';

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

  // Pre-configured templates with {cliente} placeholder
  const templates = [
    {
      title: 'Pedido Anotado 📝',
      text: 'Olá, {cliente}! Seu pedido foi anotado com sucesso e já está em nossa linha de produção! Logo entraremos em contato com mais novidades. Muito obrigado pela preferência! Oxente Festeje 🎈'
    },
    {
      title: 'Pronto para Retirada 📦',
      text: 'Olá, {cliente}! Passando para avisar que o seu pedido está prontinho e embalado para retirada! Aguardamos por você! Oxente Festeje ✨'
    },
    {
      title: 'Pendente de Pagamento ⚠️',
      text: 'Olá, {cliente}! Lembramos que há um saldo em aberto referente ao seu pedido. Poderia nos enviar o comprovante de pagamento para confirmarmos a liberação do seu pedido? Muito obrigado!'
    },
    {
      title: 'Pós-Venda / Agradecimento 🥰',
      text: 'Olá, {cliente}! Esperamos que tenha gostado das suas decorações e que sua festa tenha sido maravilhosa! Agradecemos muito pela confiança no trabalho da Oxente Festeje. Até a próxima! ❤'
    }
  ];

  const handleSelectContact = (contact: { name: string; phone: string }) => {
    setSelectedPhone(contact.phone);
    setSelectedClientName(contact.name);
  };

  const handleApplyTemplate = (templateText: string) => {
    let text = templateText;
    if (selectedClientName) {
      text = text.replace(/{cliente}/g, selectedClientName);
    } else {
      // If no customer is chosen, clean up the greeting naturally
      text = text.replace(/Olá, {cliente}!/g, 'Olá!').replace(/{cliente}/g, 'cliente');
    }
    setCustomMessage(text);
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

  const handleOpenWhatsAppWebDirectly = () => {
    window.open('https://web.whatsapp.com/', '_blank');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch no-print">
      
      {/* COLUMN 1: Direct Integration with official WhatsApp Web (7 cols) */}
      <div className="lg:col-span-8 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl min-h-[680px]">
        
        {/* Header decoration */}
        <div className="bg-zinc-950 border-b border-zinc-800 p-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-zinc-100 flex items-center gap-1.5">
                Painel WhatsApp Web
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Oficial</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Atenda seus clientes de forma sincronizada</p>
            </div>
          </div>
          
          <button
            onClick={handleOpenWhatsAppWebDirectly}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950/20 active:scale-97"
            title="Abre o WhatsApp Web em uma janela cheia alternativa de backup"
          >
            <span>Abrir WhatsApp Web Oficial</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Warning Alert banner */}
        <div className="bg-zinc-950/45 px-5 py-3 border-b border-zinc-850 text-[11px] text-zinc-400 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-zinc-200 font-bold block mb-0.5">Dica Importante:</span>
            O WhatsApp Web original bloqueia a exibição em telas internas (frames) em alguns navegadores devido a políticas rígidas de segurança corporativa do Meta. Se a janela abaixo carregar em branco ou com erro, clique em <strong className="text-emerald-400 cursor-pointer hover:underline" onClick={handleOpenWhatsAppWebDirectly}>"Abrir WhatsApp Web Oficial"</strong> logo acima para conectar em uma nova janela de forma segura.
          </div>
        </div>

        {/* Frame container */}
        <div className="flex-1 bg-zinc-950 relative min-h-[500px]">
          <iframe
            src="https://web.whatsapp.com/"
            title="WhatsApp Web Desktop"
            className="absolute inset-0 w-full h-full border-0 rounded-b-2xl bg-zinc-950"
            allow="camera; microphone; clipboard-read; clipboard-write; geolocation"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* COLUMN 2: Contact Book & Fast Messages Assistant (4 cols) */}
      <div className="lg:col-span-4 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl min-h-[680px]">
        
        {/* Assistant Header */}
        <div className="bg-zinc-950 border-b border-zinc-800 p-4">
          <h2 className="font-display font-semibold text-sm text-zinc-200 flex items-center gap-1.5">
            <span className="p-1 px-1.5 bg-brand-pink/10 border border-brand-pink/20 rounded-lg text-brand-pink text-[11px] font-black">AI</span>
            Assistente de Mensagens
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">Agilize contatos recolhendo dados das suas vendas</p>
        </div>

        {/* Action center form */}
        <div className="p-4 space-y-4 border-b border-zinc-805 bg-zinc-950/25 shrink-0">
          
          {/* Quick client select input */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 tracking-wide uppercase mb-1.5">
              Destinatário
            </label>
            
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nome do cliente"
                value={selectedClientName}
                onChange={(e) => setSelectedClientName(e.target.value)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-brand-pink rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden transition-all w-full font-medium"
              />
              
              <input
                type="text"
                placeholder="Tel (DDD + Número)"
                value={selectedPhone}
                onChange={(e) => setSelectedPhone(e.target.value)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-brand-pink rounded-xl text-xs tracking-wide text-zinc-100 placeholder-zinc-500 focus:outline-hidden transition-all font-mono font-medium w-full"
              />
            </div>
          </div>

          {/* Quick Message Input Area */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 tracking-wide uppercase mb-1.5">
              Mensagem para Enviar
            </label>
            <textarea
              rows={4}
              placeholder="Digite aqui sua mensagem personalizada..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-brand-pink rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden transition-all w-full resize-none leading-relaxed"
            />
          </div>

          {/* Destination Dispatch Selection */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 tracking-wide uppercase mb-1.5 select-none">
              Enviar através do:
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-zinc-900 p-1.5 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setSendMethod('web')}
                className={`py-1.5 px-3 rounded-lg text-[10px] font-extrabold tracking-wider uppercase transition-all active:scale-95 cursor-pointer ${
                  sendMethod === 'web'
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
                title="Abre a conversa diretamente no WhatsApp Web no seu navegador Chrome/Firefox"
              >
                🌐 WhatsApp Web
              </button>
              <button
                type="button"
                onClick={() => setSendMethod('api')}
                className={`py-1.5 px-3 rounded-lg text-[10px] font-extrabold tracking-wider uppercase transition-all active:scale-95 cursor-pointer ${
                  sendMethod === 'api'
                    ? 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
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
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-650 text-white font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-97 border border-emerald-550/20 disabled:border-transparent"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Disparar Mensagem no WhatsApp</span>
          </button>
        </div>

        {/* Quick Contacts Directory */}
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-900">
          
          {/* Tabs switch / title */}
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/25 shrink-0 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Clientes Recentes com Salles</span>
            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full font-bold text-zinc-400">
              {filteredContacts.length} contatos
            </span>
          </div>

          {/* Search Contacts Directory */}
          <div className="p-3 border-b border-zinc-800/60 bg-zinc-950/10 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-550" />
              <input
                type="text"
                placeholder="Pesquisar cliente ou número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-750 focus:border-brand-pink rounded-lg text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Dynamic Scroll Contacts */}
          <div className="flex-grow overflow-y-auto p-2 space-y-1 max-h-[170px] min-h-[120px] scrollbar-thin border-b border-zinc-800">
            {filteredContacts.length === 0 ? (
              <div className="p-6 text-center text-[11px] text-zinc-550">
                Nenhum telefone encontrado nas vendas.
              </div>
            ) : (
              filteredContacts.map((contact, idx) => {
                const isSelected = selectedPhone === contact.phone;
                return (
                  <button
                    key={`${contact.phone}-${idx}`}
                    onClick={() => handleSelectContact(contact)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between gap-2 cursor-pointer border ${
                      isSelected 
                        ? 'bg-brand-pink/10 border-brand-pink/30 text-brand-pink font-semibold' 
                        : 'bg-zinc-950/25 border-transparent hover:border-zinc-800 hover:bg-zinc-950/45 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <p className="font-bold truncate text-[11.5px] leading-tight">
                        {contact.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5 text-zinc-605" />
                        {contact.phone}
                      </p>
                    </div>
                    {contact.latestOrder && (
                      <span className="shrink-0 text-[8.5px] bg-zinc-800 border border-zinc-750 text-zinc-400 px-1.5 py-0.5 rounded-md font-mono self-start mt-0.5">
                        {contact.latestOrder}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Templates container */}
          <div className="p-4 shrink-0 bg-zinc-950/40">
            <span className="block text-[10px] font-bold text-zinc-400 tracking-wider uppercase mb-2.5 flex items-center gap-1">
              <FileText className="h-3 w-3 text-brand-pink" />
              Modelos Rápidos de Confirmação:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl.text)}
                  className="p-2 text-left bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-xl hover:bg-zinc-950 transition-colors cursor-pointer"
                >
                  <p className="text-[10px] font-bold text-zinc-350 truncate">
                    {tmpl.title}
                  </p>
                  <p className="text-[9px] text-zinc-600 line-clamp-1 mt-0.5">
                    {tmpl.text}
                  </p>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
