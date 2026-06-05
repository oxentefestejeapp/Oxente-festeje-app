import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { 
  Hourglass, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  Lock, 
  HelpCircle
} from 'lucide-react';

interface PendingApprovalProps {
  userName: string;
  userEmail: string;
  status: 'pending' | 'rejected';
}

export function PendingApproval({ userName, userEmail, status }: PendingApprovalProps) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center px-4 py-12 font-sans select-none antialiased">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
        
        {/* Subtle Decorative Aura */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink/10 rounded-full blur-3xl pointer-events-none" />
        {status === 'rejected' ? (
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-950/10 rounded-full blur-3xl pointer-events-none" />
        ) : (
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-pink/5 rounded-full blur-3xl pointer-events-none" />
        )}

        {/* Animated Rotating Status Icon */}
        <div className="inline-flex items-center justify-center p-5 bg-zinc-900/80 border border-zinc-800 rounded-2xl mb-6 shadow-inner text-brand-pink">
          {status === 'rejected' ? (
            <Lock className="h-8 w-8 text-red-400" />
          ) : (
            <Hourglass className="h-8 w-8 text-brand-pink animate-pulse" />
          )}
        </div>

        <h1 className="font-display font-bold text-2xl tracking-tight text-white mb-2">
          {status === 'rejected' ? 'Acesso Recusado' : 'Acesso Pendente'}
        </h1>
        
        <p className="text-xs text-zinc-400 mb-6 px-4">
          {status === 'rejected' 
            ? 'Infelizmente, sua solicitação de acesso foi recusada pelo administrador.'
            : 'Seu cadastro foi recebido com sucesso e está passando por análise.'}
        </p>

        {/* User identification info */}
        <div className="bg-zinc-900 border border-zinc-850/80 rounded-2xl p-4 mb-6 text-left space-y-1.5">
          <div className="text-xxs uppercase tracking-wider text-zinc-500 font-bold">Identificação do Usuário</div>
          <div className="text-sm font-semibold text-white truncate">{userName || 'Usuário Regulamentado'}</div>
          <div className="text-xs text-zinc-400 truncate">{userEmail}</div>
        </div>

        {/* Process Tracker */}
        <div className="border border-zinc-900 rounded-2xl p-5 mb-8 text-left space-y-4">
          <div className="text-xxs uppercase tracking-wider text-zinc-500 font-bold mb-1">Status da Solicitação</div>
          
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-white">1. Solicitação de Conta</div>
              <div className="text-xxs text-zinc-500">Cadastro efetuado com sucesso no sistema.</div>
            </div>
          </div>

          <div className="flex items-start gap-3 col-span-1">
            {status === 'rejected' ? (
              <CheckCircle2 className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            ) : (
              <Clock className="h-5 w-5 text-brand-pink animate-spin shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-semibold text-white">2. Análise de Segurança</div>
              <div className="text-xxs text-zinc-500">
                {status === 'rejected' 
                  ? 'O proprietário decidiu recusar este acesso.' 
                  : 'Aguardando aprovação no e-mail: oxentefesteje@gmail.com'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-zinc-700 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-zinc-500">3. Liberação do Painel</div>
              <div className="text-xxs text-zinc-600">Acesso completo ao estoque, vendas e faturamento.</div>
            </div>
          </div>
        </div>

        {status === 'rejected' && (
          <div className="text-xxs text-zinc-500 px-6 mb-8 flex justify-center items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-zinc-500" />
            <span>Fale com oxentefesteje@gmail.com se acreditar que foi um erro.</span>
          </div>
        )}

        {/* Back/Logout Action */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-zinc-900 hover:bg-zinc-850 text-white font-medium border border-zinc-850 rounded-2xl text-xs shadow-inner transition-all transform active:scale-98 cursor-pointer select-none"
        >
          <LogOut className="h-4 w-4 text-zinc-400" />
          <span>Sair ou Conectar Outra Conta</span>
        </button>

      </div>
    </div>
  );
}
