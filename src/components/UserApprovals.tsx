import React, { useState, useEffect } from 'react';
import { dbSupabase, supabase } from '../lib/supabase';
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
  createdAt?: any;
  updatedAt?: any;
}

export function UserApprovals() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const cleanupTriggered = React.useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const isUserOnline = (userProfile: UserProfile) => {
    if (!userProfile.updatedAt) return false;
    const date = new Date(userProfile.updatedAt);
    const diffMs = currentTime - date.getTime();
    // Consider online if active in the last 75 seconds (heartbeat is 30s)
    return diffMs < 75000;
  };

  const getLastSeenText = (userProfile: UserProfile) => {
    if (!userProfile.updatedAt) return '';
    const date = new Date(userProfile.updatedAt);
    const diffMs = currentTime - date.getTime();
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) {
      return 'agora pouco';
    }
    if (diffMins < 60) {
      return `há ${diffMins} min`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `há ${diffHours}h`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays} d`;
  };

  const cleanupDuplicateAbraao = async (usersList: UserProfile[]) => {
    const matching = usersList.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes('abraão') || name.includes('abraao') || email.includes('abraao') || email.includes('abraão');
    });

    if (matching.length <= 1) return;

    // Sort: newer first (biggest timestamp)
    const sorted = matching.map(u => {
      const date = u.createdAt ? new Date(u.createdAt) : new Date(0);
      return { ...u, parsedDate: date };
    }).sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

    const keeper = sorted[0];
    const toDelete = sorted.slice(1);

    console.log('[Abraao Cleanup] Keeping newest:', keeper.name, keeper.id, keeper.parsedDate);

    for (const delUser of toDelete) {
      try {
        console.log('[Abraao Cleanup] Deleting older duplicate from Supabase:', delUser.name, delUser.id, delUser.parsedDate);
        await dbSupabase.deleteUser(delUser.id);
        console.log('[Abraao Cleanup] Deleted older duplicate successfully from Supabase:', delUser.id);
      } catch (e) {
        console.error('[Abraao Cleanup] Error deleting duplicate:', e);
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    const loadUsers = async () => {
      try {
        const list = await dbSupabase.fetchUsers();
        if (list) {
          const formattedList = list.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role || (u.email === 'oxentefesteje@gmail.com' || u.email === 'abraaoapp@oxente.com' || u.id === 'abraaoapp' ? 'admin' : 'colaborador'),
            status: u.status || 'approved',
            createdAt: u.created_at || u.createdAt || new Date().toISOString(),
            updatedAt: u.updated_at || u.updatedAt || new Date().toISOString()
          }));
          setUsers(formattedList);
          
          if (!cleanupTriggered.current) {
            cleanupTriggered.current = true;
            cleanupDuplicateAbraao(formattedList);
          }
        } else {
          setUsers([]);
        }
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError('Erro ao carregar lista de usuários do banco de dados do Supabase.');
        setLoading(false);
      }
    };

    loadUsers();

    // Subscribe to real-time changes inside table 'oxente_users'
    const channel = supabase
      .channel('oxente_users_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oxente_users' }, (payload: any) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        console.log('Real-time Users Update:', eventType, payload);
        
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          setUsers((current) => {
            const index = current.findIndex(u => u.id === newRow.id);
            const mappedUser: UserProfile = {
              id: newRow.id,
              name: newRow.name,
              email: newRow.email,
              role: newRow.role || (newRow.email === 'oxentefesteje@gmail.com' || newRow.email === 'abraaoapp@oxente.com' || newRow.id === 'abraaoapp' ? 'admin' : 'colaborador'),
              status: newRow.status || 'approved',
              createdAt: newRow.created_at || newRow.createdAt || new Date().toISOString(),
              updatedAt: newRow.updated_at || newRow.updatedAt || new Date().toISOString()
            };
            
            if (index >= 0) {
              const updated = [...current];
              updated[index] = mappedUser;
              return updated;
            } else {
              return [mappedUser, ...current];
            }
          });
        } else if (eventType === 'DELETE') {
          const targetId = oldRow?.id || newRow?.id;
          if (targetId) {
            setUsers((current) => current.filter(u => u.id !== targetId));
          }
        }
      })
      .subscribe((status) => {
        console.log('📡 [Supabase Realtime] Canal de Usuários:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredUsers = users.filter((u, index, self) => {
    // Exclude users registered by normal email (only keep system usernames ending with @oxente.com and the owner)
    const isEmailRegistered = u.email && 
                              !u.email.toLowerCase().endsWith('@oxente.com') && 
                              u.email.toLowerCase() !== 'oxentefesteje@gmail.com';
    if (isEmailRegistered) return false;

    const isMatched = (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
                      (u.email || '').toLowerCase().includes(search.toLowerCase());
    if (!isMatched) return false;

    // Deduplicate by email
    const firstIndex = self.findIndex((item) => {
      if (u.email && item.email) {
        return item.email.toLowerCase() === u.email.toLowerCase();
      }
      return (item.name || '').toLowerCase() === (u.name || '').toLowerCase();
    });

    return firstIndex === index;
  });

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
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
            <span>Painel de Usuários do Sistema (Supabase Cloud Sync)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Lista de contas registradas e status de conexão online/offline de colaboradores em tempo real.
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
            className="w-full bg-zinc-900 border border-zinc-850 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs rounded-xl py-2.5 pl-9 pr-4 outline-none transition-all placeholder:text-zinc-600 text-white"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-900/60 rounded-2xl flex items-start gap-2.5 text-xs text-red-300">
          <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin text-brand-pink" />
          <span className="text-xs font-semibold">Sincronizando usuários via Supabase...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-900 rounded-2xl text-zinc-500">
          <Lock className="h-8 w-8 mx-auto text-zinc-700 mb-3" />
          <p className="text-xs font-semibold">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredUsers.map((userProfile) => {
            const isSelf = userProfile.email === 'oxentefesteje@gmail.com' || userProfile.email === 'abraaoapp@oxente.com' || userProfile.id === 'abraaoapp';
            const isAdminRole = userProfile.role === 'admin' || isSelf;
            const currentStatus = userProfile.status || 'approved';

            const statusLabelMap: any = {
              'approved': { text: 'Aprovado', style: 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30' },
              'pending': { text: 'Pendente', style: 'bg-amber-950/30 text-amber-400 border border-amber-900/30' },
              'rejected': { text: 'Recusado', style: 'bg-red-950/30 text-red-400 border border-red-900/30' }
            };

            const statusInfo = statusLabelMap[currentStatus] || { text: currentStatus, style: 'bg-zinc-800 text-zinc-400' };

            return (
              <div 
                key={userProfile.id}
                className="p-5 bg-zinc-900 border border-zinc-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-zinc-900/80"
              >
                {/* User Credentials */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate max-w-[200px]">
                      {userProfile.name}
                    </span>
                    
                    {/* Role Badges */}
                    {isAdminRole ? (
                      <span className="text-[9px] bg-brand-pink/10 border border-brand-pink/20 text-brand-pink py-0.5 px-2.5 rounded-full font-bold flex items-center gap-1">
                        <Shield className="h-2.5 w-2.5" />
                        Administrador
                      </span>
                    ) : (
                      <span className="text-[9px] bg-sky-950/40 border border-sky-900/40 text-sky-400 py-0.5 px-2.5 rounded-full font-bold flex items-center gap-1">
                        <UserCheck className="h-2.5 w-2.5" />
                        Colaborador
                      </span>
                    )}

                    {/* Status Badge */}
                    <span className={`text-[9px] py-0.5 px-2.5 rounded-full font-bold capitalize ${statusInfo.style}`}>
                      {statusInfo.text}
                    </span>

                    {/* Online/Offline Status Indicator */}
                    {isUserOnline(userProfile) ? (
                      <span className="text-[9px] bg-emerald-950/25 border border-emerald-900/40 text-emerald-400 py-0.5 px-2.5 rounded-full font-bold flex items-center gap-1.5 animate-pulse" title="Conectado agora">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        Online
                      </span>
                    ) : (
                      <span className="text-[9px] bg-zinc-950/60 border border-zinc-800 text-zinc-500 py-0.5 px-2.5 rounded-full font-medium flex items-center gap-1.5" title="Desconectado">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-700"></span>
                        Offline {getLastSeenText(userProfile) ? `(${getLastSeenText(userProfile)})` : ''}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-zinc-400 truncate select-text">
                    {userProfile.email?.endsWith('@oxente.com') ? `Login: ${userProfile.email.split('@')[0]}` : `E-mail: ${userProfile.email}`}
                  </div>

                  <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>Registrado em: {formatDate(userProfile.createdAt)}</span>
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
                          onClick={async () => {
                            try {
                              const ok = await dbSupabase.updateUserStatus(userProfile.id, 'approved');
                              if (ok) {
                                setUsers(prev => prev.map(u => u.id === userProfile.id ? { ...u, status: 'approved' } : u));
                              }
                            } catch (e) {
                              console.error('Error approving user:', e);
                            }
                          }}
                          className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-emerald-200 text-xxs font-bold px-3 py-1.5 rounded-xl border border-emerald-800/50 cursor-pointer transition-all"
                        >
                          Aprovar
                        </button>
                      )}

                      {currentStatus !== 'rejected' && (
                        <button
                          onClick={async () => {
                            try {
                              const ok = await dbSupabase.updateUserStatus(userProfile.id, 'rejected');
                              if (ok) {
                                setUsers(prev => prev.map(u => u.id === userProfile.id ? { ...u, status: 'rejected' } : u));
                              }
                            } catch (e) {
                              console.error('Error rejecting user:', e);
                            }
                          }}
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
