import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare, 
  X, 
  PackageCheck, 
  Sparkles,
  Clock
} from 'lucide-react';
import { playAppSound } from '../lib/audio';

export interface UberAlertData {
  id: string;
  senderName: string;
  senderRole?: string;
  text: string;
  timestamp: number;
}

interface UberAlertOverlayProps {
  alert: UberAlertData | null;
  onClose: () => void;
  onOpenChat: () => void;
}

const DISPLAY_DURATION_SECONDS = 14;

export function UberAlertOverlay({ alert, onClose, onOpenChat }: UberAlertOverlayProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(DISPLAY_DURATION_SECONDS);

  useEffect(() => {
    if (!alert) return;

    // Reset countdown and play urgency horn chime
    setSecondsRemaining(DISPLAY_DURATION_SECONDS);
    playAppSound('uber_alert');

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

        {/* Hazard Stripes Top and Bottom Moving Tickers */}
        <div className="absolute top-0 left-0 right-0 h-9 bg-amber-500 text-zinc-950 font-black text-xs uppercase tracking-widest flex items-center overflow-hidden shadow-lg select-none border-b-2 border-zinc-950">
          <motion.div
            animate={{ x: [0, -1000] }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 18 }}
            className="whitespace-nowrap flex items-center gap-8 font-extrabold"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 fill-zinc-950" />
                <span>ATENÇÃO EQUIPE: UBER A CAMINHO!</span>
                <span>•</span>
                <span>AGILIZAR PEDIDO PARA ENTREGA IMEDIATA</span>
                <span>•</span>
                <Car className="h-4 w-4" />
              </span>
            ))}
          </motion.div>
        </div>

        {/* Speeding Car Animation Crossing Above Modal (Right to Left, Smooth & Slower) */}
        <motion.div
          initial={{ x: '120vw' }}
          animate={{ x: '-120vw' }}
          transition={{ duration: 7.5, ease: 'linear', delay: 0.3 }}
          className="absolute top-16 sm:top-20 left-0 pointer-events-none z-10 flex items-center gap-2"
        >
          <div className="relative flex items-center bg-zinc-900/90 border-2 border-amber-400 px-4 py-2 rounded-2xl shadow-2xl shadow-amber-500/50 backdrop-blur-sm">
            {/* Car facing left with exhaust smoke trailing directly behind it (to its right) */}
            <div className="flex items-center mr-2.5">
              <span className="text-3xl transform scale-x-[-1] inline-block animate-pulse">
                🚗
              </span>
              <span className="text-xl -ml-1 opacity-90 animate-pulse">💨</span>
            </div>
            <div className="text-left mr-1">
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block">
                Motorista em Trânsito
              </span>
              <span className="text-xs font-bold text-white">
                Chegando na loja!
              </span>
            </div>
            {/* Speed lines on the right side trailing the car */}
            <div className="absolute -right-8 flex flex-col gap-1 opacity-70 pointer-events-none">
              <span className="w-7 h-1 bg-amber-400 rounded-full animate-pulse"></span>
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
          className="relative w-full max-w-lg bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-amber-500 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-amber-500/30 overflow-hidden text-center z-20"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 rounded-full transition-colors cursor-pointer"
            title="Fechar Alerta"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Urgent Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/60 text-amber-400 text-xs font-black uppercase tracking-wider mb-4 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <AlertTriangle className="h-4 w-4" />
            <span>Prioridade Máxima • Expedição</span>
          </div>

          {/* Hero Title with Icon */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-zinc-950 flex items-center justify-center shadow-lg shadow-amber-500/40 transform -rotate-3">
              <Car className="h-8 w-8 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                UBER A CAMINHO!
              </h2>
              <p className="text-xs text-amber-400 font-bold uppercase tracking-wide">
                Motorista solicitado para entrega
              </p>
            </div>
          </div>

          {/* Sender Quote Box */}
          <div className="mt-4 p-3.5 bg-zinc-950/80 border border-amber-500/40 rounded-2xl text-left shadow-inner">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Mensagem enviada por: <strong className="text-amber-300 font-bold">{alert.senderName}</strong>
              </span>
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(alert.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm font-bold text-white bg-zinc-900/90 px-3 py-2 rounded-xl border border-zinc-800">
              "{alert.text}"
            </p>
          </div>

          {/* Action Checklist for the Store Staff */}
          <div className="mt-4 text-left p-3.5 bg-amber-950/20 border border-amber-800/40 rounded-2xl">
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-2">
              <PackageCheck className="h-4 w-4 text-amber-400" />
              <span>Checklist Rápido da Loja:</span>
            </div>
            <ul className="text-xs text-zinc-300 space-y-1.5 font-medium pl-1">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">1.</span>
                <span>Conferir se o pedido tem mais de um item.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">2.</span>
                <span>Conferir se tem mais de uma sacola e se o pedido tem tampa.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">3.</span>
                <span>Conferir o nome do destinatário antes de entregar ao motorista.</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />
              <span>Ciente &amp; Agilizando!</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChat();
              }}
              className="w-full sm:w-auto py-3.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-sm rounded-2xl border border-zinc-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageSquare className="h-4 w-4 text-orange-400" />
              <span>Responder no Chat</span>
            </button>
          </div>

          {/* Progress Bar & Countdown */}
          <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Auto-fechamento em {secondsRemaining}s</span>
            <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-400 transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
