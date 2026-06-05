import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  LogIn, 
  UserPlus,
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { auth, db, hasConfig, googleProvider } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';

interface LoginProps {
  onLoginSuccess?: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [activeMode, setActiveMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Local offline mode state (in case Firebase credentials aren't initialized yet)
  const [offlineUsername, setOfflineUsername] = useState('');
  const [offlinePassword, setOfflinePassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    const sanitizedEmail = email.trim();
    const sanitizedPassword = password.trim();
    const sanitizedName = name.trim();

    // 1. If Firebase is offline/missing credentials, use the local offline fallback mechanism
    if (!hasConfig || !auth) {
      setTimeout(() => {
        const u = offlineUsername.trim().toLowerCase();
        const p = offlinePassword.trim();
        if (u === 'admin' && p === 'admin') {
          const mockUser = {
            uid: 'local-offline-admin',
            displayName: 'Propretário Offline',
            email: 'offline-admin@oxente.com',
            role: 'admin'
          };
          localStorage.setItem('oxente_custom_user', JSON.stringify(mockUser));
          setIsLoading(false);
          const event = new Event('oxente_auth_change');
          window.dispatchEvent(event);
          if (onLoginSuccess) onLoginSuccess();
        } else {
          setError('Modo Offline: Use usuário "admin" e senha "admin" para acessar o painel de testes.');
          setIsLoading(false);
        }
      }, 400);
      return;
    }

    // 2. Online Authentication Flow using Firebase Auth
    try {
      if (activeMode === 'login') {
        // --- SIGN IN FLOW ---
        if (!sanitizedEmail || !sanitizedPassword) {
          setError('Por favor, preencha todos os campos.');
          setIsLoading(false);
          return;
        }

        await signInWithEmailAndPassword(auth, sanitizedEmail, sanitizedPassword);
        setIsLoading(false);
        
        // Let the state listener in App.tsx handle redirection automatically upon auth change!
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        // --- REGISTRATION / SIGN UP FLOW ---
        if (!sanitizedName || !sanitizedEmail || !sanitizedPassword) {
          setError('Por favor, preencha todos os campos para se cadastrar.');
          setIsLoading(false);
          return;
        }

        if (sanitizedPassword.length < 6) {
          setError('A senha deve ter no mínimo 6 caracteres.');
          setIsLoading(false);
          return;
        }

        // Create Authenticated Auth Account
        const userCredential = await createUserWithEmailAndPassword(auth, sanitizedEmail, sanitizedPassword);
        const firebaseUser = userCredential.user;

        // Apply display name to Auth account
        await updateProfile(firebaseUser, { displayName: sanitizedName });

        // Save real-time user profile database document in Firestore 'users/{id}'
        // If they sign up with the main system address 'oxentefesteje@gmail.com', auto-approve them as Admin
        const isAdminEmail = sanitizedEmail.toLowerCase() === 'oxentefesteje@gmail.com';
        const userRole = isAdminEmail ? 'admin' : 'colaborador';
        const userStatus = isAdminEmail ? 'approved' : 'pending';

        if (db) {
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            id: firebaseUser.uid,
            name: sanitizedName,
            email: sanitizedEmail.toLowerCase(),
            role: userRole,
            status: userStatus,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        setIsLoading(false);
        setSuccessMsg(
          isAdminEmail 
            ? 'Conta de Administrador criada com sucesso! Redirecionando...' 
            : 'Seu cadastro foi realizado! Aguarde a aprovação do administrador para obter acesso ao painel.'
        );

        // Reset fields
        setName('');
        setEmail('');
        setPassword('');

        // Switch to login tab in 4 seconds if not auto-directed
        setTimeout(() => {
          setActiveMode('login');
          setSuccessMsg(null);
        }, 4500);
      }
    } catch (err: any) {
      console.error('Erro de autenticação:', err);
      setIsLoading(false);
      
      // Localized Portuguese friendly error messages
      let message = 'Ocorreu um erro ao processar sua solicitação. Tente novamente.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'E-mail ou senha inválidos. Verifique os dados.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'Este endereço de e-mail já está sendo utilizado por outra conta.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Formato de e-mail inválido.';
      } else if (err.code === 'auth/weak-password') {
        message = 'A senha fornecida é muito fraca. Escolha uma senha mais forte.';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (!hasConfig || !auth) {
        throw new Error('Firebase não configurado.');
      }

      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      // Validate or create document in users collection
      const isAdminEmail = firebaseUser.email?.toLowerCase() === 'oxentefesteje@gmail.com';
      const userRole = isAdminEmail ? 'admin' : 'colaborador';
      const userStatus = isAdminEmail ? 'approved' : 'pending';

      if (db) {
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Usuário Google',
          email: firebaseUser.email?.toLowerCase() || '',
          role: userRole,
          status: userStatus,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      setIsLoading(false);
      if (isAdminEmail) {
        setSuccessMsg('Bem-vindo Proprietário Principal! Redirecionando...');
      } else {
        setSuccessMsg('Autenticação via Google realizada! Verificando permissões de acesso do colaborador...');
      }

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Erro de login Google:', err);
      setIsLoading(false);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('O login foi cancelado ou a janela de login do Google foi fechada.');
      } else {
        setError('Falha na autenticação do Google: ' + (err.message || err));
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center px-4 py-12 font-sans select-none antialiased">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Subtle Decorative Aura */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-pink/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo/Brand Title */}
        <div className="text-center mb-6 relative">
          <div className="flex justify-center mb-4">
            <BrandLogo size="lg" />
          </div>
          <h1 className="font-display font-bold text-2xl tracking-tight text-white mb-2">
            Oxente Festeje
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            {hasConfig 
              ? 'Painel corporativo oficial integrado ao banco de dados do Firebase.' 
              : 'Modo Offline: Credenciais locais ativadas.'}
          </p>
        </div>

        {/* Dynamic Tab Selector for Login/Registration */}
        {hasConfig && (
          <div className="flex bg-zinc-900 border border-zinc-850 p-1.5 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'login' 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-450 hover:text-zinc-200'
              }`}
            >
              <LogIn className="h-4 w-4" />
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'register' 
                  ? 'bg-brand-pink text-black shadow-sm font-extrabold' 
                  : 'text-zinc-450 hover:text-zinc-200'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Criar Conta
            </button>
          </div>
        )}

        {/* Error / Success Alert Banners */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-900/60 rounded-2xl flex items-start gap-2.5 text-xs text-red-350 animate-in fade-in duration-200">
            <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-955/20 border border-emerald-900/40 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-350 animate-in fade-in duration-200">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-450 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Forms */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* STANDARD FIREBASE AUTENTICATION MODE */}
          {hasConfig ? (
            <>
              {activeMode === 'register' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-semibold text-zinc-400 block px-0.5">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Clara de Assis"
                      autoComplete="name"
                      className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3.5 pl-10 pr-4 outline-none transition-all text-white placeholder:text-zinc-600"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 block px-0.5">E-mail de Acesso</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@oxente.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3.5 pl-10 pr-4 outline-none transition-all text-white placeholder:text-zinc-600"
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
                    placeholder={activeMode === 'register' ? 'Mínimo 6 caracteres' : 'Digite sua senha'}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3.5 pl-10 pr-4 outline-none transition-all text-white placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-2 mt-6 py-3.5 px-4 font-extrabold rounded-2xl text-xs sm:text-sm shadow-lg transition-all transform active:scale-98 cursor-pointer select-none duration-150 disabled:opacity-50 ${
                  activeMode === 'register' 
                    ? 'bg-brand-pink hover:bg-brand-pink/90 text-black' 
                    : 'bg-white hover:bg-white/90 text-black'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : activeMode === 'login' ? (
                  <>
                    <LogIn className="h-4.5 w-4.5" />
                    <span>Entrar no Painel</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4.5 w-4.5" />
                    <span>Solicitar Cadastro</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* LOCAL OFFLINE MODE IN DEVELOPMENT */
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 block px-0.5">Usuário Offline</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={offlineUsername}
                    onChange={(e) => setOfflineUsername(e.target.value)}
                    placeholder="Digite 'admin'"
                    autoCapitalize="none"
                    autoComplete="off"
                    className="w-full bg-zinc-900 border border-zinc-850 text-sm rounded-2xl py-3.5 pl-10 pr-4 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 block px-0.5">Senha Offline</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    value={offlinePassword}
                    onChange={(e) => setOfflinePassword(e.target.value)}
                    placeholder="Digite 'admin'"
                    className="w-full bg-zinc-900 border border-zinc-850 text-sm rounded-2xl py-3.5 pl-10 pr-4 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 mt-6 py-3.5 px-4 bg-brand-pink hover:bg-brand-pink/90 text-black font-extrabold rounded-2xl text-xs sm:text-sm shadow-lg transition-all"
              >
                {isLoading ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-4.5 w-4.5" />
                    <span>Entrar (Local)</span>
                  </>
                )}
              </button>
            </>
          )}
        </form>

        {hasConfig && activeMode === 'login' && (
          <div className="mt-5 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-[1px] bg-zinc-900" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold select-none">ou acesse com</span>
              <div className="flex-1 h-[1px] bg-zinc-900" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-zinc-900 hover:bg-zinc-850 text-white font-bold rounded-2xl text-xs sm:text-sm border border-zinc-900 hover:border-zinc-800 transition-all cursor-pointer select-none active:scale-98 disabled:opacity-50"
            >
              <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 1 12 1 7.35 1 3.37 3.68 1.41 7.57l3.79 2.94C6.1 7.53 8.84 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.47c-.28 1.48-1.12 2.74-2.38 3.58l3.7 2.87c2.16-1.99 3.42-4.91 3.42-8.56z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.21 14.97c-.24-.72-.37-1.49-.37-2.3s.13-1.58.37-2.3L1.41 7.57C.51 9.36 0 11.45 0 13.67s.51 4.31 1.41 6.1l3.8-2.8z"
                />
                <path
                  fill="#34A853"
                  d="M12 22.18c3.21 0 5.91-1.06 7.88-2.89l-3.7-2.87c-1.02.68-2.33 1.09-4.18 1.09-3.16 0-5.9-2.49-6.8-5.47L1.41 14.97c1.96 3.89 5.94 6.57 10.59 6.57z"
                />
              </svg>
              <span>Entrar com o Google (Gmail)</span>
            </button>
          </div>
        )}

        {/* Footer/Info Details and Quick Tips */}
        <div className="mt-8 pt-5 border-t border-zinc-900 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-1.5 text-xxs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-555 shrink-0" />
            <span>Autenticação Oficial Google Firebase ativa</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Sparkles className="h-3 w-3 text-brand-pink" />
            <span>Hospedado via Hostinger / Chaves de Acesso Seguras</span>
          </div>
        </div>

      </div>
    </div>
  );
}
