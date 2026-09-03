import React, { useState, useEffect } from 'react';
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
  Lock,
  Users,
  Repeat
} from 'lucide-react';
import { TeamChatMessage, ChatReminder } from './TeamChatWidget';
import { requestNotificationPermission, getNotificationPermission, isNotificationSupported } from '../lib/desktopNotification';

export interface ReminderRepeatConfig {
  repeatWeekly: boolean;
  repeatDayOfWeek?: number;
  repeatDayLabel?: string;
  repeatTime?: string;
}

interface SetReminderModalProps {
  isOpen: boolean;
  message: TeamChatMessage | null;
  existingReminder?: ChatReminder | null;
  currentUserName?: string;
  onClose: () => void;
  onSetReminder: (
    message: TeamChatMessage,
    triggerAt: number,
    target: 'private' | 'all',
    repeatConfig?: ReminderRepeatConfig
  ) => void;
}

const WEEKDAYS = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
];

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
  existingReminder,
  currentUserName,
  onClose,
  onSetReminder
}: SetReminderModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | string | null>(180);
  const [customTime, setCustomTime] = useState<string>('');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [target, setTarget] = useState<'private' | 'all'>('private');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(() => new Date().getDay());

  // Reset/Initialize whenever modal opens or active message changes
  useEffect(() => {
    if (!isOpen || !message) return;

    if (existingReminder) {
      setTarget(existingReminder.target || 'private');
      if (existingReminder.repeatWeekly) {
        setRepeatWeekly(true);
        if (typeof existingReminder.repeatDayOfWeek === 'number') {
          setSelectedDayOfWeek(existingReminder.repeatDayOfWeek);
        }
      } else {
        setRepeatWeekly(false);
        setSelectedDayOfWeek(new Date().getDay());
      }

      const diffMinutes = Math.round((existingReminder.triggerAt - Date.now()) / 60000);
      const match = PRESET_OPTIONS.find(p => typeof p.minutes === 'number' && Math.abs(p.minutes - diffMinutes) <= 2);
      
      if (match) {
        setSelectedPreset(match.minutes);
        setUseCustomTime(false);
        setCustomTime('');
      } else {
        const d = new Date(existingReminder.triggerAt);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        setCustomTime(`${hh}:${mm}`);
        setUseCustomTime(true);
        setSelectedPreset(null);
      }
    } else {
      // Fresh new alarm defaults
      setTarget('private');
      setRepeatWeekly(false);
      setSelectedDayOfWeek(new Date().getDay());
      setSelectedPreset(180);
      setUseCustomTime(false);
      setCustomTime('');
    }
  }, [isOpen, message?.id, existingReminder]);

  if (!isOpen || !message) return null;

  // Calculate trigger timestamp
  const calculateTriggerAt = (): number => {
    const now = new Date();

    let targetHours = 0;
    let targetMinutes = 0;

    if (useCustomTime && customTime) {
      const [hours, minutes] = customTime.split(':').map(Number);
      targetHours = hours;
      targetMinutes = minutes;
    } else if (selectedPreset === '18:00') {
      targetHours = 18;
      targetMinutes = 0;
    } else {
      const minutesToAdd = typeof selectedPreset === 'number' ? selectedPreset : 180;
      const futureDate = new Date(now.getTime() + minutesToAdd * 60 * 1000);
      targetHours = futureDate.getHours();
      targetMinutes = futureDate.getMinutes();
    }

    // Weekly repetition: trigger on selected weekday at targetHours:targetMinutes
    if (repeatWeekly) {
      const targetDate = new Date(now);
      targetDate.setHours(targetHours, targetMinutes, 0, 0);

      const currentDay = now.getDay();
      let daysUntil = (selectedDayOfWeek - currentDay + 7) % 7;

      // If chosen weekday is today, but the time has already passed today, advance by 7 days
      if (daysUntil === 0 && targetDate.getTime() <= now.getTime()) {
        daysUntil = 7;
      }

      targetDate.setDate(targetDate.getDate() + daysUntil);
      return targetDate.getTime();
    }

    // Single-occurrence alarm
    if (useCustomTime && customTime) {
      const targetDate = new Date(now);
      targetDate.setHours(targetHours, targetMinutes, 0, 0);
      if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      return targetDate.getTime();
    }

    if (selectedPreset === '18:00') {
      const targetDate = new Date(now);
      targetDate.setHours(18, 0, 0, 0);
      if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      return targetDate.getTime();
    }

    const minutesToAdd = typeof selectedPreset === 'number' ? selectedPreset : 180;
    return now.getTime() + minutesToAdd * 60 * 1000;
  };

  const triggerAt = calculateTriggerAt();
  const triggerDate = new Date(triggerAt);
  const timeFormatted = triggerDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = triggerDate.getDate() === new Date().getDate();
  const selectedWeekdayObj = WEEKDAYS.find(w => w.value === selectedDayOfWeek);

  const handleConfirm = async () => {
    if (isNotificationSupported() && getNotificationPermission() === 'default') {
      try {
        await requestNotificationPermission();
      } catch {}
    }

    const hh = String(triggerDate.getHours()).padStart(2, '0');
    const mm = String(triggerDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    onSetReminder(message, triggerAt, target, {
      repeatWeekly,
      repeatDayOfWeek: repeatWeekly ? selectedDayOfWeek : undefined,
      repeatDayLabel: repeatWeekly ? selectedWeekdayObj?.label : undefined,
      repeatTime: repeatWeekly ? timeStr : undefined
    });
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
          <div className={`absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 ${target === 'all' ? 'bg-indigo-500/20' : 'bg-teal-500/15'} rounded-full blur-2xl pointer-events-none transition-all duration-300`} />

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
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${target === 'all' ? 'from-indigo-600 to-violet-500 shadow-indigo-500/30' : 'from-teal-600 to-emerald-500 shadow-teal-500/30'} flex items-center justify-center text-white shadow-lg shrink-0 transition-all`}>
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
              <span>Mensagem de {message.senderName}:</span>
            </div>
            <p className="text-xs text-zinc-200 font-medium line-clamp-3 italic">
              "{message.text}"
            </p>
          </div>

          {/* Target Audience Selector: Privado vs Para Todos */}
          <div className="mb-4">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between gap-1.5 mb-1.5">
              <span className="flex items-center gap-1.5">
                {target === 'all' ? <Users className="h-3.5 w-3.5 text-indigo-400" /> : <Lock className="h-3.5 w-3.5 text-teal-400" />}
                <span>Visibilidade do Alarme:</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-normal">Quem receberá o alerta</span>
            </label>

            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950/80 border border-zinc-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setTarget('private')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  target === 'private'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/20 border border-teal-400'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Privado</span>
                </div>
                <span className={`text-[10px] mt-0.5 font-normal ${target === 'private' ? 'text-teal-100' : 'text-zinc-500'}`}>
                  Só para o seu login
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTarget('all')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  target === 'all'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 border border-indigo-400'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>Toda a Equipe</span>
                </div>
                <span className={`text-[10px] mt-0.5 font-normal ${target === 'all' ? 'text-indigo-100' : 'text-zinc-500'}`}>
                  Para todos os usuários
                </span>
              </button>
            </div>
            
            <p className="text-[11px] text-zinc-400 mt-1.5 px-1">
              {target === 'private' 
                ? '🔒 Alarme exclusivo: Somente o seu computador/login receberá a tela cheia e o som deste alarme.' 
                : '👥 Alarme coletivo: Todos os colaboradores e administradores verão a tela cheia e ouvirão o alarme juntos.'}
            </p>
          </div>

          {/* Frequência do Alarme: Uma vez vs Repetir Semanalmente */}
          <div className="mb-4">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between gap-1.5 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5 text-teal-400" />
                <span>Frequência / Repetição:</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-normal">Como o alarme tocará</span>
            </label>

            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950/80 border border-zinc-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setRepeatWeekly(false)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !repeatWeekly
                    ? 'bg-zinc-800 text-white shadow-md border border-zinc-600'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Apenas Uma Vez</span>
                </div>
                <span className="text-[10px] mt-0.5 font-normal text-zinc-400">
                  Toca no horário e encerra
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRepeatWeekly(true)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  repeatWeekly
                    ? target === 'all'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 border border-indigo-400'
                      : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/20 border border-teal-400'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" />
                  <span>Repetir Semanalmente</span>
                </div>
                <span className={`text-[10px] mt-0.5 font-normal ${repeatWeekly ? (target === 'all' ? 'text-indigo-100' : 'text-teal-100') : 'text-zinc-400'}`}>
                  Toda semana nesse dia
                </span>
              </button>
            </div>

            {/* If repeatWeekly is true: Show weekday picker */}
            {repeatWeekly && (
              <div className="mt-2.5 p-2.5 bg-zinc-950 border border-teal-500/40 rounded-2xl animate-fadeIn">
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="text-[11px] font-bold text-zinc-300">
                    Repetir em qual dia da semana?
                  </span>
                  <span className="text-[11px] font-extrabold text-teal-400">
                    {selectedWeekdayObj?.label}
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((wd) => {
                    const isSelected = selectedDayOfWeek === wd.value;
                    return (
                      <button
                        key={wd.value}
                        type="button"
                        onClick={() => setSelectedDayOfWeek(wd.value)}
                        className={`py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer border ${
                          isSelected
                            ? target === 'all'
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                              : 'bg-teal-600 text-white border-teal-400 shadow-sm'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
                        }`}
                        title={wd.label}
                      >
                        {wd.short}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[10.5px] text-zinc-400 mt-2 px-0.5">
                  💡 <strong className="text-zinc-200">Apenas nesse dia:</strong> Este alarme tocará toda <strong className="text-teal-300">{selectedWeekdayObj?.label}</strong> no horário definido abaixo, e não nos outros dias da semana.
                </p>
              </div>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-teal-400" />
              <span>{repeatWeekly ? 'Qual o horário do alarme semanal?' : 'Disparar alarme em quanto tempo?'}</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {PRESET_OPTIONS.map((opt, i) => {
                const isSelected = !useCustomTime && selectedPreset === opt.minutes;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(opt.minutes);
                      setUseCustomTime(false);
                      setCustomTime('');
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                      isSelected
                        ? target === 'all'
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                          : 'bg-teal-600 text-white border-teal-400 shadow-md shadow-teal-600/30'
                        : 'bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 border-zinc-700/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className={`text-[10px] font-normal ${isSelected ? 'text-white/80' : 'text-zinc-500'}`}>
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Time Input */}
            <div className="pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => {
                    setCustomTime(e.target.value);
                    setUseCustomTime(true);
                    setSelectedPreset(null);
                  }}
                  className={`flex-1 px-3 py-2 bg-zinc-950 border rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 ${
                    useCustomTime && customTime 
                      ? target === 'all' ? 'border-indigo-400 focus:ring-indigo-400' : 'border-teal-400 focus:ring-teal-400'
                      : 'border-zinc-750 focus:border-teal-500 focus:ring-teal-500'
                  }`}
                  placeholder="Ou escolha horário exato"
                />
                {useCustomTime && customTime && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomTime(false);
                      setCustomTime('');
                      setSelectedPreset(180);
                    }}
                    className="p-2 text-zinc-400 hover:text-rose-400 bg-zinc-800 rounded-xl text-xs"
                    title="Limpar horário customizado"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Scheduled Confirmation Box */}
            <div className={`mt-4 p-3 ${target === 'all' ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200' : 'bg-teal-950/40 border-teal-500/40 text-teal-200'} border rounded-2xl flex items-start gap-2.5 text-xs transition-all`}>
              {repeatWeekly ? (
                <Repeat className={`h-4 w-4 ${target === 'all' ? 'text-indigo-400' : 'text-teal-400'} shrink-0 mt-0.5`} />
              ) : (
                <Calendar className={`h-4 w-4 ${target === 'all' ? 'text-indigo-400' : 'text-teal-400'} shrink-0 mt-0.5`} />
              )}
              <div className="space-y-1">
                <div>
                  <span className="font-medium">O alarme tocará </span>
                  {repeatWeekly ? (
                    <span className="font-black text-white underline decoration-teal-400">
                      toda {selectedWeekdayObj?.label} às {timeFormatted}
                    </span>
                  ) : (
                    <span className="font-black text-white underline decoration-teal-400">
                      {isToday ? `hoje às ${timeFormatted}` : `amanhã às ${timeFormatted}`}
                    </span>
                  )}
                  <span className="ml-1 text-[11px] font-bold opacity-90">
                    ({target === 'all' ? '👥 Toda a Equipe' : '🔒 Só para você'})
                  </span>
                </div>
                <div className="text-[11px] text-zinc-300 flex flex-col gap-0.5">
                  {repeatWeekly ? (
                    <span className={`${target === 'all' ? 'text-indigo-300' : 'text-teal-300'} font-bold flex items-center gap-1`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
                      Repetição semanal: Toca apenas na {selectedWeekdayObj?.label} e repete automaticamente na semana seguinte.
                    </span>
                  ) : (
                    <span className={`${target === 'all' ? 'text-indigo-300' : 'text-teal-300'} font-bold flex items-center gap-1`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
                      Sem tempo para fechar: Fica aberto até a pessoa mesma fechar ou adiar.
                    </span>
                  )}
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
              className={`flex-1 py-2.5 px-4 bg-gradient-to-r ${target === 'all' ? 'from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/30' : 'from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-teal-600/30'} text-white font-extrabold text-xs rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer`}
            >
              <Check className="h-4 w-4" />
              <span>{existingReminder ? 'Atualizar Alarme' : 'Ativar Alarme'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
