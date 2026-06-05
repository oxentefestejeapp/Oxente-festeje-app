import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User as UserIcon, 
  LogIn, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogo } from './BrandLogo';
import { playAppSound } from '../lib/audio';

interface LoginProps {
  onLoginSuccess?: () => void;
}

export const INITIAL_USERS = [
  { id: 'abraaoapp', name: 'Abraão', email: 'abraaoapp@oxente.com', role: 'admin', status: 'approved', password: '65196519' },
  { id: 'juan', name: 'Juan', email: 'juan@oxente.com', role: 'colaborador', status: 'approved', password: '69app69' },
  { id: 'assis', name: 'Assis', email: 'assis@oxente.com', role: 'colaborador', status: 'approved', password: '69app69' },
  { id: 'ana_clara', name: 'Ana Clara', email: 'anaclara@oxente.com', role: 'colaborador', status: 'approved', password: '69app69' }
];

export const normalizeUsername = (username: string): string => {
  return username.trim().toLowerCase().replace(/\s+/g, '_');
};

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordErrorToast, setShowPasswordErrorToast] = useState(false);

  // Auto-dismiss the password mismatch error toast after 5 seconds
  useEffect(() => {
    if (showPasswordErrorToast) {
      const timer = setTimeout(() => {
        setShowPasswordErrorToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showPasswordErrorToast]);

  // Guarantee that default users exist in local storage on load if not already populated
  useEffect(() => {
    const localUsersStr = localStorage.getItem('oxente_custom_users_local');
    if (!localUsersStr) {
      localStorage.setItem('oxente_custom_users_local', JSON.stringify(INITIAL_USERS));
    } else {
      try {
        const parsed = JSON.parse(localUsersStr);
        // Clean duplicates or merge default approved status
        const merged = [...parsed];
        INITIAL_USERS.forEach(defU => {
          if (!merged.some(m => m.id === defU.id)) {
            merged.push(defU);
          }
        });
        localStorage.setItem('oxente_custom_users_local', JSON.stringify(merged));
      } catch {
        localStorage.setItem('oxente_custom_users_local', JSON.stringify(INITIAL_USERS));
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const inputNameOrig = email.trim(); 
    const pWord = password.trim();

    if (!inputNameOrig || !pWord) {
      setError('Por favor, preencha todos os campos.');
      setIsLoading(false);
      return;
    }

    const usernameId = normalizeUsername(inputNameOrig);

    // Initial search matches
    const defaultMatch = INITIAL_USERS.find(
      (u) => u.id === usernameId || u.name.toLowerCase() === inputNameOrig.toLowerCase()
    );

    try {
      let userProfile: any = null;

      // Local storage-first lookup of user accounts
      const localUsersStr = localStorage.getItem('oxente_custom_users_local');
      const localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];
      const localMatch = localUsers.find((u: any) => u.id === usernameId || u.name?.toLowerCase() === inputNameOrig.toLowerCase());
      
      userProfile = localMatch || defaultMatch;

      if (!userProfile) {
        setError('Usuário não cadastrado. Verifique o seu usuário de login.');
        setIsLoading(false);
        playAppSound('alert');
        return;
      }

      // Password match comparison check
      if (pWord !== userProfile.password) {
        setError('Senha inválida para este usuário. Tente novamente.');
        setShowPasswordErrorToast(true);
        setIsLoading(false);
        playAppSound('alert');
        return;
      }

      // Status restriction check
      if (userProfile.status === 'rejected') {
        setError('Acesso recusado pelo administrador do painel.');
        setIsLoading(false);
        playAppSound('alert');
        return;
      }

      if (userProfile.status === 'pending') {
        setError('Seu cadastro está aguardando liberação do administrador.');
        setIsLoading(false);
        playAppSound('alert');
        return;
      }

      const loggedSession = {
        id: userProfile.id,
        uid: userProfile.id, 
        name: userProfile.name,
        displayName: userProfile.name, 
        email: userProfile.email,
        role: userProfile.role,
        status: userProfile.status
      };

      // Cache login session
      localStorage.setItem('oxente_custom_user', JSON.stringify(loggedSession));
      
      // Also cache in custom users local cache
      let localList = [...localUsers];
      const hasId = localList.findIndex((u: any) => u.id === userProfile.id);
      if (hasId >= 0) {
        localList[hasId] = { ...localList[hasId], ...userProfile };
      } else {
        localList.push(userProfile);
      }
      localStorage.setItem('oxente_custom_users_local', JSON.stringify(localList));

      setIsLoading(false);
      playAppSound('success');

      // Dispatch change event to App.tsx
      const authEvent = new Event('oxente_auth_change');
      window.dispatchEvent(authEvent);

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      console.error(err);
      setError('Falha geral no sistema de autenticação local segura.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center px-4 py-12 font-sans select-none antialiased relative overflow-x-hidden">
      {/* Dynamic Animated Floating Password Error Notification Toast */}
      <AnimatePresence>
        {showPasswordErrorToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -20, scale: 0.95, x: '-50%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed top-6 left-1/2 z-50 flex items-center gap-3 bg-zinc-950/95 backdrop-blur-md border border-red-500/30 text-white px-5 py-4 rounded-2xl shadow-xl shadow-red-950/20 max-w-sm w-[90%] select-text"
          >
            <div className="p-2 bg-red-500/15 border border-red-500/30 text-red-550 rounded-xl shrink-0">
              <AlertTriangle className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-red-200">Senha Incorreta</h4>
              <p className="text-xs text-zinc-350 mt-0.5 leading-relaxed">
                A senha inserida para <strong className="text-white font-semibold">{email || 'este usuário'}</strong> está incorreta.
              </p>
            </div>
            <button
              onClick={() => setShowPasswordErrorToast(false)}
              className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors shrink-0 cursor-pointer"
              title="Fechar"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Subtle Decorative Aura */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-pink/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo/Brand Title */}
        <div className="text-center mb-8 relative">
          <div className="flex justify-center mb-4">
            <BrandLogo size="lg" />
          </div>
          <h1 className="font-display font-bold text-2xl tracking-tight text-white mb-2">
            Oxente Festeje
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Acesso administrativo ao painel corporativo do negócio.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-900/60 rounded-2xl flex items-start gap-2.5 text-xs text-red-350 animate-in fade-in duration-200">
            <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Custom Authenticated Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 block px-0.5">Usuário (Login)</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu login"
                autoComplete="username"
                className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3.5 pl-10 pr-4 outline-none transition-all text-white placeholder:text-zinc-650"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 block px-0.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha de acesso"
                className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3.5 pl-10 pr-4 outline-none transition-all text-white placeholder:text-zinc-650"
                required
              />
            </div>
          </div>

          {/* Action Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 mt-6 py-4 px-4 bg-white hover:bg-white/90 text-black font-extrabold rounded-2xl text-xs sm:text-sm shadow-lg transition-all transform active:scale-98 cursor-pointer select-none disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <>
                 <LogIn className="h-4.5 w-4.5" />
                <span>Entrar no Painel</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info details */}
        <div className="mt-8 pt-5 border-t border-zinc-900 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-1.5 text-xxs text-zinc-550">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Sessão Local Segura Ativa</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Sparkles className="h-3 w-3 text-brand-pink" />
            <span>Hospedado via Hostinger / Código Limpo e Rápido</span>
          </div>
        </div>
      </div>
    </div>
  );
}
