import React, { useState } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db, hasConfig } from '../lib/firebase';
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  LogIn, 
  UserPlus, 
  AlertCircle, 
  Loader2, 
  Star 
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface LoginProps {
  onLoginSuccess?: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!hasConfig) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center px-4 py-12 font-sans select-none antialiased animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-pink/5 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center mb-8 relative">
            <div className="flex justify-center mb-4">
              <BrandLogo size="lg" />
            </div>
            <h1 className="font-display font-bold text-2xl tracking-tight text-white mb-2">
              Oxente Festeje
            </h1>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Modo Offline / Sem Banco de Dados Ativo
            </p>
          </div>

          <div className="mb-6 p-4 bg-amber-950/30 border border-amber-900/55 rounded-2xl flex items-start gap-2.5 text-xs text-amber-305">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-400">Aviso de Configuração</p>
              <p className="text-zinc-400 leading-relaxed">
                As credenciais do Google Firebase não foram encontradas. Isso ocorre quando o aplicativo é hospedado fora do ambiente de testes da Google AI Studio (como na Hostinger ou localmente).
              </p>
            </div>
          </div>

          <div className="text-xs text-zinc-400 mb-6 bg-zinc-900/50 border border-zinc-850 p-4 rounded-xl space-y-2 select-text">
            <p className="font-bold text-zinc-200">Como ativar a sincronização em nuvem?</p>
            <p>Declare as seguintes variáveis de ambiente no painel de administração da Hostinger ou em um arquivo <code className="text-brand-pink font-mono text-[11px] bg-black px-1.5 py-0.5 rounded">.env</code> na raiz do projeto:</p>
            <ul className="list-disc list-inside space-y-1 text-xxs text-zinc-500 font-mono">
              <li>VITE_FIREBASE_API_KEY</li>
              <li>VITE_FIREBASE_PROJECT_ID</li>
              <li>VITE_FIREBASE_AUTH_DOMAIN</li>
              <li>VITE_FIREBASE_STORAGE_BUCKET</li>
              <li>VITE_FIREBASE_MESSAGING_SENDER_ID</li>
              <li>VITE_FIREBASE_APP_ID</li>
            </ul>
          </div>

          {/* Local Mode Entry Button */}
          <button
            type="button"
            onClick={() => {
              if (onLoginSuccess) {
                onLoginSuccess();
              } else {
                window.location.reload();
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-brand-pink hover:bg-brand-pink/90 text-black font-extrabold rounded-2xl text-xs shadow-lg transition-all transform active:scale-98 cursor-pointer select-none duration-150"
          >
            <LogIn className="h-4.5 w-4.5" />
            <span>Entrar no Modo Local (Offline)</span>
          </button>

        </div>
      </div>
    );
  }

  const getFriendlyError = (code: string) => {
    switch (code) {
      case 'auth/invalid-credential':
        return 'E-mail ou senha incorretos.';
      case 'auth/user-not-found':
        return 'E-mail não está cadastrado.';
      case 'auth/wrong-password':
        return 'Senha incorreta.';
      case 'auth/email-already-in-use':
        return 'Este e-mail já está em uso.';
      case 'auth/invalid-email':
        return 'Endereço de e-mail inválido.';
      case 'auth/weak-password':
        return 'A senha é muito fraca (mínimo de 6 caracteres).';
      case 'auth/popup-closed-by-user':
        return 'O login com o Google foi fechado antes de ser concluído.';
      default:
        return 'Ocorreu um erro ao realizar a operação. Tente novamente.';
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          const isAdminEmail = user.email === 'oxentefesteje@gmail.com';
          const defaultStatus = isAdminEmail ? 'approved' : 'pending';

          await setDoc(userRef, {
            id: user.uid,
            name: user.displayName || 'Novo Usuário',
            email: user.email || '',
            status: defaultStatus,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(getFriendlyError(err.code || ''));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Basic Validations
    if (!email || !password) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      setIsLoading(false);
      return;
    }

    if (isRegistering) {
      if (!name) {
        setError('Por favor, digite seu nome completo.');
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.');
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('A senha deve conter no mínimo 6 caracteres.');
        setIsLoading(false);
        return;
      }
    }

    try {
      if (isRegistering) {
        // Register standard Email/Password user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
        });

        // Initialize Firestore profile as pending
        const user = userCredential.user;
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          id: user.uid,
          name: name,
          email: email,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        setSuccess('Cadastro solicitado com sucesso! Por favor, informe o e-mail oxentefesteje@gmail.com para que o administrador aprove o seu acesso.');
        // We will switch to login mode after successful registration
        setIsRegistering(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        // Email/Password login
        await signInWithEmailAndPassword(auth, email, password);
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyError(err.code || ''));
    } finally {
      setIsLoading(false);
    }
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
            {isRegistering 
              ? 'Crie sua conta para solicitar acesso ao gerenciador de vendas e estoque.' 
              : 'Faça login para acessar o painel de gerenciamento.'}
          </p>
        </div>

        {/* Error/Success Alert Banners */}
        {error && (
          <div className="mb-5 p-4 bg-red-950/40 border border-red-900/60 rounded-2xl flex items-start gap-2.5 text-xs text-red-300 animate-in fade-in duration-200">
            <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-4 bg-emerald-950/40 border border-emerald-950 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-300 animate-in fade-in duration-200">
            <Star className="h-4.5 w-4.5 text-brand-pink shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {isRegistering && (
            <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
              <label className="text-xs font-semibold text-zinc-400 block px-0.5">Nome Completo</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-zinc-900 border border-zinc-850/80 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3 pl-10 pr-4 outline-none transition-all placeholder:text-zinc-600 text-white"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 block px-0.5">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@gmail.com"
                className="w-full bg-zinc-900 border border-zinc-850/80 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3 pl-10 pr-4 outline-none transition-all placeholder:text-zinc-600 text-white"
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
                placeholder="••••••••"
                className="w-full bg-zinc-900 border border-zinc-850/80 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3 pl-10 pr-4 outline-none transition-all placeholder:text-zinc-600 text-white"
                required
              />
            </div>
          </div>

          {isRegistering && (
            <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
              <label className="text-xs font-semibold text-zinc-400 block px-0.5">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-850/80 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-sm rounded-2xl py-3 pl-10 pr-4 outline-none transition-all placeholder:text-zinc-600 text-white"
                  required
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 mt-6 py-3.5 px-4 bg-brand-pink hover:bg-brand-pink-hover text-black font-bold rounded-2xl text-sm shadow-lg transition-all transform active:scale-98 cursor-pointer select-none duration-150 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : isRegistering ? (
              <>
                <UserPlus className="h-4.5 w-4.5" />
                <span>Solicitar Cadastro</span>
              </>
            ) : (
              <>
                <LogIn className="h-4.5 w-4.5" />
                <span>Entrar no Sistema</span>
              </>
            )}
          </button>
        </form>

        {/* Divider Line */}
        <div className="relative my-7">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-900" />
          </div>
          <div className="relative flex justify-center text-xxs uppercase">
            <span className="bg-zinc-950 px-3.5 text-zinc-600 font-semibold tracking-wider">Ou continue com</span>
          </div>
        </div>

        {/* Google Authentication Option */}
        <button
          type="button"
          disabled={isLoading}
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-zinc-900 hover:bg-zinc-850 text-white font-medium border border-zinc-800 rounded-2xl text-xs shadow-sm transition-all transform active:scale-98 cursor-pointer select-none duration-150"
        >
          {/* Flat Google SVG Icon */}
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.109C18.28 1.96 15.54 1 12.24 1 6.133 1 1.144 5.91 1.144 12s4.99 11 11.096 11c6.38 0 10.614-4.434 10.614-10.8 0-.727-.08-1.285-.175-1.915H12.24z"
            />
          </svg>
          <span>Conectar / Criar Conta com Google</span>
        </button>

        {/* Bottom Toggle */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
              setSuccess(null);
            }}
            className="text-xs text-brand-pink hover:text-brand-pink-hover font-semibold underline underline-offset-4 cursor-pointer"
          >
            {isRegistering 
              ? 'Já possui cadastro? Faça Login' 
              : 'Não tem login? Solicitar Cadastro'}
          </button>
        </div>

      </div>
    </div>
  );
}
