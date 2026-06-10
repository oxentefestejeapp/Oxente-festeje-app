import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Paintbrush, 
  Calendar, 
  Hammer, 
  Gift, 
  Truck, 
  Heart, 
  Sparkles,
  ShoppingBag,
  FileCheck2,
  Check
} from 'lucide-react';
import { playAppSound } from '../lib/audio';

export interface ShortFeedback {
  title: string;
  message: string;
  type: 'status_agendado' | 'status_producao' | 'status_pronto' | 'status_entrega' | 'status_entregue' | 'art_finalizada' | 'pedido_criado';
}

interface ShortFeedbackToastProps {
  feedback: ShortFeedback | null;
  onClose: () => void;
}

export function ShortFeedbackToast({ feedback, onClose }: ShortFeedbackToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!feedback) return;

    // Reset progress and play audio cue based on success
    setProgress(100);
    playAppSound('pop');

    // Auto close timer
    const duration = 2000; // 2 seconds
    const intervalTime = 20;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const progressInterval = setInterval(() => {
      currentStep++;
      const nextProgress = Math.max(0, 100 - (currentStep / steps) * 100);
      setProgress(nextProgress);
    }, intervalTime);

    const closeTimer = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(closeTimer);
    };
  }, [feedback, onClose]);

  if (!feedback) return null;

  // Configuration for each type of feedback to maximize aesthetic pairing and creative energy
  const getConfig = () => {
    switch (feedback.type) {
      case 'status_agendado':
        return {
          gradient: 'from-blue-500 via-indigo-500 to-blue-600',
          border: 'border-blue-500/30 shadow-[0_0_25px_rgba(59,130,246,0.2)]',
          iconBg: 'bg-blue-500/15 text-blue-400',
          barColor: 'bg-blue-500',
          icon: <Calendar className="h-6 w-6 stroke-[2.2]" />
        };
      case 'status_producao':
        return {
          gradient: 'from-amber-500 via-orange-500 to-amber-600',
          border: 'border-amber-500/30 shadow-[0_0_25px_rgba(245,158,11,0.2)]',
          iconBg: 'bg-amber-500/15 text-amber-400',
          barColor: 'bg-amber-500',
          icon: <Hammer className="h-6 w-6 stroke-[2.2] animate-bounce" />
        };
      case 'status_pronto':
        return {
          gradient: 'from-emerald-500 via-teal-500 to-emerald-600',
          border: 'border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.25)]',
          iconBg: 'bg-emerald-500/15 text-emerald-400',
          barColor: 'bg-emerald-500',
          icon: <Gift className="h-6 w-6 stroke-[2.2] animate-pulse" />
        };
      case 'status_entrega':
        return {
          gradient: 'from-purple-500 via-indigo-500 to-purple-600',
          border: 'border-purple-500/30 shadow-[0_0_25px_rgba(147,51,234,0.2)]',
          iconBg: 'bg-purple-500/15 text-purple-400',
          barColor: 'bg-purple-500',
          icon: <Truck className="h-6 w-6 stroke-[2.2]" />
        };
      case 'status_entregue':
        return {
          gradient: 'from-cyan-500 via-teal-500 to-cyan-600',
          border: 'border-cyan-500/30 shadow-[0_0_25px_rgba(6,182,212,0.25)]',
          iconBg: 'bg-cyan-500/15 text-cyan-400',
          barColor: 'bg-cyan-500',
          icon: <Heart className="h-6 w-6 stroke-[2.2] fill-cyan-400/10" />
        };
      case 'art_finalizada':
        return {
          gradient: 'from-pink-500 via-rose-500 to-pink-600',
          border: 'border-pink-500/30 shadow-[0_0_25px_rgba(236,72,153,0.2)]',
          iconBg: 'bg-pink-500/15 text-pink-400',
          barColor: 'bg-pink-500',
          icon: <Paintbrush className="h-6 w-6 stroke-[2.2]" />
        };
      case 'pedido_criado':
        return {
          gradient: 'from-yellow-500 via-amber-500 to-yellow-600',
          border: 'border-yellow-500/30 shadow-[0_0_25px_rgba(234,179,8,0.25)]',
          iconBg: 'bg-yellow-500/15 text-yellow-400',
          barColor: 'bg-yellow-500',
          icon: <ShoppingBag className="h-6 w-6 stroke-[2.2] animate-pulse" />
        };
      default:
        return {
          gradient: 'from-zinc-500 via-zinc-600 to-zinc-700',
          border: 'border-zinc-500/30 shadow-[0_0_25px_rgba(113,113,122,0.2)]',
          iconBg: 'bg-zinc-500/15 text-zinc-400',
          barColor: 'bg-zinc-500',
          icon: <Check className="h-6 w-6 stroke-[2.2]" />
        };
    }
  };

  const config = getConfig();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-start justify-center pointer-events-none pt-[15vh] px-4 select-none no-print">
        <motion.div
          initial={{ opacity: 0, y: -45, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 220 }}
          className={`w-full max-w-sm bg-zinc-950/93 backdrop-blur-xl border ${config.border} rounded-2xl shadow-2xl p-5 pointer-events-auto overflow-hidden relative`}
        >
          <div className="flex gap-4 items-start">
            {/* Soft pulsing visual circle behind the icon */}
            <div className={`relative flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl ${config.iconBg}`}>
              {config.icon}
            </div>

            {/* Core message text */}
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-[14px] font-black tracking-tight text-white leading-snug">
                {feedback.title}
              </h4>
              <p className="text-[11px] text-zinc-350 font-semibold leading-relaxed mt-1">
                {feedback.message}
              </p>
            </div>

            {/* OK Button - to exit immediately */}
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={onClose}
              className="flex-shrink-0 self-center px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-800 text-zinc-250 hover:text-white text-[10px] font-extrabold uppercase tracking-widest rounded-lg border border-zinc-800 hover:border-zinc-750 transition-all cursor-pointer shadow-sm"
            >
              OK
            </motion.button>
          </div>

          {/* Time indicator progress bar at the bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900">
            <div 
              className={`h-full ${config.barColor} transition-all ease-linear`}
              style={{ width: `${progress}%`, transitionDuration: '20ms' }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
