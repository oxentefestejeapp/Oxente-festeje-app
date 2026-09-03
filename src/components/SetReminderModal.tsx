import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlarmClock, 
  X, 
  Clock, 
  Check, 
  Sparkles,
  Calendar,
  AlertCircle,
  Bell,
  BellRing
} from 'lucide-react';
import { TeamChatMessage } from './TeamChatWidget';
import { requestNotificationPermission, getNotificationPermission, isNotificationSupported } from '../lib/desktopNotification';

interface SetReminderModalProps {
  isOpen: boolean;
  message: TeamChatMessage | null;
  onClose: () => void;
  onSetReminder: (message: TeamChatMessage, triggerAt: number) => void;
}

const PRESET_OPTIONS = [
  { label: '15 min', minutes: 15, hint: 'Rápido' },
  { label: '30 min', minutes: 30, hint: 'Em breve' },
  { label: '1 hora', minutes: 60, hint: 'Próxima hora' },
  { label: '2 horas', minutes: 120, hint: 'Meio turno' },
  { label: '3 horas', minutes: 180, hint: 'Tarde / Finalizar' },
  { label: '4 horas', minutes: 240, hint: 'Mais tarde' },
  { label: 'Final do Turno (18:00)', minutes: '18:00', hint: 'Fechamento' },
];

export function SetReminderModal({
  isOpen,
  message,
  onClose,
  onSetReminder
}: SetReminderModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | string>(180); // Default to 3 hours as user requested
  const [customTime, setCustomTime] = useState<string>('');
  const [useCustomTime, setUseCustomTime] = useState(false);

  if (!isOpen || !message) return null;

  // Calculate trigger timestamp
  const calculateTriggerAt = (): number => {
    const now = new Date();

    if (useCustomTime && customTime) {
      const [hours, minutes] = customTime.split(':').map(Number);
      const target = new Date(now);
      target.setHours(hours, minutes, 0, 0);

      // If chosen time is already past today, set for tomorrow or add 24h
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return target.getTime();
    }

    if (selectedPreset === '18:00') {
      const target = new Date(now);
      target.setHours(18, 0, 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return target.getTime();
    }

    const minutesToAdd = typeof selectedPreset === 'number' ? selectedPreset : 180;
    return now.getTime() + minutesToAdd * 60 * 1000;
  };

  const triggerAt = calculateTriggerAt();
  const triggerDate = new Date(triggerAt);
  const timeFormatted = triggerDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = triggerDate.getDate() === new Date().getDate();

  const handleConfirm = async () => {
    if (isNotificationSupported() && getNotificationPermission() === 'default') {
      try {
        await requestNotificationPermission();
      } catch {}
    }
    onSetReminder(message, triggerAt);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="no-print fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 overflow-hidden pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          className="relative w-full max-w-md bg-zinc-900 border border-teal-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-teal-500/20 z-10 overflow-hidden"
        >
          {/* Ambient light */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/30 shrink-0">
              <AlarmClock className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-400 uppercase tracking-wider">
                <Sparkles className="h-3 w-3" />
                <span>Alarme de Mensagem</span>
              </div>
              <h3 className="text-lg font-black text-white leading-tight">
                Agendar Lembrete
              </h3>
            </div>
          </div>

          {/* Message Preview */}
          <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-2xl mb-4">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-1">
              <AlertCircle className="h-3 w-3 text-teal-400" />
              <span>Mensagem:</span>
            </div>
            <p className="text-xs text-zinc-200 font-medium line-clamp-3 italic">
              "{message.text}"
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-teal-400" />
              <span>Disparar alarme em quanto tempo?</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {PRESET_OPTIONS.map((opt, i) => {
                const isSelected = !useCustomTime && selectedPreset === opt.minutes;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setUseCustomTime(false);
                      setSelectedPreset(opt.minutes);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-teal-500/20 border-teal-400 text-teal-200 font-bold shadow-md shadow-teal-500/20 ring-1 ring-teal-400'
                        : 'bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700/80 text-zinc-300'
                    }`}
                  >
                    <span className="text-xs font-bold whitespace-nowrap">{opt.label}</span>
                    <span className="text-[9px] text-zinc-400">{opt.hint}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Time Selector */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                <span className="font-semibold">Ou definir horário específico:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => {
                    setCustomTime(e.target.value);
                    if (e.target.value) setUseCustomTime(true);
                  }}
                  className="flex-1 bg-zinc-950 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 font-mono"
                />
                {useCustomTime && (
                  <button
                    type="button"
                    onClick={() => setUseCustomTime(false)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1"
                  >
                    Resetar
                  </button>
                )}
              </div>
            </div>

            {/* Scheduled Confirmation Box */}
            <div className="mt-4 p-3 bg-teal-950/40 border border-teal-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-teal-200">
              <Calendar className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div>
                  <span className="font-medium">O alarme tocará </span>
                  <span className="font-black text-white underline decoration-teal-400">
                    {isToday ? `hoje às ${timeFormatted}` : `amanhã às ${timeFormatted}`}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-300 flex flex-col gap-0.5">
                  <span className="text-teal-300 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
                    Sem tempo para fechar: Fica aberto até você mesmo fechar ou adiar.
                  </span>
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Bell className="h-3 w-3 text-amber-400 inline shrink-0" />
                    Notificação Nativa do Sistema Operacional (Desktop Toast) no Windows/Mac.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-teal-400"
            >
              <Check className="h-4 w-4" />
              <span>ATIVAR ALARME</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
