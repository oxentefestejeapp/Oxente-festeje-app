import React, { useState, useEffect } from 'react';
import { db, OperationType, handleFirestoreError, hasConfig } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  AlertCircle, 
  Loader2,
  Calendar,
  Lock,
  Trash2
} from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
  updatedAt?: any;
}

export function UserApprovals() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const isUserOnline = (userProfile: UserProfile) => {
    if (!userProfile.updatedAt) return false;
    const date = userProfile.updatedAt.toDate ? userProfile.updatedAt.toDate() : new Date(userProfile.updatedAt);
    const diffMs = currentTime - date.getTime();
    // Consider online if active in the last 75 seconds (heartbeat is 30s)
    return diffMs < 75000;
  };

  const getLastSeenText = (userProfile: UserProfile) => {
    if (!userProfile.updatedAt) return '';
    const date = userProfile.updatedAt.toDate ? userProfile.updatedAt.toDate() : new Date(userProfile.updatedAt);
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

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    if (!hasConfig || !db) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        usersList.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      setUsers(usersList);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Erro ao carregar permissões ou usuários. Certifique-se de estar conectado com o administrador correto.');
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'users');
      } catch (firestoreErr) {
        // Logged
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (userId: string, newStatus: 'approved' | 'rejected' | 'pending') => {
    if (!hasConfig || !db) {
      setError('Operação indisponível no Modo Local Offline.');
      return;
    }
    setActionLoadingId(userId);
    setError(null);
    const docRef = doc(db, 'users', userId);
    try {
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao alterar o status do usuário: ${err.message || 'Sem permissão.'}`);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      } catch (fErr) {
        // Logged
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmDelete = window.confirm("Tem certeza que deseja excluir esta solicitação de cadastro do histórico?");
    if (!confirmDelete) return;

    if (!hasConfig || !db) {
      setError('Operação indisponível no Modo Local Offline.');
      return;
    }
    setActionLoadingId(userId);
    setError(null);
    const docRef = doc(db, 'users', userId);
    try {
      await deleteDoc(docRef);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao excluir o usuário: ${err.message || 'Sem permissão.'}`);
      try {
        handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
      } catch (fErr) {
        // Logged
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    // Firestore Timestamp conversion
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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
      
      {!hasConfig && (
        <div className="mb-6 p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300 animate-in fade-in duration-200">
          <AlertCircle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Modo Offline Local Ativo</p>
            <p className="text-zinc-400">O gerenciador de aprovações requer a ativação do Google Firebase para gerenciar usuários na nuvem. Atualmente os dados de vendas e estoque estão utilizando o armazenamento seguro local (localStorage) de seu navegador com segurança.</p>
          </div>
        </div>
      )}

      {/* Container Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-900">
        <div>
          <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-brand-pink" />
            <span>Aprovações de Cadastro</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Gerencie os usuários autorizados a acessar as informações de estoque e vendas.
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
          <span className="text-xs font-semibold">Sincronizando banco de dados...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-900 rounded-2xl text-zinc-500">
          <Lock className="h-8 w-8 mx-auto text-zinc-700 mb-3" />
          <p className="text-xs font-semibold">Nenhuma solicitação de acesso encontrada.</p>
          <p className="text-xxs text-zinc-600 mt-1">Quando novos usuários criarem contas, eles aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredUsers.map((userProfile) => {
            const isPending = userProfile.status === 'pending';
            const isApproved = userProfile.status === 'approved';
            const isRejected = userProfile.status === 'rejected';
            
            // Prevent self-demotion if the logged user is editing themselves
            const isSelf = userProfile.email === 'oxentefesteje@gmail.com';

            return (
              <div 
                key={userProfile.id}
                className="p-5 bg-zinc-900 border border-zinc-905 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-zinc-900/80"
              >
                {/* User Credentials */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate max-w-[200px]">
                      {userProfile.name}
                    </span>
                    {isSelf && (
                      <span className="text-[9px] bg-brand-pink/10 border border-brand-pink/20 text-brand-pink py-0.5 px-2 rounded-full font-bold">
                        Super Admin
                      </span>
                    )}

                    {/* Badge Status */}
                    {isApproved && (
                      <span className="text-[9px] bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 py-0.5 px-2 rounded-full font-bold flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Aprovado
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[9px] bg-amber-950/40 border border-amber-900/40 text-amber-400 py-0.5 px-2 rounded-full font-bold flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Pendente
                      </span>
                    )}
                    {isRejected && (
                      <span className="text-[9px] bg-red-950/40 border border-red-900/40 text-red-400 py-0.5 px-2 rounded-full font-bold flex items-center gap-1">
                        <XCircle className="h-2.5 w-2.5" />
                        Recusado
                      </span>
                    )}

                    {/* Online/Offline Status Indicator */}
                    {isUserOnline(userProfile) ? (
                      <span className="text-[9px] bg-emerald-950/25 border border-emerald-900/40 text-emerald-400 py-0.5 px-2.5 rounded-full font-bold flex items-center gap-1.5" title="Conectado agora">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-450 animate-pulse"></span>
                        Online
                      </span>
                    ) : (
                      <span className="text-[9px] bg-zinc-950/60 border border-zinc-850 text-zinc-500 py-0.5 px-2.5 rounded-full font-medium flex items-center gap-1.5" title="Desconectado">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-700"></span>
                        Offline {getLastSeenText(userProfile) ? `(${getLastSeenText(userProfile)})` : ''}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-zinc-400 truncate select-text">{userProfile.email}</div>

                  <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>Solicitado em: {formatDate(userProfile.createdAt)}</span>
                  </div>
                </div>

                {/* Status Toggles & Quick Notify Actions */}
                <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
                  {actionLoadingId === userProfile.id ? (
                    <div className="px-6 py-2">
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-brand-pink" />
                    </div>
                  ) : isSelf ? (
                    <span className="text-xxs text-zinc-500 font-medium italic border-zinc-850 px-2 py-1 bg-zinc-950/60 rounded-lg">
                      Sempre Autenticado
                    </span>
                  ) : (
                    <>
                      {/* Approved & Active Status Notification Actions */}

                      {/* Approved Option Toggle */}
                      {!isApproved && (
                        <button
                          onClick={() => handleUpdateStatus(userProfile.id, 'approved')}
                          className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-700/10 hover:bg-emerald-600 border border-emerald-800 hover:border-emerald-500 text-emerald-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer select-none transition-all duration-150 active:scale-95"
                          title="Aprovar Acesso"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Aprovar</span>
                        </button>
                      )}

                      {/* Reject Option Toggle */}
                      {!isRejected && (
                        <button
                          onClick={() => handleUpdateStatus(userProfile.id, 'rejected')}
                          className="flex items-center gap-1.5 py-2 px-3.5 bg-red-950/20 hover:bg-red-600 border border-red-900/50 hover:border-red-500 text-red-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer select-none transition-all duration-150 active:scale-95"
                          title="Recusar Acesso"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Recusar</span>
                        </button>
                      )}

                      {/* Restore Pending Option Toggle */}
                      {(isApproved || isRejected) && (
                        <button
                          onClick={() => handleUpdateStatus(userProfile.id, 'pending')}
                          className="flex items-center gap-1.5 py-2 px-3.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 text-zinc-400 hover:text-white rounded-xl text-xs font-medium cursor-pointer select-none transition-all duration-150"
                          title="Reverter para Pendente"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Pendente</span>
                        </button>
                      )}

                      {/* Delete requested from history */}
                      <button
                        onClick={() => handleDeleteUser(userProfile.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 border border-zinc-850 hover:border-red-900/40 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
                        title="Excluir solicitado do histórico"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
