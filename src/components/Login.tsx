import React, { useState } from 'react';
import { 
  Lock, 
  User as UserIcon, 
  LogIn, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface LoginProps {
  onLoginSuccess?: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Simulate a brief, ultra-smooth tactile animation delay
    setTimeout(() => {
      const sanitizedUsername = username.trim().toLowerCase();
      const sanitizedPassword = password.trim();

      if (!sanitizedUsername || !sanitizedPassword) {
        setError('Por favor, preencha todos os campos obrigatórios.');
        setIsLoading(false);
        return;
      }

      if (sanitizedUsername === 'abraaoapp' && sanitizedPassword === '65196519') {
        const adminUser = {
          uid: 'abraao-admin',
          displayName: 'Abraão (Administrador)',
          email: 'oxentefesteje@gmail.com',
          role: 'admin'
        };
        localStorage.setItem('oxente_custom_user', JSON.stringify(adminUser));
        setIsLoading(false);
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          window.location.reload();
        }
      } else if (
        (sanitizedUsername === 'juan' && sanitizedPassword === '69app69') ||
        (sanitizedUsername === 'assis' && sanitizedPassword === '69app69') ||
        (sanitizedUsername === 'clara' && sanitizedPassword === '69app69') ||
        (sanitizedUsername === 'colaboradoroxente' && sanitizedPassword === '69app69')
      ) {
        let dispName = 'Colaborador Oxente';
        let emailAddress = 'colaborador@oxente.com';
        let staffUid = 'colaborador-staff';

        if (sanitizedUsername === 'juan') {
          dispName = 'Juan';
          emailAddress = 'juan@oxente.com';
          staffUid = 'juan-staff';
        } else if (sanitizedUsername === 'assis') {
          dispName = 'Assis';
          emailAddress = 'assis@oxente.com';
          staffUid = 'assis-staff';
        } else if (sanitizedUsername === 'clara') {
          dispName = 'Clara';
          emailAddress = 'clara@oxente.com';
          staffUid = 'clara-staff';
        }

        const staffUser = {
          uid: staffUid,
          displayName: dispName,
          email: emailAddress,
          role: 'colaborador'
        };
        localStorage.setItem('oxente_custom_user', JSON.stringify(staffUser));
        setIsLoading(false);
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          window.location.reload();
        }
      } else {
        setError('Usuário ou senha incorretos. Verifique suas credenciais.');
        setIsLoading(false);
      }
    }, 450);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center px-4 py-12 font-sans select-none antialiased">
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
            Faça login com seu usuário e senha de acesso local para entrar no sistema.
          </p>
        </div>

        {/* Error Alert Banners */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-900/60 rounded-2xl flex items-start gap-2.5 text-xs text-red-300 animate-in fade-in duration-200">
            <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 block px-0.5">Usuário de Acesso</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: abraaoapp"
                autoCapitalize="none"
                autoComplete="off"
                className="w-full bg-zinc-900 border border-zinc-850/80 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3.5 pl-10 pr-4 outline-none transition-all placeholder:text-zinc-650 text-white"
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
                placeholder="Digite sua senha"
                className="w-full bg-zinc-900 border border-zinc-850/80 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3.5 pl-10 pr-4 outline-none transition-all placeholder:text-zinc-650 text-white"
                required
              />
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 mt-6 py-3.5 px-4 bg-brand-pink hover:bg-brand-pink/90 text-black font-extrabold rounded-2xl text-xs sm:text-sm shadow-lg transition-all transform active:scale-98 cursor-pointer select-none duration-150 disabled:opacity-50"
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

        {/* Footer/Info Details and Quick Tips */}
        <div className="mt-8 pt-5 border-t border-zinc-900 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-1.5 text-xxs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-550" />
            <span>Conexão Local Segura Modificada</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Sparkles className="h-3 w-3 text-brand-pink" />
            <span>Hospedagem Hostinger / Sem Dependência Cloud Google</span>
          </div>
        </div>

      </div>
    </div>
  );
}
