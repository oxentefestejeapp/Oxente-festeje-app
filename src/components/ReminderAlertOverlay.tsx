import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlarmClock, 
  CheckCircle2, 
  MessageSquare, 
  X, 
  Clock, 
  Sparkles,
  AlertCircle,
  RotateCcw,
  BellRing
} from 'lucide-react';
import { playAppSound } from '../lib/audio';

export interface ReminderAlertData {
  id: string;
  messageId: string;
  senderName: string;
  senderRole?: string;
  text: string;
  timestamp: number;
  scheduledAt: number;
  triggerAt: number;
}

interface ReminderAlertOverlayProps {
  alert: ReminderAlertData | null;
  onClose: () => void;
  onOpenChat: () => void;
  onSnooze: (minutes: number) => void;
}

export function ReminderAlertOverlay({ alert, onClose, onOpenChat, onSnooze }: ReminderAlertOverlayProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    if (!alert) return;

    setSecondsElapsed(0);
    playAppSound('reminder_alert');

    // Count up seconds elapsed to show how long it has been ringing
    const timerInterval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    // Replay alarm chime every 14 seconds so user doesn't miss it if away from desk
    const soundInterval = setInterval(() => {
      playAppSound('reminder_alert');
    }, 14000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(soundInterval);
    };
  }, [alert?.id]);

  if (!alert) return null;

  const timeFormatted = new Date(alert.triggerAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const minsElapsed = Math.floor(secondsElapsed / 60);
  const secsRemainder = secondsElapsed % 60;
  const elapsedFormatted = minsElapsed > 0 
    ? `${minsElapsed}m ${secsRemainder < 10 ? '0' : ''}${secsRemainder}s` 
    : `${secondsElapsed}s`;

  return (
    <AnimatePresence>
      <div className="no-print fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-hidden pointer-events-auto">
        {/* Darkened backdrop with pulsating cyan/teal glow - does NOT dismiss on backdrop click to prevent accidental dismissal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
        />

        {/* Top Ticker Bar */}
        <div className="absolute top-0 left-0 right-0 h-9 bg-teal-600 text-white font-black text-xs uppercase tracking-widest flex items-center overflow-hidden shadow-lg select-none border-b-2 border-zinc-950">
          <motion.div
            animate={{ x: [0, -1000] }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 18 }}
            className="whitespace-nowrap flex items-center gap-8 font-extrabold"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="flex items-center gap-3">
                <AlarmClock className="h-4 w-4 text-teal-200" />
                <span>ALARME DISPARADO: HORA DA TAREFA / FINALIZAR PRODUTO!</span>
                <span>•</span>
                <span>LEMBRETE AGENDADO DA EQUIPE</span>
                <span>•</span>
                <span>OXENTE FESTEJE</span>
                <span>•</span>
                <Sparkles className="h-4 w-4 text-teal-200" />
              </span>
            ))}
          </motion.div>
        </div>

        {/* Speeding Clock Animation Crossing Above Modal (Right to Left) */}
        <motion.div
          initial={{ x: '120vw' }}
          animate={{ x: '-120vw' }}
          transition={{ duration: 7.5, ease: 'linear', delay: 0.3 }}
          className="absolute top-16 sm:top-20 left-0 pointer-events-none z-10 flex items-center gap-2"
        >
          <div className="relative flex items-center bg-zinc-900/90 border-2 border-teal-400 px-4 py-2 rounded-2xl shadow-2xl shadow-teal-500/50 backdrop-blur-sm">
            <div className="flex items-center mr-2.5">
              <span className="text-3xl inline-block animate-bounce">
                ⏰
              </span>
              <span className="text-xl -ml-1 opacity-90 animate-pulse">🔔</span>
            </div>
            <div className="text-left mr-1">
              <span className="text-[11px] font-black text-teal-400 uppercase tracking-wider block">
                Alarme no Horário!
              </span>
              <span className="text-xs font-bold text-white">
                Hora de executar a tarefa
              </span>
            </div>
            <div className="absolute -right-8 flex flex-col gap-1 opacity-70 pointer-events-none">
              <span className="w-7 h-1 bg-teal-400 rounded-full animate-pulse"></span>
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
          className="relative w-full max-w-lg bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-teal-500 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-teal-500/30 overflow-hidden text-center z-20"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/15 border border-teal-500/40 text-teal-300 font-bold text-xs uppercase tracking-wider mb-4 shadow-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
            </span>
            <BellRing className="h-3.5 w-3.5 text-teal-400" />
            <span>Alarme Agendado • {timeFormatted}</span>
          </div>

          {/* Icon and Title */}
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/40 text-white border-2 border-teal-300">
                <AlarmClock className="h-10 w-10 animate-bounce" />
              </div>
              <span className="absolute -bottom-1 -right-1 text-2xl animate-pulse">
                ⏰
              </span>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            HORA DA TAREFA!
          </h2>

          <p className="text-zinc-300 text-sm mt-1 max-w-sm mx-auto font-medium">
            O alarme configurado para esta mensagem acaba de tocar:
          </p>

          {/* Message Quote Box */}
          <div className="mt-4 p-4 bg-zinc-950/90 border-2 border-teal-500/40 rounded-2xl text-left shadow-inner">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-teal-300">
                <AlertCircle className="h-3.5 w-3.5 text-teal-400" />
                <span>Mensagem de {alert.senderName}</span>
                {alert.senderRole && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-teal-950/60 border border-teal-700/50 rounded-md text-teal-300">
                    {alert.senderRole}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Clock className="h-3 w-3" />
                <span>
                  Agendado às {timeFormatted}
                </span>
              </div>
            </div>
            <p className="text-base font-bold text-white leading-relaxed break-words pl-0.5">
              "{alert.text}"
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-teal-600/30 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-teal-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>CIENTE & FINALIZANDO!</span>
            </button>

            <button
              type="button"
              onClick={onOpenChat}
              className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-zinc-700"
            >
              <MessageSquare className="h-4 w-4 text-teal-400" />
              <span>VER NO CHAT</span>
            </button>
          </div>

          {/* Snooze Options */}
          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-xs">
            <span className="text-zinc-400 font-medium flex items-center gap-1 text-[11px]">
              <RotateCcw className="h-3 w-3" />
              Adiar:
            </span>
            <button
              type="button"
              onClick={() => onSnooze(15)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 hover:text-teal-300 text-zinc-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border border-zinc-700/60"
            >
              +15 min
            </button>
            <button
              type="button"
              onClick={() => onSnooze(30)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 hover:text-teal-300 text-zinc-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border border-zinc-700/60"
            >
              +30 min
            </button>
            <button
              type="button"
              onClick={() => onSnooze(60)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 hover:text-teal-300 text-zinc-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border border-zinc-700/60"
            >
              +1 hora
            </button>
            <button
              type="button"
              onClick={() => onSnooze(180)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 hover:text-teal-300 text-zinc-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border border-zinc-700/60"
            >
              +3 horas
            </button>
          </div>

          {/* Persistent Indicator: Stays active until user confirms */}
          <div className="mt-4 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 px-1 text-xs">
            <div className="flex items-center gap-1.5 text-teal-400 font-semibold text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              <span>Alarme ativo há: <span className="font-mono text-white font-bold">{elapsedFormatted}</span></span>
            </div>
            <span className="text-[10px] text-zinc-400 font-medium">
              Permanece ativo até você fechar
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
