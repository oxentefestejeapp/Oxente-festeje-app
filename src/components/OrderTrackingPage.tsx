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
  Clock
} from 'lucide-react';
import { supabase, mapDbToSale } from '../lib/supabase';
import { Sale, StoreInfo } from '../types';
import { BrandLogo } from './BrandLogo';

const DEFAULT_STORE_INFO: StoreInfo = {
  nome: "Oxente Festeje",
  instagram: "@oxentefesteje",
  telefone: "81997380963",
  endereco: "Rua Josina Lessa, Limoeiro - PE"
};

export function OrderTrackingPage() {
  const [trackingId, setTrackingId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('venda') || urlParams.get('acompanhar') || urlParams.get('pedido') || '';
  });
  
  const [typedId, setTypedId] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(DEFAULT_STORE_INFO);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch single order details
  const fetchTrackingOrder = async (idToFetch: string) => {
    if (!idToFetch.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch sale detail
      const { data: saleData, error: saleError } = await supabase
        .from('oxente_sales')
        .select('*')
        .eq('id', idToFetch.trim())
        .maybeSingle();

      if (saleError) {
        console.error('Error fetching order:', saleError);
        setErrorMsg('Erro de conexão ao buscar o pedido. Verifique sua rede.');
        setSale(null);
        return;
      }

      if (!saleData) {
        // Try searching by order number (numeroPedido) instead of UUID/id
        const { data: saleByNum, error: errorByNum } = await supabase
          .from('oxente_sales')
          .select('*')
          .eq('numero_pedido', idToFetch.trim())
          .maybeSingle();

        if (errorByNum) {
          console.error('Error fetching by order number:', errorByNum);
        }

        if (saleByNum) {
          setSale(mapDbToSale(saleByNum));
          // Update URL query string silently so refreshing keeps the state
          const newUrl = `${window.location.origin}${window.location.pathname}?venda=${saleByNum.id}`;
          window.history.replaceState({ path: newUrl }, '', newUrl);
        } else {
          setErrorMsg('Pedido não encontrado. Verifique se o código ou o número do pedido está correto.');
          setSale(null);
        }
      } else {
        setSale(mapDbToSale(saleData));
      }

      // 2. Fetch latest store details
      const { data: storeData } = await supabase
        .from('oxente_store_info')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (storeData) {
        setStoreInfo({
          nome: storeData.nome || DEFAULT_STORE_INFO.nome,
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

    // Step 1: Confirmed
    const step1Date = sale.data 
      ? new Date(sale.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : 'Processado';

    // Step 2: Designer Assignment / Art Approval
    let s2Title = 'Aguardando Arte';
    let s2Desc = 'O pedido está na fila de artes de nossos designers.';
    let s2Status: 'pending' | 'active' | 'done' = 'pending';

    if (sale.statusArte === 'Arte Finalizada') {
      s2Title = 'Arte Aprovada & Finalizada! ✨';
      s2Desc = `Arte de alta qualidade desenhada e confirmada por nossa equipe.`;
      s2Status = 'done';
    } else if (sale.puxadoPor) {
      s2Title = 'Arte em Elaboração pelo Designer 🎨';
      s2Desc = `O designer ${sale.puxadoPor} está desenhando seu projeto com todo carinho.`;
      s2Status = 'active';
    }

    // Step 3: Production & Logistics
    let s3Title = 'Aguardando Produção';
    let s3Desc = 'Sua arte entrará em nossa impressora e guilhotina física logo mais.';
    let s3Status: 'pending' | 'active' | 'done' = 'pending';

    const prod = sale.statusProducao || 'Agendado';
    if (prod === 'Entregue') {
      s3Title = 'Pedido Entregue! 📦🎉';
      s3Desc = 'Seu pedido foi retirado ou entregue com sucesso! Obrigado pela preferência.';
      s3Status = 'done';
    } else if (prod === 'Pronto para Retirada') {
      s3Title = 'Pronto para Retirada! 🎁';
      s3Desc = 'Seu pedido físico está na loja limpinho e pronto pra embalar sua festa!';
      s3Status = 'done';
    } else if (prod === 'Agendado para Entrega') {
      s3Title = 'Pronto & Agendado para Entrega 🚚';
      s3Desc = 'Preparado em nossa frota e agendado para rota logística.';
      s3Status = 'done';
    } else if (prod === 'Em Produção') {
      s3Title = 'Em Produção Física! ⚙️';
      s3Desc = 'Imprimindo, recortando ou montando seus mimos e personalizados!';
      s3Status = 'active';
    }

    // Is preceding step done?
    if (s2Status === 'done' && s3Status === 'pending') {
      s3Status = 'active'; // ready for physical step if art is completed
    }

    // Step 4: Finance check
    const falta = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - (sale.valorPago ?? 0));
    const isPaid = falta <= 0;
    
    let s4Title = isPaid ? 'Acerto Financeiro Quitado 💳' : 'Aguardando Acerto Provisório';
    let s4Desc = isPaid 
      ? `Sua fatura de R$ ${sale.total.toFixed(2)} está 100% quitada no sistema.`
      : `Restam R$ ${falta.toFixed(2)} para quitação completa (Total R$ ${sale.total.toFixed(2)}).`;
    let s4Status: 'pending' | 'active' | 'done' = isPaid ? 'done' : 'active';

    return [
      { id: 1, title: '🛒 Pedido Registrado', desc: `Registrado no sistema em ${step1Date}.`, status: 'done' as const },
      { id: 2, title: titleCase(s2Title), desc: s2Desc, status: s2Status },
      { id: 3, title: titleCase(s3Title), desc: s3Desc, status: s3Status },
      { id: 4, title: s4Title, desc: s4Desc, status: s4Status, flexColor: isPaid ? 'border-emerald-500' : 'border-amber-500' }
    ];
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

            {/* CARD 2: JORNADA TEMPORAL DO PEDIDO (Vertical Interactive Timeline) */}
            <div className="bg-zinc-900 border border-zinc-805 rounded-3xl p-5.5 shadow-lg space-y-4">
              <div className="flex items-center gap-1.5 select-none">
                <Sparkles className="h-4 w-4 text-brand-pink" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-display">Acompanhe as Etapas</h4>
              </div>

              <div className="relative pl-5 ml-1.5 border-l-2 border-zinc-950 space-y-6 pt-1.5 pb-1.5">
                {getTimelineSteps().map((step) => {
                  const isDone = step.status === 'done';
                  const isActive = step.status === 'active';
                  
                  return (
                    <div key={step.id} className="relative">
                      {/* Outer timeline indicator dot */}
                      <div className={`absolute -left-[25.5px] top-0.5 w-[13px] h-[13px] rounded-full border-2 border-zinc-900 flex items-center justify-center transition-all ${
                        isDone 
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                          : isActive 
                            ? 'bg-brand-pink animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.4)]' 
                            : 'bg-zinc-800'
                      }`}>
                        {isDone && <Check className="h-2 w-2 text-black stroke-[4px]" />}
                      </div>

                      <div className="space-y-0.5 select-text">
                        <h5 className={`text-[11px] font-bold font-sans flex items-center gap-1.5 ${
                          isDone ? 'text-zinc-150' : isActive ? 'text-brand-pink' : 'text-zinc-550'
                        }`}>
                          {step.title}
                        </h5>
                        <p className={`text-[9.5px] leading-normal ${
                          isDone ? 'text-zinc-400' : isActive ? 'text-zinc-300' : 'text-zinc-600'
                        }`}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
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
