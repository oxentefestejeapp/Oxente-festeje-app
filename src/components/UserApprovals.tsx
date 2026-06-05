import React, { useState, useEffect } from 'react';
import { db, OperationType, handleFirestoreError, hasConfig } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
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

  const cleanupDuplicateAbraao = async (usersList: UserProfile[]) => {
    const matching = usersList.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes('abraão') || name.includes('abraao') || email.includes('abraao') || email.includes('abraão');
    });

    if (matching.length <= 1) return;

    // Sort: newer first (biggest timestamp)
    const sorted = matching.map(u => {
      const date = u.createdAt?.toDate ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : new Date(0));
      return { ...u, parsedDate: date };
    }).sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

    const keeper = sorted[0];
    const toDelete = sorted.slice(1);

    console.log('[Abraao Cleanup] Keeping newest:', keeper.name, keeper.id, keeper.parsedDate);

    const { deleteDoc, doc } = await import('firebase/firestore');
    
    for (const delUser of toDelete) {
      try {
        console.log('[Abraao Cleanup] Deleting older duplicate:', delUser.name, delUser.id, delUser.parsedDate);
        if (db) {
          await deleteDoc(doc(db, 'users', delUser.id));
          console.log('[Abraao Cleanup] Deleted older duplicate successfully:', delUser.id);
        }
      } catch (e) {
        console.error('[Abraao Cleanup] Error deleting duplicate:', e);
      }
    }
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
    const q = query(usersCollection, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        usersList.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          role: data.role || (data.email === 'oxentefesteje@gmail.com' ? 'admin' : 'colaborador'),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      setUsers(usersList);
      setLoading(false);

      if (!cleanupTriggered.current) {
        cleanupTriggered.current = true;
        cleanupDuplicateAbraao(usersList);
      }
    }, (err) => {
      console.error(err);
      setError('Erro ao carregar lista de usuários do banco de dados.');
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'users');
      } catch (firestoreErr) {
        // Logged
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter((u, index, self) => {
    const isMatched = (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
                      (u.email || '').toLowerCase().includes(search.toLowerCase());
    if (!isMatched) return false;

    // Deduplicate by email, keeping the first occurrence (which is the most recently updated since the query is ordered by updatedAt desc)
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
            <p className="text-zinc-400">Este gerenciador requer conexão do Google Firebase para listar as contas em tempo real. Atualmente você pode visualizar seu usuário local seguro.</p>
          </div>
        </div>
      )}

      {/* Container Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-900">
        <div>
          <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-brand-pink" />
            <span>Painel de Usuários do Sistema</span>
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
          <span className="text-xs font-semibold">Sincronizando usuários...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-900 rounded-2xl text-zinc-500">
          <Lock className="h-8 w-8 mx-auto text-zinc-700 mb-3" />
          <p className="text-xs font-semibold">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredUsers.map((userProfile) => {
            const isSelf = userProfile.email === 'oxentefesteje@gmail.com';
            const isAdminRole = userProfile.role === 'admin' || isSelf;

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
                    
                    {/* Role Badges */}
                    {isAdminRole ? (
                      <span className="text-[9px] bg-brand-pink/10 border border-brand-pink/20 text-brand-pink py-0.5 px-2.5 rounded-full font-bold flex items-center gap-1">
                        <Shield className="h-2.5 w-2.5" />
                        Administrador
                      </span>
                    ) : (
                      <span className="text-[9px] bg-sky-950/40 border border-sky-900/40 text-sky-450 py-0.5 px-2.5 rounded-full font-bold flex items-center gap-1">
                        <UserCheck className="h-2.5 w-2.5" />
                        Colaborador
                      </span>
                    )}

                    {/* Online/Offline Status Indicator */}
                    {isUserOnline(userProfile) ? (
                      <span className="text-[9px] bg-emerald-950/25 border border-emerald-900/40 text-emerald-400 py-0.5 px-2.5 rounded-full font-bold flex items-center gap-1.5 animate-pulse" title="Conectado agora">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-450"></span>
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
                    <span>Registrado em: {formatDate(userProfile.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-center">
                  {isSelf && (
                    <span className="text-xxs text-zinc-500 font-medium italic border bg-zinc-950/60 border-zinc-900 px-2.5 py-1 rounded-lg">
                      Proprietário Principal
                    </span>
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
