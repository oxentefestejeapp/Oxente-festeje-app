import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Sparkles, 
  Chrome, 
  Share2, 
  CheckSquare, 
  Copy, 
  Check,
  Info,
  Bell,
  BellRing,
  Zap,
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { playAppSound } from '../lib/audio';
import { 
  getBadgeDiagnosticInfo, 
  testLocalMobileBadgeAndNotification, 
  sendFakeTestOrderViaSupabase, 
  deleteFakeTestOrderViaSupabase, 
  clearMobileAppBadge, 
  requestMobileNotificationPermission 
} from '../lib/mobileBadgeNotification';

export default function InstallAppTab() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  // Diagnostic and test state
  const [diagInfo, setDiagInfo] = useState<any>(null);
  const [testStatusMsg, setTestStatusMsg] = useState<string | null>(null);
  const [lastTestOrderId, setLastTestOrderId] = useState<string | null>(null);
  const [isTestingLocal, setIsTestingLocal] = useState(false);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);

  const refreshDiagnostics = () => {
    const info = getBadgeDiagnosticInfo();
    setDiagInfo(info);
  };

  useEffect(() => {
    refreshDiagnostics();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);

      // Check if install prompt is already globally accessible in window
      if ((window as any).deferredInstallPrompt) {
        setInstallPrompt((window as any).deferredInstallPrompt);
      }

      const handlePromptCaptured = (e: any) => {
        setInstallPrompt(e.detail || (window as any).deferredInstallPrompt);
      };

      const handleAppInstalledSuccess = () => {
        setIsPWAInstalled(true);
        setInstallPrompt(null);
        (window as any).deferredInstallPrompt = null;
        playAppSound('success');
      };

      window.addEventListener('appbeforeinstallprompt', handlePromptCaptured);
      window.addEventListener('appinstalled', handleAppInstalledSuccess);

      // Initial check for standalone PWA display mode
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
        setIsPWAInstalled(true);
      }

      return () => {
        window.removeEventListener('appbeforeinstallprompt', handlePromptCaptured);
        window.removeEventListener('appinstalled', handleAppInstalledSuccess);
      };
    }
  }, []);

  const handleInstallPWA = async () => {
    playAppSound('click');
    const promptEvent = installPrompt || (window as any).deferredInstallPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setIsPWAInstalled(true);
          setInstallPrompt(null);
          (window as any).deferredInstallPrompt = null;
          playAppSound('success');
        }
      } catch (err) {
        console.warn('Erro ao processar instalação PWA:', err);
      }
    } else {
      setShowInstructions(true);
    }
  };

  const handleCopyLink = () => {
    playAppSound('click');
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestLocalNotification = async () => {
    setIsTestingLocal(true);
    setTestStatusMsg(null);
    try {
      const result = await testLocalMobileBadgeAndNotification(1);
      setTestStatusMsg(result.message);
      refreshDiagnostics();
    } catch (err: any) {
      setTestStatusMsg(`Erro ao testar: ${err.message || String(err)}`);
    } finally {
      setIsTestingLocal(false);
    }
  };

  const handleTestSupabaseOrder = async () => {
    setIsTestingSupabase(true);
    setTestStatusMsg('Enviando pedido de teste para o Supabase...');
    try {
      const res = await sendFakeTestOrderViaSupabase();
      if (res.success && res.saleId) {
        setLastTestOrderId(res.saleId);
        setTestStatusMsg(`✅ Pedido ${res.orderNumber} gravado no Supabase com sucesso! O Webhook e o canal Realtime foram acionados. Verifique seu celular.`);
        playAppSound('success');
      } else {
        setTestStatusMsg(`⚠️ Falha ao salvar no Supabase: ${res.error}`);
        playAppSound('alert');
      }
    } catch (err: any) {
      setTestStatusMsg(`Erro: ${err.message || String(err)}`);
    } finally {
      setIsTestingSupabase(false);
      refreshDiagnostics();
    }
  };

  const handleDeleteTestOrder = async () => {
    if (!lastTestOrderId) return;
    try {
      await deleteFakeTestOrderViaSupabase(lastTestOrderId);
      setLastTestOrderId(null);
      setTestStatusMsg('🧹 Pedido de teste excluído do banco com sucesso.');
      playAppSound('trash');
    } catch (err: any) {
      setTestStatusMsg(`Erro ao excluir: ${err.message || String(err)}`);
    }
  };

  const handleClearBadge = async () => {
    await clearMobileAppBadge(true);
    setTestStatusMsg('🧹 Selo do ícone zerado.');
    playAppSound('trash');
    refreshDiagnostics();
  };

  const handleRequestPermission = async () => {
    await requestMobileNotificationPermission();
    refreshDiagnostics();
  };

  // Pink themed custom QR code endpoint
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=ec4899&bgcolor=18181b&data=${encodeURIComponent(currentUrl)}`;

  return (
    <div className="space-y-6 text-zinc-100 animate-fade-in max-w-4xl mx-auto pb-10">
      
      {/* Header Banner */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 sm:p-8 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-pink/10 border border-brand-pink/25 rounded-2xl text-brand-pink shrink-0">
              <Smartphone className="h-8 w-8 animate-pulse text-brand-pink" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg sm:text-xl text-zinc-100">Oxente Festeje no Seu Celular</h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
                Instale o aplicativo no seu smartphone para acessar instantaneamente com excelente desempenho, tela cheia e total rapidez nas vendas.
              </p>
            </div>
          </div>
          
          <span className="shrink-0 text-[10px] sm:text-xs font-black uppercase tracking-wider text-brand-pink bg-brand-pink/15 border border-brand-pink/30 px-3 py-1.5 rounded-full self-start md:self-center">
            ★ Versão Staff Otimizada
          </span>
        </div>
      </div>

      {/* Central de Testes de Notificação e Webhook */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-5 sm:p-6 space-y-5 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-pink/15 border border-brand-pink/30 rounded-xl text-brand-pink shrink-0">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base text-zinc-100 flex items-center gap-2">
                Central de Testes de Notificação & Webhook
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                  Ativo
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Teste o selo no ícone do celular, som de novo pedido e o disparo pelo Supabase.
              </p>
            </div>
          </div>

          <button
            onClick={refreshDiagnostics}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/70 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-750 transition-colors self-start sm:self-auto"
            title="Atualizar status do sistema"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar Status</span>
          </button>
        </div>

        {/* Diagnostics Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-black/30 border border-zinc-850 p-3 rounded-xl">
            <span className="text-[10px] text-zinc-400 uppercase font-bold block">Dispositivo</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${diagInfo?.isMobile ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-xs font-semibold text-zinc-200">
                {diagInfo?.isMobile ? 'Celular / Tablet' : 'Computador'}
              </span>
            </div>
          </div>

          <div className="bg-black/30 border border-zinc-850 p-3 rounded-xl">
            <span className="text-[10px] text-zinc-400 uppercase font-bold block">Permissão de Notificação</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                diagInfo?.permission === 'granted' ? 'bg-emerald-400' : 
                diagInfo?.permission === 'denied' ? 'bg-red-400' : 'bg-amber-400'
              }`} />
              <span className="text-xs font-semibold text-zinc-200 capitalize">
                {diagInfo?.permission === 'granted' ? 'Autorizada' : 
                 diagInfo?.permission === 'denied' ? 'Bloqueada' : 'Pendente'}
              </span>
            </div>
          </div>

          <div className="bg-black/30 border border-zinc-850 p-3 rounded-xl">
            <span className="text-[10px] text-zinc-400 uppercase font-bold block">Selo no Ícone (Badge)</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${diagInfo?.badgeSupported ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              <span className="text-xs font-semibold text-zinc-200">
                {diagInfo?.badgeSupported ? 'Compatível' : 'Requer PWA'}
              </span>
            </div>
          </div>

          <div className="bg-black/30 border border-zinc-850 p-3 rounded-xl">
            <span className="text-[10px] text-zinc-400 uppercase font-bold block">Service Worker</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${diagInfo?.serviceWorkerActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-xs font-semibold text-zinc-200">
                {diagInfo?.serviceWorkerActive ? 'Ativo' : 'Carregando'}
              </span>
            </div>
          </div>
        </div>

        {/* Permission Request Alert if not granted */}
        {diagInfo?.permission !== 'granted' && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-amber-300 font-semibold block">Permissão de Notificações Necessária</strong>
                <span className="text-zinc-300">
                  O Android e iOS exigem autorização expressa para mostrar o banner de pedido e atualizar o número no ícone.
                </span>
              </div>
            </div>
            <button
              onClick={handleRequestPermission}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors shrink-0 shadow-sm"
            >
              Autorizar Notificações
            </button>
          </div>
        )}

        {/* Test Buttons Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          {/* Button 1: Local Test */}
          <button
            onClick={handleTestLocalNotification}
            disabled={isTestingLocal}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 to-brand-pink hover:from-pink-500 hover:to-pink-500 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Bell className="h-4 w-4" />
            <span>{isTestingLocal ? 'Disparando...' : '1. Testar Notificação & Selo (Local)'}</span>
          </button>

          {/* Button 2: Supabase Realtime / Webhook Test */}
          <button
            onClick={handleTestSupabaseOrder}
            disabled={isTestingSupabase}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            <span>{isTestingSupabase ? 'Gravando no Supabase...' : '2. Simular Pedido Fake via Supabase'}</span>
          </button>

          {/* Button 3: Clear Badge */}
          <button
            onClick={handleClearBadge}
            className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold text-xs py-3 px-3.5 rounded-xl border border-zinc-700/80 transition-colors"
            title="Limpar número do ícone"
          >
            <Trash2 className="h-4 w-4" />
            <span>Zerar Selo</span>
          </button>
        </div>

        {/* Status Message / Output */}
        {testStatusMsg && (
          <div className="bg-black/40 border border-zinc-800 p-3.5 rounded-xl flex items-start justify-between gap-3 animate-fade-in text-xs">
            <span className="text-zinc-200 leading-relaxed">{testStatusMsg}</span>
            {lastTestOrderId && (
              <button
                onClick={handleDeleteTestOrder}
                className="text-[11px] text-red-400 hover:text-red-300 font-bold shrink-0 underline ml-2"
              >
                Excluir Pedido Fake
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Interactive Interactive Installation Methods Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Method 1: Direct Click to Install */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 flex flex-col justify-between space-y-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="flex items-center justify-center bg-brand-pink/15 text-brand-pink font-bold rounded-full w-6 h-6 text-xs">1</span>
              <h3 className="font-display font-semibold text-sm">Instalar no Dispositivo Atual</h3>
            </div>
            
            <p className="text-xs text-zinc-400 leading-relaxed">
              Ideal para quando você já está acessando o aplicativo usando o navegador do seu próprio celular. O aplicativo rodará como um app nativo livre de barras de navegação!
            </p>

            <div className="bg-black/30 border border-zinc-850 p-4 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-450 uppercase tracking-widest">
                <Sparkles className="h-3.5 w-3.5 text-brand-pink animate-spin-slow" />
                <span>Benefícios Exclusivos</span>
              </div>
              <ul className="text-[11px] text-zinc-300 space-y-1.5 font-medium pl-1">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-brand-pink rounded-full shrink-0" />
                  <span>Ícone exclusivo na tela inicial</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-brand-pink rounded-full shrink-0" />
                  <span>Abertura instantânea & tela cheia</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-brand-pink rounded-full shrink-0" />
                  <span>Sincronização instantânea em nuvem</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-2">
            {isPWAInstalled ? (
              <div className="flex items-center justify-center gap-2 py-4 px-4 bg-emerald-950/20 border border-emerald-950/40 text-emerald-400 font-extrabold rounded-xl text-xs">
                <CheckSquare className="h-4.5 w-4.5 animate-bounce-slow" />
                <span>IDÊNTICO A UM APLICATIVO NATIVO!</span>
              </div>
            ) : (
              <button
                onClick={handleInstallPWA}
                type="button"
                className="w-full flex items-center justify-center gap-2.5 py-4 px-4 bg-gradient-to-r from-brand-pink to-[#be185d] hover:from-brand-pink-hover hover:to-[#a2114d] text-white font-extrabold rounded-xl shadow-lg transition-all transform active:scale-98 cursor-pointer text-xs"
              >
                <Smartphone className="h-4.5 w-4.5 animate-bounce-slow" />
                <span>Instalar com 1 Clique agora 📲</span>
              </button>
            )}
          </div>
        </div>

        {/* Method 2: Scan QR Code to Open on Mobile */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 flex flex-col justify-between space-y-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="flex items-center justify-center bg-brand-pink/15 text-brand-pink font-bold rounded-full w-6 h-6 text-xs">2</span>
              <h3 className="font-display font-semibold text-sm">Transferir para o Celular</h3>
            </div>
            
            <p className="text-xs text-zinc-400 leading-relaxed">
              Se você está no computador, aponte a câmera do seu celular para o código abaixo para carregar o link instantaneamente no celular:
            </p>

            {/* QR Code Graphic Frame */}
            <div className="flex flex-col items-center justify-center p-4 bg-zinc-950/60 rounded-xl border border-zinc-850">
              <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800/80 shadow-inner">
                <img 
                  src={qrCodeUrl} 
                  alt="Instalar QR Code" 
                  className="w-36 h-36 rounded-md select-none pointer-events-none" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider mt-2.5 uppercase">
                Aponte a câmera para escanear
              </span>
            </div>
          </div>

          <div>
            <button
              onClick={handleCopyLink}
              type="button"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700/80 hover:border-zinc-650 text-xs font-bold rounded-xl shadow transition-all active:scale-97 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Link Copiado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-brand-pink" />
                  <span>Copiar Link do Aplicativo</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Manual Installation Guide Steps Panel */}
      {(!installPrompt && !(window as any).deferredInstallPrompt && !isPWAInstalled) || showInstructions ? (
        <div className="p-6 bg-zinc-900 border border-zinc-800/80 rounded-2xl space-y-6 animate-fade-in text-xs shadow-md">
          <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-4">
            <div className="p-1.5 bg-brand-pink/10 border border-brand-pink/20 rounded-lg text-brand-pink">
              <Chrome className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-sm text-zinc-100">Guia de Instalação Manual</h3>
              <p className="text-[11px] text-zinc-400">Excelente para navegadores que bloqueiam prompts automáticos/iFrames.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Android Chrome */}
            <div className="space-y-2">
              <span className="block text-[10px] font-black text-brand-pink uppercase tracking-widest border-b border-zinc-850 pb-1.5">
                No Celular Android (Google Chrome):
              </span>
              <ol className="list-decimal list-inside space-y-2.5 pl-1 text-zinc-350 font-semibold leading-relaxed">
                <li>
                  Abra o link oficial do aplicativo no navegador <strong className="text-zinc-200">Google Chrome</strong> do seu celular.
                </li>
                <li>
                  Toque no menu superior de <strong className="text-zinc-200">três pontinhos (...)</strong>.
                </li>
                <li>
                  Toque na opção de <strong className="text-zinc-200">&quot;Instalar aplicativo&quot;</strong> ou <strong className="text-zinc-200">&quot;Adicionar à tela inicial&quot;</strong>.
                </li>
                <li>
                  Confirme e o ícone <strong className="text-zinc-200">Oxente Festeje</strong> aparecerá pronto na tela do celular!
                </li>
              </ol>
            </div>

            {/* iOS Safari */}
            <div className="space-y-2 md:border-l md:border-zinc-800 md:pl-6">
              <span className="block text-[10px] font-black text-pink-400 uppercase tracking-widest border-b border-zinc-850 pb-1.5">
                No iPhone / iPad (Navegador Safari):
              </span>
              <ol className="list-decimal list-inside space-y-2.5 pl-1 text-zinc-350 font-semibold leading-relaxed">
                <li>
                  Abra este site utilizando obrigatoriamente o navegador <strong className="text-zinc-200">Safari</strong> do seu iOS.
                </li>
                <li>
                  Toque sobre o ícone central de <strong className="text-zinc-200">Compartilhar</strong> <Share2 className="h-3.5 w-3.5 inline text-zinc-400 mx-0.5" /> (pequeno quadrado com seta para cima).
                </li>
                <li>
                  Role a lista para baixo e clique em <strong className="text-zinc-200">&quot;Adicionar à Tela de Início&quot;</strong>.
                </li>
                <li>
                  Confirme digitando o nome do app e clicando em <strong className="text-zinc-200">Adicionar</strong>!
                </li>
              </ol>
            </div>
          </div>
          
          <div className="text-[11px] text-zinc-450 bg-black/45 p-4 rounded-xl border border-zinc-850 leading-relaxed font-semibold flex items-start gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-brand-pink mt-0.5" />
            <span>
              <strong>Dica de Sandbox:</strong> O navegador e as regras de segurança padrão barram instalações diretas automáticas quando executadas dentro de janelas simuladas (iframe do estúdio de testes). Ao abrir este mesmo site em uma aba inteira ou link direto no seu celular, a opção de instalação com 1 clique funcionará de maneira fabulosa!
            </span>
          </div>
        </div>
      ) : null}

    </div>
  );
}
