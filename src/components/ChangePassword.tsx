import React, { useState } from 'react';
import { supabase, dbSupabase, isUsersTableSupported } from '../lib/supabase';
import { 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import { playAppSound } from '../lib/audio';

interface ChangePasswordProps {
  currentUser: {
    id: string;
    uid?: string;
    name: string;
    email: string;
    role: string;
  };
  onPasswordChanged?: () => void;
}

export function ChangePassword({ currentUser, onPasswordChanged }: ChangePasswordProps) {
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userId = currentUser.id || currentUser.uid || '';

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const passClean = currentPasswordInput.trim();
    const newPassClean = newPassword.trim();
    const confirmPassClean = confirmPassword.trim();

    if (!passClean || !newPassClean || !confirmPassClean) {
      setError('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }

    if (newPassClean.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      setLoading(false);
      return;
    }

    if (newPassClean !== confirmPassClean) {
      setError('A nova senha e a confirmação não coincidem.');
      setLoading(false);
      return;
    }

    if (passClean === newPassClean) {
      setError('A nova senha não pode ser igual à senha atual.');
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch user record to verify current password from Supabase
      let userRecord: any = null;

      if (isUsersTableSupported) {
        try {
          const { data, error } = await supabase.from('oxente_users').select('*').eq('id', userId).maybeSingle();
          if (data && !error) {
            userRecord = data;
          }
        } catch (dbErr) {
          console.warn('Erro ao consultar Supabase durante troca de senha:', dbErr);
        }
      }

      // If not found online, fallback to localStorage
      if (!userRecord) {
        const localUsers = localStorage.getItem('oxente_custom_users_local');
        if (localUsers) {
          const parsed = JSON.parse(localUsers);
          userRecord = parsed.find((u: any) => u.id === userId);
        }
      }

      const defaultPasswords: Record<string, string> = {
        'abraaoapp': '65196519',
        'juan': '69app69',
        'assis': '69app69',
        'ana_clara': '69app69'
      };

      const expectedCurrentPassword = userRecord?.password || defaultPasswords[userId] || '69app69';

      if (passClean !== expectedCurrentPassword) {
        setError('A senha atual está incorreta.');
        setLoading(false);
        return;
      }

      // 2. Save the updated password to Supabase
      if (isUsersTableSupported) {
        try {
          await supabase.from('oxente_users').update({
            password: newPassClean,
            updated_at: new Date().toISOString()
          }).eq('id', userId);
        } catch (dbErr) {
          console.warn('Erro ao salvar nova senha no Supabase:', dbErr);
        }
      }

      // Also support localStorage persistent sync
      const localUsers = localStorage.getItem('oxente_custom_users_local');
      let parsedLocalList = localUsers ? JSON.parse(localUsers) : [];
      
      const existsId = parsedLocalList.findIndex((u: any) => u.id === userId);
      if (existsId >= 0) {
        parsedLocalList[existsId].password = newPassClean;
      } else {
        parsedLocalList.push({
          id: userId,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          status: 'approved',
          password: newPassClean
        });
      }
      localStorage.setItem('oxente_custom_users_local', JSON.stringify(parsedLocalList));

      // Successfully updated password
      playAppSound('success');
      setSuccess('Sua senha foi alterada com sucesso!');
      setCurrentPasswordInput('');
      setNewPassword('');
      setConfirmPassword('');

      if (onPasswordChanged) {
        onPasswordChanged();
      }
    } catch (err: any) {
      console.error(err);
      setError('Ocorreu um erro ao atualizar a senha: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-zinc-950 border border-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl animate-in fade-in duration-200">
      <div className="text-center mb-6 border-b border-zinc-900 pb-5">
        <div className="inline-flex items-center justify-center p-3 bg-zinc-900 border border-zinc-850 text-brand-pink rounded-2xl mb-3 shadow-inner">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="font-display font-bold text-lg text-white">Alterar Minha Senha</h2>
        <p className="text-xs text-zinc-400 mt-1.5">
          Mantenha sua conta segura alterando sua senha de acesso abaixo. O login <strong className="text-zinc-200 select-all font-mono">@{userId}</strong> continuará o mesmo.
        </p>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-950/40 border border-red-900/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-300">
          <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-5 p-4 bg-emerald-950/45 border border-emerald-900/45 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400 block px-0.5">Senha Atual</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="password"
              value={currentPasswordInput}
              onChange={(e) => setCurrentPasswordInput(e.target.value)}
              placeholder="Digite sua senha atual"
              className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs rounded-xl py-3 pl-10 pr-4 outline-none transition-all text-white placeholder:text-zinc-650"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400 block px-0.5">Nova Senha</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs rounded-xl py-3 pl-10 pr-4 outline-none transition-all text-white placeholder:text-zinc-650"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400 block px-0.5">Confirmar Nova Senha</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs rounded-xl py-3 pl-10 pr-4 outline-none transition-all text-white placeholder:text-zinc-650"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 mt-6 py-3 px-4 bg-brand-pink hover:bg-brand-pink/90 text-black font-extrabold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-98 cursor-pointer select-none disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Atualizar Minha Senha</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
