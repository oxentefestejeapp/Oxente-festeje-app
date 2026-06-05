/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Package, TrendingUp, DollarSign, Gift, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
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
  const totalSalesCount = sales.length;
  const totalRevenue = sales.reduce((acc, curr) => acc + curr.total, 0);

  // Products with stock less than 3 units
  const criticalProducts = products.filter(p => p.estoque < 3);
  const criticalCount = criticalProducts.length;

  return (
    <header className="no-print w-full bg-black border-b border-zinc-900 py-6 px-4 mb-8 relative">
      
      {/* Global Mute Toggle Control in Header */}
      <div className="absolute top-2 left-4 md:top-3 md:left-6 no-print">
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
      </div>
      
      {/* Upper Corner Critical Stock Alert Badge */}
      {criticalCount > 0 && (
        <div className="absolute top-2 right-4 md:top-3 md:right-6 flex items-center gap-1.5 bg-amber-950/30 border border-amber-800/80 text-amber-200 px-3 py-1 rounded-full text-xs font-bold shadow-3xs animate-fade-in select-none">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>
            Estoque Crítico: <span className="text-amber-300 font-extrabold">{criticalCount}</span> {criticalCount === 1 ? 'item' : 'itens'}
          </span>
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
