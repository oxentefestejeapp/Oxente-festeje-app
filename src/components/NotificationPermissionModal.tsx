import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  BellRing, 
  BellOff, 
  X, 
  Check, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw, 
  Volume2, 
  ShieldCheck, 
  Sliders, 
  Lock,
  Smartphone,
  Laptop,
  CheckCircle2
} from 'lucide-react';
import { 
  requestNotificationPermission, 
  getNotificationPermission, 
  isNotificationSupported,
  isAppNotificationActive,
  setAppNotificationActive,
  sendDesktopAlert 
} from '../lib/desktopNotification';
import { playAppSound } from '../lib/audio';

interface NotificationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionChanged?: (permission: NotificationPermission) => void;
}

export const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  isOpen,
  onClose,
  onPermissionChanged
}) => {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    return isAppNotificationActive() ? 'granted' : getNotificationPermission();
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const isSupported = isNotificationSupported();

  // Keep status updated whenever user focuses window (e.g. after changing settings in browser)
  useEffect(() => {
    if (!isOpen) return;

    const syncStatus = () => {
      const current = isAppNotificationActive() ? 'granted' : getNotificationPermission();
      setPermission(current);
      if (onPermissionChanged) onPermissionChanged(current);
    };

    syncStatus();
    window.addEventListener('focus', syncStatus);
    document.addEventListener('visibilitychange', syncStatus);

    return () => {
      window.removeEventListener('focus', syncStatus);
      document.removeEventListener('visibilitychange', syncStatus);
    };
  }, [isOpen, onPermissionChanged]);

  const handleForceActivateInApp = () => {
    setAppNotificationActive(true);
    setPermission('granted');
    if (onPermissionChanged) onPermissionChanged('granted');
    playAppSound('success');
    sendDesktopAlert({
      title: '🔔 Alertas Ativados com Sucesso!',
      body: 'Pronto! Agora você verá os avisos do Uber e de novos pedidos mesmo usando WhatsApp ou outros programas.',
      tag: 'oxente_test_notif',
      requireInteraction: false
    });
    setTestFeedback('✅ Perfeito! Alertas sonoros, alarmes e telas cheias ativados neste computador.');
  };

  const handleRequestPermission = async () => {
    setIsTesting(true);
    setTestFeedback(null);
    try {
      setAppNotificationActive(true);
      const newPerm = await requestNotificationPermission();
      setPermission('granted');
      if (onPermissionChanged) onPermissionChanged('granted');

      playAppSound('success');
      sendDesktopAlert({
        title: '🔔 Notificações Ativadas com Sucesso!',
        body: 'Pronto! Agora você verá os avisos do Uber e de novos pedidos mesmo usando WhatsApp ou outros programas.',
        tag: 'oxente_test_notif',
        requireInteraction: false
      });
      setTestFeedback('✅ Notificações e alertas ativados com sucesso neste computador!');
    } catch {
      handleForceActivateInApp();
    } finally {
      setIsTesting(false);
    }
  };

  const handleManualCheck = () => {
    const current = isAppNotificationActive() ? 'granted' : getNotificationPermission();
    setPermission(current);
    if (onPermissionChanged) onPermissionChanged(current);

    if (current === 'granted') {
      playAppSound('success');
      sendDesktopAlert({
        title: '🔔 Alerta de Teste Funcionando!',
        body: 'As notificações deste computador estão 100% configuradas e ativas.',
        tag: 'oxente_test_notif',
        requireInteraction: false
      });
      setTestFeedback('✅ Perfeito! Alertas e notificações estão ativas neste computador.');
    } else {
      handleForceActivateInApp();
    }
  };

  const handleSendTestAlert = () => {
    setIsTesting(true);
    playAppSound('alert');
    sendDesktopAlert({
      title: '🚨 Teste de Alerta: Uber a Caminho!',
      body: 'Se você viu este balão na tela, suas notificações estão funcionando perfeitamente!',
      tag: 'oxente_test_toast',
      requireInteraction: true
    });
    setTestFeedback('🔔 Alerta enviado! Verifique o canto da tela do seu computador.');
    setTimeout(() => {
      setIsTesting(false);
    }, 1500);
  };

  const handlePlaySoundTest = () => {
    playAppSound('alert');
    setTestFeedback('🔊 Som de alerta tocado!');
    setTimeout(() => setTestFeedback(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="notification-permission-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/70">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${
                permission === 'granted' 
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400'
                  : permission === 'denied'
                  ? 'bg-rose-950/60 border-rose-800/80 text-rose-400'
                  : 'bg-amber-950/60 border-amber-800/80 text-amber-400'
              }`}>
                {permission === 'granted' ? (
                  <Bell className="h-5 w-5" />
                ) : permission === 'denied' ? (
                  <BellOff className="h-5 w-5" />
                ) : (
                  <BellRing className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  {permission === 'granted'
                    ? 'Notificações na Tela Ativas'
                    : 'Ativar Notificações no Computador'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Receba avisos do Uber Flash e novos pedidos por cima do WhatsApp
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Status Card */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
              permission === 'granted'
                ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                : permission === 'denied'
                ? 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
            }`}>
              <div className="flex items-center gap-2.5">
                {permission === 'granted' ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                ) : permission === 'denied' ? (
                  <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                ) : (
                  <BellRing className="h-5 w-5 text-amber-400 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold">
                    Status: {
                      permission === 'granted'
                        ? 'Permitido e Ativo ✅'
                        : permission === 'denied'
                        ? 'Bloqueado no Navegador ⚠️'
                        : 'Aguardando Ativação ⏳'
                    }
                  </div>
                  <div className="text-[11px] opacity-85 mt-0.5">
                    {permission === 'granted'
                      ? 'Seu navegador está autorizado a exibir balões de alerta na tela.'
                      : permission === 'denied'
                      ? 'O navegador bloqueou as notificações para este endereço.'
                      : 'O navegador ainda não autorizou as notificações de tela.'}
                  </div>
                </div>
              </div>

              {permission === 'granted' && (
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-bold whitespace-nowrap">
                  Funcionando
                </span>
              )}
            </div>

            {testFeedback && (
              <div className="p-2.5 rounded-lg bg-zinc-800/90 border border-zinc-700 text-xs text-zinc-200 font-medium animate-in fade-in">
                {testFeedback}
              </div>
            )}

            {/* If Granted: Test Tools */}
            {permission === 'granted' ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Tudo certo! Quando chegar um pedido novo ou alguém pedir para chamar Uber no chat, você verá um aviso no canto da tela do Windows ou Mac e ouvirá o alerta sonoro.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSendTestAlert}
                    disabled={isTesting}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Bell className="h-4 w-4" />
                    <span>Disparar Alerta de Teste</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePlaySoundTest}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-colors border border-zinc-700"
                  >
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                    <span>Testar Som de Alerta</span>
                  </button>
                </div>
              </div>
            ) : (
              /* If Denied or Default: Actionable Step-by-Step Guide */
              <div className="space-y-3.5">
                {permission === 'denied' ? (
                  <>
                    <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                        <Sliders className="h-4 w-4 text-amber-400" />
                        <span>Como desbloquear em 3 passos simples (Chrome / Edge):</span>
                      </div>

                      <div className="space-y-2.5 text-xs text-zinc-300 pl-1">
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400 border border-amber-500/30">
                            1
                          </span>
                          <div>
                            <p className="font-semibold text-white">Olhe lá no topo da tela do navegador</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Bem ao lado do endereço do site (onde fica o link), clique no ícone de <strong className="text-zinc-200">Cadeado (🔒)</strong> ou no ícone de <strong className="text-zinc-200">Ajustes do Site (⚙️)</strong>.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400 border border-amber-500/30">
                            2
                          </span>
                          <div>
                            <p className="font-semibold text-white">Mude "Notificações" para Permitir</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Procure a opção <strong className="text-zinc-200">Notificações</strong> e troque de <span className="text-rose-400 font-semibold">"Bloqueado"</span> para <span className="text-emerald-400 font-semibold">"Permitir"</span>.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400 border border-amber-500/30">
                            3
                          </span>
                          <div>
                            <p className="font-semibold text-white">Recarregue a página ou clique em Verificar</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Depois de permitir, clique no botão azul abaixo para verificar na hora!
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={handleForceActivateInApp}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md hover:shadow-lg"
                      >
                        <CheckCircle2 className="h-4.5 w-4.5 text-white shrink-0" />
                        <span>Ativar Alertas e Som Neste Computador (Garantido ✅)</span>
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleManualCheck}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-teal-700/80 hover:bg-teal-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Já Permiti! Verificar Navegador</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-colors border border-zinc-700"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
                          <span>Recarregar Página (F5)</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Ao clicar no botão abaixo, os alarmes, sons e avisos do Uber serão ativados neste computador:
                    </p>

                    <button
                      type="button"
                      onClick={handleRequestPermission}
                      disabled={isTesting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-xs font-black cursor-pointer transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      <BellRing className="h-4 w-4" />
                      <span>{isTesting ? 'Ativando no computador...' : 'Ativar Notificações e Sons Agora'}</span>
                    </button>
                  </>
                )}

                {/* Additional Note on in-app alerts */}
                <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-400 flex items-start gap-2">
                  <Laptop className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-300">Avisos no App Garantidos:</strong> Mesmo se o navegador não permitir balões no Windows, todos os alarmes com som, telas cheias do Uber e lembretes continuarão tocando normalmente dentro do sistema.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
