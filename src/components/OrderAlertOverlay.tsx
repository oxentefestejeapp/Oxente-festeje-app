import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  CheckCircle2, 
  MessageSquare, 
  X, 
  FileText, 
  Sparkles,
  Clock,
  PenTool
} from 'lucide-react';
import { playAppSound } from '../lib/audio';

export interface OrderAlertData {
  id: string;
  senderName: string;
  senderRole?: string;
  text: string;
  timestamp: number;
}

interface OrderAlertOverlayProps {
  alert: OrderAlertData | null;
  onClose: () => void;
  onOpenChat: () => void;
}

const DISPLAY_DURATION_SECONDS = 14;

export function OrderAlertOverlay({ alert, onClose, onOpenChat }: OrderAlertOverlayProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(DISPLAY_DURATION_SECONDS);

  useEffect(() => {
    if (!alert) return;

    // Reset countdown and play order chime
    setSecondsRemaining(DISPLAY_DURATION_SECONDS);
    playAppSound('order_alert');

    // Interval for progress bar
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [alert?.id]);

  if (!alert) return null;

  const progressPercent = (secondsRemaining / DISPLAY_DURATION_SECONDS) * 100;

  return (
    <AnimatePresence>
      <div className="no-print fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-hidden pointer-events-auto">
        {/* Darkened backdrop with pulsating caution tint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Top Ticker Bar */}
        <div className="absolute top-0 left-0 right-0 h-9 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest flex items-center overflow-hidden shadow-lg select-none border-b-2 border-zinc-950">
          <motion.div
            animate={{ x: [0, -1000] }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 18 }}
            className="whitespace-nowrap flex items-center gap-8 font-extrabold"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="flex items-center gap-3">
                <ClipboardList className="h-4 w-4 text-indigo-200" />
                <span>ATENÇÃO EQUIPE: ANOTA OS PEDIDOS!</span>
                <span>•</span>
                <span>CONFERIR WHATSAPP E BALCÃO</span>
                <span>•</span>
                <span>REGISTRAR NO SISTEMA</span>
                <span>•</span>
                <Sparkles className="h-4 w-4 text-indigo-200" />
              </span>
            ))}
          </motion.div>
        </div>

        {/* Speeding Clipboard & Pen Animation Crossing Above Modal (Right to Left) */}
        <motion.div
          initial={{ x: '120vw' }}
          animate={{ x: '-120vw' }}
          transition={{ duration: 7.5, ease: 'linear', delay: 0.3 }}
          className="absolute top-16 sm:top-20 left-0 pointer-events-none z-10 flex items-center gap-2"
        >
          <div className="relative flex items-center bg-zinc-900/90 border-2 border-indigo-400 px-4 py-2 rounded-2xl shadow-2xl shadow-indigo-500/50 backdrop-blur-sm">
            {/* Clipboard and writing sparks trailing behind */}
            <div className="flex items-center mr-2.5">
              <span className="text-3xl inline-block animate-pulse">
                📝
              </span>
              <span className="text-xl -ml-1 opacity-90 animate-bounce">✨</span>
            </div>
            <div className="text-left mr-1">
              <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider block">
                Novos Pedidos
              </span>
              <span className="text-xs font-bold text-white">
                Anotar e Organizar!
              </span>
            </div>
            {/* Speed lines on the right side trailing */}
            <div className="absolute -right-8 flex flex-col gap-1 opacity-70 pointer-events-none">
              <span className="w-7 h-1 bg-indigo-400 rounded-full animate-pulse"></span>
              <span className="w-4 h-0.5 bg-white rounded-full"></span>
            </div>
          </div>
        </motion.div>

        {/* Main Alert Modal Card */}
        <motion.div
          initial={{ scale: 0.8, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.85, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-indigo-500 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-indigo-500/30 overflow-hidden text-center z-20"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title="Fechar Alerta"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 font-bold text-xs uppercase tracking-wider mb-4 shadow-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
            <ClipboardList className="h-3.5 w-3.5 text-indigo-400" />
            <span>Atendimento & Produção</span>
          </div>

          {/* Icon and Title */}
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/40 text-white border-2 border-indigo-300">
                <PenTool className="h-10 w-10 animate-bounce" />
              </div>
              <span className="absolute -bottom-1 -right-1 text-2xl animate-pulse">
                📝
              </span>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            ANOTA OS PEDIDOS!
          </h2>

          <p className="text-zinc-300 text-sm mt-1 max-w-sm mx-auto font-medium">
            Atenção equipe! Novos pedidos aguardando conferência, anotação e registro no sistema.
          </p>

          {/* Message Quote Box */}
          <div className="mt-4 p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-left shadow-inner">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                <span>{alert.senderName}</span>
                {alert.senderRole && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-indigo-950/60 border border-indigo-700/50 rounded-md text-indigo-300">
                    {alert.senderRole}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Clock className="h-3 w-3" />
                <span>
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <p className="text-sm font-semibold text-white leading-snug break-words pl-0.5">
              "{alert.text}"
            </p>
          </div>

          {/* Checklist Rápido da Loja */}
          <div className="mt-4 text-left p-3.5 bg-indigo-950/20 border border-indigo-800/40 rounded-2xl">
            <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-400" />
              <span>Checklist Rápido de Atendimento:</span>
            </div>
            <ul className="text-xs text-zinc-300 space-y-1.5 font-medium pl-1">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">1.</span>
                <span>Conferir mensagens pendentes no WhatsApp e no balcão da loja.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">2.</span>
                <span>Anotar dados do cliente, tema, data, horário e cores dos balões.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">3.</span>
                <span>Cadastrar os itens no sistema para iniciar a conferência e produção.</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-indigo-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>CIENTE & ANOTANDO!</span>
            </button>

            <button
              type="button"
              onClick={onOpenChat}
              className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-zinc-700"
            >
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <span>RESPONDER NO CHAT</span>
            </button>
          </div>

          {/* Auto-Dismiss Progress Bar */}
          <div className="mt-4 pt-2 flex items-center gap-2 justify-center">
            <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full"
                animate={{ width: `${progressPercent}%` }}
                transition={{ ease: 'linear', duration: 0.3 }}
              />
            </div>
            <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">
              {secondsRemaining}s
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
