/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  Sparkles, 
  FolderPlus, 
  HelpCircle, 
  Heart, 
  Star, 
  Settings, 
  Truck, 
  Coins,
  Users,
  LogOut,
  Loader2,
  ClipboardList,
  Bell,
  ArrowRight,
  Palette,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, hasConfig } from './lib/firebase';
import { dbSupabase } from './lib/supabase';

import { Header } from './components/Header';
import { ProductForm } from './components/ProductForm';
import { StockManager } from './components/StockManager';
import { SalesManager } from './components/SalesManager';
import { SettingsManager } from './components/SettingsManager';
import { DeliveryManager } from './components/DeliveryManager';
import { ReceivablesManager } from './components/ReceivablesManager';
import { Login } from './components/Login';
import { PendingApproval } from './components/PendingApproval';
import { UserApprovals } from './components/UserApprovals';
import { SalesAudit } from './components/SalesAudit';
import { RemindersManager } from './components/RemindersManager';
import { ClosedOrdersManager } from './components/ClosedOrdersManager';
import { WhatsAppWebTab } from './components/WhatsAppWebTab';

import { Product, Sale, StoreInfo } from './types';
import { defaultProducts, defaultSales, defaultStoreInfo } from './defaultData';
import { playAppSound, getIsAudioMuted, setAudioMuted } from './lib/audio';

export default function App() {
  // 1. Firebase Auth and DB state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userStatus, setUserStatus] = useState<'loading' | 'unauthenticated' | 'pending' | 'approved' | 'rejected'>('loading');

  // 2. Core Persistent State
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(defaultStoreInfo);
  const [activeTab, setActiveTab] = useState<'vendas' | 'a_receber' | 'entregas' | 'estoque' | 'cadastro' | 'configuracoes' | 'usuarios' | 'auditoria' | 'lembretes' | 'pedidos_fechados' | 'whatsapp_web'>('vendas');
  const [preselectedSaleId, setPreselectedSaleId] = useState<string | null>(null);

  // 3. Supabase Sync Status State
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error' | 'tables_missing'>('idle');
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string | null>(null);

  const [globalMuted, setGlobalMuted] = useState(() => getIsAudioMuted());

  useEffect(() => {
    const handleMute = (e: any) => {
      setGlobalMuted(e.detail);
    };
    window.addEventListener('oxente_app_audio_mute_changed', handleMute);
    return () => {
      window.removeEventListener('oxente_app_audio_mute_changed', handleMute);
    };
  }, []);

  const toggleGlobalMute = () => {
    const nextVal = !globalMuted;
    setAudioMuted(nextVal);
    setGlobalMuted(nextVal);
    if (!nextVal) {
      setTimeout(() => playAppSound('success'), 50);
    }
  };

  const changeTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    playAppSound('click');
  };

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayRemindersCount = React.useMemo(() => {
    const todayStr = getTodayString();
    return sales.filter(s => s.dataRetirada === todayStr && s.statusProducao !== 'Entregue' && s.status !== 'Concluído').length;
  }, [sales]);

  const totalFaltante = React.useMemo(() => {
    const isSalePending = (sale: Sale) => {
      if (sale.status) {
        return sale.status === 'Pendente';
      }
      const missingValue = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - (sale.valorPago ?? sale.total));
      return missingValue > 0 || !!sale.numeroPedido;
    };
    return sales
      .filter(s => isSalePending(s))
      .reduce((acc, s) => {
        const missing = s.valorFaltante !== undefined ? s.valorFaltante : (s.total - (s.valorPago ?? 0));
        return acc + (missing > 0 ? missing : 0);
      }, 0);
  }, [sales]);

  const pendingCountForBanner = React.useMemo(() => {
    const isSalePending = (sale: Sale) => {
      if (sale.status) {
        return sale.status === 'Pendente';
      }
      const missingValue = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - (sale.valorPago ?? sale.total));
      return missingValue > 0 || !!sale.numeroPedido;
    };
    return sales.filter(s => isSalePending(s) && (s.valorFaltante !== undefined ? s.valorFaltante > 0 : (s.total - (s.valorPago ?? 0)) > 0)).length;
  }, [sales]);

  // Monitor Firebase Auth State & Permissions status
  useEffect(() => {
    const isLocalBypass = localStorage.getItem('oxente_local_bypass') === 'true';
    if (!hasConfig || !auth || isLocalBypass) {
      setFirebaseUser({
        uid: 'local-admin',
        displayName: 'Proprietário Local (Offline)',
        email: 'oxentefesteje@gmail.com',
      } as any);
      setUserStatus('approved');
      return;
    }

    let unsubDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous user snapshot listener if any exists
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (!user) {
        setFirebaseUser(null);
        setUserStatus('unauthenticated');
        return;
      }

      setFirebaseUser(user);

      // Super Admin Account gets immediate bypass and registration write
      const isAdminEmail = user.email === 'oxentefesteje@gmail.com';
      if (isAdminEmail) {
        setUserStatus('approved');
        
        try {
          await setDoc(doc(db, 'users', user.uid), {
            id: user.uid,
            name: user.displayName || 'Proprietário',
            email: user.email,
            status: 'approved',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.error('Error auto-syncing admin profile:', err);
        }
        return;
      }

      // Check registration progress for regular accounts
      const userRef = doc(db, 'users', user.uid);
      unsubDoc = onSnapshot(userRef, async (snap) => {
        if (!snap.exists()) {
          // Register user record as 'pending approval' initially in Firestore
          try {
            await setDoc(userRef, {
              id: user.uid,
              name: user.displayName || 'Novo Usuário',
              email: user.email || '',
              status: 'pending',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            setUserStatus('pending');
          } catch (err) {
            console.error('Failed to register initial pending profile:', err);
            setUserStatus('pending');
          }
        } else {
          const data = snap.data();
          const currentStatus = (data?.status || 'pending') as 'pending' | 'approved' | 'rejected';
          setUserStatus(currentStatus);
        }
      }, (err) => {
        console.error('Firestore listener for user profile permission failed:', err);
        setUserStatus('pending');
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  // Periodic online heartbeat tracking
  useEffect(() => {
    if (!firebaseUser || !db) return;

    // Run heartbeat immediately on connect
    const runHeartbeat = async () => {
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        await updateDoc(userRef, {
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Error running online heartbeat:', err);
      }
    };

    // Run once at the beginning
    runHeartbeat();

    // Run every 30 seconds to maintain online status
    const interval = setInterval(runHeartbeat, 30000);

    return () => clearInterval(interval);
  }, [firebaseUser]);

  // Load state on mount (with SWR pull from Supabase Cloud Database)
  useEffect(() => {
    // 1. Initial fast local state loading from Cache
    const cachedProducts = localStorage.getItem('oxente_products');
    const cachedSales = localStorage.getItem('oxente_sales');
    const cachedStoreInfo = localStorage.getItem('oxente_store_info');

    let loadedProducts = defaultProducts;
    let loadedSales = defaultSales;
    let loadedStoreInfo = defaultStoreInfo;

    if (cachedProducts) {
      loadedProducts = JSON.parse(cachedProducts);
      setProducts(loadedProducts);
    } else {
      setProducts(defaultProducts);
      localStorage.setItem('oxente_products', JSON.stringify(defaultProducts));
    }

    if (cachedSales) {
      loadedSales = JSON.parse(cachedSales);
      setSales(loadedSales);
    } else {
      setSales(defaultSales);
      localStorage.setItem('oxente_sales', JSON.stringify(defaultSales));
    }

    if (cachedStoreInfo) {
      loadedStoreInfo = JSON.parse(cachedStoreInfo);
      setStoreInfo(loadedStoreInfo);
    } else {
      setStoreInfo(defaultStoreInfo);
      localStorage.setItem('oxente_store_info', JSON.stringify(defaultStoreInfo));
    }

    // 2. Asynchronous remote cloud pull using SWR (Stale-While-Revalidate)
    const syncDataWithSupabase = async () => {
      setSupabaseSyncStatus('syncing');
      try {
        const testRes = await dbSupabase.testConnection();
        if (!testRes.success) {
          setSupabaseSyncStatus('error');
          setSupabaseErrorMsg(testRes.error || 'Erro ao conectar no Supabase.');
          return;
        }

        if (testRes.tablesConfigured === false) {
          setSupabaseSyncStatus('tables_missing');
          setSupabaseErrorMsg(testRes.error || 'Tabelas do aplicativo ausentes no Supabase.');
          return;
        }

        // Parallel load of remote data
        const [dbProds, dbSaless, dbStore] = await Promise.all([
          dbSupabase.fetchProducts(),
          dbSupabase.fetchSales(),
          dbSupabase.fetchStoreInfo()
        ]);

        // Sync Products
        if (dbProds && dbProds.length > 0) {
          setProducts(dbProds);
          localStorage.setItem('oxente_products', JSON.stringify(dbProds));
        } else if (dbProds && dbProds.length === 0 && loadedProducts.length > 0) {
          console.log('Populando produtos locais para o Supabase pela primeira vez...');
          await Promise.all(loadedProducts.map(p => dbSupabase.saveProduct(p)));
        }

        // Sync Sales
        if (dbSaless && dbSaless.length > 0) {
          setSales(dbSaless);
          localStorage.setItem('oxente_sales', JSON.stringify(dbSaless));
        } else if (dbSaless && dbSaless.length === 0 && loadedSales.length > 0) {
          console.log('Populando vendas locais para o Supabase pela primeira vez...');
          await Promise.all(loadedSales.map(s => dbSupabase.saveSale(s)));
        }

        // Sync Store Info
        if (dbStore) {
          setStoreInfo(dbStore);
          localStorage.setItem('oxente_store_info', JSON.stringify(dbStore));
        } else if (loadedStoreInfo) {
          await dbSupabase.saveStoreInfo(loadedStoreInfo);
        }

        setSupabaseSyncStatus('synced');
        setSupabaseErrorMsg(null);
      } catch (err: any) {
        console.error('Falha na sincronização automatizada com Supabase:', err);
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(err.message || String(err));
      }
    };

    syncDataWithSupabase();
  }, []);

  // Guarantee that non-admin accounts are immediately kicked back from restricted/admin tabs
  useEffect(() => {
    const restrictedTabs = ['usuarios', 'a_receber', 'estoque', 'cadastro', 'configuracoes', 'auditoria'];
    if (restrictedTabs.includes(activeTab) && firebaseUser?.email !== 'oxentefesteje@gmail.com') {
      setActiveTab('vendas');
    }
  }, [activeTab, firebaseUser]);

  // Synchronizers
  const saveProducts = (updatedProducts: Product[]) => {
    setProducts(updatedProducts);
    localStorage.setItem('oxente_products', JSON.stringify(updatedProducts));
  };

  const saveSales = (updatedSales: Sale[]) => {
    setSales(updatedSales);
    localStorage.setItem('oxente_sales', JSON.stringify(updatedSales));
  };

  // State mutation actions with automatic remote DB sync
  const handleAddProduct = async (newProduct: Product) => {
    const updated = [newProduct, ...products];
    saveProducts(updated);
    
    // Background sync to Supabase
    try {
      await dbSupabase.saveProduct(newProduct);
    } catch (e) {
      console.warn('Erro ao sincronizar novo produto em segundo plano:', e);
    }
  };

  const handleUpdateStock = async (id: string, newStock: number, isInfinite?: boolean) => {
    let itemToSync: Product | null = null;
    const updated = products.map((p) => {
      if (p.id === id) {
        itemToSync = { 
          ...p, 
          estoque: newStock, 
          estoqueInfinito: isInfinite !== undefined ? (isInfinite ? true : undefined) : p.estoqueInfinito 
        };
        return itemToSync;
      }
      return p;
    });
    saveProducts(updated);

    // Background sync to Supabase
    if (itemToSync) {
      try {
        await dbSupabase.saveProduct(itemToSync);
      } catch (e) {
        console.warn('Erro ao sincronizar estoque em segundo plano:', e);
      }
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const updated = products.filter((p) => p.id !== id);
    saveProducts(updated);

    // Background delete in Supabase
    try {
      await dbSupabase.deleteProduct(id);
    } catch (e) {
      console.warn('Erro ao deletar produto do Supabase:', e);
    }
  };

  const handleRecordSale = async (newSale: Sale) => {
    const updated = [...sales, newSale];
    saveSales(updated);

    // Background save to Supabase
    try {
      await dbSupabase.saveSale(newSale);
    } catch (e) {
      console.warn('Erro ao sincronizar venda/pedido no Supabase:', e);
    }
  };

  const handleUpdateSale = async (updatedSale: Sale) => {
    const updated = sales.map((s) => (s.id === updatedSale.id ? updatedSale : s));
    saveSales(updated);

    // Background save to Supabase
    try {
      await dbSupabase.saveSale(updatedSale);
    } catch (e) {
      console.warn('Erro ao sincronizar alteração de venda no Supabase:', e);
    }
  };

  const handleRestoreBackup = async (newProducts: Product[], newSales: Sale[], newStoreInfo: StoreInfo) => {
    setProducts(newProducts);
    setSales(newSales);
    setStoreInfo(newStoreInfo);
    localStorage.setItem('oxente_products', JSON.stringify(newProducts));
    localStorage.setItem('oxente_sales', JSON.stringify(newSales));
    localStorage.setItem('oxente_store_info', JSON.stringify(newStoreInfo));

    // Upload whole dataset securely to Supabase
    setSupabaseSyncStatus('syncing');
    try {
      await Promise.all([
        ...newProducts.map(p => dbSupabase.saveProduct(p)),
        ...newSales.map(s => dbSupabase.saveSale(s)),
        dbSupabase.saveStoreInfo(newStoreInfo)
      ]);
      setSupabaseSyncStatus('synced');
    } catch (err: any) {
      console.error('Falha de restauração de backup no Supabase:', err);
      setSupabaseSyncStatus('error');
      setSupabaseErrorMsg(err.message || 'Erro ao sincronizar backup.');
    }
  };

  const handleUpdateStoreInfo = async (newStoreInfo: StoreInfo) => {
    setStoreInfo(newStoreInfo);
    localStorage.setItem('oxente_store_info', JSON.stringify(newStoreInfo));

    // Async save to Supabase
    try {
      await dbSupabase.saveStoreInfo(newStoreInfo);
    } catch (e) {
      console.warn('Erro ao atualizar dados da loja no Supabase:', e);
    }
  };

  if (userStatus === 'loading') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans select-none antialiased">
        <Loader2 className="h-8 w-8 animate-spin text-brand-pink mb-4.5" />
        <p className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Carregando permissões...</p>
      </div>
    );
  }

  if (userStatus === 'unauthenticated') {
    return <Login />;
  }

  if (userStatus === 'pending' || userStatus === 'rejected') {
    return (
      <PendingApproval 
        userName={firebaseUser?.displayName || ''} 
        userEmail={firebaseUser?.email || ''} 
        status={userStatus} 
      />
    );
  }

  const isAdmin = firebaseUser?.email === 'oxentefesteje@gmail.com';

  const getTabClass = (tabKey: string) => {
    return `w-full flex items-center justify-center gap-2 rounded-xl font-semibold transition-all cursor-pointer select-none whitespace-nowrap min-w-0 ${
      activeTab === tabKey
        ? 'bg-brand-pink text-black shadow-lg font-bold hover:bg-brand-pink/90'
        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-brand-pink'
    } ${
      isAdmin
        ? 'py-3.5 px-3 md:px-4 text-[11px] md:text-xs xl:text-[13px] border border-zinc-800/45 shadow-sm'
        : 'py-3.5 px-5 text-xs sm:text-sm'
    }`;
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans select-none antialiased">
      
      {/* Real-time Header */}
      <Header products={products} sales={sales} currentUserEmail={firebaseUser?.email || ''} />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 pb-16">

        {/* Dynamic Receivables Summary Banner - Exclusive to oxentefesteje@gmail.com */}
        {firebaseUser?.email === 'oxentefesteje@gmail.com' && totalFaltante > 0 && (
          <div className="no-print mb-6 bg-red-950/10 border border-red-900/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in select-text max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center shrink-0">
                <Coins className="h-5 w-5 animate-pulse" />
              </div>
              <div className="text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-450 block">Saldos de Clientes Pendentes</span>
                <span className="text-sm font-semibold text-zinc-350 inline-flex flex-wrap items-center justify-center sm:justify-start gap-1 mt-0.5">
                  Falta receber <strong className="text-red-400 font-mono text-base">R$ {totalFaltante.toFixed(2)}</strong> em <strong className="text-zinc-200">{pendingCountForBanner}</strong> {pendingCountForBanner === 1 ? 'pedido ativo' : 'pedidos ativos'}.
                </span>
              </div>
            </div>
            
            <button
              onClick={() => changeTab('a_receber')}
              className="w-full sm:w-auto shrink-0 px-4 py-2.5 bg-red-900/15 hover:bg-brand-pink text-red-500 hover:text-black font-extrabold border border-red-900/20 hover:border-brand-pink rounded-xl text-xs transition-all active:scale-97 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Cobrar Clientes no WhatsApp</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        
        {/* Navigation Tabs Bar */}
        <div className={`no-print bg-zinc-900 rounded-2xl border border-zinc-800 mb-8 shadow-lg ${
          isAdmin 
            ? 'p-4 sm:p-5 md:p-6 pb-6 md:pb-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3.5 sm:gap-4 md:gap-5 w-full' 
            : 'p-3 grid grid-cols-2 sm:grid-cols-6 gap-3 w-full'
        }`}>
          
          <button
            onClick={() => changeTab('vendas')}
            className={getTabClass('vendas')}
          >
            <motion.div
              animate={activeTab === 'vendas' ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <TrendingUp className="h-4 w-4" />
            </motion.div>
            <span className="hidden sm:inline">Registrar Venda</span>
            <span className="sm:hidden">Venda</span>
          </button>
 
          {firebaseUser?.email === 'oxentefesteje@gmail.com' && (
            <button
              onClick={() => changeTab('a_receber')}
              className={getTabClass('a_receber')}
            >
              <motion.div
                animate={activeTab === 'a_receber' ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <Coins className="h-4 w-4" />
              </motion.div>
              <span className="hidden sm:inline">Saldos a Receber</span>
              <span className="sm:hidden">A Receber</span>
            </button>
          )}
 
          <button
            onClick={() => changeTab('entregas')}
            className={getTabClass('entregas')}
          >
            <motion.div
              animate={activeTab === 'entregas' ? { scale: [1, 1.3, 1], x: [0, 3, -3, 0] } : { scale: 1, x: 0 }}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <Truck className="h-4 w-4" />
            </motion.div>
            <span className="hidden sm:inline">Entregar Pedido</span>
            <span className="sm:hidden">Entregas</span>
          </button>
 
          <button
            onClick={() => changeTab('lembretes')}
            className={getTabClass('lembretes')}
          >
            <motion.div
              animate={activeTab === 'lembretes' ? { scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] } : { scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <Bell className="h-4 w-4" />
              {todayRemindersCount > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-red-600 text-white text-[8px] flex items-center justify-center font-bold px-0.5">
                  {todayRemindersCount}
                </span>
              )}
            </motion.div>
            <span className="hidden sm:inline">Lembretes do dia</span>
            <span className="sm:hidden">Lembretes</span>
          </button>

          <button
            onClick={() => changeTab('pedidos_fechados')}
            className={getTabClass('pedidos_fechados')}
          >
            <motion.div
              animate={activeTab === 'pedidos_fechados' ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <Palette className="h-4 w-4" />
            </motion.div>
            <span className="hidden sm:inline">Pedidos Fechados</span>
            <span className="sm:hidden">Pedidos</span>
          </button>

          <button
            onClick={() => changeTab('whatsapp_web')}
            className={getTabClass('whatsapp_web')}
          >
            <motion.div
              animate={activeTab === 'whatsapp_web' ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <MessageSquare className="h-4 w-4" />
            </motion.div>
            <span className="hidden sm:inline">WhatsApp Web</span>
            <span className="sm:hidden">Whats Web</span>
          </button>
 
          {firebaseUser?.email === 'oxentefesteje@gmail.com' && (
            <button
              onClick={() => changeTab('estoque')}
              className={getTabClass('estoque')}
            >
              <motion.div
                animate={activeTab === 'estoque' ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <Package className="h-4 w-4" />
              </motion.div>
              <span className="hidden sm:inline">Conferir Estoque</span>
              <span className="sm:hidden">Estoque</span>
            </button>
          )}
 
          {firebaseUser?.email === 'oxentefesteje@gmail.com' && (
            <button
              onClick={() => changeTab('cadastro')}
              className={getTabClass('cadastro')}
            >
              <motion.div
                animate={activeTab === 'cadastro' ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <FolderPlus className="h-4 w-4" />
              </motion.div>
              <span className="hidden sm:inline">Cadastrar Produto</span>
              <span className="sm:hidden">Cadastro</span>
            </button>
          )}
 
          {firebaseUser?.email === 'oxentefesteje@gmail.com' && (
            <button
              onClick={() => changeTab('configuracoes')}
              className={getTabClass('configuracoes')}
            >
              <motion.div
                animate={activeTab === 'configuracoes' ? { scale: [1, 1.3, 1], rotate: [0, 45, 0] } : { scale: 1, rotate: 0 }}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <Settings className="h-4 w-4" />
              </motion.div>
              <span className="hidden sm:inline">Configurações</span>
              <span className="sm:hidden">Ajustes</span>
            </button>
          )}
 
          {/* Exclusive Users Approval Dashboard for Admin */}
          {firebaseUser?.email === 'oxentefesteje@gmail.com' && (
            <button
              onClick={() => changeTab('usuarios')}
              className={getTabClass('usuarios')}
            >
              <motion.div
                animate={activeTab === 'usuarios' ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <Users className="h-4 w-4" />
              </motion.div>
              <span className="hidden sm:inline">Aprovações</span>
              <span className="sm:hidden">Usuários</span>
            </button>
          )}
 
          {/* Exclusive Sales Audit Trails Log for Admin */}
          {firebaseUser?.email === 'oxentefesteje@gmail.com' && (
            <button
              onClick={() => changeTab('auditoria')}
              className={getTabClass('auditoria')}
            >
              <motion.div
                animate={activeTab === 'auditoria' ? { scale: [1, 1.15, 1], y: [0, -2, 0] } : { scale: 1, y: 0 }}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <ClipboardList className="h-4 w-4" />
              </motion.div>
              <span className="hidden sm:inline">Auditoria</span>
              <span className="sm:hidden">Auditoria</span>
            </button>
          )}
 
          {/* Quick Sign Out Action Trigger */}
          <button
            onClick={async () => {
              const confirmExit = window.confirm('Tem certeza que deseja sair do sistema?');
              if (confirmExit) {
                localStorage.removeItem('oxente_local_bypass');
                if (auth) {
                  try {
                    await signOut(auth);
                  } catch (e) {
                    console.error('Erro de logout:', e);
                  }
                  window.location.reload();
                } else {
                  window.location.reload();
                }
              }
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all cursor-pointer text-zinc-400 hover:bg-red-950/20 hover:text-red-450 border border-transparent shadow-sm w-full shrink-0 ${
              isAdmin 
                ? 'py-3.5 px-3 md:px-4 text-[11px] md:text-xs xl:text-[13px] border-zinc-800/45 hover:border-red-900/45' 
                : 'py-3.5 px-5 text-xs sm:text-sm col-span-2 sm:col-span-1'
            }`}
            title="Sair do Sistema"
          >
            <motion.div
              whileHover={{ scale: 1.25, x: 2 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <LogOut className="h-4 w-4 text-zinc-500" />
            </motion.div>
            <span className="hidden md:inline">Sair</span>
          </button>
 
        </div>

        {/* Tab Components Render View */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
          >
            {activeTab === 'cadastro' && firebaseUser?.email === 'oxentefesteje@gmail.com' && (
              <ProductForm onAddProduct={handleAddProduct} />
            )}

            {activeTab === 'estoque' && firebaseUser?.email === 'oxentefesteje@gmail.com' && (
              <StockManager
                products={products}
                onUpdateStock={handleUpdateStock}
                onDeleteProduct={handleDeleteProduct}
              />
            )}

            {activeTab === 'vendas' && (
              <SalesManager
                products={products}
                sales={sales}
                storeInfo={storeInfo}
                onRecordSale={handleRecordSale}
                onUpdateStock={handleUpdateStock}
                onUpdateSale={handleUpdateSale}
                currentUserEmail={firebaseUser?.email || ''}
              />
            )}

            {activeTab === 'a_receber' && firebaseUser?.email === 'oxentefesteje@gmail.com' && (
              <ReceivablesManager
                sales={sales}
                storeInfo={storeInfo}
                onUpdateSale={handleUpdateSale}
                onNavigateToTab={(tab, preselectedId) => {
                  if (preselectedId) {
                    setPreselectedSaleId(preselectedId);
                  }
                  changeTab(tab as any);
                }}
              />
            )}

            {activeTab === 'entregas' && (
              <DeliveryManager
                products={products}
                sales={sales}
                storeInfo={storeInfo}
                onUpdateSale={handleUpdateSale}
                preselectedSaleId={preselectedSaleId}
                onClearPreselectedSaleId={() => setPreselectedSaleId(null)}
              />
            )}

            {activeTab === 'lembretes' && (
              <RemindersManager
                sales={sales}
                storeInfo={storeInfo}
                onUpdateSale={handleUpdateSale}
              />
            )}

            {activeTab === 'pedidos_fechados' && (
              <ClosedOrdersManager
                products={products}
                sales={sales}
                storeInfo={storeInfo}
                onUpdateSale={handleUpdateSale}
                currentUserEmail={firebaseUser?.email || ''}
              />
            )}

            {activeTab === 'whatsapp_web' && (
              <WhatsAppWebTab
                sales={sales}
                storeInfo={storeInfo}
              />
            )}

            {activeTab === 'configuracoes' && firebaseUser?.email === 'oxentefesteje@gmail.com' && (
              <SettingsManager
                products={products}
                sales={sales}
                storeInfo={storeInfo}
                onRestoreBackup={handleRestoreBackup}
                onUpdateStoreInfo={handleUpdateStoreInfo}
                supabaseSyncStatus={supabaseSyncStatus}
                supabaseErrorMsg={supabaseErrorMsg}
              />
            )}

            {activeTab === 'usuarios' && firebaseUser?.email === 'oxentefesteje@gmail.com' && (
              <UserApprovals />
            )}

            {activeTab === 'auditoria' && firebaseUser?.email === 'oxentefesteje@gmail.com' && (
              <SalesAudit sales={sales} storeInfo={storeInfo} onUpdateSale={handleUpdateSale} />
            )}
          </motion.div>
        </AnimatePresence>

      </main>

      {/* Screen Footer */}
      <footer className="no-print bg-zinc-950 border-t border-zinc-900 py-6 mt-12 text-center text-xs text-zinc-500">
        <div className="max-w-[1440px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 font-medium text-zinc-400">
            <span>Oxente Festeje</span>
            <Star className="h-3.5 w-3.5 text-brand-pink fill-brand-pink" />
            <span>Gerenciador de Vendas &amp; Estoque</span>
          </div>
          <p className="flex items-center gap-1 text-zinc-500">
            Feito para facilitar suas comemorações com amor 
            <Heart className="h-3 w-3 text-brand-pink fill-brand-pink" />
          </p>
        </div>
      </footer>

    </div>
  );
}
