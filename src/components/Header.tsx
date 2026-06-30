/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Package, TrendingUp, DollarSign, Gift, AlertTriangle, Volume2, VolumeX, Wifi, WifiOff, X } from 'lucide-react';
import { Product, Sale } from '../types';
import { BrandLogo } from './BrandLogo';
import { playAppSound, getIsAudioMuted, setAudioMuted } from '../lib/audio';

interface HeaderProps {
  products: Product[];
  sales: Sale[];
  currentUserEmail?: string;
}

export function Header({ products, sales, currentUserEmail = '' }: HeaderProps) {
  const [audioMuted, setAudioMutedState] = useState(() => getIsAudioMuted());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showCriticalList, setShowCriticalList] = useState(false);
  const isAdmin = currentUserEmail === 'oxentefesteje@gmail.com' || currentUserEmail === 'abraaoapp@oxente.com';

  useEffect(() => {
    const handleMute = (e: any) => {
      setAudioMutedState(e.detail);
    };
    window.addEventListener('oxente_app_audio_mute_changed', handleMute);
    return () => {
      window.removeEventListener('oxente_app_audio_mute_changed', handleMute);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleMute = () => {
    const nextVal = !audioMuted;
    setAudioMuted(nextVal);
    setAudioMutedState(nextVal);
    if (!nextVal) {
      setTimeout(() => playAppSound('success'), 50);
    }
  };

  const totalProducts = products.length;
  const totalStock = products.reduce((acc, curr) => acc + curr.estoque, 0);
  const actualSales = sales.filter(s => s.status !== 'Orçamento');
  const totalSalesCount = actualSales.length;
  const totalRevenue = actualSales.reduce((acc, curr) => acc + curr.total, 0);

  // Products with stock less than 10 units (ignoring infinite stock and adicional products)
  const criticalProducts = products.filter(p => p && !p.adicional && !p.estoqueInfinito && p.estoque < 10);
  const criticalCount = criticalProducts.length;

  return (
    <header className="no-print w-full bg-black border-b border-zinc-900 py-6 px-4 mb-8 relative">
      
      {/* Global Controls (Mute + Connection Status) in Header */}
      <div className="absolute top-2 left-4 md:top-3 md:left-6 no-print flex items-center gap-2">
        <button
          onClick={toggleMute}
          className={`flex items-center gap-1.5 px-3 py-1 bg-black border rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm ${
            audioMuted
              ? 'border-zinc-850 text-zinc-550 hover:text-zinc-400'
              : 'border-brand-pink/25 text-brand-pink hover:bg-brand-pink/5 hover:border-brand-pink'
          }`}
          title={audioMuted ? "Ativar bipes de áudio" : "Mutar bipes de áudio"}
        >
          {audioMuted ? (
            <>
              <VolumeX className="h-3 w-3 text-zinc-550 shrink-0" />
              <span className="text-[9px] uppercase font-bold tracking-widest sm:inline hidden">Sons: Mutado</span>
            </>
          ) : (
            <>
              <Volume2 className="h-3 w-3 text-brand-pink shrink-0 animate-pulse" />
              <span className="text-[9px] uppercase font-bold tracking-widest sm:inline hidden">Sons: Ativos</span>
            </>
          )}
        </button>

        {/* Dynamic Connection Status Indicator */}
        <div 
          className={`flex items-center gap-1.5 px-3 py-1 bg-black border rounded-xl text-xs font-black select-none shadow-sm cursor-help ${
            isOnline 
              ? 'border-emerald-900/30 text-emerald-500 bg-emerald-950/5' 
              : 'border-amber-900/40 text-amber-500 bg-amber-950/20 animate-pulse'
          }`}
          title={isOnline ? "Você está conectado à internet! Seus dados estão sincronizando em tempo real com o banco de dados." : "Você está offline! Suas alterações estão salvas localmente neste dispositivo e serão sincronizadas assim que a conexão for restabelecida."}
        >
          {isOnline ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <Wifi className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-[9px] uppercase font-bold tracking-widest sm:inline hidden">Online</span>
            </>
          ) : (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
              <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-[9px] uppercase font-bold tracking-widest sm:inline hidden text-amber-400">Offline</span>
            </>
          )}
        </div>
      </div>
      
      {/* Upper Corner Critical Stock Alert Badge - Interactive and clickable for all users */}
      {criticalCount > 0 && (
        <button
          onClick={() => setShowCriticalList(true)}
          className="absolute top-2 right-4 md:top-3 md:right-6 flex items-center gap-1.5 bg-amber-950/40 hover:bg-amber-905 border border-amber-800/80 text-amber-200 px-3 py-1 rounded-full text-xs font-bold shadow-3xs animate-fade-in select-none cursor-pointer transition-colors"
          title="Clique para localizar produtos com estoque crítico"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>
            Estoque Crítico: <span className="text-amber-300 font-extrabold">{criticalCount}</span> {criticalCount === 1 ? 'item' : 'itens'}
          </span>
        </button>
      )}

      {/* Critical Stock List Modal to let all users easily see and locate low-stock products */}
      {showCriticalList && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4 select-none animate-fade-in">
          <div 
            className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative p-6 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-5 w-5 text-amber-400 animate-bounce" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 font-sans">Estoque Crítico</h3>
              </div>
              <button 
                onClick={() => setShowCriticalList(false)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Subtext */}
            <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed font-medium">
              Os seguintes produtos possuem estoque igual ou inferior a <strong className="text-amber-400">10 itens</strong>. Providencie a reposição para evitar a falta do produto:
            </p>

            {/* List container */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {criticalProducts.map((p) => (
                <div 
                  key={p.id} 
                  className="flex justify-between items-center bg-zinc-905 border border-zinc-850 p-2.5 rounded-xl hover:border-amber-900/40 transition-colors"
                >
                  <p className="text-xs font-bold text-zinc-200 truncate pr-2" title={p.nome}>{p.nome}</p>
                  <span className="px-2.5 py-0.5 bg-red-950/40 border border-red-500/30 text-red-400 font-black text-[11px] rounded-full shrink-0">
                    {p.estoque} un.
                  </span>
                </div>
              ))}
            </div>

            {/* CTA action */}
            <button
              onClick={() => setShowCriticalList(false)}
              className="mt-5 w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-350 font-bold rounded-xl text-xs transition-colors cursor-pointer select-none"
            >
              Ciente, fechar visualização 🚀
            </button>
          </div>
        </div>
      )}

      <div className={`${isAdmin ? 'max-w-7xl' : 'max-w-5xl'} mx-auto flex flex-col md:flex-row items-center justify-between gap-6`}>
        
        {/* Logo and Brand */}
        <div className="flex items-center gap-3 text-center md:text-left">
          <BrandLogo size="md" />
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2">
              <h1 className="font-display font-bold text-3xl tracking-tight text-brand-pink leading-none">
                Oxente Festeje
              </h1>
              <Sparkles className="h-5 w-5 text-brand-pink fill-brand-pink" />
            </div>
            <p className="text-xs text-pink-500 font-bold uppercase tracking-widest mt-1">
              Brindes Personalizados
            </p>
          </div>
        </div>

        {/* Real-time stats indicators */}
        <div className={`grid gap-3 w-full md:w-auto ${
          isAdmin 
            ? 'grid-cols-2 lg:grid-cols-4' 
            : 'grid-cols-1 sm:grid-cols-3'
        }`}>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-brand-pink shadow-xs">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Produtos</p>
              <h4 className="text-lg font-bold text-zinc-100">{totalProducts}</h4>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-brand-pink shadow-xs">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Estoque Total</p>
              <h4 className="text-lg font-bold text-zinc-100">{totalStock} <span className="text-xs text-brand-pink font-medium">un.</span></h4>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-amber-500 shadow-xs">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Vendas</p>
              <h4 className="text-lg font-bold text-zinc-100">{totalSalesCount}</h4>
            </div>
          </div>

          {isAdmin && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-emerald-450 shadow-xs">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Faturamento</p>
                <h4 className="text-lg font-bold text-emerald-400">R$ {totalRevenue.toFixed(2)}</h4>
              </div>
            </div>
          )}

        </div>
        
      </div>
    </header>
  );
}
