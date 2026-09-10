import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Check, 
  Loader2, 
  Calendar, 
  MapPin, 
  Instagram, 
  MessageSquare, 
  ArrowLeft, 
  DollarSign, 
  AlertCircle,
  Package,
  Sparkles,
  Search,
  ShoppingCart,
  QrCode,
  ShieldCheck,
  Smartphone,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { supabase, mapDbToSale } from '../lib/supabase';
import { Sale, StoreInfo } from '../types';
import { BrandLogo } from './BrandLogo';
import { playAppSound } from '../lib/audio';

const DEFAULT_STORE_INFO: StoreInfo = {
  nome: "Oxente Festeje",
  instagram: "@oxentefesteje",
  telefone: "83988859302",
  endereco: "Rua Josina Lessa Feitosa 176, Mangabeira 1 - João Pessoa - PB"
};

export function OrderTrackingPage() {
  const [trackingId, setTrackingId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const aprovarParam = urlParams.get('aprovar');
    if (aprovarParam && aprovarParam !== '1' && aprovarParam !== 'true') {
      return aprovarParam;
    }
    return urlParams.get('venda') || urlParams.get('acompanhar') || urlParams.get('pedido') || '';
  });
  
  const [typedId, setTypedId] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(DEFAULT_STORE_INFO);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [justApproved, setJustApproved] = useState(false);

  // Fetch single order details
  const fetchTrackingOrder = async (idToFetch: string) => {
    if (!idToFetch.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const cleanId = idToFetch.trim();
      const numOnly = cleanId.replace(/^#/, '');

      let foundRecord: any = null;

      // 1. Fetch sale detail by UUID
      const { data: saleData, error: saleError } = await supabase
        .from('oxente_sales')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (saleError) {
        console.error('Error fetching order by id:', saleError);
      }

      if (saleData) {
        foundRecord = saleData;
      } else {
        // Try searching by order number (numeroPedido)
        const { data: saleByNum } = await supabase
          .from('oxente_sales')
          .select('*')
          .eq('numero_pedido', cleanId)
          .maybeSingle();

        if (saleByNum) {
          foundRecord = saleByNum;
        } else if (numOnly !== cleanId) {
          const { data: saleByNumOnly } = await supabase
            .from('oxente_sales')
            .select('*')
            .eq('numero_pedido', numOnly)
            .maybeSingle();
          if (saleByNumOnly) {
            foundRecord = saleByNumOnly;
          }
        }
      }

      // If still not found, check localStorage fallback
      if (!foundRecord) {
        try {
          const raw = localStorage.getItem('oxente_sales');
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const localMatch = list.find((s: any) => 
                s.id === cleanId || 
                s.numeroPedido === cleanId || 
                s.numeroPedido === numOnly ||
                (s.id && s.id.substring(0, 5) === cleanId)
              );
              if (localMatch) {
                setSale(localMatch);
                setLoading(false);
                return;
              }
            }
          }
        } catch (e) {}

        setErrorMsg('Pedido não encontrado. Verifique se o código ou o número do pedido está correto.');
        setSale(null);
        return;
      }

      setSale(mapDbToSale(foundRecord));

      // 2. Fetch latest store details (apenas o registro 'default' da loja)
      const { data: storeData } = await supabase
        .from('oxente_store_info')
        .select('*')
        .eq('key', 'default')
        .maybeSingle();
      
      if (storeData) {
        const validNome = storeData.nome && !/^\d{10,}$/.test(storeData.nome.trim())
          ? storeData.nome
          : DEFAULT_STORE_INFO.nome;

        setStoreInfo({
          nome: validNome,
          instagram: storeData.instagram || DEFAULT_STORE_INFO.instagram,
          telefone: storeData.telefone || DEFAULT_STORE_INFO.telefone,
          endereco: storeData.endereco || DEFAULT_STORE_INFO.endereco,
          whatsappTemplate: storeData.whatsapp_template || undefined
        });
      }
    } catch (err: any) {
      console.error('General error fetching tracking details:', err);
      setErrorMsg('Ocorreu um erro ao carregar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppConfirmationUrl = () => {
    if (!sale) return '#';
    const cleanPhone = (storeInfo?.telefone || DEFAULT_STORE_INFO.telefone).replace(/\D/g, '');
    const storePhoneForWA = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const pedidoTag = sale.numeroPedido ? `#${sale.numeroPedido}` : `#${sale.id.substring(0, 5)}`;
    const storeName = storeInfo?.nome && !/^\d{10,}$/.test(storeInfo.nome.trim()) ? storeInfo.nome : 'Oxente Festeje';
    const textMsg = `Olá, *${storeName}*! Tudo bem? 🎨✨\n\nAqui é *${sale.cliente || 'Cliente'}*!\nPassei para avisar que *APROVEI O LAYOUT* do meu pedido *${pedidoTag}*! ✅🧵\n\nConferi com atenção todas as cores, modelos, textos, ortografia e detalhes. Está tudo certinho para a confecção e produção! 🚀🎈\n\nMuito obrigado!`;
    return `https://api.whatsapp.com/send?phone=${storePhoneForWA}&text=${encodeURIComponent(textMsg)}`;
  };

  const handleApproveLayout = async () => {
    if (!sale) return;
    setApproving(true);
    const waUrl = getWhatsAppConfirmationUrl();

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('oxente_sales')
        .update({
          cliente_aprovou_layout: true,
          cliente_aprovou_layout_em: nowIso
        })
        .eq('id', sale.id);

      if (error) {
        console.error('Erro ao registrar aprovação do layout no Supabase:', error);
      }

      setSale(prev => prev ? {
        ...prev,
        clienteAprovouLayout: true,
        clienteAprovouLayoutEm: nowIso
      } : null);

      setJustApproved(true);
      playAppSound('complete');

      // Local storage fallback sync
      try {
        const raw = localStorage.getItem('oxente_sales');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map((s: any) => s.id === sale.id ? { 
              ...s, 
              clienteAprovouLayout: true, 
              clienteAprovouLayoutEm: nowIso 
            } : s);
            localStorage.setItem('oxente_sales', JSON.stringify(updated));
          }
        }
      } catch (e) {}

      // Abre a conversa no WhatsApp para enviar a confirmação também pelo Zap
      if (waUrl && waUrl !== '#') {
        window.open(waUrl, '_blank');
      }
    } catch (err) {
      console.error('Erro ao aprovar:', err);
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    if (trackingId) {
      fetchTrackingOrder(trackingId);
    }
  }, [trackingId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedId.trim()) {
      setTrackingId(typedId.trim());
      fetchTrackingOrder(typedId.trim());
    }
  };

  const handleBackToSearch = () => {
    setSale(null);
    setErrorMsg(null);
    setTrackingId('');
    setTypedId('');
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  };

  // Determine Timeline Steps status and helper values
  const getTimelineSteps = () => {
    if (!sale) return [];

    // Step 1: Pedido Lançado
    const step1Date = sale.data 
      ? new Date(sale.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : 'Processado';

    // Step 2: Arte em Produção
    let s2Title = 'Arte em Produção';
    let s2Desc = 'Aguardando início do design da arte pela equipe.';
    let s2Status: 'pending' | 'active' | 'done' = 'pending';

    if (sale.statusArte === 'Arte Finalizada') {
      s2Title = 'Arte Concluída pelo Designer 🎨';
      s2Desc = `Layout finalizado com capricho pela equipe de criação${sale.arteFinalizadaEm ? ` em ${new Date(sale.arteFinalizadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}.`;
      s2Status = 'done';
    } else if (sale.puxadoPor) {
      s2Title = 'Arte em Elaboração 🎨';
      s2Desc = `O designer ${sale.puxadoPor} está desenhando seu projeto com todo capricho.`;
      s2Status = 'active';
    } else {
      s2Title = 'Arte na Fila de Criação 🎨';
      s2Desc = 'Aguardando início da elaboração da arte pela nossa equipe.';
      s2Status = 'active';
    }

    // Step 4: Produção Física / Confecção (Passado para fase de produção)
    const prod = sale.statusProducao || 'Agendado';
    let s4Title = 'Confecção & Produção Física';
    let s4Desc = 'Seu pedido entrará na linha de produção física assim que a arte for aprovada por você.';
    let s4Status: 'pending' | 'active' | 'done' = 'pending';

    if (['Pronto para Retirada', 'Agendado para Entrega', 'Entregue'].includes(prod)) {
      s4Title = 'Confecção Concluída com Sucesso! 🎁';
      s4Desc = 'Todos os seus personalizados foram produzidos, revisados e embalados.';
      s4Status = 'done';
    } else if (sale.clienteAprovouLayout) {
      // SÓ entra em fase ativa e anima/pisca após a aprovação formal do cliente
      if (prod === 'Em Produção') {
        s4Title = 'Em Produção & Confecção Física! ⚙️🧵';
        s4Desc = 'Seus personalizados estão sendo impressos, recortados e montados na oficina com todo carinho.';
      } else {
        s4Title = 'Passado para Fase de Produção! 🚀🧵';
        s4Desc = 'Com a sua aprovação confirmada, seu pedido avançou para a fila de confecção e produção!';
      }
      s4Status = 'active';
    } else {
      // Cliente AINDA NÃO aprovou o layout: mantém estritamente pendente (sem piscar nem animar)
      s4Status = 'pending';
      if (sale.statusArte === 'Arte Finalizada') {
        s4Title = 'Aguardando Aprovação para Iniciar Produção';
        s4Desc = 'Aguardando a sua confirmação no layout acima para dar início à confecção física.';
      } else {
        s4Title = 'Confecção & Produção Física';
        s4Desc = 'Seu pedido entrará na produção física após a conclusão e aprovação da arte.';
      }
    }

    // Step 5: Retirada / Entrega
    let s5Title = 'Aguardando Conclusão da Produção';
    let s5Desc = 'Assim que a confecção terminar, seu pacote ficará pronto para entrega ou retirada.';
    let s5Status: 'pending' | 'active' | 'done' = 'pending';

    if (prod === 'Entregue') {
      s5Title = 'Pedido Entregue! 📦🎉';
      s5Desc = 'Seu pedido foi entregue ou retirado na loja com sucesso. Muito obrigado pela preferência!';
      s5Status = 'done';
    } else if (['Pronto para Retirada', 'Agendado para Entrega'].includes(prod)) {
      s5Title = prod === 'Agendado para Entrega' ? 'Pronto & Agendado para Entrega! 🚚' : 'Pronto para Retirada na Loja! 🎁';
      s5Desc = prod === 'Agendado para Entrega' 
        ? 'Pedido pronto aguardando a rota de entrega chegar até você.'
        : 'Seu pacote já está limpinho e embalado na loja te esperando!';
      s5Status = 'active';
    }

    const steps: Array<{ id: number; title: string; desc: string; status: 'done' | 'active' | 'pending' }> = [
      { id: 1, title: '🛒 Pedido Lançado & Confirmado', desc: `Registrado no sistema em ${step1Date}.`, status: 'done' },
      { id: 2, title: s2Title, desc: s2Desc, status: s2Status },
    ];

    // SÓ exibe a etapa de aprovação de layout se o designer já finalizou a arte ou se já foi aprovada
    if (sale.statusArte === 'Arte Finalizada' || sale.clienteAprovouLayout) {
      steps.push({
        id: steps.length + 1,
        title: sale.clienteAprovouLayout ? 'Layout Aprovado por Você! ✨' : 'Aguardando sua Aprovação do Layout ⏳',
        desc: sale.clienteAprovouLayout
          ? `Você conferiu e aprovou formalmente o layout${sale.clienteAprovouLayoutEm ? ` em ${new Date(sale.clienteAprovouLayoutEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}. Pedido liberado para produção!`
          : 'A arte foi finalizada pelo designer! Por favor, confira todos os detalhes no card acima e confirme a aprovação para liberar a confecção.',
        status: sale.clienteAprovouLayout ? ('done' as const) : ('active' as const)
      });
    }

    steps.push({ id: steps.length + 1, title: s4Title, desc: s4Desc, status: s4Status });
    steps.push({ id: steps.length + 1, title: s5Title, desc: s5Desc, status: s5Status });

    return steps;
  };

  const titleCase = (str: string) => {
    return str;
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-between font-sans selection:bg-brand-pink/30 antialiased">
      
      {/* 1. TOP HEADER / APP LOGO BLOCK */}
      <header className="w-full max-w-xl px-5 pt-8 pb-4 flex flex-col items-center text-center">
        <BrandLogo size="md" className="mb-3" />
        <h1 className="text-xl font-display font-medium tracking-tight text-white">Oxente Festeje</h1>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-medium">Portal de Acompanhamento do Cliente</p>
      </header>

      {/* 2. MAIN LOGICAL STAGE */}
      <main className="w-full max-w-xl flex-1 px-4 pb-12 flex flex-col justify-start">
        
        {/* CASE A: STILL LOADING */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 select-none">
            <Loader2 className="h-9 w-9 text-brand-pink animate-spin mb-4" />
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Buscando informações do pedido...</span>
            <p className="text-[10px] text-zinc-650 mt-1.5 font-mono">Conectando real-time ao banco de dados</p>
          </div>
        )}

        {/* CASE B: NO SALE LOADED & NOT LOADING -> SHOW DESERT SEARCH BOX */}
        {!loading && !sale && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-zinc-900 border border-zinc-805/90 rounded-3xl p-6.5 shadow-2xl relative overflow-hidden space-y-6"
          >
            {/* Ambient Background Glow inside the Search card */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink/5 rounded-full blur-2xl -z-10" />
            
            <div className="text-center space-y-2">
              <span className="inline-flex p-3 bg-brand-pink/10 border border-brand-pink/20 rounded-2xl text-brand-pink select-none">
                <ShoppingCart className="h-6 w-6" />
              </span>
              <h2 className="text-base font-bold text-zinc-100 font-display">Acompanhe seu Pedido</h2>
              <p className="text-xs text-zinc-400 font-sans max-w-xs mx-auto leading-relaxed">
                Digite o código identificador enviado pela loja no WhatsApp ou o número do pedido para ver o status em tempo real.
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Código do pedido (ex: b1a4... ou #1002)"
                  value={typedId}
                  onChange={(e) => setTypedId(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-zinc-950/80 border border-zinc-800 rounded-2xl py-4.5 pl-11 pr-5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-pink focus:ring-1 focus:ring-brand-pink transition-all"
                />
                <Search className="h-4 w-4 text-zinc-600 absolute left-4.5 top-[18px]" />
              </div>
              <button
                type="submit"
                disabled={!typedId.trim()}
                className="w-full py-4 bg-brand-pink hover:bg-brand-pink-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-wide rounded-2xl cursor-pointer disabled:cursor-not-allowed transition-all active:scale-98 flex items-center justify-center gap-1.5"
              >
                Buscar Pedido
              </button>
            </form>

            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="p-3 bg-red-950/15 border border-red-900/35 rounded-xl flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-red-300 leading-normal font-sans font-medium">{errorMsg}</span>
              </motion.div>
            )}

            <div className="pt-2 text-center select-none">
              <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono font-bold flex items-center justify-center gap-1">
                <ShieldCheck className="h-3 w-3 text-zinc-600" /> Servidor Seguro Oxente Cloud
              </span>
            </div>
          </motion.div>
        )}

        {/* CASE C: ORDER DETAILS LOADED -> EXPLORE DETAILED TIMELINE */}
        {!loading && sale && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Header info bar */}
            <div className="flex items-center justify-between px-3 select-none">
              <button 
                onClick={handleBackToSearch}
                className="text-zinc-500 hover:text-white flex items-center gap-1 text-[10px] uppercase font-black tracking-wider cursor-pointer transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Nova Consulta</span>
              </button>
            </div>

            {/* CARD 1: OVERVIEW HERO */}
            <div className="bg-zinc-900 border border-zinc-805 rounded-3xl p-5 shadow-lg relative overflow-hidden select-none">
              <div className="absolute top-0 right-0 w-28 h-28 bg-brand-pink/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-brand-pink tracking-wider">Cliente</span>
                  <div className="py-1 px-2.5 bg-brand-pink/15 rounded-full border border-brand-pink/20 text-brand-pink text-[9px] font-black uppercase tracking-wider">
                    Pedido #{sale.numeroPedido || sale.id.substring(0, 5)}
                  </div>
                </div>
                <h3 className="text-base font-bold text-white leading-tight font-display">{sale.cliente}</h3>
                
                <div className="grid grid-cols-2 gap-3 mt-4.5 pt-3.5 border-t border-zinc-950/60 text-sans">
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">Data do Registro</span>
                    <span className="text-[10.5px] font-bold text-zinc-300 font-mono">
                      {sale.data ? new Date(sale.data).toLocaleDateString('pt-BR') : 'Anotado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">Previsão de Retirada</span>
                    <span className="text-[10.5px] font-bold text-amber-400 font-mono flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0 text-amber-500" />
                      {sale.dataRetirada 
                        ? `${new Date(sale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')}${sale.turnoEntrega ? ` (${sale.turnoEntrega})` : ''}` 
                        : 'A combinar'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD DE APROVAÇÃO DO LAYOUT PELO CLIENTE (OPÇÃO 1) */}
            {sale.clienteAprovouLayout ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-emerald-950/40 via-emerald-900/20 to-zinc-900 border-2 border-emerald-500/40 rounded-3xl p-5 shadow-xl relative overflow-hidden space-y-3"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl shrink-0 mt-0.5">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9.5px] font-black uppercase text-emerald-400 tracking-wider bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
                        Arte Confirmada
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white font-display">
                      Layout Conferido e Aprovado por Você! ✨
                    </h3>
                    <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                      Sua confirmação de layout foi registrada com sucesso em nosso sistema
                      {sale.clienteAprovouLayoutEm && (
                        <strong className="text-emerald-300 font-mono font-medium block mt-1">
                          📅 Registrado em: {new Date(sale.clienteAprovouLayoutEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </strong>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-400 font-sans pt-1">
                      Seu pedido está liberado para a <strong>confecção e produção</strong>! 🚀🧵🎈
                    </p>
                  </div>
                </div>

                {/* Botão de Envio / Confirmação pelo WhatsApp */}
                <div className="pt-1">
                  <a
                    href={getWhatsAppConfirmationUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-950/50 cursor-pointer transition-all flex items-center justify-center gap-2 no-underline"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Enviar Confirmação no WhatsApp da Loja</span>
                  </a>
                </div>

                {justApproved && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-center text-xs text-emerald-200 font-bold space-y-1"
                  >
                    <div>🎉 Aprovação registrada com sucesso no sistema!</div>
                    <div className="text-[11px] font-normal text-emerald-300/90">
                      O WhatsApp foi aberto para registrar a confirmação também pela conversa. Se a conversa não abriu automaticamente, toque no botão verde acima.
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : sale.statusArte === 'Arte Finalizada' ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 border-2 border-brand-pink/50 rounded-3xl p-5 shadow-2xl relative overflow-hidden space-y-4"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink/10 rounded-full blur-2xl -z-10 pointer-events-none" />

                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-brand-pink/20 text-brand-pink border border-brand-pink/40 rounded-2xl shrink-0 mt-0.5">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9.5px] font-black uppercase text-brand-pink tracking-wider bg-brand-pink/15 px-2 py-0.5 rounded-full border border-brand-pink/25">
                        Confirmação de Aprovação do Layout
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white font-display">
                      Você Confere e Aprova o Layout?
                    </h3>
                    <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                      Olá, <strong className="text-white">{sale.cliente}</strong>! Informamos que, com a sua aprovação, <strong className="text-brand-pink">você CONFIRMA</strong> que conferiu com atenção todas as informações mostradas no layout:
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3.5 space-y-2 text-xs font-sans text-zinc-300">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Cores do produto e modelos</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Possíveis erros de digitação</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Textos, nomes, idades, datas</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Todos os detalhes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>O produto será como foi aprovado</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={approving}
                    onClick={handleApproveLayout}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-550 active:scale-98 disabled:opacity-70 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-950/50 cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    {approving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Gravando sua aprovação...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-white" />
                        <span>Sim, conferi tudo e aprovo o layout!</span>
                      </>
                    )}
                  </button>
                  
                  <p className="text-[10.5px] text-zinc-500 text-center font-sans leading-tight">
                    🔒 Ao clicar em aprovar arte, ele é registrado no sistema da loja e o WhatsApp é aberto para confirmar também pela conversa.
                  </p>
                </div>
              </motion.div>
            ) : null}

            {/* CARD 2: JORNADA TEMPORAL DO PEDIDO (Vertical Interactive Timeline) */}
            <div className="bg-zinc-900 border border-zinc-805 rounded-3xl p-6 shadow-lg space-y-4">
              <div className="flex items-center gap-1.5 select-none">
                <Sparkles className="h-4.5 w-4.5 text-brand-pink" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-display">Acompanhe as Etapas</h4>
              </div>

              <div className="relative pl-6 ml-1.5 space-y-7 py-1">
                {/* Linha do tempo dinâmica em degradê */}
                <div className="absolute left-[-1px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-pink via-purple-500 to-zinc-800 pointer-events-none" />
                
                {getTimelineSteps().map((step, index) => {
                  const isDone = step.status === 'done';
                  const isActive = step.status === 'active';
                  
                  return (
                    <motion.div 
                      key={step.id} 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: index * 0.1 }}
                      className="relative"
                    >
                      {/* Outer timeline indicator dot */}
                      <div className={`absolute -left-[32px] top-0.5 w-[15px] h-[15px] rounded-full border-2 border-zinc-900 flex items-center justify-center transition-all ${
                        isDone 
                          ? 'bg-gradient-to-tr from-brand-pink to-purple-600 shadow-[0_0_10px_rgba(236,72,153,0.5)]' 
                          : isActive 
                            ? 'bg-gradient-to-tr from-brand-pink to-purple-600 animate-pulse shadow-[0_0_12px_rgba(236,72,153,0.7)] scale-110' 
                            : 'bg-zinc-850 border-zinc-800'
                      }`}>
                        {isDone && <Check className="h-2.5 w-2.5 text-white stroke-[4px]" />}
                        {isActive && (
                          <span className="absolute w-2 h-2 rounded-full bg-white animate-ping" />
                        )}
                      </div>

                      <div className="space-y-0.5 select-text pl-1.5">
                        <h5 className={`text-[11.5px] font-bold font-sans flex items-center gap-1.5 ${
                          isDone ? 'text-zinc-150' : isActive ? 'text-brand-pink font-extrabold' : 'text-zinc-550'
                        }`}>
                          {step.title}
                          {isActive && (
                            <span className="inline-flex h-2 w-2 rounded-full bg-brand-pink animate-pulse" />
                          )}
                        </h5>
                        <p className={`text-[9.5px] leading-relaxed font-medium ${
                          isDone ? 'text-zinc-300' : isActive ? 'text-zinc-200' : 'text-zinc-650'
                        }`}>
                          {step.desc}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* CARD 3: ORDER ITEMS DETAILS */}
            <div className="bg-zinc-900 border border-zinc-805 rounded-3xl p-5 shadow-lg space-y-3.5">
              <div className="flex items-center gap-1.5 select-none">
                <Package className="h-4 w-4 text-brand-pink" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-display">Detalhes dos Itens</h4>
              </div>

              <div className="bg-zinc-950/50 border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-900 select-text">
                {sale.itens && sale.itens.length > 0 ? (
                  sale.itens.map((item, index) => (
                    <div key={item.id || index} className="p-3 flex items-center justify-between gap-3 text-sans text-xs">
                      <div>
                        <span className="font-bold text-zinc-100">{item.produtoNome}</span>
                        <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">
                          R$ {item.precoUn.toFixed(2)} un • Qtd: {item.quantidade}
                        </span>
                      </div>
                      <span className="font-bold font-mono text-zinc-200 shrink-0">
                        R$ {item.total.toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 flex items-center justify-between gap-3 text-sans text-xs">
                    <div>
                      <span className="font-bold text-zinc-100">{sale.produtoNome}</span>
                      <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">
                        R$ {sale.precoUn?.toFixed(2) || '0.00'} un • Qtd: {sale.quantidade}
                      </span>
                    </div>
                    <span className="font-bold font-mono text-zinc-200 shrink-0">
                      R$ {sale.total.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Financial Summary */}
                <div className="p-3 bg-zinc-950/80 space-y-1.5 font-mono text-[10px] border-t-2 border-zinc-900">
                  <div className="flex justify-between text-zinc-500">
                    <span>VALOR TOTAL:</span>
                    <span className="font-bold">R$ {sale.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>VALOR PAGO:</span>
                    <span className="font-bold">R$ {(sale.valorPago !== undefined ? sale.valorPago : sale.total).toFixed(2)}</span>
                  </div>
                  {(() => {
                    const falta = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - (sale.valorPago ?? 0));
                    return (
                      <div className={`flex justify-between font-bold ${falta > 0 ? 'text-red-400 text-xs mt-1 pt-1.5 border-t border-dashed border-zinc-800' : 'text-zinc-400'}`}>
                        <span>{falta > 0 ? 'SALDO RESTANTE:' : 'SALDO RESTANTE:'}</span>
                        <span>R$ {falta.toFixed(2)}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Callout reminder about dynamic updates */}
              <p className="text-[9px] text-zinc-550 leading-relaxed italic text-center select-none pt-1">
                ⚙️ As informações acima são atualizadas automaticamente conforme nossa equipe trabalha em seu pedido.
              </p>
            </div>

            {/* CARD 4: CONTACT & HELP CENTRE */}
            <div className="bg-zinc-900 border border-zinc-805 rounded-3xl p-5 shadow-lg space-y-3 select-none">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">Central de Contato da Loja</span>
              
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 text-xs text-zinc-450 leading-tight">
                  <MapPin className="h-4 w-4 text-brand-pink shrink-0" />
                  <span className="font-sans font-semibold">{storeInfo.endereco}</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-450 leading-tight">
                  <Instagram className="h-4 w-4 text-brand-pink shrink-0" />
                  <a 
                    href="https://instagram.com/oxentefesteje" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="hover:underline font-bold text-brand-pink font-sans"
                  >
                    @oxentefesteje
                  </a>
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-zinc-450 border-t border-zinc-850/60 pt-2.5 mt-1.5 flex-col w-full">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-400 uppercase text-[9px] tracking-wider">
                    <Clock className="h-3.5 w-3.5 text-brand-pink shrink-0" />
                    <span>Horário de Funcionamento</span>
                  </div>
                  <div className="pl-5 space-y-0.5 text-zinc-500 font-medium">
                    <p className="font-sans text-xs"><strong className="text-zinc-400">Seg a Sex:</strong> 08:30 às 12:00 e 13:00 às 17:00</p>
                    <p className="font-sans text-xs"><strong className="text-zinc-400">Sábado:</strong> 08:30 às 12:00</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={`https://api.whatsapp.com/send?phone=55${storeInfo.telefone.replace(/\D/g, '')}&text=${encodeURIComponent(`Olá Oxente Festeje! Sou o cliente ${sale.cliente || ''} e gostaria de tirar uma dúvida sobre o meu pedido #${sale.numeroPedido || sale.id.substring(0, 5)}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-550/30 hover:border-emerald-500/50 rounded-2xl block text-center font-bold text-xs text-emerald-400 transition-all cursor-pointer active:scale-98"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Dúvidas? Chame no WhatsApp</span>
                  </div>
                </a>
              </div>
            </div>

          </motion.div>
        )}

      </main>

      {/* 3. CLEAN COMPRESSED WATERMARK FOOTER */}
      <footer className="w-full text-center py-6 select-none bg-black">
        <span className="text-[10px] text-zinc-700 tracking-wide font-mono">
          Oxente Festeje © {new Date().getFullYear()} • Todos os direitos reservados
        </span>
      </footer>

    </div>
  );
}
