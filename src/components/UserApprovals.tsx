import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  AlertCircle, 
  Loader2,
  Calendar,
  Lock,
  Shield,
  UserCheck
} from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'colaborador' | string;
  status?: 'pending' | 'approved' | 'rejected' | string;
  createdAt?: string;
  updatedAt?: string;
}

const INITIAL_USERS = [
  { id: 'abraaoapp', name: 'Abraão', email: 'abraaoapp@oxente.com', role: 'admin', status: 'approved', password: '65196519' },
  { id: 'juan', name: 'Juan', email: 'juan@oxente.com', role: 'colaborador', status: 'approved', password: '69app69' },
  { id: 'assis', name: 'Assis', email: 'assis@oxente.com', role: 'colaborador', status: 'approved', password: '69app69' },
  { id: 'ana_clara', name: 'Ana Clara', email: 'anaclara@oxente.com', role: 'colaborador', status: 'approved', password: '69app69' }
];

export function UserApprovals() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Set initial data and load custom users from localStorage
  useEffect(() => {
    setLoading(true);
    try {
      const savedStr = localStorage.getItem('oxente_custom_users_local');
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        setUsers(parsed);
      } else {
        localStorage.setItem('oxente_custom_users_local', JSON.stringify(INITIAL_USERS));
        setUsers(INITIAL_USERS);
      }
    } catch (e) {
      console.error('Error loading local users:', e);
      setError('Falha ao obter lista local de colaboradores.');
      setUsers(INITIAL_USERS);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateStatus = (userId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const updatedList = users.map(user => {
        if (user.id === userId) {
          return { ...user, status: newStatus, updatedAt: new Date().toISOString() };
        }
        return user;
      });
      setUsers(updatedList);
      localStorage.setItem('oxente_custom_users_local', JSON.stringify(updatedList));

      // Trigger standard auth change event to reload current session status if current user was updated
      const authEvent = new Event('oxente_auth_change');
      window.dispatchEvent(authEvent);
    } catch (e) {
      console.error('Erro ao atualizar status do usuário:', e);
      setError('Erro ao salvar alteração de status do usuário.');
    }
  };

  const isUserOnline = (userProfile: UserProfile) => {
    if (!userProfile.updatedAt) return false;
    const date = new Date(userProfile.updatedAt);
    const diffMs = currentTime - date.getTime();
    // Active in last 90 seconds
    return diffMs < 90000;
  };

  const getLastSeenText = (userProfile: UserProfile) => {
    if (!userProfile.updatedAt) return 'Não conectado recentemente';
    const date = new Date(userProfile.updatedAt);
    const diffMs = currentTime - date.getTime();
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) {
      return 'Ativo agora';
    }
    if (diffMins < 60) {
      return `Ativo há ${diffMins} min`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `Ativo há ${diffHours}h`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `Ativo há ${diffDays} d`;
  };

  const filteredUsers = users.filter((u, index, self) => {
    const isMatched = (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
                      (u.email || '').toLowerCase().includes(search.toLowerCase());
    if (!isMatched) return false;

    // Deduplicate
    const firstIndex = self.findIndex((item) => item.id === u.id);
    return firstIndex === index;
  });

  const formatDate = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl animate-in fade-in duration-200">
      
      {/* Container Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-900">
        <div>
          <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-brand-pink" />
            <span>Colaboradores Cadastrados</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Lista de colaboradores ativos do sistema, permitindo aprovação, alteração de status e controle offline seguro.
          </p>
        </div>

        {/* Filter Input */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs rounded-xl py-2.5 pl-9 pr-4 outline-none transition-all text-white placeholder:text-zinc-650"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-900/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-300">
          <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin text-brand-pink" />
          <span className="text-xs">Carregando usuários cadastrados...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-zinc-550 border border-dashed border-zinc-900 rounded-2xl">
          <p className="text-xs">Nenhum colaborador encontrado para a busca atual.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredUsers.map((userProfile) => {
            const isOnline = isUserOnline(userProfile);
            const isSelf = userProfile.id === 'abraaoapp';
            const currentStatus = userProfile.status || 'approved';

            return (
              <div 
                key={userProfile.id}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-zinc-900/40 border border-zinc-900 rounded-2xl hover:border-zinc-850 hover:bg-zinc-900/60 transition-all gap-4"
              >
                <div className="flex items-start gap-3 w-full sm:w-auto">
                  {/* Status Indicator circle aura */}
                  <div className="relative mt-1">
                    <div className="w-10 h-10 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-center shrink-0">
                      <Lock className="h-4.5 w-4.5 text-zinc-550" />
                    </div>
                    <div 
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-900 ${
                        isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
                      }`} 
                      title={isOnline ? 'Online' : 'Offline'}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-white truncate">{userProfile.name}</h3>
                      <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-850 text-brand-pink rounded-md text-[10px] font-mono tracking-tight shrink-0">
                        @{userProfile.id}
                      </span>
                      {userProfile.role === 'admin' && (
                        <span className="px-2 py-0.5 bg-brand-pink/10 border border-brand-pink/20 text-brand-pink rounded-md text-[10px] shrink-0 font-semibold flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          <span>Admin</span>
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-zinc-400 select-all truncate mt-0.5">{userProfile.email}</p>
                    
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>Sessão: {getLastSeenText(userProfile)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 shrink-0" />
                        <span className={`capitalize ${
                          currentStatus === 'approved' ? 'text-emerald-500 font-semibold' :
                          currentStatus === 'rejected' ? 'text-red-500 font-semibold' : 'text-amber-500 font-semibold'
                        }`}>
                          {currentStatus === 'approved' ? 'Aprovado' :
                           currentStatus === 'rejected' ? 'Acesso Recusado' : 'Pendente'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:self-center">
                  {isSelf ? (
                    <span className="text-xxs text-zinc-500 font-medium italic border bg-zinc-950/60 border-zinc-900 px-2.5 py-1 rounded-lg">
                      Proprietário Principal
                    </span>
                  ) : (
                    <>
                      {/* Status Action Buttons */}
                      {currentStatus !== 'approved' && (
                        <button
                          onClick={() => handleUpdateStatus(userProfile.id, 'approved')}
                          className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-emerald-200 text-xxs font-bold px-3 py-1.5 rounded-xl border border-emerald-800/50 cursor-pointer transition-all"
                        >
                          Aprovar
                        </button>
                      )}

                      {currentStatus !== 'rejected' && (
                        <button
                          onClick={() => handleUpdateStatus(userProfile.id, 'rejected')}
                          className="bg-red-950/40 hover:bg-red-950/80 text-red-400 hover:text-red-300 text-xxs font-bold px-3 py-1.5 rounded-xl border border-red-900/30 cursor-pointer transition-all"
                        >
                          Recusar
                        </button>
                      )}
                    </>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
