/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  MessageSquare,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db, hasConfig } from './lib/firebase';
import { supabase, dbSupabase, mapDbToProduct, mapDbToSale, getFormattedSupabaseError } from './lib/supabase';

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
import { ChangePassword } from './components/ChangePassword';

import { Product, Sale, StoreInfo } from './types';
import { defaultProducts, defaultSales, defaultStoreInfo } from './defaultData';
import { playAppSound, getIsAudioMuted, setAudioMuted } from './lib/audio';

export default function App() {
  // 1. Custom Secure Credentials Auth State
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [userStatus, setUserStatus] = useState<'loading' | 'unauthenticated' | 'pending' | 'approved' | 'rejected'>('loading');

  const isAdmin = firebaseUser?.email === 'oxentefesteje@gmail.com' || firebaseUser?.email === 'abraaoapp@oxente.com' || firebaseUser?.id === 'abraaoapp' || firebaseUser?.role === 'admin';

  // 2. Core Persistent State
  const [products, setProducts] = useState<Product[]>([]);
  const pendingStockUpdates = useRef<Record<string, number>>({});
  const pendingProducts = useRef<Record<string, Product>>((() => {
    try {
      const saved = localStorage.getItem('oxente_pending_products');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  })());
  const [sales, setSales] = useState<Sale[]>([]);

  const addPendingProduct = (product: Product) => {
    const updated = { ...pendingProducts.current, [product.id]: product };
    pendingProducts.current = updated;
    localStorage.setItem('oxente_pending_products', JSON.stringify(updated));
  };

  const removePendingProduct = (id: string) => {
    const updated = { ...pendingProducts.current };
    delete updated[id];
    pendingProducts.current = updated;
    localStorage.setItem('oxente_pending_products', JSON.stringify(updated));
  };
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(defaultStoreInfo);
  const [activeTab, setActiveTab] = useState<'vendas' | 'a_receber' | 'entregas' | 'estoque' | 'cadastro' | 'configuracoes' | 'usuarios' | 'auditoria' | 'lembretes' | 'pedidos_fechados' | 'whatsapp_web'>(() => {
    const saved = localStorage.getItem('oxente_active_tab');
    const allowedTabs = ['vendas', 'a_receber', 'entregas', 'estoque', 'cadastro', 'configuracoes', 'usuarios', 'auditoria', 'lembretes', 'pedidos_fechados', 'whatsapp_web'];
    return (allowedTabs.includes(saved || '') ? saved : 'vendas') as any;
  });
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
    return sales.filter(s => s.dataRetirada === todayStr && s.statusProducao !== 'Entregue' && s.status !== 'Concluído' && s.status !== 'Orçamento').length;
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

  // Monitor Authentication State (Custom Code-Based Authenticated User)
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const checkLocalAuth = () => {
      // Clean up previous Firestore listener if exists
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      const savedUserStr = localStorage.getItem('oxente_custom_user');
      if (savedUserStr) {
        try {
          const userObj = JSON.parse(savedUserStr);
          const userIdNormal = userObj.id || userObj.uid || '';

          if (db && hasConfig && userIdNormal) {
            // Read Firestore real-time snaps for this user
            const userDocRef = doc(db, 'users', userIdNormal);
            unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
              if (docSnap.exists()) {
                const uData = docSnap.data();
                const enhancedUser = {
                  ...userObj,
                  id: uData.id || userIdNormal,
                  uid: uData.id || userIdNormal,
                  name: uData.name || userObj.name || 'Colaborador',
                  displayName: uData.name || userObj.name || 'Colaborador',
                  email: uData.email || userObj.email || '',
                  role: uData.role || (uData.id === 'abraaoapp' ? 'admin' : 'colaborador'),
                  status: uData.status || 'approved'
                };
                setFirebaseUser(enhancedUser);

                const statusValue = uData.status || 'approved';
                if (statusValue === 'approved') {
                  setUserStatus('approved');
                } else if (statusValue === 'rejected') {
                  setUserStatus('rejected');
                } else {
                  setUserStatus('pending');
                }
              } else {
                // Not found on DB yet - use local details
                setFirebaseUser(userObj);
                setUserStatus(userObj.status || 'approved');
              }
            }, (err) => {
              console.error('Error fetching real-time snapshot status:', err);
              setFirebaseUser(userObj);
              setUserStatus(userObj.status || 'approved');
            });
          } else {
            // Local offline fallback
            setFirebaseUser(userObj);
            setUserStatus('approved');
          }
        } catch (e) {
          setFirebaseUser(null);
          setUserStatus('unauthenticated');
        }
      } else {
        setFirebaseUser(null);
        setUserStatus('unauthenticated');
      }
    };

    checkLocalAuth();
    window.addEventListener('oxente_auth_change', checkLocalAuth);

    return () => {
      window.removeEventListener('oxente_auth_change', checkLocalAuth);
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  // Online heartbeat and status synchronization with Firestore
  useEffect(() => {
    const uid = firebaseUser?.id || firebaseUser?.uid;
    if (!uid || !db || !hasConfig) return;

    const runHeartbeat = async () => {
      try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Error running online heartbeat:', err);
      }
    };

    runHeartbeat();
    const interval = setInterval(runHeartbeat, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [firebaseUser?.id, firebaseUser?.uid]);

  // Synchronize Supabase configurations dynamically through Firestore database
  useEffect(() => {
    if (!db || !hasConfig) return;

    const syncSupabaseSettings = async () => {
      try {
        const configDocRef = doc(db, 'config', 'supabase');
        const docSnap = await getDoc(configDocRef);
        
        const localUrl = localStorage.getItem('supabase_url');
        const localKey = localStorage.getItem('supabase_anon_key');
        const isDirty = localStorage.getItem('supabase_keys_dirty') === 'true';

        if (isAdmin && isDirty) {
          // Administrator manually entered keys via configuration tab -> upload to Firestore
          if (localUrl && localKey) {
            await setDoc(configDocRef, {
              url: localUrl,
              key: localKey,
              updatedAt: serverTimestamp()
            });
            localStorage.removeItem('supabase_keys_dirty');
            console.log('Sincronizados detalhes do Supabase do administrador com o Firestore.');
          }
        } else {
          // Both collaborators and administrator (on other devices/browsers) pull the keys from Firestore
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.url && data.key) {
              if (localUrl !== data.url || localKey !== data.key) {
                console.log('Nova configuração de Supabase detectada na nuvem. Atualizando localmente...');
                localStorage.setItem('supabase_url', data.url);
                localStorage.setItem('supabase_anon_key', data.key);
                localStorage.removeItem('supabase_keys_dirty');
                // Trigger reload to apply connection details globally
                window.location.reload();
              }
            }
          } else if (isAdmin && localUrl && localKey) {
            // First time running or Firestore document doesn't exist yet, bootstrap Firestore config
            await setDoc(configDocRef, {
              url: localUrl,
              key: localKey,
              updatedAt: serverTimestamp()
            });
            console.log('Inicializada configuração do Supabase no Firestore.');
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar chaves do Supabase via Firestore:', err);
      }
    };

    // Run once after auth determines role
    if (firebaseUser) {
      syncSupabaseSettings();
    }
  }, [firebaseUser, isAdmin]);

  // Load state on mount (with SWR pull from Supabase Cloud Database)
  useEffect(() => {
    // 1. Initial fast local state loading from Cache
    const cachedProducts = localStorage.getItem('oxente_products');
    const cachedSales = localStorage.getItem('oxente_sales');
    const cachedStoreInfo = localStorage.getItem('oxente_store_info');

    let loadedProducts = defaultProducts;
    let loadedSales: Sale[] = [];
    let loadedStoreInfo = defaultStoreInfo;

    if (cachedProducts) {
      loadedProducts = JSON.parse(cachedProducts);
      setProducts(loadedProducts);
    } else {
      setProducts(defaultProducts);
      localStorage.setItem('oxente_products', JSON.stringify(defaultProducts));
    }

    if (cachedSales) {
      const parsedSales = JSON.parse(cachedSales) as Sale[];
      const oneDayAgoTime = new Date().getTime() - (24 * 60 * 60 * 1000);
      const filteredSales = parsedSales.filter(s => {
        if (s.status === 'Orçamento') {
          const sTime = new Date(s.data).getTime();
          if (isNaN(sTime)) return true;
          return sTime >= oneDayAgoTime;
        }
        return true;
      });
      loadedSales = filteredSales;
      setSales(filteredSales);
      if (filteredSales.length !== parsedSales.length) {
        localStorage.setItem('oxente_sales', JSON.stringify(filteredSales));
      }
    } else {
      setSales([]);
      localStorage.setItem('oxente_sales', JSON.stringify([]));
    }

    if (cachedStoreInfo) {
      loadedStoreInfo = JSON.parse(cachedStoreInfo);
      if (!loadedStoreInfo.whatsappTemplate || !loadedStoreInfo.whatsappTemplate.includes('Josina Lessa')) {
        loadedStoreInfo.whatsappTemplate = defaultStoreInfo.whatsappTemplate;
        localStorage.setItem('oxente_store_info', JSON.stringify(loadedStoreInfo));
      }
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
          // Merge local loadedProducts or pendingProducts with database dbProds to avoid losing locally registered products
          const mergedProdsMap = new Map(dbProds.map(p => [p.id, p]));
          
          // Guarantee any pending stock updates are merged
          mergedProdsMap.forEach((p, id) => {
            const pendingStock = pendingStockUpdates.current[id];
            if (pendingStock !== undefined) {
              p.estoque = pendingStock;
            }
          });

          // Ensure pending products are merged and kept safe
          const updatedPendingObj = { ...pendingProducts.current };
          let pendingChanged = false;

          (Object.values(updatedPendingObj) as Product[]).forEach(p => {
            if (!mergedProdsMap.has(p.id)) {
              mergedProdsMap.set(p.id, p);
            } else {
              delete updatedPendingObj[p.id];
              pendingChanged = true;
            }
          });

          if (pendingChanged) {
            pendingProducts.current = updatedPendingObj;
            localStorage.setItem('oxente_pending_products', JSON.stringify(updatedPendingObj));
          }

          const mergedProds = Array.from(mergedProdsMap.values());
          setProducts(mergedProds);
          localStorage.setItem('oxente_products', JSON.stringify(mergedProds));
        } else if (dbProds && dbProds.length === 0 && loadedProducts.length > 0) {
          console.log('Populando produtos locais para o Supabase pela primeira vez...');
          await Promise.all(loadedProducts.map(p => dbSupabase.saveProduct(p)));
        }

        // Sync Sales
        if (dbSaless && dbSaless.length > 0) {
          const oneDayAgoTime = new Date().getTime() - (24 * 60 * 60 * 1000);
          const filteredSaless = dbSaless.filter(s => {
            if (s.status === 'Orçamento') {
              const sTime = new Date(s.data).getTime();
              if (isNaN(sTime)) return true;
              return sTime >= oneDayAgoTime;
            }
            return true;
          });
          setSales(filteredSaless);
          localStorage.setItem('oxente_sales', JSON.stringify(filteredSaless));
        } else if (dbSaless && dbSaless.length === 0 && loadedSales.length > 0) {
          console.log('Populando vendas locais para o Supabase pela primeira vez...');
          await Promise.all(loadedSales.map(s => dbSupabase.saveSale(s)));
        }

        // Sync Store Info
        if (dbStore) {
          if (!dbStore.whatsappTemplate || !dbStore.whatsappTemplate.includes('Josina Lessa')) {
            dbStore.whatsappTemplate = defaultStoreInfo.whatsappTemplate;
            dbSupabase.saveStoreInfo(dbStore).catch((err: any) => console.warn('Erro ao atualizar whatsappTemplate no Supabase:', err));
          }
          setStoreInfo(dbStore);
          localStorage.setItem('oxente_store_info', JSON.stringify(dbStore));
        } else if (loadedStoreInfo) {
          await dbSupabase.saveStoreInfo(loadedStoreInfo);
        }

        setSupabaseSyncStatus('synced');
        setSupabaseErrorMsg(null);

        // Executa limpeza automática de pedidos entregues há mais de 15 dias no Supabase
        dbSupabase.purgeOldDeliveredSales().catch(err => {
          console.warn('Erro silencioso ao executar autolimpeza de vendas:', err);
        });

        // Executa limpeza automática de orçamentos gerados há mais de 1 dia no Supabase
        dbSupabase.purgeOldEstimates().catch(err => {
          console.warn('Erro silencioso ao executar autolimpeza de orçamentos:', err);
        });
      } catch (err: any) {
        console.error('Falha na sincronização automatizada com Supabase:', err);
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(getFormattedSupabaseError(err.message || String(err)));
      }
    };

    syncDataWithSupabase();
  }, []);

  // Persist active tab selection to localStorage
  useEffect(() => {
    localStorage.setItem('oxente_active_tab', activeTab);
  }, [activeTab]);

  // Real-time Supabase Database Synchronisation for all users in real-time
  useEffect(() => {
    let active = true;

    const handleProductsChange = (payload: any) => {
      if (!active) return;
      const { eventType, new: newRow, old: oldRow } = payload;
      console.log('Sincronização em Tempo Real (Produtos):', eventType, payload);

      if (eventType === 'INSERT') {
        const prod = mapDbToProduct(newRow);
        // Add to pending products list to shield it from disappearing in case of DB read lag
        addPendingProduct(prod);
        setProducts((current) => {
          if (current.some(p => p.id === prod.id)) return current;
          const updated = [prod, ...current];
          localStorage.setItem('oxente_products', JSON.stringify(updated));
          return updated;
        });
      } else if (eventType === 'UPDATE') {
        const prod = mapDbToProduct(newRow);
        setProducts((current) => {
          const pendingStock = pendingStockUpdates.current[prod.id];
          const finalProd = pendingStock !== undefined ? { ...prod, estoque: pendingStock } : prod;
          const updated = current.map(p => p.id === prod.id ? finalProd : p);
          localStorage.setItem('oxente_products', JSON.stringify(updated));
          return updated;
        });
      } else if (eventType === 'DELETE') {
        const targetId = oldRow?.id || newRow?.id;
        if (targetId) {
          // Clear from pending map as we received official delete confirmation
          removePendingProduct(targetId);
          setProducts((current) => {
            const updated = current.filter(p => p.id !== targetId);
            localStorage.setItem('oxente_products', JSON.stringify(updated));
            return updated;
          });
        }
      }
    };

    const handleSalesChange = (payload: any) => {
      if (!active) return;
      const { eventType, new: newRow, old: oldRow } = payload;
      console.log('Sincronização em Tempo Real (Vendas):', eventType, payload);

      if (eventType === 'INSERT') {
        const sale = mapDbToSale(newRow);
        setSales((current) => {
          if (current.some(s => s.id === sale.id)) return current;
          const updated = [sale, ...current];
          updated.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          localStorage.setItem('oxente_sales', JSON.stringify(updated));
          return updated;
        });
      } else if (eventType === 'UPDATE') {
        const sale = mapDbToSale(newRow);
        setSales((current) => {
          const updated = current.map(s => s.id === sale.id ? sale : s);
          updated.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          localStorage.setItem('oxente_sales', JSON.stringify(updated));
          return updated;
        });
      } else if (eventType === 'DELETE') {
        const targetId = oldRow?.id || newRow?.id;
        if (targetId) {
          setSales((current) => {
            const updated = current.filter(s => s.id !== targetId);
            localStorage.setItem('oxente_sales', JSON.stringify(updated));
            return updated;
          });
        }
      }
    };

    const handleStoreChange = (payload: any) => {
      if (!active) return;
      const { eventType, new: newRow } = payload;
      console.log('Sincronização em Tempo Real (Loja):', eventType, payload);

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const updatedStore = {
          nome: newRow.nome,
          instagram: newRow.instagram || '',
          telefone: newRow.telefone || '',
          endereco: newRow.endereco || '',
          whatsappTemplate: newRow.whatsapp_template || ''
        };
        setStoreInfo(updatedStore);
        localStorage.setItem('oxente_store_info', JSON.stringify(updatedStore));
      }
    };

    // Listen to real-time event notifications from Supabase
    const productsChannel = supabase
      .channel('oxente_products_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oxente_products' }, handleProductsChange)
      .subscribe();

    const salesChannel = supabase
      .channel('oxente_sales_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oxente_sales' }, handleSalesChange)
      .subscribe();

    const storeChannel = supabase
      .channel('oxente_store_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oxente_store_info' }, handleStoreChange)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(storeChannel);
    };
  }, []);

  // Safe Multi-User Background Polling & Focus-Refocus Sync (Resolves real-time refresh lag)
  useEffect(() => {
    let intervalId: any;

    const pollCloudUpdates = async () => {
      // Direct prevention: don't call anything if tab is minimized to save API quota
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      
      try {
        const [dbProds, dbSaless, dbStore] = await Promise.all([
          dbSupabase.fetchProducts(),
          dbSupabase.fetchSales(),
          dbSupabase.fetchStoreInfo()
        ]);

        if (dbProds && dbProds.length > 0) {
          setProducts((curr) => {
            // Index the database products, applying pending stock changes
            const mergedProdsMap = new Map(dbProds.map(p => {
              const pendingStock = pendingStockUpdates.current[p.id];
              const finalProd = pendingStock !== undefined ? { ...p, estoque: pendingStock } : p;
              return [finalProd.id, finalProd];
            }));

            // Re-insert any pending new products that aren't acknowledged in the remote list yet
            let pendingChanged = false;
            const updatedPending = { ...pendingProducts.current };

            (Object.values(updatedPending) as Product[]).forEach(p => {
              if (!mergedProdsMap.has(p.id)) {
                // Keep the locally created pending product
                mergedProdsMap.set(p.id, p);
              } else {
                // Confirmed in the database! Safe to remove from pending map.
                delete updatedPending[p.id];
                pendingChanged = true;
              }
            });

            if (pendingChanged) {
              pendingProducts.current = updatedPending;
              localStorage.setItem('oxente_pending_products', JSON.stringify(updatedPending));
            }

            const mergedProds = Array.from(mergedProdsMap.values());
            const hasChanged = JSON.stringify(curr) !== JSON.stringify(mergedProds);
            
            if (hasChanged) {
              localStorage.setItem('oxente_products', JSON.stringify(mergedProds));
              return mergedProds;
            }
            return curr;
          });
        }

        if (dbSaless && dbSaless.length > 0) {
          setSales((curr) => {
            const hasChanged = JSON.stringify(curr) !== JSON.stringify(dbSaless);
            if (hasChanged) {
              localStorage.setItem('oxente_sales', JSON.stringify(dbSaless));
              return dbSaless;
            }
            return curr;
          });
        }

        if (dbStore) {
          setStoreInfo((curr) => {
            const hasChanged = JSON.stringify(curr) !== JSON.stringify(dbStore);
            if (hasChanged) {
              localStorage.setItem('oxente_store_info', JSON.stringify(dbStore));
              return dbStore;
            }
            return curr;
          });
        }
      } catch (e) {
        console.warn('Erro ao sincronizar dados em segundo plano:', e);
      }
    };

    // Poll every 30 seconds when the tab is visible
    intervalId = setInterval(pollCloudUpdates, 30000);

    // Refresh instantly whenever tab is focused/visible again
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        pollCloudUpdates();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    window.addEventListener('focus', pollCloudUpdates);

    return () => {
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      window.removeEventListener('focus', pollCloudUpdates);
    };
  }, []);

  // Guarantee that non-admin accounts are immediately kicked back from restricted/admin tabs
  useEffect(() => {
    const restrictedTabs = ['usuarios', 'a_receber', 'cadastro', 'configuracoes', 'auditoria'];
    if (restrictedTabs.includes(activeTab) && !isAdmin) {
      setActiveTab('vendas');
    }
  }, [activeTab, isAdmin]);

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
  const handleAddProduct = async (newProduct: Product): Promise<boolean> => {
    // Record in local pending products map to survive any background refreshes
    addPendingProduct(newProduct);

    const updated = [newProduct, ...products];
    saveProducts(updated);
    
    // Background sync to Supabase
    try {
      const success = await dbSupabase.saveProduct(newProduct);
      if (!success) {
        console.warn('Falha ao registrar produto no Supabase após criação.');
        return false;
      }
      return true;
    } catch (e: any) {
      console.error('Erro ao sincronizar novo produto em segundo plano:', e);
      return false;
    }
  };

  const handleUpdateStock = async (id: string, newStock: number, isInfinite?: boolean) => {
    // Record in local pending stock map
    pendingStockUpdates.current[id] = newStock;

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

    // Background sync to Supabase using fast optimized method
    try {
      await dbSupabase.updateProductStock(id, newStock, isInfinite);
    } catch (e) {
      console.warn('Erro ao sincronizar estoque em segundo plano:', e);
    } finally {
      // Clear pending state after sync completes
      delete pendingStockUpdates.current[id];
    }
  };

  const handleDeleteProduct = async (id: string) => {
    // Also remove from pending local products to prevent reviving this product
    removePendingProduct(id);

    const updated = products.filter((p) => p.id !== id);
    saveProducts(updated);

    // Background delete in Supabase
    try {
      const success = await dbSupabase.deleteProduct(id);
      if (!success) {
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(`Erro ao deletar produto do Supabase: ${getFormattedSupabaseError()}`);
      }
    } catch (e: any) {
      console.warn('Erro ao deletar produto do Supabase:', e);
      setSupabaseSyncStatus('error');
      setSupabaseErrorMsg(`Erro ao deletar produto do Supabase: ${e.message || String(e)}`);
    }
  };

  const handleRecordSale = async (newSale: Sale) => {
    const updated = [...sales, newSale];
    saveSales(updated);

    // If it is an estimate, do not deduct from product inventory stock
    if (newSale.status === 'Orçamento') {
      try {
        const success = await dbSupabase.saveSale(newSale);
        if (!success) {
          setSupabaseSyncStatus('error');
          setSupabaseErrorMsg(`Erro ao sincronizar orçamento no Supabase: ${getFormattedSupabaseError()}`);
        }
      } catch (e: any) {
        console.warn('Erro ao sincronizar orçamento no Supabase:', e);
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(`Erro ao sincronizar orçamento no Supabase: ${e.message || String(e)}`);
      }
      return;
    }

    // Atomically decrease stock for each sold item
    const itemsToDecrease = newSale.itens || [
      {
        id: `item-${newSale.produtoId}`,
        produtoId: newSale.produtoId,
        produtoNome: newSale.produtoNome,
        precoUn: newSale.precoUn,
        quantidade: newSale.quantidade,
        total: newSale.total
      }
    ];

    const productsToSync: Product[] = [];
    const updatedProducts = products.map((p) => {
      const soldItem = itemsToDecrease.find((item) => item.produtoId === p.id);
      if (soldItem && !p.estoqueInfinito) {
        const updatedProduct = {
          ...p,
          estoque: Math.max(0, p.estoque - soldItem.quantidade)
        };
        productsToSync.push(updatedProduct);
        return updatedProduct;
      }
      return p;
    });

    if (productsToSync.length > 0) {
      // Record pending local stocks to protect them
      productsToSync.forEach((p) => {
        pendingStockUpdates.current[p.id] = p.estoque;
      });

      saveProducts(updatedProducts);

      // Async update each product's stock in Supabase using the fast optimized method
      try {
        const results = await Promise.all(
          productsToSync.map(p => dbSupabase.updateProductStock(p.id, p.estoque, p.estoqueInfinito))
        );
        if (results.some(r => !r)) {
          setSupabaseSyncStatus('error');
          setSupabaseErrorMsg(`Erro ao sincronizar atualização de estoque no Supabase: ${getFormattedSupabaseError()}`);
        }
      } catch (e: any) {
        console.warn('Erro ao sincronizar estoque atualizado com o Supabase em segundo plano:', e);
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(`Erro ao sincronizar atualização de estoque no Supabase: ${e.message || String(e)}`);
      } finally {
        // Clear pending states after sync completes
        productsToSync.forEach((p) => {
          delete pendingStockUpdates.current[p.id];
        });
      }
    }

    // Background save to Supabase
    try {
      const success = await dbSupabase.saveSale(newSale);
      if (!success) {
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(`Erro ao sincronizar venda/pedido no Supabase: ${getFormattedSupabaseError()}`);
      }
    } catch (e: any) {
      console.warn('Erro ao sincronizar venda/pedido no Supabase:', e);
      setSupabaseSyncStatus('error');
      setSupabaseErrorMsg(`Erro ao sincronizar venda/pedido no Supabase: ${e.message || String(e)}`);
    }
  };

  const handleUpdateSale = async (updatedSale: Sale) => {
    const updated = sales.map((s) => (s.id === updatedSale.id ? updatedSale : s));
    saveSales(updated);

    // Background save to Supabase
    try {
      const success = await dbSupabase.saveSale(updatedSale);
      if (!success) {
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(`Erro ao sincronizar alteração de venda no Supabase: ${getFormattedSupabaseError()}`);
      }
    } catch (e: any) {
      console.warn('Erro ao sincronizar alteração de venda no Supabase:', e);
      setSupabaseSyncStatus('error');
      setSupabaseErrorMsg(`Erro ao sincronizar alteração de venda no Supabase: ${e.message || String(e)}`);
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
      setSupabaseErrorMsg(getFormattedSupabaseError(err.message || 'Erro ao sincronizar backup.'));
    }
  };

  const handleUpdateStoreInfo = async (newStoreInfo: StoreInfo) => {
    setStoreInfo(newStoreInfo);
    localStorage.setItem('oxente_store_info', JSON.stringify(newStoreInfo));

    // Async save to Supabase
    try {
      const success = await dbSupabase.saveStoreInfo(newStoreInfo);
      if (!success) {
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(`Erro ao atualizar dados da loja no Supabase: ${getFormattedSupabaseError()}`);
      }
    } catch (e: any) {
      console.warn('Erro ao atualizar dados da loja no Supabase:', e);
      setSupabaseSyncStatus('error');
      setSupabaseErrorMsg(`Erro ao atualizar dados da loja no Supabase: ${e.message || String(e)}`);
    }
  };

  const handleClearAllSales = async (): Promise<boolean> => {
    try {
      const success = await dbSupabase.clearAllSales();
      if (success) {
        setSales([]);
        localStorage.setItem('oxente_sales', JSON.stringify([]));
        return true;
      }
      return false;
    } catch (e: any) {
      console.error('Erro ao realizar limpeza de vendas:', e);
      return false;
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

  const getTabClass = (tabKey: string) => {
    return `w-full flex items-center justify-center gap-2 rounded-xl font-semibold transition-all cursor-pointer select-none whitespace-nowrap min-w-0 ${
      activeTab === tabKey
        ? 'bg-brand-pink text-black shadow-lg font-bold hover:bg-brand-pink/90'
        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-brand-pink'
    } ${
      isAdmin
        ? 'py-3.5 px-3 md:px-4 text-xs md:text-[13px] border border-zinc-800/45 shadow-sm'
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
        {isAdmin && totalFaltante > 0 && (
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
            ? 'p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 w-full' 
            : 'p-3 grid grid-cols-2 sm:grid-cols-7 gap-3 w-full'
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
 
          {isAdmin && (
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
 
          {isAdmin && (
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
 
          {isAdmin && (
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
          {isAdmin && (
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
              <span className="hidden sm:inline">Usuários</span>
              <span className="sm:hidden">Usuários</span>
            </button>
          )}
 
          {/* Exclusive Sales Audit Trails Log for Admin */}
          {isAdmin && (
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
 
          {/* User Change Password Tab */}
          <button
            onClick={() => changeTab('alterar_senha')}
            className={getTabClass('alterar_senha')}
          >
            <motion.div
              animate={activeTab === 'alterar_senha' ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <Key className="h-4 w-4 text-brand-pink" />
            </motion.div>
            <span className="hidden sm:inline">Minha Senha</span>
            <span className="sm:hidden">Senha</span>
          </button>

          {/* Quick Sign Out Action Trigger */}
          <button
            onClick={() => {
              localStorage.removeItem('oxente_local_bypass');
              localStorage.removeItem('oxente_custom_user');
              setFirebaseUser(null);
              setUserStatus('unauthenticated');
              setActiveTab('vendas');
              window.dispatchEvent(new Event('oxente_auth_change'));
              window.location.reload();
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
            {activeTab === 'cadastro' && isAdmin && (
              <ProductForm onAddProduct={handleAddProduct} />
            )}

            {activeTab === 'estoque' && (
              <StockManager
                products={products}
                onUpdateStock={handleUpdateStock}
                onDeleteProduct={handleDeleteProduct}
                isAdmin={isAdmin}
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

            {activeTab === 'a_receber' && isAdmin && (
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

            {activeTab === 'configuracoes' && isAdmin && (
              <SettingsManager
                products={products}
                sales={sales}
                storeInfo={storeInfo}
                onRestoreBackup={handleRestoreBackup}
                onUpdateStoreInfo={handleUpdateStoreInfo}
                onClearAllSales={handleClearAllSales}
                supabaseSyncStatus={supabaseSyncStatus}
                supabaseErrorMsg={supabaseErrorMsg}
              />
            )}

            {activeTab === 'usuarios' && isAdmin && (
              <UserApprovals />
            )}

            {activeTab === 'auditoria' && isAdmin && (
              <SalesAudit sales={sales} storeInfo={storeInfo} onUpdateSale={handleUpdateSale} />
            )}

            {activeTab === 'alterar_senha' && (
              <ChangePassword currentUser={firebaseUser} />
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
