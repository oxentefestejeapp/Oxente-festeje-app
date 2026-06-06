import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Phone, Hash, User, ExternalLink, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sale, StoreInfo } from '../types';

interface WhatsAppNotifierProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSale?: (updatedSale: Sale) => void;
  storeInfo?: StoreInfo;
}

export function WhatsAppNotifier({ sale, isOpen, onClose, onUpdateSale, storeInfo }: WhatsAppNotifierProps) {
  const [phone, setPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [success, setSuccess] = useState(false);

  // Sync state whenever sale opens
  useEffect(() => {
    if (sale) {
      setPhone(sale.telefoneCliente || '');
      setOrderNumber(sale.numeroPedido || sale.id.substring(0, 5).toUpperCase());
      setClientName(sale.cliente || 'Consumidor');
      setSuccess(false);
    }
  }, [sale, isOpen]);

  if (!sale || !isOpen) return null;

  // Build message exactly from the user request
  const getRawMessageText = () => {
    const defaultTemplate = `Olá, *{cliente}*!

®️ seu pedido está pronto para retirada{pedido}

⚠️ lembrando que fechamos aos sabados ao meio dia

📍 Segue o endereço abaixo

*ENDEREÇO HORÁRIOS & PONTO DE REFERENCIA*:

Rua Josina Lessa Feitosa 176

Mangabeira 1

*Ponto de referência* 

Entrando a direta da Boticário da Av Josefa Taveira, pega a primeira rua à direita.

*🚨Horário  de atendimento e retirada de produtos🚨*

Segunda a Sexta de 8:30h às 12h das 13:00h às 17:00h

Sábados de 8:30h às 12h 

*Fechado aos domingos e feriados*`;

    const rawTemplate = storeInfo?.whatsappTemplate || defaultTemplate;
    
    const clientVal = clientName.trim() || 'Consumidor';
    const orderVal = orderNumber.trim() ? ` (Pedido #${orderNumber.trim()})` : '';
    const statusVal = sale?.statusProducao || 'Pronto para Retirada';
    
    return rawTemplate
      .replace(/{cliente}/g, clientVal)
      .replace(/{pedido}/g, orderVal)
      .replace(/{status_producao}/g, statusVal)
      .replace(/{status}/g, statusVal);
  };

  const getWhatsAppLink = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.length > 0) {
      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        finalPhone = `55${cleanPhone}`;
      }
    }
    const encodedText = encodeURIComponent(getRawMessageText());
    // Use the official whatsapp:// custom protocol to launch the WhatsApp Desktop application directly
    return `whatsapp://send?phone=${finalPhone}&text=${encodedText}`;
  };

  const currentFormattedText = getRawMessageText();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.replace(/\D/g, '')) {
      alert('Por favor, informe o telefone do cliente com o DDD.');
      return;
    }

    // Save changes to sale object (phone & order number)
    const updatedSale: Sale = {
      ...sale,
      cliente: clientName.trim(),
      telefoneCliente: phone.trim() || undefined,
      numeroPedido: orderNumber.trim() || undefined,
      avisoProntoSended: true,
    };

    if (onUpdateSale) {
      onUpdateSale(updatedSale);
    }

    // Direct redirection to the native application protocol handler
    // This triggers WhatsApp Desktop or Mobile directly, bypassing browser window management and avoiding blank tabs.
    window.location.href = getWhatsAppLink();

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative select-text"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-black/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand-pink/15 border border-brand-pink/20 rounded-md text-brand-pink">
                <MessageSquare className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-100 text-sm">Avisar Pronto por WhatsApp</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Integração comercial com WhatsApp Business</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSend} className="p-6 space-y-4">
            {success ? (
              <div className="py-8 text-center flex flex-col items-center justify-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Check className="h-6 w-6 stroke-[3px]" />
                </div>
                <h4 className="text-zinc-100 font-bold text-sm">Mensagem enviada com sucesso!</h4>
                <p className="text-xs text-zinc-450 max-w-xs leading-normal">
                  Redirecionado para o WhatsApp. As atualizações cadastrais do pedido também foram salvas.
                </p>
              </div>
            ) : (
              <>
                {/* Visual Fields Wrapper */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone Input */}
                  <div>
                    <label htmlFor="wa-phone" className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1 leading-none select-none">
                      <Phone className="h-3 w-3 text-brand-pink" /> 
                      <span>Telefone do Cliente:</span>
                    </label>
                    <input
                      id="wa-phone"
                      type="tel"
                      value={phone}
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
                        setPhone(formatted);
                      }}
                      className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-xs font-mono"
                      placeholder="Ex: (83) 98885-9302"
                      required
                    />
                  </div>

                  {/* Order Number Input */}
                  <div>
                    <label htmlFor="wa-order" className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1 leading-none select-none">
                      <Hash className="h-3 w-3 text-zinc-400" />
                      <span>Nº do Pedido:</span>
                    </label>
                    <input
                      id="wa-order"
                      type="text"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-xs font-mono"
                      placeholder="Ex: 2741"
                    />
                  </div>
                </div>

                {/* Client Name Input */}
                <div>
                  <label htmlFor="wa-client" className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1 leading-none select-none">
                    <User className="h-3 w-3 text-zinc-400" />
                    <span>Nome do Cliente:</span>
                  </label>
                  <input
                    id="wa-client"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-zinc-100 text-xs"
                    placeholder="Ex: Maria Pereira"
                  />
                </div>

                {/* Live Text Preview Box */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold select-none block">
                    Pré-visualização da Mensagem:
                  </span>
                  <div className="w-full max-h-[170px] overflow-y-auto p-4 bg-zinc-950/80 border border-zinc-850 rounded-xl font-mono text-[10.5px] leading-relaxed text-zinc-300 break-words select-text">
                    {currentFormattedText.split('\n').map((line, i) => (
                      <p key={i} className={line.trim() === '' ? 'h-2' : ''}>{line}</p>
                    ))}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 justify-end pt-3 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer select-none"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer select-none flex items-center gap-2"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar no WhatsApp</span>
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </button>
                </div>
              </>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
