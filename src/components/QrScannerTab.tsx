import React, { useEffect, useRef, useState } from 'react';
import { 
  QrCode, Camera, CameraOff, AlertCircle, RefreshCw, 
  MessageSquare, User, Phone, Briefcase, Calendar, 
  Coins, FileText, CheckCircle2, ChevronRight, Play, Square, 
  Sparkles, BellRing
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5Qrcode } from 'html5-qrcode';
import { Sale, StoreInfo } from '../types';
import { playAppSound } from '../lib/audio';
import { WhatsAppNotifier } from './WhatsAppNotifier';

interface QrScannerTabProps {
  sales: Sale[];
  storeInfo: StoreInfo;
  onUpdateSale: (updatedSale: Sale) => void;
}

interface ScanHistoryItem {
  timestamp: string;
  decodedText: string;
  sale: Sale | null;
  status: 'found' | 'not_found' | 'invalid';
}

export default function QrScannerTab({ sales, storeInfo, onUpdateSale }: QrScannerTabProps) {
  const qrCodeRegionId = "oxente-qr-scanner-viewfinder";
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ id: string; time: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [scannedSale, setScannedSale] = useState<Sale | null>(null);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'pronto' | 'entregue'>('pronto');
  // Initialize and list cameras on mount
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices: any[]) => {
        setCameras(devices);
        if (devices.length > 0) {
          // Default to the back camera (containing "back" or "traseira" in labeled environment, otherwise final device)
          const backCam = devices.find(device => 
            device.label?.toLowerCase().includes('back') || 
            device.label?.toLowerCase().includes('traseira') || 
            device.label?.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
          setCameraPermission('granted');
        } else {
          setCameraPermission('denied');
        }
      })
      .catch((err) => {
        console.warn('Erro ao obter câmeras:', err);
        setCameraPermission('denied');
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async (deviceIdToUse?: string) => {
    const targetId = deviceIdToUse || selectedCameraId;
    if (!targetId) {
      setScanError('Câmera não selecionada ou não disponível.');
      return;
    }

    try {
      setScanError(null);
      // Ensure any current scanner is stopped
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      // Instantiate
      const html5Qr = new Html5Qrcode(qrCodeRegionId);
      html5QrCodeRef.current = html5Qr;

      await html5Qr.start(
        targetId,
        {
          fps: 12,
          qrbox: (width, height) => {
            const minDim = Math.min(width, height);
            const size = Math.floor(minDim * 0.7);
            return { width: size, height: size };
          }
        },
        (decodedText) => {
          handleSuccessScan(decodedText);
        },
        (errorMessage) => {
          // Silent verbose frame scanning errors (common and expected)
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.warn('Erro ao iniciar câmera:', err);
      setScanError(`Não foi possível acessar a câmera. Verifique permissões ou se outra aba está usando-a. (${err.message || err})`);
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.warn('Erro ao parar câmera:', e);
      }
    }
    setIsScanning(false);
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    if (isScanning) {
      // Restart with new camera
      stopScanning().then(() => {
        startScanning(newId);
      });
    }
  };

  const getRawMessageText = (sale: Sale, mode: 'pronto' | 'entregue') => {
    const clientVal = (sale.cliente || 'Consumidor').trim();
    const orderNumber = sale.numeroPedido || sale.id.substring(0, 5).toUpperCase();
    const orderVal = orderNumber.trim() ? ` (Pedido #${orderNumber.trim()})` : '';

    if (mode === 'entregue') {
      return `Olá, *${clientVal}*! 🥰
      
®️ Passando para avisar que seu pedido *#${orderNumber.trim()}* foi retirado / entregue com sucesso! 🎉

Muito obrigado pela preferência e confiança em nosso trabalho! É um prazer imenso fazer parte do seu momento especial! ❤️ ✨

Até a próxima comemoração! 🎈`;
    }

    const defaultTemplate = `Olá, *{cliente}*!

®️ seu pedido está pronto para retirada{pedido}

⚠️ lembrando que fechamos aos sabados ao meio dia

📍 Segue o endereço abaixo

*ENDEREÇO HORÁRIOS & PONTO DE REFERENCIA*:

Rua Josina Lessa Feitosa 176

Mangabeira 1

*Ponto de referência* 

Entrando a direta da Boticário da Av Josefa Taveira, pega a primeira rua à direita.

*🚨Horário  de atendimento e retirada de produtos🚨*

Segunda a Sexta de 8:30h às 12h das 13:00h às 17:00h

Sábados de 8:30h às 12h 

*Fechado aos domingos e feriados*`;

    const rawTemplate = storeInfo?.whatsappTemplate || defaultTemplate;
    const statusVal = sale.statusProducao || 'Pronto para Retirada';
    
    return rawTemplate
      .replace(/{cliente}/g, clientVal)
      .replace(/{pedido}/g, orderVal)
      .replace(/{status_producao}/g, statusVal)
      .replace(/{status}/g, statusVal);
  };

  const getWhatsAppLink = (sale: Sale, mode: 'pronto' | 'entregue') => {
    const phone = sale.telefoneCliente || '';
    const cleanPhone = phone.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.length > 0) {
      if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        finalPhone = `55${cleanPhone}`;
      }
    }
    const encodedText = encodeURIComponent(getRawMessageText(sale, mode));
    return `whatsapp://send?phone=${finalPhone}&text=${encodedText}`;
  };

  const handleSuccessScan = (text: string) => {
    const now = Date.now();
    let saleId = '';
    let parsedText = text.trim();

    // Check if the QR code conforms to tracking URLs or standard "oxente:id"
    if (parsedText.includes('acompanhar=')) {
      const parts = parsedText.split('acompanhar=');
      if (parts.length > 1) {
        saleId = parts[1].split('&')[0];
      }
    } else if (parsedText.startsWith('oxente:')) {
      saleId = parsedText.substring(7);
    } else {
      saleId = parsedText;
    }

    // Lookup sale
    const foundSale = sales.find(s => s.id === saleId || s.numeroPedido === saleId);

    if (foundSale) {
      // Cooldown to prevent repeating the scan of the same sale in rapid succession
      if (lastScannedRef.current && lastScannedRef.current.id === foundSale.id && (now - lastScannedRef.current.time) < 4000) {
        return;
      }
      lastScannedRef.current = { id: foundSale.id, time: now };

      playAppSound('pop');
      playAppSound('success');
      
      const targetStatus = scanMode === 'pronto' ? 'Pronto para Retirada' : 'Entregue';
      const updated: Sale = {
        ...foundSale,
        statusProducao: targetStatus,
        foiAlterado: true,
        editadoEm: new Date().toISOString()
      };
      
      // Persist to parent/database
      onUpdateSale(updated);
      setScannedSale(updated);
      
      // Append to local scanning history avoiding duplicates sequentially
      setScanHistory(prev => {
        const exists = prev.some(h => h.sale?.id === updated.id);
        const newItem: ScanHistoryItem = {
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          decodedText: text,
          sale: updated,
          status: 'found'
        };
        if (exists) {
          return [newItem, ...prev.filter(h => h.sale?.id !== updated.id)];
        }
        return [newItem, ...prev];
      });

      // REDIRECT TO WHATSAPP AUTOMATICALLY - ZERO CLICKS NEEDED! Keep camera active!
      try {
        const link = getWhatsAppLink(updated, scanMode);
        window.location.href = link;
      } catch (err) {
        console.warn('Erro ao abrir link de WhatsApp automaticamente:', err);
      }
    } else {
      // Cooldown for unknown barcodes/QRs to prevent alarm sound spam
      if (lastScannedRef.current && lastScannedRef.current.id === saleId && (now - lastScannedRef.current.time) < 4000) {
        return;
      }
      lastScannedRef.current = { id: saleId, time: now };

      playAppSound('alert');
      // Look for a close match in numbers if the scanner read raw code or text
      setScanHistory(prev => [
        {
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          decodedText: text,
          sale: null,
          status: 'not_found'
        },
        ...prev
      ]);
      setScanError(`Código lido: "${text}". Nenhum pedido correspondente encontrado no banco de dados.`);
    }
  };

  const handleMarkReadyAndNotify = (sale: Sale, mode: 'pronto' | 'entregue') => {
    const targetStatus = mode === 'pronto' ? 'Pronto para Retirada' : 'Entregue';
    const updated: Sale = {
      ...sale,
      statusProducao: targetStatus,
      foiAlterado: true,
      editadoEm: new Date().toISOString()
    };
    onUpdateSale(updated);
    setScannedSale(updated);
    
    // Fallback/Re-send WhatsApp Link manually can directly rewrite location
    try {
      window.location.href = getWhatsAppLink(updated, mode);
    } catch (err) {
      console.warn(err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto select-none">
      
      {/* Header Info */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-brand-pink/10 border border-brand-pink/20 rounded-xl text-brand-pink shrink-0">
            <QrCode className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              Leitor Ágil de QR Codes
              <Sparkles className="h-4 w-4 text-amber-400 fill-amber-400" />
            </h2>
            <p className="text-xs text-zinc-400">
              Escaneie o QR Code impresso no recibo térmico para abrir a mensagem do WhatsApp do cliente de forma imediata!
            </p>
          </div>
        </div>

        {/* Cam controls */}
        {cameras.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="flex-1 md:flex-initial">
              <select 
                value={selectedCameraId}
                onChange={handleCameraChange}
                className="w-full bg-black border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 px-3 py-2 rounded-xl focus:outline-none transition-all cursor-pointer"
              >
                {cameras.map(cam => (
                  <option key={cam.id} value={cam.id}>
                    📷 {cam.label || `Câmera ${cam.id.substring(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
            
            {isScanning ? (
              <button
                onClick={stopScanning}
                className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white hover:text-red-100 font-bold border border-red-900/35 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-97"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Parar</span>
              </button>
            ) : (
              <button
                onClick={() => startScanning()}
                className="px-4 py-2 bg-brand-pink text-black font-bold hover:bg-brand-pink-hover rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-97"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Ativar Câmera</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <div className="bg-zinc-900 border border-zinc-850 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="space-y-0.5 text-center sm:text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 justify-center sm:justify-start">
            Ação Instantânea ao Escanear
          </h3>
          <p className="text-[11px] text-zinc-500 font-medium">Defina se a leitura mudará o status para pronto para retirada ou entregue</p>
        </div>
        <div className="bg-black/60 border border-zinc-850 p-1 rounded-xl flex w-full sm:w-auto relative select-none">
          <button
            type="button"
            onClick={() => {
              setScanMode('pronto');
              playAppSound('click');
            }}
            className={`flex-1 sm:flex-initial px-4.5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              scanMode === 'pronto'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Avisar Pronto</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setScanMode('entregue');
              playAppSound('click');
            }}
            className={`flex-1 sm:flex-initial px-4.5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              scanMode === 'entregue'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Avisar Entregue</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left is scanner viewport, Right is detected card & history */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* VIEWPORT COLUMN */}
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-3xl p-4.5 relative overflow-hidden shadow-2xl flex flex-col items-center justify-center min-h-[380px]">
            
            {/* Real scanner view tag */}
            <div className="w-full max-w-[340px] aspect-square rounded-2xl overflow-hidden relative border border-zinc-850 bg-black flex flex-col items-center justify-center">
              <div 
                id={qrCodeRegionId} 
                className="w-full h-full object-cover"
              />

              {/* Holographic camera cover if not scanning */}
              {!isScanning && (
                <div className="absolute inset-0 bg-zinc-900/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 space-y-3 z-10 animate-fade-in">
                  <div className="w-14 h-14 rounded-full bg-zinc-800/70 border border-zinc-700/50 flex items-center justify-center text-zinc-500">
                    <CameraOff className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-widest font-sans">Visualizador Desativado</h3>
                    <p className="text-[10.5px] text-zinc-500 leading-normal max-w-[245px] mx-auto font-medium">
                      Clique no botão "Ativar Câmera" acima para iniciar o leitor inteligente de QR Codes. Referencie permissões se necessário.
                    </p>
                  </div>
                </div>
              )}

              {/* Scanning visual indicators (laser line & corner target frame) */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                  
                  {/* Laser green sweeping line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-pink to-transparent opacity-85 shadow-[0_0_12px_#ff007f] animate-bounce w-full top-[15%]" style={{ animationDuration: '3s' }} />

                  {/* Corner brackets targets */}
                  <div className="absolute top-10 left-10 w-6 h-6 border-t-4 border-l-4 border-brand-pink rounded-tl-md" />
                  <div className="absolute top-10 right-10 w-6 h-6 border-t-4 border-r-4 border-brand-pink rounded-tr-md" />
                  <div className="absolute bottom-10 left-10 w-6 h-6 border-b-4 border-l-4 border-brand-pink rounded-bl-md" />
                  <div className="absolute bottom-10 right-10 w-6 h-6 border-b-4 border-r-4 border-brand-pink rounded-br-md" />

                  <span className="absolute bottom-3 text-[9px] font-bold tracking-widest text-brand-pink uppercase animate-pulse bg-black/60 px-2.5 py-1 rounded-full border border-brand-pink/15 select-none">
                    ALINHADO AO QUADRANTE
                  </span>
                </div>
              )}
            </div>

            {/* Error notifications or tips */}
            {scanError && (
              <div className="mt-4 p-3 bg-red-950/15 border border-red-900/30 rounded-xl flex items-start gap-2.5 max-w-[340px] animate-fade-in select-text">
                <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-400 leading-normal font-semibold">
                  {scanError}
                </p>
              </div>
            )}

            {!scanError && isScanning && (
              <p className="mt-4 text-[10px] text-zinc-500 font-bold uppercase tracking-wider text-center select-none animate-pulse">
                Aponte a câmera para o QR Code localizado na base do recibo térmico impresso.
              </p>
            )}
          </div>
        </div>

        {/* DETAILS & INTERACTION COLUMN */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {scannedSale ? (
              <motion.div
                key={scannedSale.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5.5 space-y-4 shadow-xl select-text"
              >
                {/* Visual Card Header */}
                <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
                  <div className="space-y-1">
                    <span className="text-[10px] px-2.5 py-1 bg-brand-pink/10 border border-brand-pink/20 rounded-full font-bold text-brand-pink uppercase tracking-widest select-none">
                      Pedido Localizado
                    </span>
                    <h3 className="text-base font-extrabold text-zinc-100 flex items-center gap-1.5 pt-1.5 font-display">
                      <User className="h-4 w-4 text-zinc-550" />
                      {scannedSale.cliente}
                    </h3>
                  </div>

                  <button
                    onClick={() => {
                      setScannedSale(null);
                      // Resume camera seamlessly if it was active
                      startScanning();
                    }}
                    className="text-xxs font-black uppercase text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/40 bg-zinc-950 p-2 rounded-xl transition-all cursor-pointer"
                  >
                    Escanear Outro
                  </button>
                </div>

                {/* Technical Information Blocks */}
                <div className="grid grid-cols-2 gap-3.5 text-xs">
                  <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl space-y-1.5">
                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1 select-none">
                      <FileText className="h-3 w-3 text-brand-pink" />
                      Nº Pedido
                    </span>
                    <strong className="text-zinc-200 font-mono text-sm block">
                      #{scannedSale.numeroPedido || scannedSale.id.substring(0, 5).toUpperCase()}
                    </strong>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl space-y-1.5">
                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1 select-none">
                      <Phone className="h-3 w-3 text-brand-pink" />
                      Whatsapp
                    </span>
                    <strong className="text-zinc-200 font-mono text-xs block truncate leading-normal">
                      {scannedSale.telefoneCliente || 'Não informado'}
                    </strong>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl space-y-1.5 col-span-2">
                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1 select-none">
                      <Briefcase className="h-3 w-3 text-brand-pink" />
                      Produto(s) do Pedido
                    </span>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                      {scannedSale.itens && scannedSale.itens.length > 0 ? (
                        scannedSale.itens.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] text-zinc-300 font-medium">
                            <span className="truncate max-w-[200px] font-semibold">{it.produtoNome}</span>
                            <span className="font-mono text-zinc-450">Qtd: {it.quantidade}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between items-center text-[11px] text-zinc-300 font-medium">
                          <span className="truncate max-w-[200px] font-semibold">{scannedSale.produtoNome}</span>
                          <span className="font-mono text-zinc-450">Qtd: {scannedSale.quantidade}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl space-y-1.5">
                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1 select-none">
                      <Coins className="h-3 w-3 text-brand-pink" />
                      Situação Financeira
                    </span>
                    {(() => {
                      const falta = scannedSale.valorFaltante !== undefined ? scannedSale.valorFaltante : (scannedSale.total - (scannedSale.valorPago ?? 0));
                      return falta > 0 ? (
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-red-400 font-bold block uppercase">Pendente</span>
                          <span className="text-xs font-bold text-zinc-400">Restante: <strong className="text-zinc-100 font-mono">R$ {falta.toFixed(2)}</strong></span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-emerald-450 font-bold block uppercase">Pago Total</span>
                          <strong className="text-[10.5px] font-mono text-zinc-450 leading-none">R$ {scannedSale.total.toFixed(2)}</strong>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl space-y-1.5">
                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1 select-none">
                      <Calendar className="h-3 w-3 text-brand-pink" />
                      Prazo de Entrega
                    </span>
                    <strong className="text-zinc-200 text-xs block truncate">
                      {scannedSale.dataRetirada 
                        ? new Date(scannedSale.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') 
                        : 'Sem prazo'}
                    </strong>
                  </div>
                </div>

                {/* Automated Flow Status Banner */}
                <div className={`${scanMode === 'entregue' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-pink-500/10 border-pink-500/20'} border p-3.5 rounded-2xl flex items-center gap-3 select-none`}>
                  <div className={`p-2 ${scanMode === 'entregue' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-pink-500/10 text-pink-400'} rounded-xl font-extrabold flex items-center justify-center animate-bounce`}>
                    {scanMode === 'entregue' ? (
                      <CheckCircle2 className="h-4.5 w-4.5 animate-pulse" />
                    ) : (
                      <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider block">
                      {scanMode === 'entregue' ? 'Aviso de Entrega Disparado!' : 'Aviso Disponível Adicionado!'}
                    </span>
                    <p className="text-[10.5px] font-semibold text-zinc-300 leading-normal">
                      Status do pedido mudou para{' '}
                      <strong className={`${scanMode === 'entregue' ? 'text-emerald-400' : 'text-brand-pink'} font-black`}>
                        {scanMode === 'entregue' ? 'Entregue' : 'Pronto para Retirada'}
                      </strong>{' '}
                      e o WhatsApp foi aberto automaticamente com o aviso!
                    </p>
                  </div>
                </div>

                {/* Operations Actions block */}
                <div className="pt-2 flex flex-col gap-2.5 select-none">
                  <button
                    onClick={() => {
                      setScannedSale(null);
                      startScanning();
                    }}
                    className="w-full px-5 py-3.5 bg-brand-pink text-black font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(255,0,127,0.25)] active:scale-98 hover:bg-brand-pink/90"
                  >
                    <Play className="h-4.5 w-4.5 fill-black" />
                    <span>Escanear Próximo Pedido</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleMarkReadyAndNotify(scannedSale, scanMode)}
                      className="px-3.5 py-3.5 bg-zinc-950 hover:bg-zinc-850 hover:text-white border border-zinc-850 text-zinc-350 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Reabrir conversa se necessário"
                    >
                      <MessageSquare className="h-4 w-4 text-emerald-450 shrink-0" />
                      <span>Reenviar WhatsApp</span>
                    </button>

                    <button
                      onClick={() => {
                        const nextStatus = scannedSale.statusProducao === 'Entregue' ? 'Pronto para Retirada' : 'Entregue';
                        const updated: Sale = {
                          ...scannedSale,
                          statusProducao: nextStatus,
                          foiAlterado: true,
                          editadoEm: new Date().toISOString()
                        };
                        onUpdateSale(updated);
                        setScannedSale(updated);
                        playAppSound('success');
                      }}
                      className={`px-3.5 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        scannedSale.statusProducao === 'Entregue'
                          ? 'bg-zinc-850 border border-zinc-750 text-zinc-450 hover:text-zinc-300'
                          : 'bg-zinc-950 border border-zinc-850 text-zinc-350 hover:text-zinc-250'
                      }`}
                    >
                      <CheckCircle2 className={`h-4.5 w-4.5 shrink-0 ${scannedSale.statusProducao === 'Entregue' ? 'text-emerald-400 font-extrabold' : 'text-zinc-650'}`} />
                      <span>{scannedSale.statusProducao === 'Entregue' ? 'Já Entregue' : 'Marcar Entregue'}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-zinc-950 border border-dashed border-zinc-850 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[180px] text-zinc-550 space-y-2 select-none"
              >
                <div className="w-12 h-12 rounded-full border border-zinc-850 bg-black/40 flex items-center justify-center animate-pulse">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Aguardando Leitura de Pedido</h3>
                  <p className="text-[10px] text-zinc-500 max-w-[280px] mx-auto mt-1 font-medium leading-relaxed">
                    Ative a câmera e aponte-a para o QR Code de controle do recibo do cliente. Ao escanear, o painel do pedido aparecerá aqui.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HISTORIC SCAN LOG */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5.5 space-y-3.5 shadow-md">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-2.5">
              <BellRing className="h-4 w-4 text-brand-pink" />
              Histórico de Leituras Recentes
            </h4>

            {scanHistory.length > 0 ? (
              <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
                {scanHistory.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      if (item.sale) {
                        setScannedSale(item.sale);
                        playAppSound('click');
                      }
                    }}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs cursor-pointer transition-all ${
                      item.status === 'found'
                        ? 'bg-zinc-950/75 border-zinc-850 hover:bg-zinc-950 hover:border-zinc-750 text-zinc-200'
                        : 'bg-red-950/10 border-red-950/30 text-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[9.5px] font-mono text-zinc-500 font-bold shrink-0">{item.timestamp}</span>
                      <div className="min-w-0">
                        {item.sale ? (
                          <>
                            <span className="font-extrabold text-zinc-200 block truncate">{item.sale.cliente}</span>
                            <span className="text-[10.2px] text-zinc-450 font-semibold block uppercase">
                              Pedido #{item.sale.numeroPedido || item.sale.id.substring(0, 5).toUpperCase()}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-red-400 block truncate">Desconhecido</span>
                            <span className="text-[10.3px] text-zinc-500 font-mono block truncate">{item.decodedText}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {item.sale && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          item.sale.statusProducao === 'Pronto'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-900/30'
                            : item.sale.statusProducao === 'Entregue'
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-750'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-900/20'
                        }`}>
                          {item.sale.statusProducao || 'Agendado'}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-zinc-650" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10.5px] text-zinc-500 font-medium text-center py-4 select-none">
                Nenhuma leitura realizada nesta sessão de trabalho.
              </p>
            )}
          </div>
        </div>

      </div>

      <WhatsAppNotifier
        sale={scannedSale}
        isOpen={whatsAppOpen}
        onClose={() => setWhatsAppOpen(false)}
        onUpdateSale={(updatedSale) => {
          onUpdateSale(updatedSale);
          setScannedSale(updatedSale);
        }}
        storeInfo={storeInfo}
      />

    </div>
  );
}
