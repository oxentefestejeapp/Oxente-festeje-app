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
  Key,
  Smartphone,
  CalendarCheck,
  RefreshCw,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, dbSupabase, mapDbToProduct, mapDbToSale, getFormattedSupabaseError, getSupabaseConfig, isUsersTableSupported } from './lib/supabase';

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
import { dispatchNewOrderNotification, dispatchOrderEditedNotification } from './lib/notifications';
import { WhatsAppWebTab } from './components/WhatsAppWebTab';
import { ChangePassword } from './components/ChangePassword';
import InstallAppTab from './components/InstallAppTab';
import { SchedulingManager } from './components/SchedulingManager';

import { Product, Sale, StoreInfo } from './types';
import { defaultProducts, defaultSales, defaultStoreInfo } from './defaultData';
import { playAppSound, getIsAudioMuted, setAudioMuted } from './lib/audio';

export default function App() {
  // 1. Custom Secure Credentials Auth State
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [userStatus, setUserStatus] = useState<'loading' | 'unauthenticated' | 'pending' | 'approved' | 'rejected'>('loading');

  const isAdmin = firebaseUser?.email === 'oxentefesteje@gmail.com' || firebaseUser?.email === 'abraaoapp@oxente.com' || firebaseUser?.id === 'abraaoapp' || firebaseUser?.role === 'admin';

  const isAdminRef = useRef(false);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  const isAnaClara = firebaseUser?.id === 'ana_clara' || 
                     firebaseUser?.email === 'anaclara@oxente.com' || 
                     (firebaseUser?.name && firebaseUser.name.toLowerCase().includes('ana clara')) || 
                     (firebaseUser?.displayName && firebaseUser.displayName.toLowerCase().includes('ana clara'));

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

  const productsRef = useRef<Product[]>([]);
  const salesRef = useRef<Sale[]>([]);
  const currentUserEmailRef = useRef<string>('');
  const userChannelRef = useRef<any>(null);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    salesRef.current = sales;
  }, [sales]);

  useEffect(() => {
    currentUserEmailRef.current = firebaseUser?.email || '';
  }, [firebaseUser]);

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
  const [activeTab, setActiveTab] = useState<'vendas' | 'a_receber' | 'entregas' | 'agendamento' | 'estoque' | 'cadastro' | 'configuracoes' | 'usuarios' | 'auditoria' | 'lembretes' | 'pedidos_fechados' | 'whatsapp_web' | 'instalar_app'>(() => {
    const saved = localStorage.getItem('oxente_active_tab');
    const allowedTabs = ['vendas', 'a_receber', 'entregas', 'agendamento', 'estoque', 'cadastro', 'configuracoes', 'usuarios', 'auditoria', 'lembretes', 'pedidos_fechados', 'whatsapp_web', 'instalar_app'];
    return (allowedTabs.includes(saved || '') ? saved : 'vendas') as any;
  });
  const [preselectedSaleId, setPreselectedSaleId] = useState<string | null>(null);

  // 3. Supabase Sync Status State
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error' | 'tables_missing'>('idle');
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string | null>(null);

  const [isForceUpdating, setIsForceUpdating] = useState(false);
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

  // Redirect unallowed users who try to access the install tab
  useEffect(() => {
    if (activeTab === 'instalar_app' && !isAnaClara && !isAdmin) {
      setActiveTab('vendas');
    }
  }, [activeTab, isAnaClara, isAdmin]);

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

  // Hook to calculate out-of-stock and critical stock products on the central page
  const criticalStockBannerData = React.useMemo(() => {
    const outOfStock = products.filter(p => p && !p.estoqueInfinito && p.estoque === 0);
    const lowStock = products.filter(p => p && !p.estoqueInfinito && p.estoque > 0 && p.estoque < 3); // critical threshold (< 3)
    return {
      outOfStock,
      lowStock,
      totalAlerts: outOfStock.length + lowStock.length
    };
  }, [products]);

  // Monitor Authentication State (Custom Code-Based Authenticated User backed by Supabase Cloud)
  useEffect(() => {
    const checkLocalAuth = async () => {
      // Clean up previous Supabase channel if any
      if (userChannelRef.current) {
        if (typeof userChannelRef.current.cleanup === 'function') {
          try {
            userChannelRef.current.cleanup();
          } catch (e) {
            console.warn('Erro ao limpar canal customizado:', e);
          }
        } else {
          try {
            supabase.removeChannel(userChannelRef.current);
          } catch (e) {
            console.warn('Erro ao remover canal:', e);
          }
        }
        userChannelRef.current = null;
      }

      const savedUserStr = localStorage.getItem('oxente_custom_user');
      if (savedUserStr) {
        try {
          const userObj = JSON.parse(savedUserStr);
          const userIdNormal = userObj.id || userObj.uid || '';
          if (userIdNormal) {
            // First load user details directly from Supabase
            const loadProfile = async () => {
              try {
                if (isUsersTableSupported) {
                  const { data, error } = await supabase.from('oxente_users').select('*').eq('id', userIdNormal).maybeSingle();
                  if (data && !error) {
                    const enhancedUser = {
                      ...userObj,
                      id: data.id,
                      uid: data.id,
                      name: data.name || userObj.name || 'Colaborador',
                      displayName: data.name || userObj.name || 'Colaborador',
                      email: data.email || userObj.email || '',
                      role: data.role || (data.id === 'abraaoapp' ? 'admin' : 'colaborador'),
                      status: data.status || 'approved'
                    };
                    setFirebaseUser(enhancedUser);
                    setUserStatus((data.status || 'approved') as any);
                    return;
                  }
                }

                // Fallback: Not found in database, table not supported, or database error
                await dbSupabase.saveUser({
                  id: userIdNormal,
                  name: userObj.name || 'Colaborador',
                  email: userObj.email || '',
                  role: userObj.role || (userIdNormal === 'abraaoapp' ? 'admin' : 'colaborador'),
                  status: userObj.status || 'approved'
                });
                setFirebaseUser(userObj);
                setUserStatus((userObj.status || 'approved') as any);
              } catch (e) {
                console.error('Error loading profile from Supabase:', e);
                setFirebaseUser(userObj);
                setUserStatus((userObj.status || 'approved') as any);
              }
            };

            await loadProfile();

            if (isUsersTableSupported) {
              // Set up real-time postgres single-row changes listener for this user
              let syncChannel: any = null;
              let syncReconnectTimer: any = null;
              let syncActive = true;

              const subscribeUserSync = () => {
                if (!syncActive) return;
                if (syncChannel) {
                  supabase.removeChannel(syncChannel);
                }

                syncChannel = supabase
                  .channel(`user-sync-${userIdNormal}`)
                  .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'oxente_users', 
                    filter: `id=eq.${userIdNormal}` 
                  }, (payload) => {
                    const { eventType, new: newRow } = payload;
                    if (eventType === 'INSERT' || eventType === 'UPDATE') {
                      const enhancedUser = {
                        ...userObj,
                        id: newRow.id,
                        uid: newRow.id,
                        name: newRow.name || userObj.name || 'Colaborador',
                        displayName: newRow.name || userObj.name || 'Colaborador',
                        email: newRow.email || userObj.email || '',
                        role: newRow.role || (newRow.id === 'abraaoapp' ? 'admin' : 'colaborador'),
                        status: newRow.status || 'approved'
                      };
                      setFirebaseUser(enhancedUser);
                      setUserStatus((newRow.status || 'approved') as any);
                    }
                  })
                  .subscribe((status, err) => {
                    console.log(`📡 [Supabase Realtime] Canal de Sincronização do Usuário (${userIdNormal}):`, status, err || '');
                    if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                      console.warn(`🔄 Canal de Sync do Usuário (${userIdNormal}) encerrado (${status}). Tentando reconectar em 4 segundos...`);
                      clearTimeout(syncReconnectTimer);
                      syncReconnectTimer = setTimeout(() => {
                        if (syncActive) subscribeUserSync();
                      }, 4000);
                    } else if (status === 'SUBSCRIBED') {
                      clearTimeout(syncReconnectTimer);
                    }
                  });

                userChannelRef.current = {
                  channel: syncChannel,
                  cleanup: () => {
                    syncActive = false;
                    clearTimeout(syncReconnectTimer);
                    supabase.removeChannel(syncChannel);
                  }
                };
              };

              subscribeUserSync();
            }
          } else {
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
      if (userChannelRef.current) {
        if (typeof userChannelRef.current.cleanup === 'function') {
          try {
            userChannelRef.current.cleanup();
          } catch (e) {
            console.warn('Erro ao limpar canal no encerramento:', e);
          }
        } else {
          try {
            supabase.removeChannel(userChannelRef.current);
          } catch (e) {
            console.warn('Erro ao remover canal no encerramento:', e);
          }
        }
        userChannelRef.current = null;
      }
    };
  }, []);

  // Online heartbeat and status synchronization with Supabase Cloud
  useEffect(() => {
    const uid = firebaseUser?.id || firebaseUser?.uid;
    if (!uid) return;

    const runHeartbeat = async () => {
      try {
        await dbSupabase.updateUserHeartbeat(uid);
      } catch (err) {
        console.error('Error running online heartbeat on Supabase:', err);
      }
    };

    runHeartbeat();
    const interval = setInterval(runHeartbeat, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [firebaseUser?.id, firebaseUser?.uid]);

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
        const fetchedData = await Promise.all([
          dbSupabase.fetchProducts(),
          dbSupabase.fetchSales(),
          dbSupabase.fetchStoreInfo()
        ]);
        let dbProds = fetchedData[0];
        let dbSaless = fetchedData[1];
        let dbStore = fetchedData[2];

        // Sync Products
        if (dbProds) {
          // Identify local-only products (present locally but not on the server) to upload them and prevent losing newly registered products
          const serverProductIds = new Set(dbProds.map(p => p.id));
          const localOnlyProducts = loadedProducts.filter(p => p && p.id && !serverProductIds.has(p.id));

          if (localOnlyProducts.length > 0) {
            console.log(`📤 Encontrados ${localOnlyProducts.length} produtos locais/offline. Fazendo upload automático para a nuvem compartilhada...`);
            await Promise.all(
              localOnlyProducts.map(async (p) => {
                try {
                  await dbSupabase.saveProduct(p);
                } catch (e) {
                  console.warn(`Erro ao fazer upload automático de produto local ${p.id}:`, e);
                }
              })
            );
            const refreshedDbProds = await dbSupabase.fetchProducts();
            if (refreshedDbProds) {
              dbProds = refreshedDbProds;
            }
          }
        }

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
        if (dbSaless) {
          const oneDayAgoTime = new Date().getTime() - (24 * 60 * 60 * 1000);
          
          // Identify local-only sales (present locally but not on the server) to upload them and prevent losing offline orders.
          // CRITICAL: Only treat them as local-only offline orders if they are explicitly marked as pendingSync.
          // This prevents deleted sales from being resurrected/uploaded back to the server!
          const serverSalesIds = new Set(dbSaless.map(s => s.id));
          const localOnlySales = loadedSales.filter(s => s && s.id && s.pendingSync && !serverSalesIds.has(s.id));

          if (localOnlySales.length > 0) {
            console.log(`📤 Encontrados ${localOnlySales.length} pedidos locais/offline pendentes de envio. Fazendo upload automático para a nuvem compartilhada...`);
            await Promise.all(
              localOnlySales.map(async (sale) => {
                try {
                  const success = await dbSupabase.saveSale(sale);
                  if (success) {
                    sale.pendingSync = false;
                  }
                } catch (e) {
                  console.warn(`Erro ao fazer upload automático de venda local ${sale.id}:`, e);
                }
              })
            );
            const refreshedDbSales = await dbSupabase.fetchSales();
            if (refreshedDbSales) {
              dbSaless = refreshedDbSales;
            }
          }

          // Maintain local safety: keep local-only sales in the final list if they aren't on the server yet and are pending sync
          const finalServerSalesIds = new Set(dbSaless.map(s => s.id));
          const unsavedLocalSalesAtStart = loadedSales.filter(s => s && s.id && s.pendingSync && !finalServerSalesIds.has(s.id));
          
          const mergedSalesList = [...dbSaless];
          if (unsavedLocalSalesAtStart.length > 0) {
            mergedSalesList.push(...unsavedLocalSalesAtStart);
          }

          if (mergedSalesList.length > 0) {
            const filteredSaless = mergedSalesList.filter(s => {
              if (s.status === 'Orçamento') {
                const sTime = new Date(s.data).getTime();
                if (isNaN(sTime)) return true;
                return sTime >= oneDayAgoTime;
              }
              return true;
            });
            filteredSaless.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
            setSales(filteredSaless);
            localStorage.setItem('oxente_sales', JSON.stringify(filteredSaless));
          } else {
            // Se o banco de dados de vendas foi esvaziado/zerado, limpa o estado local
            // para evitar ressuscitar vendas do localStorage.
            setSales([]);
            localStorage.setItem('oxente_sales', JSON.stringify([]));
          }
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

        // Executa limpeza automática de pedidos entregues há mais de 10 dias no Supabase
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
          if (current.some(s => s.id === sale.id)) {
            const localSale = current.find(s => s.id === sale.id);
            if (localSale && localSale.updatedAt && sale.updatedAt) {
              const localTime = new Date(localSale.updatedAt).getTime();
              const serverTime = new Date(sale.updatedAt).getTime();
              if (localTime > serverTime) return current;
            }
            const updated = current.map(s => s.id === sale.id ? sale : s);
            localStorage.setItem('oxente_sales', JSON.stringify(updated));
            return updated;
          }
          const updated = [sale, ...current];
          updated.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          localStorage.setItem('oxente_sales', JSON.stringify(updated));

          // Notificar sobre novos pedidos em tempo real no celular se veio de outro usuário e o usuário logado é administrador
          const isMySale = sale.criadoPorEmail === currentUserEmailRef.current;
          if (!isMySale && isAdminRef.current) {
            dispatchNewOrderNotification(
              sale.cliente,
              sale.total,
              sale.numeroPedido,
              () => {
                setActiveTab('vendas');
              }
            );
          }

          return updated;
        });
      } else if (eventType === 'UPDATE') {
        const sale = mapDbToSale(newRow);
        setSales((current) => {
          const localSale = current.find(s => s.id === sale.id);
          // Only trigger if the manual edit timestamp (editadoEm) actually changed
          const isManualEditSaved = localSale && sale.editadoEm && sale.editadoEm !== localSale.editadoEm;

          // If local sale has a newer updatedAt, preserve local optimism and ignore this message
          if (localSale && localSale.updatedAt && sale.updatedAt) {
            const localTime = new Date(localSale.updatedAt).getTime();
            const serverTime = new Date(sale.updatedAt).getTime();
            if (localTime > serverTime) {
              return current;
            }
          }

          const updated = current.map(s => s.id === sale.id ? sale : s);
          updated.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          localStorage.setItem('oxente_sales', JSON.stringify(updated));

          // Notificar sobre pedidos editados em tempo real no celular se veio de outro usuário e foi um salvamento de edição manual
          const isMyEdit = sale.editadoPorEmail === currentUserEmailRef.current;
          const isStatusOrScheduleChangeOnly = localSale && (
            (sale.statusProducao !== localSale.statusProducao) ||
            (sale.turnoEntrega !== localSale.turnoEntrega) ||
            (sale.dataRetirada !== localSale.dataRetirada) ||
            (sale.status !== localSale.status)
          );

          if (!isMyEdit && isManualEditSaved && !isStatusOrScheduleChangeOnly && isAdminRef.current) {
            dispatchOrderEditedNotification(
              sale.cliente,
              sale.total,
              sale.numeroPedido,
              () => {
                setActiveTab('vendas');
              }
            );
          }

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
        if (newRow.key === 'app_version_trigger') {
          const dbTrigger = Number(newRow.nome);
          if (dbTrigger) {
            const lastProcessed = localStorage.getItem('oxente_last_reload_trigger');
            if (lastProcessed && lastProcessed !== String(dbTrigger)) {
              localStorage.setItem('oxente_last_reload_trigger', String(dbTrigger));
              localStorage.removeItem('oxente_products');
              localStorage.removeItem('oxente_sales');
              localStorage.removeItem('oxente_store_info');
              
              setIsForceUpdating(true);
              setTimeout(() => {
                window.location.reload();
              }, 2500);
            } else if (!lastProcessed) {
              localStorage.setItem('oxente_last_reload_trigger', String(dbTrigger));
            }
          }
          return;
        }

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

    // Listen to real-time event notifications from Supabase with self-healing auto-reconnect
    let productsChannel: any = null;
    let salesChannel: any = null;
    let storeChannel: any = null;
    let reconnectTimers: { [key: string]: any } = {};

    const subscribeProducts = () => {
      if (!active) return;
      if (productsChannel) {
        supabase.removeChannel(productsChannel);
      }
      
      const channelId = `oxente_products_realtime_${Math.random().toString(36).substring(2, 9)}`;
      productsChannel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oxente_products' }, handleProductsChange)
        .subscribe((status, err) => {
          console.log(`📡 [Supabase Realtime] Canal de Produtos (${channelId}): ${status}`, err || '');
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`🔄 Canal de Produtos encerrado (${status}). Tentando reconectar em 4 segundos...`);
            clearTimeout(reconnectTimers['products']);
            reconnectTimers['products'] = setTimeout(() => {
              if (active) subscribeProducts();
            }, 4000);
          } else if (status === 'SUBSCRIBED') {
            clearTimeout(reconnectTimers['products']);
          }
        });
    };

    const subscribeSales = () => {
      if (!active) return;
      if (salesChannel) {
        supabase.removeChannel(salesChannel);
      }

      const channelId = `oxente_sales_realtime_${Math.random().toString(36).substring(2, 9)}`;
      salesChannel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oxente_sales' }, handleSalesChange)
        .subscribe((status, err) => {
          console.log(`📡 [Supabase Realtime] Canal de Vendas (${channelId}): ${status}`, err || '');
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`🔄 Canal de Vendas encerrado (${status}). Tentando reconectar em 4 segundos...`);
            clearTimeout(reconnectTimers['sales']);
            reconnectTimers['sales'] = setTimeout(() => {
              if (active) subscribeSales();
            }, 4000);
          } else if (status === 'SUBSCRIBED') {
            clearTimeout(reconnectTimers['sales']);
          }
        });
    };

    const subscribeStore = () => {
      if (!active) return;
      if (storeChannel) {
        supabase.removeChannel(storeChannel);
      }

      const channelId = `oxente_store_realtime_${Math.random().toString(36).substring(2, 9)}`;
      storeChannel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oxente_store_info' }, handleStoreChange)
        .subscribe((status, err) => {
          console.log(`📡 [Supabase Realtime] Canal da Loja (${channelId}): ${status}`, err || '');
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`🔄 Canal da Loja encerrado (${status}). Tentando reconectar em 4 segundos...`);
            clearTimeout(reconnectTimers['store']);
            reconnectTimers['store'] = setTimeout(() => {
              if (active) subscribeStore();
            }, 4000);
          } else if (status === 'SUBSCRIBED') {
            clearTimeout(reconnectTimers['store']);
          }
        });
    };

    subscribeProducts();
    subscribeSales();
    subscribeStore();

    return () => {
      active = false;
      Object.values(reconnectTimers).forEach(timer => clearTimeout(timer));
      if (productsChannel) supabase.removeChannel(productsChannel);
      if (salesChannel) supabase.removeChannel(salesChannel);
      if (storeChannel) supabase.removeChannel(storeChannel);
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
      
      // Auto background upload retry of pendingSync sales
      try {
        const currentSales = salesRef.current;
        const pendingUploads = currentSales.filter(s => s && s.pendingSync);
        if (pendingUploads.length > 0) {
          console.log(`[Sync] Background upload de ${pendingUploads.length} vendas pendentes...`);
          await Promise.all(pendingUploads.map(async (sale) => {
            try {
              const success = await dbSupabase.saveSale(sale);
              if (success) {
                console.log(`[Sync] Venda ${sale.id} sincronizada com sucesso.`);
                setSales((current) => {
                  const updated = current.map(s => s.id === sale.id ? { ...s, pendingSync: false } : s);
                  localStorage.setItem('oxente_sales', JSON.stringify(updated));
                  return updated;
                });
              }
            } catch (err) {
              console.warn(`[Sync] Falha ao tentar sincronizar em background a venda ${sale.id}:`, err);
            }
          }));
        }
      } catch (e) {
        console.warn('[Sync] Erro no fluxo de upload automático em background:', e);
      }
      
      try {
        const [dbProds, dbSaless, dbStore] = await Promise.all([
          dbSupabase.fetchProducts(),
          dbSupabase.fetchSales(),
          dbSupabase.fetchStoreInfo()
        ]);

        if (dbProds) {
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

        if (dbSaless) {
          setSales((curr) => {
            // Find newly added sales that are not in our current state (curr)
            const currentIds = new Set(curr.map(s => s.id));
            const newSalesOnServer = dbSaless.filter(s => !currentIds.has(s.id));

            // To prevent a flood of notifications on first load, only alert if we already had a local list
            if (curr.length > 0) {
              // 1. Notify newly added orders (only if logged in user is admin)
              if (newSalesOnServer.length > 0) {
                newSalesOnServer.forEach(sale => {
                  const isMySale = sale.criadoPorEmail === currentUserEmailRef.current;
                  if (!isMySale && isAdminRef.current) {
                    dispatchNewOrderNotification(
                      sale.cliente,
                      sale.total,
                      sale.numeroPedido,
                      () => {
                        setActiveTab('vendas');
                      }
                    );
                  }
                });
              }

              // 2. Identify and notify about edited existing orders
              const currentSalesMap = new Map(curr.map(s => [s.id, s]));
              const editedSalesOnServer = dbSaless.filter((s: any) => {
                const localSale = currentSalesMap.get(s.id) as any;
                if (!localSale) return false;
                // Only notify if the manual edit timestamp (editadoEm) has actually changed
                const isManualEditSaved = s.editadoEm && s.editadoEm !== localSale.editadoEm;
                
                const isStatusOrScheduleChangeOnly = localSale && (
                  (s.statusProducao !== localSale.statusProducao) ||
                  (s.turnoEntrega !== localSale.turnoEntrega) ||
                  (s.dataRetirada !== localSale.dataRetirada) ||
                  (s.status !== localSale.status)
                );
                
                return isManualEditSaved && !isStatusOrScheduleChangeOnly;
              });

              if (editedSalesOnServer.length > 0) {
                editedSalesOnServer.forEach(sale => {
                  const isMyEdit = sale.editadoPorEmail === currentUserEmailRef.current;
                  if (!isMyEdit && isAdminRef.current) {
                    dispatchOrderEditedNotification(
                      sale.cliente,
                      sale.total,
                      sale.numeroPedido,
                      () => {
                        setActiveTab('vendas');
                      }
                    );
                  }
                });
              }
            }

            // Construct merged sales list dynamically comparing local vs remote updatedAt
            const localSalesMap = new Map<string, Sale>(curr.map(s => [s.id, s]));
            const typedDbSales = dbSaless as Sale[];
            
            const mergedSalesList = typedDbSales.map(serverSale => {
              const localSale = localSalesMap.get(serverSale.id);
              if (!localSale) {
                return serverSale;
              }
              
              // If local sale is pending sync, preserve local version
              if (localSale.pendingSync) {
                return localSale;
              }
              
              // If local sale has a newer updatedAt, preserve local optimism
              if (localSale.updatedAt && serverSale.updatedAt) {
                const localTime = new Date(localSale.updatedAt).getTime();
                const serverTime = new Date(serverSale.updatedAt).getTime();
                if (localTime > serverTime) {
                  return localSale;
                }
              } else if (localSale.updatedAt && !serverSale.updatedAt) {
                return localSale;
              }
              
              return serverSale;
            });
            
            // Keep local-only sales (unsaved local sales) to avoid losing offline orders.
            const nowTime = Date.now();
            const serverIds = new Set(typedDbSales.map(s => s.id));
            const unsavedLocalSales = curr.filter(s => {
              if (serverIds.has(s.id)) return false;
              if (s.pendingSync) return true; // Keep unsynced sales indefinitely until they sync successfully!
              
              // Fallback: keep anyway if created or updated in the last 15 minutes (to tolerate lag, network delay, etc)
              const createdAt = s.data ? new Date(s.data).getTime() : 0;
              const updatedAt = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
              const maxTime = Math.max(createdAt, updatedAt);
              const diffMs = nowTime - maxTime;
              return Math.abs(diffMs) < 900000; // 15 minutes (900000 ms), tolerate timezone/clock mismatch
            });
            if (unsavedLocalSales.length > 0) {
              mergedSalesList.push(...unsavedLocalSales);
            }
            
            // Keep sorting by 'data' descending
            mergedSalesList.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

            const hasChanged = JSON.stringify(curr) !== JSON.stringify(mergedSalesList);
            if (hasChanged) {
              localStorage.setItem('oxente_sales', JSON.stringify(mergedSalesList));
              return mergedSalesList;
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

    // Poll every 15 seconds when the tab is visible
    intervalId = setInterval(pollCloudUpdates, 15000);

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

    const currentProducts = productsRef.current;
    let itemToSync: Product | null = null;
    const updated = currentProducts.map((p) => {
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
      // Clear pending state after sync completes with safe buffer delay
      setTimeout(() => {
        delete pendingStockUpdates.current[id];
      }, 3000);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    // Also remove from pending local products to prevent reviving this product
    removePendingProduct(id);

    const currentProducts = productsRef.current;
    const updated = currentProducts.filter((p) => p.id !== id);
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

  const handleUpdateProduct = async (updatedProduct: Product): Promise<boolean> => {
    const currentProducts = productsRef.current;
    const updated = currentProducts.map((p) => p.id === updatedProduct.id ? updatedProduct : p);
    saveProducts(updated);

    try {
      const success = await dbSupabase.saveProduct(updatedProduct);
      if (!success) {
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(`Erro ao sincronizar atualização do produto no Supabase: ${getFormattedSupabaseError()}`);
        return false;
      }
      return true;
    } catch (e: any) {
      console.warn('Erro ao atualizar produto no Supabase:', e);
      setSupabaseSyncStatus('error');
      setSupabaseErrorMsg(`Erro ao atualizar produto no Supabase: ${e.message || String(e)}`);
      return false;
    }
  };

  const handleRecordSale = async (newSale: Sale) => {
    const stampedSale: Sale = {
      ...newSale,
      updatedAt: new Date().toISOString(),
      pendingSync: true
    };
    const currentSales = salesRef.current;
    const currentProducts = productsRef.current;

    const updated = [...currentSales, stampedSale];
    saveSales(updated);

    // If it is an estimate, do not deduct from product inventory stock
    if (stampedSale.status === 'Orçamento') {
      try {
        const success = await dbSupabase.saveSale(stampedSale);
        if (success) {
          setSales((current) => {
            const updatedSalesList = current.map(s => s.id === stampedSale.id ? { ...s, pendingSync: false } : s);
            localStorage.setItem('oxente_sales', JSON.stringify(updatedSalesList));
            return updatedSalesList;
          });
        } else {
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
    const itemsToDecrease = stampedSale.itens || [
      {
        id: `item-${stampedSale.produtoId}`,
        produtoId: stampedSale.produtoId,
        produtoNome: stampedSale.produtoNome,
        precoUn: stampedSale.precoUn,
        quantidade: stampedSale.quantidade,
        total: stampedSale.total
      }
    ];

    const productsToSync: Product[] = [];
    const updatedProducts = currentProducts.map((p) => {
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
        // Clear pending states after sync completes, giving a safe buffer for async realtime echoes
        setTimeout(() => {
          productsToSync.forEach((p) => {
            delete pendingStockUpdates.current[p.id];
          });
        }, 3000);
      }
    }

    // Background save to Supabase
    try {
      const success = await dbSupabase.saveSale(stampedSale);
      if (success) {
        setSales((current) => {
          const updatedSalesList = current.map(s => s.id === stampedSale.id ? { ...s, pendingSync: false } : s);
          localStorage.setItem('oxente_sales', JSON.stringify(updatedSalesList));
          return updatedSalesList;
        });
      } else {
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
    const stampedSale: Sale = {
      ...updatedSale,
      updatedAt: new Date().toISOString(),
      pendingSync: true
    };
    const currentSales = salesRef.current;
    const currentProducts = productsRef.current;

    // 1. Encontrar o pedido original antes da alteração usando o valor mais atualizado do ref
    const oldSale = currentSales.find((s) => s.id === stampedSale.id);

    // 2. Atualizar a lista de vendas localmente
    const updated = currentSales.map((s) => (s.id === stampedSale.id ? stampedSale : s));
    saveSales(updated);

    // 3. Se temos o pedido original, calcular as diferenças de estoque
    if (oldSale) {
      // Função auxiliar para consolidar os itens de uma venda
      const getSaleItems = (sale: Sale): { produtoId: string; quantidade: number }[] => {
        if (sale.itens && sale.itens.length > 0) {
          return sale.itens.map(item => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade || 0
          }));
        }
        if (sale.produtoId) {
          return [{
            produtoId: sale.produtoId,
            quantidade: sale.quantidade || 0
          }];
        }
        return [];
      };

      const oldItems = getSaleItems(oldSale);
      const newItems = getSaleItems(stampedSale);

      // Mapear quantidades de produtos no pedido antigo e novo
      // Nota: o estoque só é afetado se o status NÃO for 'Orçamento'
      const oldQtyMap: Record<string, number> = {};
      if (oldSale.status !== 'Orçamento') {
        oldItems.forEach(item => {
          oldQtyMap[item.produtoId] = (oldQtyMap[item.produtoId] || 0) + item.quantidade;
        });
      }

      const newQtyMap: Record<string, number> = {};
      if (stampedSale.status !== 'Orçamento') {
        newItems.forEach(item => {
          newQtyMap[item.produtoId] = (newQtyMap[item.produtoId] || 0) + item.quantidade;
        });
      }

      // Reunir todos os IDs de produtos afetados
      const affectedProductIds = new Set([
        ...Object.keys(oldQtyMap),
        ...Object.keys(newQtyMap)
      ]);

      const productsToSync: Product[] = [];
      const updatedProducts = currentProducts.map((p) => {
        if (affectedProductIds.has(p.id) && !p.estoqueInfinito) {
          const oldQty = oldQtyMap[p.id] || 0;
          const newQty = newQtyMap[p.id] || 0;
          const diff = newQty - oldQty; // se diff > 0, vendeu mais (diminuir estoque); se diff < 0, retirou itens (devolver estoque)
          
          const updatedProduct = {
            ...p,
            estoque: Math.max(0, p.estoque - diff)
          };
          productsToSync.push(updatedProduct);
          return updatedProduct;
        }
        return p;
      });

      if (productsToSync.length > 0) {
        // Registrar atualizações pendentes para proteger o estado local
        productsToSync.forEach((p) => {
          pendingStockUpdates.current[p.id] = p.estoque;
        });

        saveProducts(updatedProducts);

        // Atualizar estoque no Supabase de forma assíncrona/otimizada
        try {
          const results = await Promise.all(
            productsToSync.map(p => dbSupabase.updateProductStock(p.id, p.estoque, p.estoqueInfinito))
          );
          if (results.some(r => !r)) {
            setSupabaseSyncStatus('error');
            setSupabaseErrorMsg(`Erro ao sincronizar atualização de estoque pós alteração de pedido no Supabase: ${getFormattedSupabaseError()}`);
          }
        } catch (e: any) {
          console.warn('Erro ao restaurar/atualizar estoque no Supabase:', e);
          setSupabaseSyncStatus('error');
          setSupabaseErrorMsg(`Erro ao restaurar/atualizar estoque no Supabase: ${e.message || String(e)}`);
        } finally {
          // Mantém as atualizações de estoque pendentes protegidas de ecos de conexões por 3 segundos
          setTimeout(() => {
            productsToSync.forEach((p) => {
              delete pendingStockUpdates.current[p.id];
            });
          }, 3000);
        }
      }
    }

    // Salvamento em plano de fundo no Supabase
    try {
      const success = await dbSupabase.saveSale(stampedSale);
      if (success) {
        setSales((current) => {
          const updatedSalesList = current.map(s => s.id === stampedSale.id ? { ...s, pendingSync: false } : s);
          localStorage.setItem('oxente_sales', JSON.stringify(updatedSalesList));
          return updatedSalesList;
        });
      } else {
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(`Erro ao sincronizar alteração de venda no Supabase: ${getFormattedSupabaseError()}`);
      }
    } catch (e: any) {
      console.warn('Erro ao sincronizar alteração de venda no Supabase:', e);
      setSupabaseSyncStatus('error');
      setSupabaseErrorMsg(`Erro ao sincronizar alteração de venda no Supabase: ${e.message || String(e)}`);
    }
  };

  const handleDeleteSale = async (id: string): Promise<boolean> => {
    const currentSales = salesRef.current;
    const currentProducts = productsRef.current;

    const saleToDelete = currentSales.find((s) => s.id === id);
    if (!saleToDelete) return false;

    const updated = currentSales.filter((s) => s.id !== id);
    saveSales(updated);

    // Se não for um orçamento, devolva os itens do pedido ao estoque
    if (saleToDelete.status !== 'Orçamento') {
      const itemsToRestore = saleToDelete.itens || [
        {
          id: `item-${saleToDelete.produtoId}`,
          produtoId: saleToDelete.produtoId,
          produtoNome: saleToDelete.produtoNome,
          precoUn: saleToDelete.precoUn,
          quantidade: saleToDelete.quantidade,
          total: saleToDelete.total
        }
      ];

      const productsToSync: Product[] = [];
      const updatedProducts = currentProducts.map((p) => {
        const restoredItem = itemsToRestore.find((item) => item.produtoId === p.id);
        if (restoredItem && !p.estoqueInfinito) {
          const updatedProduct = {
            ...p,
            estoque: p.estoque + restoredItem.quantidade
          };
          productsToSync.push(updatedProduct);
          return updatedProduct;
        }
        return p;
      });

      if (productsToSync.length > 0) {
        // Registrar atualizações pendentes para proteger o estado local
        productsToSync.forEach((p) => {
          pendingStockUpdates.current[p.id] = p.estoque;
        });

        saveProducts(updatedProducts);

        // Atualizar estoque no Supabase de forma assíncrona/otimizada
        try {
          const results = await Promise.all(
            productsToSync.map(p => dbSupabase.updateProductStock(p.id, p.estoque, p.estoqueInfinito))
          );
          if (results.some(r => !r)) {
            setSupabaseSyncStatus('error');
            setSupabaseErrorMsg(`Erro ao sincronizar devolução de estoque no Supabase: ${getFormattedSupabaseError()}`);
          }
        } catch (e: any) {
          console.warn('Erro ao restaurar estoque no Supabase:', e);
          setSupabaseSyncStatus('error');
          setSupabaseErrorMsg(`Erro ao restaurar estoque no Supabase: ${e.message || String(e)}`);
        } finally {
          // Mantém pendentes protegidos de sincronizações concorrentes por 3 segundos
          setTimeout(() => {
            productsToSync.forEach((p) => {
              delete pendingStockUpdates.current[p.id];
            });
          }, 3000);
        }
      }
    }

    try {
      const success = await dbSupabase.deleteSale(id);
      if (!success) {
        setSupabaseSyncStatus('error');
        setSupabaseErrorMsg(`Erro ao excluir venda no Supabase: ${getFormattedSupabaseError()}`);
        return false;
      }
      return true;
    } catch (e: any) {
      console.warn('Erro ao excluir venda no Supabase:', e);
      setSupabaseSyncStatus('error');
      setSupabaseErrorMsg(`Erro ao excluir venda no Supabase: ${e.message || String(e)}`);
      return false;
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

  const handleForceAllUsersUpdate = async (): Promise<void> => {
    try {
      const newTrigger = Date.now();
      // Store in Supabase oxente_store_info table under key 'app_version_trigger'
      const { error } = await supabase.from('oxente_store_info').upsert({
        key: 'app_version_trigger',
        nome: String(newTrigger),
        updated_at: new Date().toISOString()
      });
      
      if (error) throw error;
      
      // Clear locally
      localStorage.setItem('oxente_last_reload_trigger', String(newTrigger));
      localStorage.removeItem('oxente_products');
      localStorage.removeItem('oxente_sales');
      localStorage.removeItem('oxente_store_info');
      
      setIsForceUpdating(true);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      console.error('Erro ao forçar atualização:', err);
      // Fallback: clear local and reload
      localStorage.removeItem('oxente_products');
      localStorage.removeItem('oxente_sales');
      localStorage.removeItem('oxente_store_info');
      window.location.reload();
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
    let activeGradient = 'bg-brand-pink text-black shadow-lg';
    
    switch (tabKey) {
      case 'vendas':
        activeGradient = 'bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-black shadow-[0_0_15px_rgba(249,115,22,0.35)]';
        break;
      case 'a_receber':
        activeGradient = 'bg-gradient-to-r from-teal-500 to-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.35)]';
        break;
      case 'entregas':
        activeGradient = 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)]';
        break;
      case 'agendamento':
        activeGradient = 'bg-gradient-to-r from-blue-500 to-sky-500 text-black shadow-[0_0_15px_rgba(14,165,233,0.35)]';
        break;
      case 'lembretes':
        activeGradient = 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.35)]';
        break;
      case 'pedidos_fechados':
        activeGradient = 'bg-gradient-to-r from-zinc-650 to-neutral-500 text-white shadow-[0_0_15px_rgba(115,115,115,0.35)]';
        break;
      case 'whatsapp_web':
        activeGradient = 'bg-gradient-to-r from-green-400 to-emerald-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.35)]';
        break;
      case 'estoque':
        activeGradient = 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.35)]';
        break;
      case 'cadastro':
        activeGradient = 'bg-gradient-to-r from-yellow-400 via-amber-550 to-orange-500 text-black shadow-[0_0_15px_rgba(217,119,6,0.35)]';
        break;
      case 'configuracoes':
        activeGradient = 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.35)]';
        break;
      case 'usuarios':
        activeGradient = 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]';
        break;
      case 'auditoria':
        activeGradient = 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-[0_0_15px_rgba(224,36,36,0.35)]';
        break;
      case 'instalar_app':
        activeGradient = 'bg-gradient-to-r from-cyan-400 to-emerald-450 text-black shadow-[0_0_15px_rgba(6,182,212,0.35)]';
        break;
    }

    return `w-full flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-300 cursor-pointer select-none whitespace-nowrap min-w-0 ${
      activeTab === tabKey
        ? `${activeGradient} scale-[1.04] border border-white/10`
        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-white hover:scale-[1.02]'
    } ${
      isAdmin
        ? 'py-3.5 px-3 md:px-4 text-xs md:text-[13px] border border-zinc-800/45 shadow-sm'
        : 'py-3.5 px-5 text-xs sm:text-sm'
    }`;
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans select-none antialiased">
      {isForceUpdating && (
        <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 text-center animate-fade-in select-none">
          <div className="bg-zinc-900 border border-brand-pink/30 rounded-2xl p-8 max-w-md shadow-2xl flex flex-col items-center">
            <RefreshCw className="h-12 w-12 text-brand-pink animate-spin mb-4" />
            <h2 className="text-xl font-display font-bold text-zinc-100 mb-2">Atualizando Oxente Festeje</h2>
            <p className="text-sm text-zinc-400">
              Sincronizando todos os dispositivos com a nuvem em tempo real...
            </p>
            <div className="mt-4 flex items-center space-x-2 bg-brand-pink/10 border border-brand-pink/20 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-brand-pink animate-ping" />
              <span className="text-xs font-mono text-brand-pink">Recarregando recursos e cache...</span>
            </div>
          </div>
        </div>
      )}
      {/* Barra superior de gradiente festivo e animado multicolorido */}
      <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-orange-500 via-yellow-400 via-emerald-500 via-blue-500 via-purple-500 to-pink-500 sticky top-0 z-50 shadow-[0_3px_15px_rgba(249,115,22,0.3)] animate-pulse" />
      
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

        {/* Dynamic Stock Level Alert Banner - Visible on Central Page */}
        {criticalStockBannerData.totalAlerts > 0 && (
          <div className="no-print mb-6 bg-amber-950/10 border border-amber-900/25 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm animate-fade-in max-w-5xl mx-auto w-full transition-all hover:border-amber-950">
            <div className="flex flex-col sm:flex-row items-start gap-4.5 w-full min-w-0">
              <div className={`p-3 rounded-xl flex items-center justify-center shrink-0 border ${
                criticalStockBannerData.outOfStock.length > 0 
                  ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                <AlertTriangle className="h-5.5 w-5.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-450 block">⚠️ ALERTA DE ESTOQUE CRÍTICO</span>
                <span className="text-sm font-extrabold text-zinc-150 block mt-1">
                  Existem <strong className="text-amber-400 font-mono text-base">{criticalStockBannerData.totalAlerts}</strong> {criticalStockBannerData.totalAlerts === 1 ? 'brinde esgotado ou com quantidade mínima' : 'brindes esgotados ou com quantidade mínima'} no estoque!
                </span>
                
                {/* Scrollable list of critical products directly in the banner */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {criticalStockBannerData.outOfStock.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => changeTab('estoque')}
                      className="inline-flex items-center gap-1.5 text-[10.5px] font-black bg-red-950/35 hover:bg-red-950/60 text-red-400 border border-red-900/30 hover:border-red-800/50 px-2.5 py-1.5 rounded-lg shrink-0 transition-all font-sans cursor-pointer uppercase tracking-wider"
                      title="Produto esgotado! Clique para gerenciar."
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                      <span className="max-w-[150px] truncate">{p.nome}</span>: <span className="font-mono font-bold text-red-300">0 un.</span>
                    </button>
                  ))}
                  {criticalStockBannerData.lowStock.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => changeTab('estoque')}
                      className="inline-flex items-center gap-1.5 text-[10.5px] font-black bg-amber-950/30 hover:bg-amber-950/55 text-amber-400 border border-amber-900/20 hover:border-amber-800/40 px-2.5 py-1.5 rounded-lg shrink-0 transition-all font-sans cursor-pointer uppercase tracking-wider"
                      title="Estoque muito baixo! Clique para gerenciar."
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span className="max-w-[150px] truncate">{p.nome}</span>: <span className="font-mono font-bold text-amber-300">{p.estoque} un.</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <button
              onClick={() => changeTab('estoque')}
              className="w-full lg:w-auto shrink-0 px-5 py-3 bg-amber-900/15 hover:bg-brand-pink text-amber-400 hover:text-black font-black border border-amber-900/25 hover:border-brand-pink rounded-xl text-xs transition-all active:scale-97 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm font-sans uppercase tracking-widest"
            >
              <span>Conferir Estoque</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        
        {/* Navigation Tabs Bar */}
        <div className={`no-print bg-zinc-900 rounded-2xl border border-zinc-800 mb-8 shadow-lg ${
          isAdmin 
            ? 'p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 w-full' 
            : 'p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 w-full'
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
            onClick={() => changeTab('agendamento')}
            className={getTabClass('agendamento')}
          >
            <motion.div
              animate={activeTab === 'agendamento' ? { scale: [1, 1.3, 1], y: [0, -3, 3, 0] } : { scale: 1, y: 0 }}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <CalendarCheck className="h-4 w-4" />
            </motion.div>
            <span className="hidden sm:inline">Agendamento</span>
            <span className="sm:hidden">Agendar</span>
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
 
          {/* Install Mobile App Tab (Hidden for Admins, visible ONLY for Ana Clara) */}
          {!isAdmin && isAnaClara && (
            <button
              onClick={() => changeTab('instalar_app')}
              className={getTabClass('instalar_app')}
            >
              <motion.div
                animate={activeTab === 'instalar_app' ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : { scale: 1, rotate: 0 }}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <Smartphone className="h-4 w-4 text-brand-pink" />
              </motion.div>
              <span className="hidden sm:inline">Instalar no Celular</span>
              <span className="sm:hidden">Instalar</span>
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
                onUpdateProduct={handleUpdateProduct}
                onAddProduct={handleAddProduct}
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
                onDeleteSale={handleDeleteSale}
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

            {activeTab === 'agendamento' && (
              <SchedulingManager
                products={products}
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
                onForceAllUsersUpdate={handleForceAllUsersUpdate}
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

            {activeTab === 'instalar_app' && !isAdmin && isAnaClara && (
              <InstallAppTab />
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
