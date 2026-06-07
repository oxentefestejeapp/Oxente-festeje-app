import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Sparkles, 
  Chrome, 
  Share2, 
  CheckSquare, 
  Copy, 
  Check,
  Info
} from 'lucide-react';
import { playAppSound } from '../lib/audio';

export default function InstallAppTab() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

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
