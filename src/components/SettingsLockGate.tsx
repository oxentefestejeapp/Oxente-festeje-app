import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, KeyRound, ShieldAlert, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { playAppSound } from '../lib/audio';

interface SettingsLockGateProps {
  onUnlock: () => void;
  onCancel: () => void;
  tabName?: string;
  title?: string;
  subtitle?: string;
  unlockButtonText?: string;
  idPrefix?: string;
}

export const SettingsLockGate: React.FC<SettingsLockGateProps> = ({ 
  onUnlock, 
  onCancel,
  tabName = 'Configurações',
  title = 'Área Restrita',
  subtitle,
  unlockButtonText,
  idPrefix = 'configuracoes'
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto focus password input on mount
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError('Por favor, insira a senha administrativa.');
      setShake(true);
      playAppSound('alert');
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (password.trim() === '69config69') {
      setError(null);
      playAppSound('success');
      onUnlock();
    } else {
      setError('Senha incorreta! Acesso restrito ao administrador.');
      setShake(true);
      playAppSound('alert');
      setTimeout(() => setShake(false), 500);
      setPassword('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md"
      >
        <motion.div
          animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="bg-zinc-950 border-2 border-cyan-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl relative overflow-hidden"
        >
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon and Header */}
          <div className="text-center mb-6 relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-indigo-500/20 border border-cyan-500/40 text-cyan-400 mb-4 shadow-lg shadow-cyan-950/50">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span>{title}</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
              {subtitle || `${tabName} protegido(a) por segunda senha de segurança.`}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label 
                htmlFor={`input-senha-${idPrefix}`} 
                className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider"
              >
                Senha Administrativa
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id={`input-senha-${idPrefix}`}
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Digite a senha de segurança..."
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 bg-zinc-900/90 border border-zinc-700/80 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 rounded-xl text-white text-sm placeholder:text-zinc-600 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-400 text-xs font-medium"
              >
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Actions */}
            <div className="space-y-2.5 pt-2">
              <button
                id={`botao-desbloquear-${idPrefix}`}
                type="submit"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-black text-sm rounded-xl shadow-lg shadow-cyan-950/60 transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{unlockButtonText || `Desbloquear ${tabName}`}</span>
              </button>

              <button
                id={`botao-voltar-vendas-${idPrefix}`}
                type="button"
                onClick={onCancel}
                className="w-full py-2.5 px-4 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para Vendas</span>
              </button>
            </div>
          </form>

          {/* Footer security note */}
          <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center">
            <p className="text-[11px] text-zinc-500">
              🔒 Sessão protegida: ao sair desta aba, a trava de segurança será reativada automaticamente.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
