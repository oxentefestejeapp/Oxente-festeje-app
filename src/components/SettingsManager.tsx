/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  FileText, 
  Database, 
  Package, 
  ShieldCheck, 
  Calendar, 
  Clock,
  Info, 
  LogOut, 
  RefreshCw, 
  UploadCloud, 
  Trash, 
  CheckSquare, 
  AlertCircle, 
  Loader2,
  Edit,
  Save,
  FileSpreadsheet,
  MessageSquare,
  Smartphone,
  Chrome,
  Share2,
  Sparkles,
  Cloud,
  Terminal,
  Copy,
  CheckCircle,
  Bell,
  Volume2,
  VolumeX,
  Megaphone,
  Rocket,
  Bot,
  Sun,
  Palette,
  Truck,
  Crown
} from 'lucide-react';
import { Product, Sale, StoreInfo } from '../types';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  listDriveBackups, 
  uploadBackupToDrive, 
  downloadBackupFromDrive, 
  deleteBackupFromDrive,
  DriveBackupFile 
} from '../lib/googleDrive';
import { User } from 'firebase/auth';
import { getSupabaseConfig, getSupabaseMigrationSQL } from '../lib/supabase';
import { 
  getNotificationPermissionStatus,
  requestNotificationPermission,
  isNotificationsEnabled,
  setNotificationsEnabled,
  isTtsEnabled,
  setTtsEnabled,
  dispatchNewOrderNotification
} from '../lib/notifications';

interface SettingsManagerProps {
  products: Product[];
  sales: Sale[];
  storeInfo: StoreInfo;
  onRestoreBackup: (products: Product[], sales: Sale[], storeInfo: StoreInfo) => void;
  onUpdateStoreInfo?: (updated: StoreInfo) => void;
  onClearAllSales?: () => Promise<boolean>;
  onForceAllUsersUpdate?: () => Promise<void>;
  onTriggerCelebration?: (type: 'halfway' | 'goal' | 'designer_goal' | 'welcome' | 'designer_halfway' | 'order_delivered' | 'weekly_50_orders') => void;
  supabaseSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error' | 'tables_missing';
  supabaseErrorMsg?: string | null;
}

export function SettingsManager({ 
  products, 
  sales, 
  storeInfo, 
  onRestoreBackup, 
  onUpdateStoreInfo,
  onClearAllSales,
  onForceAllUsersUpdate,
  onTriggerCelebration,
  supabaseSyncStatus = 'idle',
  supabaseErrorMsg = null
}: SettingsManagerProps) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [localRestoreError, setLocalRestoreError] = useState<string | null>(null);
  const [localRestoreSuccess, setLocalRestoreSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTipId, setSelectedTipId] = useState<number | null>(null);
  const [isClearingSales, setIsClearingSales] = useState(false);
  const [clearStep, setClearStep] = useState<'idle' | 'confirming'>('idle');
  const [dangerPassword, setDangerPassword] = useState('');
  const [isTriggeringUpdate, setIsTriggeringUpdate] = useState(false);
  const [updateTriggeredSuccess, setUpdateTriggeredSuccess] = useState(false);

  // States and effects for 1-Click PWA Installation on Android/Mobile
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [showPwaInstructions, setShowPwaInstructions] = useState(false);

  // States and effects for Push Notifications and TTS Alerts on Mobile / Desktop
  const [isNotificationsSupported, setIsNotificationsSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [notificationsPref, setNotificationsPref] = useState(true);
  const [ttsPref, setTtsPref] = useState(true);
  const [testNotificationStatus, setTestNotificationStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsNotificationsSupported('Notification' in window);
      setPermissionStatus(getNotificationPermissionStatus());
      setNotificationsPref(isNotificationsEnabled());
      setTtsPref(isTtsEnabled());
    }
  }, []);

  const handleToggleNotifications = (val: boolean) => {
    setNotificationsEnabled(val);
    setNotificationsPref(val);
  };

  const handleToggleTts = (val: boolean) => {
    setTtsEnabled(val);
    setTtsPref(val);
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermissionStatus(getNotificationPermissionStatus());
    if (granted) {
      setNotificationsEnabled(true);
      setNotificationsPref(true);
    }
  };

  const handleTestNotification = () => {
    setTestNotificationStatus('Disparando...');
    dispatchNewOrderNotification(
      "Maria das Neves",
      125.80,
      "9999"
    );
    setTimeout(() => {
      setTestNotificationStatus('Alerta enviado com sucesso! Verifique seu celular.');
      setTimeout(() => setTestNotificationStatus(null), 4000);
    }, 800);
  };

  useEffect(() => {
    // Check if install prompt is already globally accessible in window
    if ((window as any).deferredInstallPrompt) {
      setInstallPrompt((window as any).deferredInstallPrompt);
    }

    const handlePromptCaptured = (e: any) => {
      setInstallPrompt(e.detail || (window as any).deferredInstallPrompt);
    };

    const handleAppInstalledSuccess = () => {
      setIsPWAInstalled(true);
      setInstallPrompt(null);
      (window as any).deferredInstallPrompt = null;
    };

    window.addEventListener('appbeforeinstallprompt', handlePromptCaptured);
    window.addEventListener('appinstalled', handleAppInstalledSuccess);

    // Initial check for standalone PWA display mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsPWAInstalled(true);
    }

    return () => {
      window.removeEventListener('appbeforeinstallprompt', handlePromptCaptured);
      window.removeEventListener('appinstalled', handleAppInstalledSuccess);
    };
  }, []);

  const handleInstallPWA = async () => {
    const promptEvent = installPrompt || (window as any).deferredInstallPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setIsPWAInstalled(true);
          setInstallPrompt(null);
          (window as any).deferredInstallPrompt = null;
        }
      } catch (err) {
        console.warn('Erro ao processar instalação PWA:', err);
      }
    } else {
      // Toggle instructions manual list if automatic click prompt is blocked
      setShowPwaInstructions(true);
      
      const isIframe = window.self !== window.top;
      if (isIframe) {
        const confirmGo = window.confirm(
          "Para instalar o aplicativo com 1 Clique no seu celular, o navegador exige que o app seja executado fora da moldura de testes (iFrame).\n\nDeseja abrir o aplicativo em uma nova aba para realizar a instalação instantânea do app agora?"
        );
        if (confirmGo) {
          window.open(window.location.href, '_blank');
        }
      } else {
        alert(
          "O instalador automático do Google Chrome está pronto! Clique nos 'Três Pontos (...)' do seu navegador no topo direito e selecione 'Instalar aplicativo' ou 'Adicionar à tela inicial' para concluir em 1 clique!"
        );
      }
    }
  };
  
  // Edit Store states
  const [storeNome, setStoreNome] = useState(storeInfo.nome || '');
  const [storeInstagram, setStoreInstagram] = useState(storeInfo.instagram || '');
  const [storeTelefone, setStoreTelefone] = useState(storeInfo.telefone || '');
  const [storeEndereco, setStoreEndereco] = useState(storeInfo.endereco || '');
  const [storeTemplate, setStoreTemplate] = useState(storeInfo.whatsappTemplate || '');
  const [saveStoreSuccess, setSaveStoreSuccess] = useState(false);

  // Danger Zone state and handlers
  const [clearSuccess, setClearSuccess] = useState(false);

  const handleClearSales = async () => {
    if (clearStep === 'idle') {
      setClearStep('confirming');
      return;
    }

    if (dangerPassword !== '69apagar69') {
      alert('Senha incorreta! Não foi possível apagar os dados.');
      return;
    }

    setIsClearingSales(true);
    setClearSuccess(false);
    try {
      if (onClearAllSales) {
        const success = await onClearAllSales();
        if (success) {
          setClearSuccess(true);
          setDangerPassword('');
          setTimeout(() => setClearSuccess(false), 5000);
        } else {
          alert('Erro no banco de dados do Supabase ao tentar apagar os pedidos.');
        }
      } else {
        alert('Ação onClearAllSales não configurada!');
      }
    } catch (err: any) {
      console.error('Erro ao limpar pedidos:', err);
      alert('Falha interna ao tentar limpar pedidos.');
    } finally {
      setIsClearingSales(false);
      setClearStep('idle');
    }
  };

  // Supabase state handlers and clipboard integration
  const [supConfig, setSupConfig] = useState(() => getSupabaseConfig());
  const [supUrl, setSupUrl] = useState(supConfig.url);
  const [supKey, setSupKey] = useState(supConfig.key);
  const [dbSuccessMsg, setDbSuccessMsg] = useState<string | null>(null);
  const [dbErrorMsg, setDbErrorMsg] = useState<string | null>(null);
  const [copiedMigration, setCopiedMigration] = useState(false);

  // States for AWS RDS/Custom PostgreSQL dynamic configuration
  const [dbProviderSelection, setDbProviderSelection] = useState<'supabase' | 'aws'>('supabase');
  const [pgHost, setPgHost] = useState('');
  const [pgPort, setPgPort] = useState('5432');
  const [pgUser, setPgUser] = useState('postgres');
  const [pgPassword, setPgPassword] = useState('');
  const [pgDatabase, setPgDatabase] = useState('');
  const [pgSsl, setPgSsl] = useState(true);
  const [isSavingPgConfig, setIsSavingPgConfig] = useState(false);
  const [pgConfigSuccessMsg, setPgConfigSuccessMsg] = useState<string | null>(null);
  const [pgConfigErrorMsg, setPgConfigErrorMsg] = useState<string | null>(null);

  // Load existing database config on mount from active server configuration
  useEffect(() => {
    const fetchDbConfig = async () => {
      try {
        const res = await fetch('/api/db/config');
        if (res.ok) {
          const data = await res.json();
          setDbProviderSelection(data.provider || 'supabase');
          setPgHost(data.pgHost || '');
          setPgPort(data.pgPort || '5432');
          setPgUser(data.pgUser || 'postgres');
          setPgPassword(data.pgPassword || '');
          setPgDatabase(data.pgDatabase || '');
          setPgSsl(data.pgSsl !== false);
        }
      } catch (err) {
        console.error('Erro ao buscar configuração de banco de dados do servidor:', err);
      }
    };
    fetchDbConfig();
  }, []);

  const handleSavePgConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPgConfig(true);
    setPgConfigSuccessMsg(null);
    setPgConfigErrorMsg(null);

    try {
      const res = await fetch('/api/db/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'aws',
          pgHost: pgHost.trim(),
          pgPort: pgPort.trim(),
          pgUser: pgUser.trim(),
          pgPassword,
          pgDatabase: pgDatabase.trim(),
          pgSsl
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar configurações do PostgreSQL.');
      }

      setPgConfigSuccessMsg('Banco de dados PostgreSQL conectado e sincronizado com sucesso!');
      setDbProviderSelection('aws');
      
      // Reload page after a delay to initialize socket.io channels in client-side Supabase mapper
      setTimeout(() => {
        window.location.reload();
      }, 2500);

    } catch (err: any) {
      setPgConfigErrorMsg(err.message || 'Falha de comunicação com o servidor.');
    } finally {
      setIsSavingPgConfig(false);
    }
  };

  const handleSwitchToSupabase = async () => {
    setIsSavingPgConfig(true);
    setPgConfigSuccessMsg(null);
    setPgConfigErrorMsg(null);

    try {
      const res = await fetch('/api/db/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'supabase'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao alterar provedor para Supabase.');
      }

      setPgConfigSuccessMsg('Alterado para Supabase! Carregando conexões locais...');
      setDbProviderSelection('supabase');
      
      setTimeout(() => {
        window.location.reload();
      }, 2500);

    } catch (err: any) {
      setPgConfigErrorMsg(err.message || 'Falha ao alterar provedor de banco.');
    } finally {
      setIsSavingPgConfig(false);
    }
  };

  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supUrl || !supKey) {
      setDbErrorMsg('Falta preencher a URL do projeto ou a chave anônima pública.');
      return;
    }
    localStorage.setItem('supabase_url', supUrl.trim());
    localStorage.setItem('supabase_anon_key', supKey.trim());
    localStorage.setItem('supabase_keys_dirty', 'true');
    setDbSuccessMsg('Credenciais do Supabase aplicadas com sucesso! Inicializando conexão com a nuvem...');
    setDbErrorMsg(null);
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handleCopyMigrationSQL = () => {
    try {
      const sqlText = getSupabaseMigrationSQL();
      navigator.clipboard.writeText(sqlText);
      setCopiedMigration(true);
      setTimeout(() => setCopiedMigration(false), 3000);
    } catch (e) {
      console.warn('Erro ao copiar migration SQL:', e);
    }
  };

  // Sync edit states when storeInfo changes
  useEffect(() => {
    setStoreNome(storeInfo.nome || '');
    setStoreInstagram(storeInfo.instagram || '');
    setStoreTelefone(storeInfo.telefone || '');
    setStoreEndereco(storeInfo.endereco || '');
    setStoreTemplate(storeInfo.whatsappTemplate || '');
  }, [storeInfo]);

  const handleSaveStoreInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateStoreInfo) {
      onUpdateStoreInfo({
        nome: storeNome,
        instagram: storeInstagram,
        telefone: storeTelefone,
        endereco: storeEndereco,
        whatsappTemplate: storeTemplate
      });
      setSaveStoreSuccess(true);
      setTimeout(() => setSaveStoreSuccess(false), 3500);
    }
  };

  const handleExportSalesCSV = () => {
    try {
      // CSV headers
      const headers = [
        'Data',
        'Numero Pedido',
        'Cliente',
        'Telefone',
        'Produto',
        'Preco Unitario',
        'Quantidade',
        'Forma Pagamento',
        'Total',
        'Valor Pago',
        'Valor Faltante',
        'Status'
      ];

      // Convert rows
      const rows = sales.map(sale => {
        const valPago = sale.valorPago !== undefined ? sale.valorPago : sale.total;
        const valFaltante = sale.valorFaltante !== undefined ? sale.valorFaltante : (sale.total - valPago);
        const dateFormatted = new Date(sale.data).toLocaleDateString('pt-BR');
        
        return [
          dateFormatted,
          sale.numeroPedido || 'N/A',
          `"${sale.cliente.replace(/"/g, '""')}"`,
          sale.telefoneCliente || '',
          `"${sale.produtoNome.replace(/"/g, '""')}"`,
          sale.precoUn.toFixed(2),
          sale.quantidade,
          sale.formaPagamento,
          sale.total.toFixed(2),
          valPago.toFixed(2),
          valFaltante.toFixed(2),
          sale.status || 'Concluido'
        ];
      });

      // Combine headers and rows
      const csvContent = [
        headers.join(';'),
        ...rows.map(e => e.join(';'))
      ].join('\r\n');

      // Create a blob and download
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `relatorio_vendas_oxente_${today}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting sales to CSV:', err);
    }
  };
  
  // Google Drive states
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        fetchDriveBackups(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setDriveBackups([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const fetchDriveBackups = async (tokenStr: string) => {
    if (!tokenStr) return;
    setIsLoadingBackups(true);
    setDriveError(null);
    try {
      const list = await listDriveBackups(tokenStr);
      setDriveBackups(list);
    } catch (err: any) {
      console.error(err);
      setDriveError('Não foi possível obter a lista de backups do Google Drive.');
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setDriveError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        fetchDriveBackups(res.accessToken);
        showSuccessMessage('Conectado à sua conta do Google Drive!');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setDriveError('Falha ao autenticar com o Google. Tente novamente.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setDriveBackups([]);
      showSuccessMessage('Desconectado do Google Drive.');
    } catch (err) {
      console.error(err);
    }
  };

  const showSuccessMessage = (msg: string) => {
    setDriveSuccessMsg(msg);
    setTimeout(() => setDriveSuccessMsg(null), 5000);
  };

  const handleUploadToDrive = async () => {
    if (!accessToken) return;
    setIsUploading(true);
    setDriveError(null);
    try {
      const backupObj = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        database: {
          products,
          sales,
          storeInfo
        }
      };
      
      await uploadBackupToDrive(accessToken, backupObj);
      showSuccessMessage('Cópia de segurança enviada para o Google Drive com sucesso!');
      fetchDriveBackups(accessToken);
    } catch (err: any) {
      console.error(err);
      setDriveError('Erro ao enviar o backup para o Google Drive.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadBackup = () => {
    try {
      const backupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        database: {
          products,
          sales,
          storeInfo
        }
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const today = new Date().toISOString().split('T')[0];
      const exportFileDefaultName = `backup_oxente_festeje_${today}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (error) {
      console.error('Failed to generate backup file:', error);
    }
  };

  const handleLocalRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonText = event.target?.result as string;
        const backupData = JSON.parse(jsonText);

        let validatedProducts: Product[] | null = null;
        let validatedSales: Sale[] | null = null;
        let validatedStoreInfo: StoreInfo | null = null;

        // Try standard format: { database: { products, sales, storeInfo } }
        if (backupData && backupData.database) {
          if (Array.isArray(backupData.database.products)) {
            validatedProducts = backupData.database.products;
          }
          if (Array.isArray(backupData.database.sales)) {
            validatedSales = backupData.database.sales;
          }
          if (backupData.database.storeInfo) {
            validatedStoreInfo = backupData.database.storeInfo;
          }
        } 
        // Fallback standard structure if top-level has them direct
        else if (backupData && (Array.isArray(backupData.products) || Array.isArray(backupData.sales))) {
          if (Array.isArray(backupData.products)) {
            validatedProducts = backupData.products;
          }
          if (Array.isArray(backupData.sales)) {
            validatedSales = backupData.sales;
          }
          if (backupData.storeInfo) {
            validatedStoreInfo = backupData.storeInfo;
          }
        }

        if (!validatedProducts || !validatedSales) {
          setLocalRestoreError('Estrutura de arquivo inválida. Certifique-se de que é um JSON de backup exportado por este aplicativo.');
          setLocalRestoreSuccess(false);
          e.target.value = '';
          return;
        }

        const confirmRestore = window.confirm(
          `⚠️ ATENÇÃO: Você tem certeza que deseja restaurar o backup local?\nEste arquivo possui ${validatedProducts.length} produtos e ${validatedSales.length} vendas.\n\nEssa ação irá SOBRESCREVER os dados atuais e sincronizar o banco de dados!`
        );

        if (!confirmRestore) {
          e.target.value = '';
          return;
        }

        onRestoreBackup(
          validatedProducts,
          validatedSales,
          validatedStoreInfo || storeInfo
        );

        setLocalRestoreSuccess(true);
        setLocalRestoreError(null);
        setTimeout(() => setLocalRestoreSuccess(false), 5000);

      } catch (error) {
        console.error('Failed to parse backup file:', error);
        setLocalRestoreError('Falha ao ler o arquivo. Certifique-se de que é um arquivo JSON válido exportado por este aplicativo.');
        setLocalRestoreSuccess(false);
      } finally {
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Restores a backup from Drive
  const handleRestoreFromDrive = async (file: DriveBackupFile) => {
    if (!accessToken) return;
    
    // Explicit User Confirmation before overwriting local data
    const confirmRestore = window.confirm(
      `ATENÇÃO: Você tem certeza que deseja restaurar o backup "${file.name}"? This action will overwrite your current sales history and product catalog.`
    );
    if (!confirmRestore) return;

    setIsRestoringId(file.id);
    setDriveError(null);
    try {
      const content = await downloadBackupFromDrive(accessToken, file.id);
      
      // Perform validation checks on downloaded data structure
      if (content && content.database && Array.isArray(content.database.products) && Array.isArray(content.database.sales)) {
        onRestoreBackup(
          content.database.products,
          content.database.sales,
          content.database.storeInfo || storeInfo
        );
        showSuccessMessage(`Backup "${file.name}" restaurado com sucesso!`);
      } else {
        setDriveError('A estrutura do arquivo de backup obtido do Google Drive é inválida.');
      }
    } catch (error) {
      console.error(error);
      setDriveError('Houve uma falha ao baixar ou processar o backup selecionado.');
    } finally {
      setIsRestoringId(null);
    }
  };

  // Deletes a backup from Drive
  const handleDeleteFromDrive = async (file: DriveBackupFile) => {
    if (!accessToken) return;

    // Explicit User Confirmation before deleting data from cloud
    const confirmDelete = window.confirm(
      `Deseja realmente excluir permanentemente o backup "${file.name}" do seu Google Drive?`
    );
    if (!confirmDelete) return;

    setIsDeletingId(file.id);
    setDriveError(null);
    try {
      await deleteBackupFromDrive(accessToken, file.id);
      showSuccessMessage(`Backup "${file.name}" removido do Google Drive.`);
      fetchDriveBackups(accessToken);
    } catch (error) {
      console.error(error);
      setDriveError('Erro ao excluir o backup do Google Drive.');
    } finally {
      setIsDeletingId(null);
    }
  };

  const totalProducts = products.length;
  const totalSales = sales.length;
  const lastSaleDate = sales.length > 0 ? new Date(sales[sales.length - 1].data).toLocaleDateString('pt-BR') : 'Nenhuma';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Settings & Database Header */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-pink/10 border border-brand-pink/20 rounded-xl text-brand-pink">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-xl text-zinc-100">Configurações do Sistema</h2>
            <p className="text-xs text-zinc-400 mt-1">Gerencie a segurança dos dados e backups do seu negócio.</p>
          </div>
        </div>
      </div>

      {/* 📲 PWA 1-CLICK MOBILE INSTALLER PANEL */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md space-y-4">
        <div className="flex items-center gap-3 border-b border-zinc-850 pb-4">
          <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400">
            <Smartphone className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base text-zinc-100">Instalar no Celular (Android)</h3>
            <p className="text-xs text-zinc-400 mt-1">Configure o aplicativo no seu celular para rodar rápido e em tela cheia.</p>
          </div>
          <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-1 rounded">
            PWA Online
          </span>
        </div>

        <div className="text-xs text-zinc-350 leading-relaxed space-y-2.5 bg-black/40 p-4 rounded-xl border border-zinc-850">
          <p>
            Ao instalar o aplicativo, ele aparecerá na tela inicial do seu celular, abrindo instantaneamente sem as barras de navegação do navegador Chrome e possuindo excelente velocidade de resposta.
          </p>
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-zinc-500">
            <Sparkles className="h-3.5 w-3.5 text-brand-pink animate-spin-slow" />
            <span>O aplicativo roda 100% conectado com o banco de dados</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {isPWAInstalled ? (
            <div className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 font-bold rounded-xl text-xs">
              <CheckSquare className="h-4 w-4" />
              <span>Aplicativo já instalado e rodando em modo standalone!</span>
            </div>
          ) : (
            <button
              onClick={handleInstallPWA}
              type="button"
              className="w-full flex items-center justify-center gap-2.5 py-4 px-4 bg-gradient-to-r from-brand-pink to-[#be185d] hover:from-brand-pink-hover hover:to-[#a2114d] text-white font-extrabold rounded-xl shadow-lg transition-all transform active:scale-98 cursor-pointer text-xs"
            >
              <Smartphone className="h-4.5 w-4.5 animate-bounce-slow" />
              <span>Instalar Aplicativo no Celular (1 Clique) 📲</span>
            </button>
          )}

          {/* Manual step-by-step instructions (fallback for iOS or direct Chrome install) */}
          {(!installPrompt && !(window as any).deferredInstallPrompt && !isPWAInstalled) || showPwaInstructions ? (
            <div className="p-4.5 bg-zinc-950/60 border border-zinc-850 rounded-xl space-y-4 animate-fade-in text-xs">
              <div className="flex items-center gap-2 border-b border-zinc-850 pb-2.5 text-zinc-300 font-bold">
                <Chrome className="h-4 w-4 text-brand-pink" />
                <span>Guia Passo a Passo de Instalação Manual</span>
              </div>
              
              <div className="space-y-3.5">
                {/* Android Chrome */}
                <div className="space-y-1">
                  <span className="block text-[10px] font-black text-brand-pink uppercase tracking-widest">No Celular Android (Google Chrome):</span>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-zinc-350 font-medium">
                    <li>Abra o link oficial do aplicativo no navegador Chrome do seu celular.</li>
                    <li>Toque no botão de menu de <strong>três pontos (...)</strong> no canto superior direito.</li>
                    <li>Toque na opção de <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.</li>
                    <li>Confirme a instalação e o ícone &quot;Oxente Festeje&quot; aparecerá no seu painel principal do celular!</li>
                  </ol>
                </div>

                {/* iOS Safari */}
                <div className="space-y-1 pt-1 border-t border-zinc-850/60">
                  <span className="block text-[10px] font-black text-pink-400 uppercase tracking-widest">No iPhone / iPad (Safari):</span>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-zinc-355 font-medium">
                    <li>Abra este site no navegador de internet <strong>Safari</strong> do iOS.</li>
                    <li>Toque sobre o ícone de de <strong>Compartilhar</strong> <Share2 className="h-3 w-3 inline text-zinc-400 mx-0.5" /> (seta para cima).</li>
                    <li>Desça as opções da aba e clique em <strong>&quot;Adicionar à Tela de Início&quot;</strong>.</li>
                    <li>Escreva o nome do app e clique em <strong>&quot;Adicionar&quot;</strong> para finalizar!</li>
                  </ol>
                </div>
              </div>
              
              <div className="text-[10px] text-zinc-500 bg-black/30 p-2.5 rounded-lg border border-zinc-850 leading-relaxed font-semibold">
                ℹ️ <strong>Para desenvolvedores:</strong> Se estiver rodando no sandbox de testes (iframe), o navegador bloqueia prompts de instalação automática. Abra o link do aplicativo em uma nova aba para testar o clique direto de instalação de forma ideal.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 🔔 HIGH-PERFORMANCE REALTIME MOBILE/DESKTOP NOTIFICATIONS PANEL */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md space-y-5 animate-fade-in text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-brand-pink/10 border border-brand-pink/20 rounded-xl text-brand-pink shrink-0">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-zinc-100">Configurações de Alertas & Notificações</h3>
              <p className="text-xs text-zinc-400 mt-1">Receba avisos instantâneos com chimes e voz em tempo real no seu celular ao receber um novo pedido.</p>
            </div>
          </div>
          
          <div className="shrink-0 max-sm:self-start">
            {permissionStatus === 'granted' ? (
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2.5 py-1 rounded-full">
                ● Ativo no Celular
              </span>
            ) : permissionStatus === 'denied' ? (
              <span className="text-[10px] font-black uppercase tracking-wider text-pink-500 bg-pink-950/20 border border-pink-900/30 px-2.5 py-1 rounded-full">
                ● Bloqueado
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/20 border border-amber-900/30 px-2.5 py-1 rounded-full">
                ● Configurar
              </span>
            )}
          </div>
        </div>

        {/* Informative notification context banner */}
        <div className="text-xs text-zinc-350 leading-relaxed bg-black/40 p-4.5 rounded-xl border border-zinc-850 space-y-3">
          <p>
            Este aplicativo utiliza sincronização em nuvem ultrarápida. Toda vez que um atendente, parceiro de equipe ou cliente cadastrar um pedido, seu dispositivo emitirá um alerta sonoro instantâneo e uma chamada de voz, mesmo se o aplicativo estiver trabalhando em segundo plano ou com a tela apagada!
          </p>

          {!isNotificationsSupported && (
            <div className="text-[11px] font-semibold text-pink-400 bg-pink-950/10 border border-pink-900/20 p-2.5 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Aviso: Seu navegador ou iFrame restrito não suporta notificações de Push do sistema. Para melhor experiência, abra o app em uma aba separada!</span>
            </div>
          )}
        </div>

        {/* Main interactive controls */}
        <div className="space-y-4">
          
          {/* Permission Requester if needed */}
          {isNotificationsSupported && permissionStatus !== 'granted' && (
            <div className="bg-amber-950/10 border border-amber-900/30 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-amber-300">Permissão de Notificação Necessária</h4>
                <p className="text-[11px] text-zinc-400 font-medium">O navegador precisa de autorização para mostrar alertas em tela no celular.</p>
              </div>
              <button
                onClick={handleRequestPermission}
                type="button"
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs rounded-lg transition-all active:scale-95 cursor-pointer block sm:inline-block shrink-0"
              >
                Ativar Notificações 🔔
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Toggle Browser push notifications */}
            <div className="bg-black/20 border border-zinc-850 p-4 rounded-xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {notificationsPref ? (
                    <Bell className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Bell className="h-4 w-4 text-zinc-550" />
                  )}
                  <h4 className="text-xs font-bold text-zinc-150">Notificações Push do Sistema</h4>
                </div>
                <p className="text-[10.5px] text-zinc-400">Exibir balões de alerta pop-up no aparelho celular.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input 
                  type="checkbox" 
                  checked={notificationsPref} 
                  onChange={(e) => handleToggleNotifications(e.target.checked)}
                  disabled={permissionStatus !== 'granted'}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 peer-checked:after:bg-black after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-pink"></div>
              </label>
            </div>

            {/* Toggle TTS announcements */}
            <div className="bg-black/20 border border-zinc-850 p-4 rounded-xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {ttsPref ? (
                    <Megaphone className="h-4 w-4 text-[#ec4899] animate-pulse" />
                  ) : (
                    <Megaphone className="h-4 w-4 text-zinc-550" />
                  )}
                  <h4 className="text-xs font-bold text-zinc-150">Alerta de Voz Sintetizada (TTS)</h4>
                </div>
                <p className="text-[10.5px] text-zinc-400">Falar o nome do cliente e o valor total do pedido alto em voz.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input 
                  type="checkbox" 
                  checked={ttsPref} 
                  onChange={(e) => handleToggleTts(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 peer-checked:after:bg-black after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-pink"></div>
              </label>
            </div>

          </div>

          {/* Tester trigger button */}
          <div className="pt-2 border-t border-zinc-850 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[11px] text-zinc-400 font-medium text-center sm:text-left">
              🚀 Quer experimentar a mágica de voz em tempo real agora mesmo? Clique ao lado para testar:
            </div>
            <div className="w-full sm:w-auto shrink-0 flex flex-col items-center">
              <button
                onClick={handleTestNotification}
                type="button"
                className="w-full sm:w-auto flex items-center justify-center gap-2 py-2 px-5 bg-zinc-800 hover:bg-zinc-750 text-brand-pink border border-brand-pink/30 hover:border-brand-pink text-xs font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer"
              >
                <span>Despertar Alerta de Teste 🧪</span>
              </button>
            </div>
          </div>

          {testNotificationStatus && (
            <div className="p-3 bg-brand-pink/5 border border-brand-pink/20 rounded-xl text-center text-xs font-bold text-brand-pink animate-fade-in">
              {testNotificationStatus}
            </div>
          )}

        </div>
      </div>

      {/* Google Drive Integration Section */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">☁️</span>
            <h3 className="font-display font-semibold text-base text-zinc-100"> backup em Nuvem (Google Drive)</h3>
          </div>

          {user && (
            <button 
              onClick={handleGoogleLogout}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 px-3 py-1.5 bg-black border border-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Desconectar</span>
            </button>
          )}
        </div>

        {/* Integration Status / Sign-In UI */}
        {!user ? (
          <div className="p-5 bg-black/40 border border-zinc-850 rounded-xl flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-brand-pink/10 border border-brand-pink/20 rounded-full text-brand-pink">
              <UploadCloud className="h-8 w-8" />
            </div>
            <div className="max-w-sm space-y-1">
              <h4 className="font-semibold text-zinc-200 text-sm">Sincronize com seu Google Drive</h4>
              <p className="text-xs text-zinc-450 leading-relaxed">
                Conecte-se com segurança para enviar backups para sua conta na nuvem ou restaurar seu estoque a partir de arquivos salvos anteriormente.
              </p>
            </div>

            {/* Official style Sign in with Google Button */}
            <button 
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className="px-5 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isSigningIn ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin text-zinc-900" />
              ) : (
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4.5 w-4.5">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              )}
              <span>{isSigningIn ? 'Conectando...' : 'Entrar com o Google'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* User Account Info card */}
            <div className="p-4 bg-black/35 border border-zinc-850 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="h-9 w-9 rounded-full border border-brand-pink/30" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-zinc-800 text-xs font-bold text-center flex items-center justify-center text-zinc-300">
                    {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div>
                  <span className="block text-xs text-zinc-450">Conta Conectada</span>
                  <span className="block text-sm font-semibold text-zinc-150 leading-tight">{user.email}</span>
                </div>
              </div>
              <span className="bg-brand-pink/15 text-brand-pink border border-brand-pink/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                Google Drive Ativo
              </span>
            </div>

            {/* Quick backup button in connected state */}
            <button
              onClick={handleUploadToDrive}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-pink hover:bg-brand-pink-hover text-black font-bold rounded-xl shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <UploadCloud className="h-4.5 w-4.5" />
              )}
              <span>{isUploading ? 'Enviando Cópia...' : 'Salvar Cópia de Segurança no Google Drive'}</span>
            </button>

            {/* Existing backups section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4">
                <span className="text-xs uppercase tracking-wider font-extrabold text-zinc-400">Backups Salvos na Nuvem</span>
                <button
                  onClick={() => accessToken && fetchDriveBackups(accessToken)}
                  disabled={isLoadingBackups}
                  className="p-1.5 text-zinc-500 hover:text-brand-pink transition-colors cursor-pointer"
                  title="Atualizar lista"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {isLoadingBackups ? (
                <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="h-6 w-6 text-brand-pink animate-spin mb-1" />
                  <span className="text-xs">Buscando backups em seu Google Drive...</span>
                </div>
              ) : driveBackups.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs bg-black/15 border border-dashed border-zinc-850 rounded-xl leading-relaxed">
                  Nenhum arquivo de backup "backup_oxente_festeje" encontrado no seu Drive ainda.
                  <br />Clique no botão acima para criar o primeiro!
                </div>
              ) : (
                <div className="divide-y divide-zinc-850/60 border border-zinc-850/80 rounded-xl bg-black/25 overflow-hidden max-h-56 overflow-y-auto">
                  {driveBackups.map(file => (
                    <div key={file.id} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="block font-medium text-zinc-200 truncate" title={file.name}>
                          {file.name}
                        </span>
                        <span className="block text-[10px] text-zinc-500 mt-0.5">
                          Criado em: {new Date(file.createdTime).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Restore Button */}
                        <button
                          onClick={() => handleRestoreFromDrive(file)}
                          disabled={isRestoringId === file.id || isDeletingId === file.id}
                          className="px-2.5 py-1.5 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 hover:bg-emerald-900/30 font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                        >
                          {isRestoringId === file.id ? (
                            <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                          ) : (
                            <CheckSquare className="h-3 w-3 inline mr-1" />
                          )}
                          Restaurar
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteFromDrive(file)}
                          disabled={isRestoringId === file.id || isDeletingId === file.id}
                          className="p-1.5 bg-red-950/20 border border-red-950/40 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer disabled:opacity-40 font-bold"
                          title="Excluir Backup permanentemente do Drive"
                        >
                          {isDeletingId === file.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Local Error feedback */}
        {driveError && (
          <div className="p-3.5 bg-red-950/25 border border-red-900/30 rounded-xl text-red-300 text-xs font-semibold animate-fade-in flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{driveError}</span>
          </div>
        )}

        {/* Local Success feedback */}
        {driveSuccessMsg && (
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-300 text-xs font-semibold animate-fade-in flex items-center justify-center gap-2 text-center">
            <span>🎉</span>
            <span>{driveSuccessMsg}</span>
          </div>
        )}

      </div>

      {/* Local JSON Backup Card (Offline backup) */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md space-y-6">
        
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
          <ShieldCheck className="h-5 w-5 text-zinc-400" />
          <h3 className="font-display font-semibold text-base text-zinc-100">Backup Local (Arquivo JSON)</h3>
        </div>

        <p className="text-sm text-zinc-350 leading-relaxed">
          Você também pode fazer o download off-line convencional dos dados do seu navegador para manter um arquivo físico salvo em seu computador.
        </p>

        {/* Database Stats Preview Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/45 border border-zinc-800/60 p-4 rounded-xl">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <Package className="h-4.5 w-4.5 text-brand-pink shrink-0" />
            <div>
              <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Produtos</span>
              <span className="text-sm font-bold text-zinc-200">{totalProducts} cadastrados</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-2 py-1 border-y sm:border-y-0 sm:border-x border-zinc-850/60">
            <FileText className="h-4.5 w-4.5 text-emerald-450 shrink-0" />
            <div>
              <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Vendas</span>
              <span className="text-sm font-bold text-zinc-200">{totalSales} registradas</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-2 py-1">
            <Calendar className="h-4.5 w-4.5 text-amber-500 shrink-0" />
            <div>
              <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Última Venda</span>
              <span className="text-sm font-bold text-zinc-200">{lastSaleDate}</span>
            </div>
          </div>
        </div>

        {/* Hidden File Input for local backup importation */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          onChange={handleLocalRestoreBackup}
          className="hidden"
        />

        {/* Action Buttons */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleDownloadBackup}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-zinc-800 hover:bg-zinc-750 text-zinc-250 hover:text-white font-bold rounded-xl shadow-xs transition-all transform active:scale-98 cursor-pointer border border-zinc-700/40 text-xs"
          >
            <Download className="h-4 w-4" />
            <span>Baixar JSON</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 hover:from-purple-900/60 hover:to-indigo-900/60 text-purple-200 hover:text-white font-bold rounded-xl shadow-xs transition-all transform active:scale-98 cursor-pointer border border-purple-800/30 text-xs"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Restaurar JSON</span>
          </button>

          <button
            onClick={handleExportSalesCSV}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-brand-pink/15 hover:bg-brand-pink/25 text-brand-pink font-bold rounded-xl shadow-xs transition-all transform active:scale-98 cursor-pointer border border-brand-pink/30 text-xs animate-pulse-slow"
          >
            <FileSpreadsheet className="h-4.5 w-4.5" />
            <span>Exportar Excel (CSV)</span>
          </button>
        </div>

        {/* Success / Error Confirmation Toast/Notices */}
        {downloadSuccess && (
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-300 text-xs font-semibold animate-fade-in flex items-center justify-center gap-2 text-center">
            <span className="text-base">🎉</span>
            <span>Arquivo de backup baixado com sucesso!</span>
          </div>
        )}

        {localRestoreSuccess && (
          <div className="p-3.5 bg-emerald-950/35 border border-emerald-900/50 rounded-xl text-emerald-300 text-xs font-bold animate-fade-in flex items-center justify-center gap-2 text-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <span className="text-base">✨</span>
            <span>Backup local carregado e restaurado com sucesso! Toda a base foi sincronizada.</span>
          </div>
        )}

        {localRestoreError && (
          <div className="p-3.5 bg-red-950/30 border border-red-900/40 rounded-xl text-red-300 text-xs font-semibold animate-fade-in flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{localRestoreError}</span>
          </div>
        )}

      </div>

      {/* ⚡ CLOUD DATABASE CONFIGURATION CARD */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-md space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-4 gap-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-brand-pink shrink-0 animate-pulse" />
            <div>
              <h3 className="font-display font-semibold text-base text-zinc-100">
                Sincronização de Banco de Dados
              </h3>
              <p className="text-[10px] text-zinc-450 mt-0.5">
                Alterne e configure o banco de dados do seu aplicativo de forma dinâmica e descomplicada.
              </p>
            </div>
          </div>
          
          {/* Diagnostic Sync Badges */}
          <div className="shrink-0 self-start sm:self-auto">
            {supabaseSyncStatus === 'synced' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-full font-bold bg-emerald-950/45 text-emerald-400 border border-emerald-905/40">
                <CheckCircle className="h-3 w-3" />
                Conectado &amp; Ativo
              </span>
            )}
            {supabaseSyncStatus === 'syncing' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-full font-bold bg-zinc-850 text-brand-pink border border-zinc-800 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                Sincronizando...
              </span>
            )}
            {supabaseSyncStatus === 'tables_missing' && (
              <span className="inline-flex items-center gap-1 py-1 px-2 text-[10px] rounded-full font-bold bg-amber-950/40 text-amber-302 border border-amber-900/30 animate-pulse">
                <AlertCircle className="h-3 w-3 text-amber-500" />
                Tabelas Ausentes
              </span>
            )}
            {supabaseSyncStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-full font-bold bg-red-950/45 text-red-400 border border-red-900/40">
                <AlertCircle className="h-3 w-3" />
                Erro Conexão
              </span>
            )}
            {supabaseSyncStatus === 'idle' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-full font-bold bg-zinc-800 text-zinc-450 border border-zinc-750">
                Não Conectado
              </span>
            )}
          </div>
        </div>

        {/* Sync feedback panel */}
        {supabaseErrorMsg && (
          <div className="p-3.5 bg-red-950/15 border border-red-950/40 rounded-xl text-xs text-red-300 leading-relaxed space-y-1 select-text">
            <p className="font-bold flex items-center gap-1 text-red-400">
              <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
              Notificação do Sincronizador:
            </p>
            <p className="text-zinc-400 leading-relaxed text-[11px]">{supabaseErrorMsg}</p>
          </div>
        )}

        {/* Provedor selector buttons */}
        <div className="grid grid-cols-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-850 gap-2">
          <button
            type="button"
            onClick={handleSwitchToSupabase}
            disabled={isSavingPgConfig}
            className={`py-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              dbProviderSelection === 'supabase'
                ? 'bg-brand-pink text-black shadow-sm font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Database className="h-3.5 w-3.5 shrink-0" />
            <span>Supabase (Nuvem Direta)</span>
          </button>
          <button
            type="button"
            onClick={() => setDbProviderSelection('aws')}
            disabled={isSavingPgConfig}
            className={`py-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              dbProviderSelection === 'aws'
                ? 'bg-brand-pink text-black shadow-sm font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Cloud className="h-3.5 w-3.5 shrink-0" />
            <span>AWS PostgreSQL / Hostinger</span>
          </button>
        </div>

        {dbProviderSelection === 'aws' ? (
          /* Dynamic AWS PostgreSQL Connection Panel */
          <div className="space-y-4">
            <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl space-y-2 text-[11px] text-zinc-400 leading-relaxed">
              <p className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-brand-pink" />
                Hospedagem Hostinger / Banco Próprio
              </p>
              <p>
                Insira as credenciais do seu banco de dados PostgreSQL abaixo. O servidor irá testar a conexão antes de aplicar as mudanças. Ao salvar, as tabelas serão criadas de forma automática!
              </p>
            </div>

            <form onSubmit={handleSavePgConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">HOST (Endpoint AWS / Hostinger)</label>
                  <input
                    type="text"
                    value={pgHost}
                    onChange={(e) => setPgHost(e.target.value)}
                    placeholder="oxentenuvem.cfmssismksw6.us-east-2.rds.amazonaws.com"
                    className="w-full bg-black border border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs font-mono text-zinc-200 px-3.5 py-3 rounded-xl focus:outline-none placeholder-zinc-650 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">PORTA</label>
                  <input
                    type="text"
                    value={pgPort}
                    onChange={(e) => setPgPort(e.target.value)}
                    placeholder="5432"
                    className="w-full bg-black border border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs font-mono text-zinc-200 px-3.5 py-3 rounded-xl focus:outline-none placeholder-zinc-650 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">USUÁRIO</label>
                  <input
                    type="text"
                    value={pgUser}
                    onChange={(e) => setPgUser(e.target.value)}
                    placeholder="postgres"
                    className="w-full bg-black border border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs font-mono text-zinc-200 px-3.5 py-3 rounded-xl focus:outline-none placeholder-zinc-650 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">SENHA DO BANCO</label>
                  <input
                    type="password"
                    value={pgPassword}
                    onChange={(e) => setPgPassword(e.target.value)}
                    placeholder="Sua senha do banco PostgreSQL"
                    className="w-full bg-black border border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs font-mono text-zinc-200 px-3.5 py-3 rounded-xl focus:outline-none placeholder-zinc-650 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">NOME DO BANCO DE DADOS (Database)</label>
                  <input
                    type="text"
                    value={pgDatabase}
                    onChange={(e) => setPgDatabase(e.target.value)}
                    placeholder="oxentenuvem"
                    className="w-full bg-black border border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs font-mono text-zinc-200 px-3.5 py-3 rounded-xl focus:outline-none placeholder-zinc-650 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">SSL SEGURO</label>
                  <select
                    value={String(pgSsl)}
                    onChange={(e) => setPgSsl(e.target.value === 'true')}
                    className="w-full bg-black border border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs font-mono text-zinc-200 px-3.5 py-3 rounded-xl focus:outline-none transition-all"
                  >
                    <option value="true">Habilitado (SSL Criptografado - Recomendado)</option>
                    <option value="false">Desabilitado</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingPgConfig}
                  className="px-5 py-3.5 bg-brand-pink hover:bg-brand-pink/90 disabled:bg-zinc-850 disabled:text-zinc-550 text-black font-extrabold rounded-xl transition-all cursor-pointer text-xs flex-1 flex items-center justify-center gap-1.5 active:scale-97 shadow-md"
                >
                  {isSavingPgConfig ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Testando e Salvando Conexão...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Salvar e Sincronizar Banco de Dados</span>
                    </>
                  )}
                </button>
              </div>

              {/* Feedback messages */}
              {pgConfigSuccessMsg && (
                <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-300 text-xs font-semibold animate-fade-in text-center">
                  {pgConfigSuccessMsg}
                </div>
              )}
              {pgConfigErrorMsg && (
                <div className="p-3.5 bg-red-950/25 border border-red-900/30 rounded-xl text-red-300 text-xs font-semibold animate-fade-in leading-relaxed">
                  {pgConfigErrorMsg}
                </div>
              )}
            </form>
          </div>
        ) : (
          /* Supabase Legacy Panel */
          <>
            {/* SQL Schema Copy/Migration Instructions block */}
            <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl space-y-2 select-text">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                  <Terminal className="h-4 w-4 text-brand-pink" />
                  <span>Script de Criação de Tabelas (SQL)</span>
                </div>
                <button
                  onClick={handleCopyMigrationSQL}
                  className={`px-3 py-1.5 rounded-lg text-xxs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                    copiedMigration 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  <Copy className="h-3 w-3" />
                  <span>{copiedMigration ? 'Copiado SQL!' : 'Copiar Roteiro SQL'}</span>
                </button>
              </div>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                Caso as tabelas não tenham sido criadas, abra o painel do seu Supabase, clique em <strong className="text-zinc-200">SQL Editor</strong>, crie uma "New Query", cole o conteúdo do SQL (obtido no botão acima) e clique em <strong className="text-brand-pink">Run</strong>. Isso liberará o armazenamento na nuvem de imediato!
              </p>
            </div>

            {/* Credentials Form block */}
            <form onSubmit={handleSaveSupabaseConfig} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">SUPABASE_URL (Projeto)</label>
                  <input
                    type="url"
                    value={supUrl}
                    onChange={(e) => setSupUrl(e.target.value)}
                    placeholder="https://suas-credenciais.supabase.co"
                    className="w-full bg-black border border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs font-mono text-zinc-200 px-3.5 py-3 rounded-xl focus:outline-none placeholder-zinc-650 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">SUPABASE_ANON_KEY (Chave Pública Anon)</label>
                  <input
                    type="text"
                    value={supKey}
                    onChange={(e) => setSupKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-black border border-zinc-800 focus:border-brand-pink focus:ring-1 focus:ring-brand-pink text-xs font-mono text-zinc-200 px-3.5 py-3 rounded-xl focus:outline-none placeholder-zinc-650 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className="px-5 py-3.5 bg-brand-pink hover:bg-brand-pink/90 text-black font-extrabold rounded-xl transition-all cursor-pointer text-xs flex-1 flex items-center justify-center gap-1.5 active:scale-97 shadow-md"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar Credenciais do Supabase</span>
                </button>
              </div>

              {/* Local success / error feedback */}
              {dbSuccessMsg && (
                <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-300 text-xs font-semibold animate-fade-in text-center">
                  {dbSuccessMsg}
                </div>
              )}
              {dbErrorMsg && (
                <div className="p-3.5 bg-red-950/25 border border-red-900/30 rounded-xl text-red-300 text-xs font-semibold animate-fade-in">
                  {dbErrorMsg}
                </div>
              )}
            </form>
          </>
        )}

      </div>

      {/* Visual Configuration of Store details & WhatsApp message template */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-805 p-6 shadow-md space-y-6 select-text">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
          <MessageSquare className="h-5 w-5 text-brand-pink shrink-0" />
          <div>
            <h3 className="font-display font-semibold text-base text-zinc-100">Configuração da Loja e Mensagem</h3>
            <p className="text-[10px] text-zinc-450 mt-0.5">Customize dados de rodapé e o texto disparado quando as encomendas ficam prontas</p>
          </div>
        </div>

        <form onSubmit={handleSaveStoreInfo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-450 mb-1.5 uppercase tracking-wider">Nome do Empreendimento</label>
              <input
                type="text"
                value={storeNome}
                onChange={(e) => setStoreNome(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-pink/40 text-zinc-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-450 mb-1.5 uppercase tracking-wider">Instagram Comercial</label>
              <input
                type="text"
                value={storeInstagram}
                onChange={(e) => setStoreInstagram(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-pink/40 text-zinc-200 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-450 mb-1.5 uppercase tracking-wider">Telefone Comercial de Contato</label>
              <input
                type="text"
                value={storeTelefone}
                onChange={(e) => setStoreTelefone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-pink/40 text-zinc-200 text-xs card-input_telefone"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-450 mb-1.5 uppercase tracking-wider">Endereço de Retirada</label>
              <input
                type="text"
                value={storeEndereco}
                onChange={(e) => setStoreEndereco(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-pink/40 text-zinc-200 text-xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Modelo da Mensagem WhatsApp</label>
              <span className="text-[10px] text-zinc-500 font-bold">Use <code className="text-brand-pink bg-black px-1 py-0.5 rounded text-[9.5px]">{'{cliente}'}</code> e <code className="text-brand-pink bg-black px-1 py-0.5 rounded text-[9.5px]">{'{pedido}'}</code> como marcadores automáticos</span>
            </div>
            <textarea
              rows={8}
              value={storeTemplate}
              onChange={(e) => setStoreTemplate(e.target.value)}
              className="w-full px-3.5 py-3 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-pink/40 text-zinc-200 text-xs font-mono leading-relaxed"
              placeholder="Excreva o modelo de mensagem..."
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="flex items-center gap-2 py-2.5 px-5 bg-brand-pink hover:bg-brand-pink-hover text-black font-extrabold rounded-xl text-xs shadow-xs transition-all cursor-pointer select-none active:scale-98"
            >
              <Save className="h-4 w-4 stroke-[2.5]" />
              <span>Salvar Alterações Globais</span>
            </button>
          </div>
        </form>

        {saveStoreSuccess && (
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-350 text-xs font-semibold animate-fade-in flex items-center justify-center gap-2 text-center">
            <span>🎉</span>
            <span>Detalhes da loja e modelo salvos com sucesso no navegador!</span>
          </div>
        )}
      </div>

      {/* NEW: SUÍTE DE DICAS DE ALAVANCAGEM & GESTÃO DA LOJA */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-md space-y-6 lg:col-span-2 select-text">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <div>
              <h3 className="font-display font-semibold text-base text-zinc-100">Guia de Boas Práticas e Dicas de Gestão</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5">Explore as estratégias recomendadas para alavancar seu atelier e evitar inadimplências</p>
            </div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-brand-pink bg-brand-pink/15 px-2 py-1 rounded-sm">
            Educacional
          </span>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 1,
              icon: '💰',
              title: 'Dica 1: Sinal de 50% Obrigatório no Agendamento',
              subtitle: 'Proteja o caixa da loja e garanta compras de insumos antes do evento',
              text: 'Solicite sempre ao menos 50% de entrada (sinal) no ato do fechamento de decorações, mesas temáticas ou acervos. Isso garante o capital necessário para compra imediata de consumíveis encomendados (como balões especiais, fitas e embalagens de transporte) e reduz drasticamente (em até 95%) o risco de cancelamento ou desistência na véspera da festa.'
            },
            {
              id: 2,
              icon: '📦',
              title: 'Dica 2: Combinações e Kits Combo ("Pegue e Monte")',
              subtitle: 'Eleve seu Ticket Médio estimulando a conveniência dos kits',
              text: 'Facilite a tomada de decisão agrupando peças de altíssimo giro com acessórios complementares de menor saída em pacotes fechados por um preço promocional coordenado. Exemplo: Kit Mesa MDF + Suporte de Painel Redondo + 3 Bandejas de Doces Metálicas. Isso eleva significativamente o ticket médio individual por negócio (de R$ 80 para R$ 220+).'
            },
            {
              id: 3,
              icon: '💬',
              title: 'Dica 3: Cadência de Notificação Ativa no WhatsApp',
              subtitle: 'Engajamento profissional pré, durante e pós-evento com seus clientes',
              text: 'Divida o contato com a mãe festeira ou decorador em três estágios precisos:\n1. Agendamento: Confirmação formal enviando o recibo inicial PDF com as regras acordadas.\n2. Preparação: Dispare o aviso quando a equipe alterar o status da encomenda para "Pronto para Retirada", fornecendo o link com o endereço de retirada da oficina física.\n3. Pós-festa: Dois dias após a data de retirada, solicite feedback de satisfação e peça fotos oficiais do evento para repostagem nas redes sociais.'
            },
            {
              id: 4,
              icon: '⭐',
              title: 'Dica 4: Foco em Produtos Estrela (Margem vs Esforço)',
              subtitle: 'Separe itens de alta lucratividade dos de alta manutenção e desgaste',
              text: 'Monitore quais peças de acervo exigem menos tempo de separação e limpeza pós-evento, mas comandam excelentes taxas de aluguel. Cavaletes metálicos industriais e painéis permanentes possuem margem de lucro recorrente muito superior a balões de látex descartáveis que exigem mão de obra manual intensa. Maximize a propaganda e destaque destas louças estruturais na vitrine.'
            },
            {
              id: 5,
              icon: '⚙️',
              title: 'Dica 5: Fluxo de Produção Interna Ativo no Sistema',
              subtitle: 'Organize as fases de confecção das encomendas sem atritos internos',
              text: 'Use consistentemente os novos filtros de "Status de Produção" (Agendado, Em Produção, Pronto para Retirada, Entregue) inseridos recentemente em cada venda registrada! Ao marcar cada fase, a equipe da oficina sabe com total exatidão o que já está garantido, o que está na mesa de costura ou montagem, e o que está embalado e estocado nas prateleiras de liberação rápida.'
            },
            {
              id: 6,
              icon: '🚨',
              title: 'Dica 6: Gestão Antibloqueio de Encomendas Esquecidas (+5 Dias)',
              subtitle: 'Otimize o estoque físico rotativo na oficina e evite retenção longa',
              text: 'O sistema agora sinaliza em cor vermelha pulsante e emite um alerta de destaque se uma encomenda passar de 5 dias após a data planejada sem ser descarregada pelo cliente do salão. Estabeleça regras contratuais prevendo taxa adicional de armazenagem por dia extra ou desmanche imediato do kit com retenção completa do sinal após este limite, visando liberar espaço físico de circulação interna no atelier.'
            },
            {
              id: 7,
              icon: '🛡️',
              title: 'Dica 7: Auditoria de Segurança de Lançamentos Privados',
              subtitle: 'Rastreabilidade total para prevenção de furos financeiros',
              text: 'Aproveite o canal de auditoria em tempo real exclusivo para o e-mail oxentefesteje@gmail.com. Este histórico imutável registra permanentemente a autoria e a data exata de qualquer novo lançamento ou modificação de valores, assegurando absoluta conformidade com os processos internos do negócio.'
            },
            {
              id: 8,
              icon: '📋',
              title: 'Dica 8: Checklist de Conferência de Devolução (Prevenção de Avarias)',
              subtitle: 'Evite prejuízos blindando o acervo contra arranhões, perdas e quebras',
              text: 'No ato da devolução das peças do pegue-e-monte pelo cliente, realize sempre uma checagem cuidadosa comparando os itens físicos devolvidos com a lista discriminada no sistema. Defina contratualmente e avise previamente que quaisquer trincas, manchas permanentes ou quebras de itens (como bandejas cerâmicas e estruturas mdf) acarretarão cobrança imediata de taxa de reposição com preço de mercado.'
            },
            {
              id: 9,
              icon: '📸',
              title: 'Dica 9: Construção de Portfólio de Alto Impacto Visual',
              subtitle: 'Use os eventos montados para atrair clientes de maior poder aquisitivo',
              text: 'Nunca entregue uma decoração ou retire um kit sem registrar fotos de alta qualidade com iluminação adequada. Crie um catálogo digital categorizado e organizado das decorações completas montadas pelo atelier "Oxente Festeje". Fotos profissionais publicadas no catálogo servem como gatilhos mentais poderosos de autoridade e facilitam a conversão de novas reservas sem a necessidade de descontos.'
            },
            {
              id: 10,
              icon: '📈',
              title: 'Dica 10: Planejamento Sazonal de Datas Comemorativas',
              subtitle: 'Antecipe as tendências do ano para maximizar faturamento no atelier',
              text: 'Atente-se ao calendário anual de festividades de alto giro. Períodos como Festas Juninas (Mês de São João), Dia das Crianças, Halloween e Confraternizações de fim de ano concentram picos imensos de demanda por acervos e pacotes decorativos. Planeje a compra e higienização das peças temáticas correspondentes com pelo menos 45 dias de antecedência para garantir atendimento total e sem gargalos de estoque.'
            }
          ].map((tip) => {
            const isOpen = selectedTipId === tip.id;
            return (
              <div 
                key={tip.id} 
                className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                  isOpen 
                    ? 'border-brand-pink bg-brand-pink/5 shadow-xs' 
                    : 'border-zinc-800 bg-black/30 hover:border-zinc-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedTipId(isOpen ? null : tip.id)}
                  className="w-full text-left p-4 flex items-start gap-3 justify-between cursor-pointer focus:outline-none select-none"
                >
                  <div className="flex gap-2.5">
                    <span className="text-xl shrink-0 mt-0.5">{tip.icon}</span>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5 flex-wrap">
                        {tip.title}
                      </h4>
                      <p className="text-[10.5px] text-zinc-450 mt-0.5">{tip.subtitle}</p>
                    </div>
                  </div>
                  <span className={`text-xs text-zinc-500 transition-transform font-bold ${isOpen ? 'rotate-180 text-brand-pink' : ''}`}>
                    ▼
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4.5 pt-1 border-t border-zinc-800/60 text-xs text-zinc-300 whitespace-pre-line leading-relaxed animate-fade-in font-sans">
                    {tip.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 🎉 DEMONSTRAÇÃO DO EFEITO DE METAS (ANIMAÇÃO) */}
      {onTriggerCelebration && (
        <div className="bg-zinc-900 rounded-2xl border border-pink-500/15 p-6 shadow-md space-y-6">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
            <Sparkles className="h-5 w-5 text-pink-400 shrink-0" />
            <div>
              <h3 className="font-display font-semibold text-base text-zinc-100">Testar Efeitos Visuais de Conquista</h3>
              <p className="text-[10px] text-zinc-450 mt-0.5">Veja em primeira mão as duas lindas animações comemorativas que celebram as metas diárias</p>
            </div>
          </div>

          <div className="text-xs text-zinc-300 space-y-2 leading-relaxed">
            <p>
              Para engajar e motivar a equipe, o aplicativo conta com efeitos comemorativos interativos e sonoros ao bater marcas de vendas diárias ou receber as boas-vindas do dia.
            </p>
            <p>
              Ao clicar nos botões abaixo, você poderá demonstrar e conferir como as comemorações de <strong>Metade do Caminho (5º pedido)</strong>, <strong>Meta Batida (10º pedido)</strong>, o <strong>Modo Criativo (5ª arte finalizada)</strong>, o <strong>Modo Máquina (10ª arte finalizada)</strong>, os <strong>Pedidos Entregues</strong> e as <strong>Boas-Vindas do Dia</strong> funcionam e surgem na tela para animar a produção.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => onTriggerCelebration('halfway')}
              className="px-5 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-97 shadow-md flex-1 min-w-[200px]"
            >
              <Rocket className="h-4 w-4 text-white animate-pulse" />
              <span>Testar Metade do Caminho (5º Pedido) 🚀</span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerCelebration('goal')}
              className="px-5 py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-97 shadow-md flex-1 min-w-[200px]"
            >
              <Sparkles className="h-4 w-4 text-white" />
              <span>Testar Meta Batida (10º Pedido) 🎈</span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerCelebration('order_delivered')}
              className="px-5 py-3.5 bg-gradient-to-r from-emerald-650 to-emerald-800 hover:brightness-110 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-97 shadow-md flex-1 min-w-[200px]"
            >
              <Truck className="h-4 w-4 text-white animate-bounce" />
              <span>Testar Pedido Entregue 🚚💨</span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerCelebration('designer_halfway')}
              className="px-5 py-3.5 bg-gradient-to-r from-pink-500 to-indigo-500 hover:from-pink-600 hover:to-indigo-600 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-97 shadow-md flex-1 min-w-[200px]"
            >
              <Palette className="h-4 w-4 text-white animate-pulse" />
              <span>Testar Modo Criativo (5ª Arte) 🎨✨</span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerCelebration('designer_goal')}
              className="px-5 py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-97 shadow-md flex-1 min-w-[200px]"
            >
              <Bot className="h-4 w-4 text-white animate-bounce" />
              <span>Testar Modo Máquina (10ª Arte) 🤖🎨</span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerCelebration('welcome')}
              className="px-5 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-97 shadow-md flex-1 min-w-[200px]"
            >
              <Sun className="h-4 w-4 text-white animate-spin" style={{ animationDuration: '6s' }} />
              <span>Testar Boas-Vindas do Dia 🏡☕</span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerCelebration('weekly_50_orders')}
              className="px-5 py-3.5 bg-gradient-to-tr from-amber-500 via-yellow-400 to-pink-500 hover:brightness-110 text-black font-black rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-97 shadow-md flex-1 min-w-[200px]"
            >
              <Crown className="h-4 w-4 text-black animate-pulse" />
              <span>Testar Meta Semanal (50 Pedidos) 👑🏆</span>
            </button>
          </div>
        </div>
      )}

      {/* 🟢 FORÇAR ATUALIZAÇÃO / SINCRONIZAÇÃO EM TEMPO REAL PARA TODOS OS USUÁRIOS */}
      <div className="bg-zinc-900 rounded-2xl border border-emerald-550/15 p-6 shadow-md space-y-6">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
          <Megaphone className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <h3 className="font-display font-semibold text-base text-zinc-100">Atualização Forçada Unificada (Sincronização Realtime)</h3>
            <p className="text-[10px] text-zinc-450 mt-0.5">Sincronize instantaneamente todos os dispositivos e logins ativos do atelier de uma só vez</p>
          </div>
        </div>

        <div className="text-xs text-zinc-300 space-y-2 leading-relaxed">
          <p>
            Ocasionalmente, devido a caches de rotas ou sessões antigas de navegadores de celulares, alguns colaboradores podem demorar a receber as notificações ou novos pedidos em tempo real.
          </p>
          <p>
            Ao clicar no botão abaixo, você disparará um sinal Firestore em tempo real que <strong className="text-emerald-400">forçará todos os dispositivos (incluindo o seu perfil de administrador e todos os colaboradores logados)</strong> a exibir uma tela de recarga e recarregar os arquivos e caches do aplicativo automaticamente para a versão mais atualizada e 100% conectada ao Supabase Cloud.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            type="button"
            disabled={isTriggeringUpdate}
            onClick={async () => {
              if (onForceAllUsersUpdate) {
                setIsTriggeringUpdate(true);
                try {
                  await onForceAllUsersUpdate();
                  setUpdateTriggeredSuccess(true);
                  setTimeout(() => setUpdateTriggeredSuccess(false), 5000);
                } catch (e) {
                  // Erro tratado no App.tsx
                } finally {
                  setIsTriggeringUpdate(false);
                }
              }
            }}
            className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-550 disabled:bg-emerald-800 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-97 shadow-md"
          >
            {isTriggeringUpdate ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Enviando Comando de Atualização...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 text-white" />
                <span>Forçar Atualização / Sincronização em Todo o Sistema</span>
              </>
            )}
          </button>
        </div>

        {updateTriggeredSuccess && (
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-350 text-xs font-semibold animate-fade-in text-center">
            Comando de recarregamento executado com sucesso! Todos os celulares logados serão atualizados em segundos.
          </div>
        )}
      </div>

      {/* ZONA DE PERIGO: APAGAR PEDIDOS */}
      <div className="bg-red-950/10 rounded-2xl border border-red-900/30 p-6 shadow-md space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-950/40 border border-red-950 text-red-400 rounded-xl">
            <Trash className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base text-red-200">Zona de Perigo (Ação Irreversível)</h3>
            <p className="text-xs text-red-300/80 mt-1">Apagar todos os pedidos já feitos no aplicativo para reiniciar o sistema do zero.</p>
          </div>
        </div>

        <div className="text-xs text-red-350 bg-red-950/15 p-4 rounded-xl border border-red-910/30">
          Esta ação apagará permanentemente todos os lançamentos de vendas, orçamentos e históricos da nuvem (Supabase) e do seu dispositivo. Esta ação não afetará seu cadastro de produtos ou as informações de contato da loja.
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          {clearStep === 'idle' ? (
            <button
              onClick={handleClearSales}
              disabled={isClearingSales}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-950 hover:bg-red-900 text-red-200 font-bold border border-red-900/40 hover:border-red-500 rounded-xl text-sm transition-all cursor-pointer select-none"
            >
              <Trash className="h-4 w-4" />
              <span>Desejo Apagar Todos os Pedidos</span>
            </button>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              <p className="text-xs text-red-300 font-semibold text-center sm:text-left">
                ⚠️ Tem certeza absoluta? Essa ação não pode ser desfeita! Para prosseguir, insira a senha de confirmação abaixo.
              </p>
              
              <div className="flex flex-col gap-1.5 max-w-sm">
                <label className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                  Senha de Confirmação
                </label>
                <input
                  type="password"
                  placeholder="Digite a senha de segurança"
                  value={dangerPassword}
                  onChange={(e) => setDangerPassword(e.target.value)}
                  disabled={isClearingSales}
                  className="w-full py-2 px-3.5 bg-red-950/20 text-red-200 border border-red-900/40 rounded-xl text-xs font-semibold font-mono focus:border-red-500/80 focus:ring-1 focus:ring-red-550/30 outline-none transition-all placeholder:text-red-900/40"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleClearSales}
                  disabled={isClearingSales || dangerPassword !== '69apagar69'}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-red-650 hover:bg-red-750 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer select-none disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isClearingSales ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Processando Limpeza...</span>
                    </>
                  ) : (
                    <>
                      <Trash className="h-4 w-4 text-white" />
                      <span>Sim, Apagar Tudo Agora!</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setClearStep('idle');
                    setDangerPassword('');
                  }}
                  disabled={isClearingSales}
                  className="flex-1 py-2.5 px-4 bg-zinc-805 hover:bg-zinc-705 text-zinc-300 font-semibold rounded-xl text-xs sm:text-sm border border-zinc-750 transition-all cursor-pointer select-none"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {clearSuccess && (
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-350 text-xs font-semibold animate-fade-in flex items-center justify-center gap-2 text-center">
            <span>🎉 Sucesso! Todos os pedidos foram apagados e o sistema está limpo.</span>
          </div>
        )}
      </div>

    </div>
  );
}
