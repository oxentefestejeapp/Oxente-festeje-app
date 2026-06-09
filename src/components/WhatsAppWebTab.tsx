import React, { useState, useMemo } from 'react';
import { MessageSquare, Search, Phone, User, Send, FileText } from 'lucide-react';
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
      text: 'Olá, {cliente}! Seu pedido foi anotado com sucesso e já está em nossa linha de produção! Logo entraremos em contato com mais novidades. Muito obrigado pela preferência! Oxente Festeje 🎈\n\n🎨A partir de agora, será encaminhado para fila de artes do design.\n\n🚨 Ele poderá entrar em contato com 1 a 3 dias uteis, sem alteração da data da entrega.'
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
            <span className="block text-[11px] font-bold text-zinc-350 tracking-wider uppercase mb-3 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-brand-pink" />
              Modelos Rápidos (Clique para aplicar):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl.text)}
                  className="p-2.5 text-left bg-zinc-900 border border-zinc-850 hover:border-zinc-800/80 rounded-xl hover:bg-zinc-950 transition-colors cursor-pointer"
                >
                  <p className="text-[10px] font-bold text-zinc-300 truncate">
                    {tmpl.title}
                  </p>
                  <p className="text-[9px] text-zinc-600 line-clamp-1 mt-1 font-medium">
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
