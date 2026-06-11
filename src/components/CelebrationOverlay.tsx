import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Star, X, Rocket, Zap, Flame, Bot, Cpu, Palette, Brain, Sun, Coffee, Heart, Truck, Gift, CheckCircle2, Calendar, Clock, AlertTriangle, AlertOctagon, Award, Crown } from 'lucide-react';
import { playAppSound } from '../lib/audio';

interface CelebrationOverlayProps {
  onClose: () => void;
  type?: 'halfway' | 'goal' | 'designer_goal' | 'welcome' | 'designer_halfway' | 'order_delivered' | 'critical_stock' | 'weekly_50_orders';
  userName?: string;
  productName?: string;
  productStock?: number;
}

interface Balloon {
  id: number;
  x: number; // percentage width
  delay: number;
  color: string;
  size: number;
}

interface FireworkSpark {
  id: number;
  angle: number;
  distance: number;
  color: string;
}

interface FireworkCluster {
  id: number;
  x: number; // percentage
  y: number; // percentage
  delay: number;
  sparks: FireworkSpark[];
}

interface CosmicStar {
  id: number;
  x: number; // percentage width
  y: number; // percentage height
  scale: number;
  delay: number;
  speed: number;
  rotation: number;
}

export function CelebrationOverlay({ onClose, type = 'goal', userName, productName, productStock }: CelebrationOverlayProps) {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [fireworks, setFireworks] = useState<FireworkCluster[]>([]);
  const [cosmicStars, setCosmicStars] = useState<CosmicStar[]>([]);

  useEffect(() => {
    if (type === 'goal') {
      // 1. Balloon setup for goal completion
      const colors = [
        'bg-pink-500 shadow-pink-500/50',
        'bg-purple-500 shadow-purple-500/50',
        'bg-amber-500 shadow-amber-500/50',
        'bg-emerald-500 shadow-emerald-500/50',
        'bg-rose-500 shadow-rose-500/50',
        'bg-indigo-500 shadow-indigo-500/50',
        'bg-sky-500 shadow-sky-500/50'
      ];

      const generatedBalloons = Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        x: Math.random() * 90 + 5,
        delay: Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 20 + 35
      }));
      setBalloons(generatedBalloons);

      // 2. Firework setup for goal completion
      const sparkColors = ['#ec4899', '#a855f7', '#eab308', '#22c55e', '#ef4444', '#06b6d4', '#6366f1'];
      const generatedFireworks = Array.from({ length: 5 }).map((_, i) => {
        const sparks = Array.from({ length: 12 }).map((_, s) => ({
          id: s,
          angle: (s * 360) / 12,
          distance: Math.random() * 65 + 55,
          color: sparkColors[Math.floor(Math.random() * sparkColors.length)]
        }));

        return {
          id: i,
          x: Math.random() * 60 + 20,
          y: Math.random() * 40 + 20,
          delay: i * 0.4,
          sparks
        };
      });
      setFireworks(generatedFireworks);

      playAppSound('complete');
      const audioIntervals = [300, 600, 1000];
      const timers = audioIntervals.map(ms => 
        setTimeout(() => {
          playAppSound('success');
        }, ms)
      );

      const autoCloseTimer = setTimeout(() => {
        onClose();
      }, 12000);

      return () => {
        timers.forEach(clearTimeout);
        clearTimeout(autoCloseTimer);
      };
    } else if (type === 'order_delivered') {
      // Setup celebratory delivery stars and packages
      const generatedStars = Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 50 + 50,
        scale: Math.random() * 0.75 + 0.45,
        delay: Math.random() * 2,
        speed: Math.random() * 2.5 + 2.2,
        rotation: Math.random() * 360
      }));
      setCosmicStars(generatedStars);

      playAppSound('success');
      const secondBeep = setTimeout(() => {
        playAppSound('success');
      }, 300);

      const autoCloseTimer = setTimeout(() => {
        onClose();
      }, 8000); // 8 seconds is perfect for an order delivery toast

      return () => {
        clearTimeout(secondBeep);
        clearTimeout(autoCloseTimer);
      };
    } else if (type === 'designer_halfway') {
      // Setup charming palette stars and design sparkles
      const generatedStars = Array.from({ length: 24 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 50 + 50,
        scale: Math.random() * 0.7 + 0.4,
        delay: Math.random() * 2,
        speed: Math.random() * 2.8 + 2.5,
        rotation: Math.random() * 360
      }));
      setCosmicStars(generatedStars);

      playAppSound('success');
      const secondBeep = setTimeout(() => {
        playAppSound('success');
      }, 350);

      const autoCloseTimer = setTimeout(() => {
        onClose();
      }, 10000);

      return () => {
        clearTimeout(secondBeep);
        clearTimeout(autoCloseTimer);
      };
    } else if (type === 'designer_goal') {
      // 3. Cyber/neon design celebration
      const generatedStars = Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100, // full screen wide
        y: Math.random() * 50 + 50, // bottom half start
        scale: Math.random() * 0.7 + 0.5,
        delay: Math.random() * 2.5,
        speed: Math.random() * 3 + 2, // speed
        rotation: Math.random() * 360
      }));
      setCosmicStars(generatedStars);

      // Cyber/AI neon sparks and sounds
      playAppSound('complete');
      const audioTimer = setTimeout(() => {
        playAppSound('success');
      }, 450);

      const autoCloseTimer = setTimeout(() => {
        onClose();
      }, 12000);

      return () => {
        clearTimeout(audioTimer);
        clearTimeout(autoCloseTimer);
      };
    } else if (type === 'welcome') {
      // Setup beautiful morning elements - soft sparkles, sunshine, loving stars
      const generatedStars = Array.from({ length: 25 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 60 + 30, // all over
        scale: Math.random() * 0.7 + 0.4,
        delay: Math.random() * 2,
        speed: Math.random() * 3 + 2.5,
        rotation: Math.random() * 360
      }));
      setCosmicStars(generatedStars);

      playAppSound('success');
      
      const autoCloseTimer = setTimeout(() => {
        onClose();
      }, 15000); // slightly more time to read the gorgeous morning greeting

      return () => {
        clearTimeout(autoCloseTimer);
      };
    } else if (type === 'critical_stock') {
      // Setup alarming yellow/red pulsing warning signs
      const generatedStars = Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 60 + 30, // all over
        scale: Math.random() * 0.7 + 0.5,
        delay: Math.random() * 1.5,
        speed: Math.random() * 3.5 + 2.5,
        rotation: Math.random() * 30 - 15
      }));
      setCosmicStars(generatedStars);

      playAppSound('alert');
      const secondBeep = setTimeout(() => {
        playAppSound('alert');
      }, 500);

      const autoCloseTimer = setTimeout(() => {
        onClose();
      }, 15000);

      return () => {
        clearTimeout(secondBeep);
        clearTimeout(autoCloseTimer);
      };
    } else if (type === 'weekly_50_orders') {
      // Celestial, glamorous golden and pink cosmic star setup for weekly 50 orders
      const generatedStars = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 60 + 35, // starting lower and ascending
        scale: Math.random() * 0.85 + 0.55,
        delay: Math.random() * 3,
        speed: Math.random() * 3.5 + 2.2,
        rotation: Math.random() * 360
      }));
      setCosmicStars(generatedStars);

      // Play continuous epic reward sounds
      playAppSound('complete');
      const secondBeep = setTimeout(() => {
        playAppSound('complete');
      }, 350);
      const thirdBeep = setTimeout(() => {
        playAppSound('success');
      }, 700);

      const autoCloseTimer = setTimeout(() => {
        onClose();
      }, 15000);

      return () => {
        clearTimeout(secondBeep);
        clearTimeout(thirdBeep);
        clearTimeout(autoCloseTimer);
      };
    } else {
      // type === 'halfway'
      const generatedStars = Array.from({ length: 25 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100, // full screen
        y: Math.random() * 50 + 50, // lower screen half initially
        scale: Math.random() * 0.6 + 0.5,
        delay: Math.random() * 2.5,
        speed: Math.random() * 2.5 + 2.5, // ascending speed
        rotation: Math.random() * 360
      }));
      setCosmicStars(generatedStars);

      // Energetic progression sounds
      playAppSound('success');
      const secondBeep = setTimeout(() => {
        playAppSound('success');
      }, 400);

      const autoCloseTimer = setTimeout(() => {
        onClose();
      }, 10000);

      return () => {
        clearTimeout(secondBeep);
        clearTimeout(autoCloseTimer);
      };
    }
  }, [onClose, type]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden pointer-events-none">
      {/* Darkened subtle celebratory backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md pointer-events-auto"
        onClick={onClose}
      />

      {/* RENDER GOAL VISUAL LAYERS (10th Order) */}
      {type === 'goal' && (
        <>
          {/* Floating Balloons Layer */}
          <div className="absolute inset-x-0 bottom-0 top-0 overflow-hidden pointer-events-none">
            {balloons.map((balloon) => (
              <motion.div
                key={balloon.id}
                initial={{ y: '110vh', x: `${balloon.x}vw`, opacity: 0.9 }}
                animate={{ 
                  y: '-20vh',
                  x: [
                    `${balloon.x}vw`, 
                    `${balloon.x + (balloon.id % 2 === 0 ? 5 : -5)}vw`, 
                    `${balloon.x + (balloon.id % 2 === 0 ? -3 : 3)}vw`, 
                    `${balloon.x}vw`
                  ]
                }}
                transition={{
                  y: { duration: Math.random() * 4 + 7, delay: balloon.delay, ease: 'easeOut' },
                  x: { duration: 4, delay: balloon.delay, repeat: Infinity, ease: 'easeInOut' }
                }}
                className="absolute"
                style={{ width: balloon.size, height: balloon.size * 1.25 }}
              >
                <div className={`w-full h-full rounded-full relative shadow-lg ${balloon.color}`}>
                  <div className="absolute top-2 left-2 w-3 h-4 bg-white/30 rounded-full blur-[1px]"></div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-current opacity-75"></div>
                  <svg className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-4 h-12 stroke-white/40 fill-none" viewBox="0 0 10 30">
                    <path d="M5,0 C2,10 8,20 5,30" strokeWidth="1" />
                  </svg>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Fireworks Bursting Layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {fireworks.map((fw) => (
              <div 
                key={fw.id}
                className="absolute"
                style={{ left: `${fw.x}%`, top: `${fw.y}%` }}
              >
                <motion.div
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: [0, 1.2, 0], opacity: [1, 1, 0] }}
                  transition={{ duration: 0.5, delay: fw.delay, ease: 'easeOut' }}
                  className="w-4 h-4 bg-white rounded-full blur-[2px]"
                />

                {fw.sparks.map((spark) => {
                  const rad = (spark.angle * Math.PI) / 180;
                  const targetX = Math.cos(rad) * spark.distance;
                  const targetY = Math.sin(rad) * spark.distance;

                  return (
                    <motion.div
                      key={spark.id}
                      initial={{ x: 0, y: 0, scale: 1, opacity: 0 }}
                      animate={{ 
                        x: [0, targetX], 
                        y: [0, targetY + 30], 
                        scale: [1, 1.2, 0],
                        opacity: [0, 1, 1, 0]
                      }}
                      transition={{ 
                        duration: 1.2, 
                        delay: fw.delay + 0.3, 
                        ease: 'easeOut' 
                      }}
                      className="absolute w-2 h-2 rounded-full shadow-[0_0_8px_currentcolor]"
                      style={{ 
                        backgroundColor: spark.color,
                        color: spark.color,
                        marginTop: '-4px',
                        marginLeft: '-4px'
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* RENDER HALFWAY, DESIGNER_GOAL, WELCOME, DESIGNER_HALFWAY, ORDER_DELIVERED OR SCHEDULED_DELIVERY VISUAL LAYERS */}
      {(type === 'halfway' || type === 'designer_goal' || type === 'welcome' || type === 'designer_halfway' || type === 'order_delivered' || type === 'critical_stock' || type === 'weekly_50_orders') && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {cosmicStars.map((star) => (
            <motion.div
              key={star.id}
              initial={{ 
                x: `${star.x}vw`, 
                y: '105vh', 
                scale: 0, 
                opacity: 0, 
                rotate: star.rotation 
              }}
              animate={{ 
                y: '-15vh', 
                scale: [0, star.scale, star.scale, 0], 
                opacity: [0, 1, 0.8, 0],
                x: [
                  `${star.x}vw`, 
                  `${star.x + (star.id % 2 === 0 ? 8 : -8)}vw`
                ]
              }}
              transition={{
                duration: star.speed,
                delay: star.delay,
                ease: 'easeIn',
                repeat: Infinity,
                repeatDelay: Math.random() * 2
              }}
              className="absolute"
            >
              {type === 'designer_goal' ? (
                // Cyber design elements
                star.id % 3 === 0 ? (
                  <Palette className="h-6 w-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
                ) : star.id % 2 === 0 ? (
                  <Cpu className="h-5 w-5 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                ) : (
                  <Bot className="h-5 w-5 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)] animate-bounce" />
                )
              ) : type === 'designer_halfway' ? (
                // Arts halfway elements
                star.id % 3 === 0 ? (
                  <Palette className="h-5 w-5 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                ) : star.id % 2 === 0 ? (
                  <Sparkles className="h-4 w-4 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                ) : (
                  <Heart className="h-4.5 w-4.5 text-cyan-400 fill-cyan-400/20 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                )
              ) : type === 'order_delivered' ? (
                // Order delivered elements
                star.id % 3 === 0 ? (
                  <Truck className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                ) : star.id % 2 === 0 ? (
                  <Gift className="h-4.5 w-4.5 text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] animate-bounce" />
                ) : (
                  <Sparkles className="h-4 w-4 text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]" />
                )
              ) : type === 'welcome' ? (
                // Welcome morning/warm elements
                star.id % 3 === 0 ? (
                  <Sun className="h-6 w-6 text-amber-350 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-spin" style={{ animationDuration: '10s' }} />
                ) : star.id % 2 === 0 ? (
                  <Heart className="h-5 w-5 text-pink-500 fill-pink-500/10 drop-shadow-[0_0_8px_rgba(236,72,153,0.7)]" />
                ) : (
                  <Coffee className="h-5 w-5 text-amber-500 drop-shadow-[0_0_8px_rgba(217,119,6,0.6)] animate-bounce" />
                )
              ) : type === 'critical_stock' ? (
                // Critical stock warning elements
                star.id % 2 === 0 ? (
                  <AlertTriangle className="h-6 w-6 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                ) : (
                  <AlertOctagon className="h-5 w-5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-bounce" />
                )
              ) : type === 'weekly_50_orders' ? (
                // Glorious golden/pink elements for weekly 50 orders milestone
                star.id % 3 === 0 ? (
                  <Trophy className="h-6 w-6 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-pulse" />
                ) : star.id % 2 === 0 ? (
                  <Award className="h-5.5 w-5.5 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)] animate-bounce" />
                ) : (
                  <Crown className="h-5 w-5 text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.95)]" />
                )
              ) : (
                // Traditional halfway elements
                star.id % 3 === 0 ? (
                  <Rocket className="h-6 w-6 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                ) : star.id % 2 === 0 ? (
                  <Zap className="h-5 w-5 text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                ) : (
                  <Star className="h-4 w-4 text-emerald-400 fill-emerald-500/30 drop-shadow-[0_0_10px_rgba(34,197,94,0.7)]" />
                )
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Main card representation inside frame */}
      <AnimatePresence mode="wait">
        {type === 'goal' ? (
          // GOAL CARD (10 sales)
          <motion.div
            key="goal-card"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.2 }}
            className="relative z-10 w-full max-w-md mx-4 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-[0_0_50px_rgba(236,72,153,0.25)] p-8 text-center pointer-events-auto no-print"
          >
            {/* Sparkly corner highlights */}
            <div className="absolute top-4 left-4 text-pink-500/40 animate-pulse">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 right-4 text-purple-500/40 animate-pulse delay-75">
              <Sparkles className="h-5 w-5" />
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer shadow-sm"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Triumphant Trophy Symbol */}
            <motion.div 
              animate={{ 
                scale: [1, 1.15, 1],
                rotate: [0, -5, 5, 0]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: 'reverse'
              }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-yellow-400 to-amber-500 text-black shadow-xl shadow-amber-500/20 mb-6"
            >
              <Trophy className="h-10 w-10 stroke-[2.2]" />
            </motion.div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-semibold text-amber-400 uppercase tracking-widest mb-4">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              Meta de Vendas Batida!
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            </div>

            {/* Title */}
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight leading-tight mb-3">
              10º Pedido Registrado! 🎯
            </h1>

            {/* Subtitle */}
            <p className="text-sm text-zinc-400 font-medium px-4 mb-6 leading-relaxed">
              Parabéns, equipe! Vocês acabaram de alcançar a incrível marca de <strong className="text-pink-400">10 pedidos registrados hoje</strong>. O sucesso festeja com vocês! 🎈
            </p>

            {/* Visual progress card indicator */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-2xl mb-6 flex items-center justify-between">
              <div className="text-left">
                <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500">Oxente Festeje</span>
                <span className="text-sm font-black text-zinc-200">Meta Diária Concluída</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-amber-400">10 / 10</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={onClose}
              className="w-full py-3 px-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 active:scale-[0.98] transition-all text-white font-bold rounded-2xl shadow-lg shadow-pink-500/20 cursor-pointer"
            >
              Excelente! Continuar 🚀
            </button>
          </motion.div>
        ) : type === 'designer_goal' ? (
          // DESIGNER GOAL CARD (10 finalized arts)
          <motion.div
            key="designer-goal-card"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.1 }}
            className="relative z-10 w-full max-w-sm mx-4 bg-zinc-950 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(34,211,238,0.25)] p-7 text-center pointer-events-auto no-print"
          >
            {/* Sparkly corner highlights */}
            <div className="absolute top-4 left-4 text-cyan-400 animate-pulse">
              <Cpu className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 right-4 text-pink-500 animate-pulse delay-75">
              <Palette className="h-5 w-5" />
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Flying Bot Icon */}
            <motion.div 
              animate={{ 
                y: [0, -6, 0],
                rotate: [0, 6, -6, 0]
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 text-black shadow-xl shadow-cyan-500/25 mb-5"
            >
              <Bot className="h-8 w-8 stroke-[2.2]" />
            </motion.div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[10px] font-bold text-cyan-405 uppercase tracking-widest mb-3">
              <Brain className="h-3.5 w-3.5 text-pink-400 fill-pink-400/25 animate-pulse" />
              Modo Máquina Ativado! ⚡
              <Brain className="h-3.5 w-3.5 text-pink-400 fill-pink-400/25 animate-pulse" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 tracking-tight leading-tight mb-2">
              Você é uma Máquina! 🤖🎨
            </h1>

            {/* Subtitle */}
            <p className="text-xs text-zinc-350 font-medium px-4 mb-5 leading-relaxed">
              Você é uma máquina de fazer artes, <strong className="text-cyan-400">quase uma I.A.</strong>, continue assim! Você acaba de finalizar sua <strong className="text-pink-400">10ª arte hoje</strong>. Sensacional! 🖥️✨
            </p>

            {/* Metrics display */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl mb-5 text-left space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-extrabold text-zinc-400 uppercase tracking-wider">Desempenho Diário do Design</span>
                <span className="font-black text-cyan-400">10/10 Concluídas</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-mono">Status do Designer:</span>
                <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Ultra Produtivo</span>
              </div>
            </div>

            {/* CTA button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-5 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:brightness-110 active:scale-[0.98] transition-all text-white font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/15 cursor-pointer"
            >
              Manter o Ritmo Insano! ⚡
            </button>
          </motion.div>
        ) : type === 'designer_halfway' ? (
          // DESIGNER HALFWAY CARD (5 arts)
          <motion.div
            key="designer-halfway-card"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.1 }}
            className="relative z-10 w-full max-w-sm mx-4 bg-zinc-950 border border-pink-550/30 rounded-3xl shadow-[0_0_50px_rgba(236,72,153,0.25)] p-7 text-center pointer-events-auto no-print"
          >
            {/* Sparkly corner highlights */}
            <div className="absolute top-4 left-4 text-pink-450 animate-pulse">
              <Palette className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 right-4 text-purple-400 animate-pulse delay-100">
              <Sparkles className="h-5 w-5" />
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Glowing Palette morning Icon */}
            <motion.div 
              animate={{ 
                scale: [1, 1.08, 1],
                rotate: [0, 6, -6, 0]
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 text-white shadow-xl shadow-pink-500/25 mb-5"
            >
              <Palette className="h-8 w-8 stroke-[2.2] animate-pulse" />
            </motion.div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-pink-500/10 border border-pink-500/20 rounded-full text-[10px] font-bold text-pink-450 uppercase tracking-widest mb-3">
              <Sparkles className="h-3.5 w-3.5 text-pink-400 animate-spin" style={{ animationDuration: '4s' }} />
              Metade das Artes do Dia! 💖🎨
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-400 to-pink-500 tracking-tight leading-tight mb-2">
              Inspiração Brilhante! 🌟✨
            </h1>

            {/* Subtitle */}
            <p className="text-xs text-zinc-350 font-medium px-2 mb-5 leading-relaxed">
              Você acaba de finalizar sua <strong className="text-pink-450">5ª arte de hoje</strong>! Sua criatividade dá vida aos sonhos dos nossos clientes! Cada pixel feito com amor e carinho transforma ideias em pura magia. 🥳💻
            </p>

            {/* Speech/Quote Display */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl mb-5 text-left space-y-1">
              <span className="block text-[9px] font-extrabold text-pink-500 uppercase tracking-widest">Vibe Positiva Oxente:</span>
              <p className="text-xs italic text-zinc-400 font-medium leading-relaxed">
                "O design não é apenas o que se vê, mas o amor depositado em cada detalhe que encanta corações!" 💕🎨
              </p>
            </div>

            {/* Progress bar */}
            <div className="bg-zinc-900 border border-zinc-850 p-3 rounded-xl mb-5">
              <div className="flex justify-between items-center text-[10px] mb-1.5">
                <span className="text-zinc-500 font-mono">Meta de Artes do Dia:</span>
                <span className="font-bold text-pink-400">5 de 10 Artes</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-850">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '50%' }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full"
                />
              </div>
            </div>

            {/* CTA button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-5 bg-gradient-to-r from-pink-500 via-purple-500 to-zinc-800 hover:brightness-110 active:scale-[0.98] transition-all text-white font-extrabold text-xs rounded-xl shadow-lg shadow-pink-500/15 cursor-pointer"
            >
              Continuar Criando Obras de Arte! 🚀
            </button>
          </motion.div>
        ) : type === 'order_delivered' ? (
          // ORDER DELIVERED CARD
          <motion.div
            key="order-delivered-card"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.1 }}
            className="relative z-10 w-full max-w-sm mx-4 bg-zinc-950 border border-emerald-500/30 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.25)] p-7 text-center pointer-events-auto no-print"
          >
            {/* Sparkly corner highlights */}
            <div className="absolute top-4 left-4 text-emerald-400 animate-pulse">
              <Truck className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 right-4 text-pink-400 animate-pulse delay-100">
              <Sparkles className="h-5 w-5" />
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Glowing Truck Icon */}
            <motion.div 
              animate={{ 
                scale: [1, 1.08, 1],
                x: [0, 8, -8, 0]
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/25 mb-5"
            >
              <Truck className="h-8 w-8 stroke-[2.2] animate-pulse" />
            </motion.div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              Pedido Entregue com Sucesso! 🚚💨
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-400 to-emerald-500 tracking-tight leading-tight mb-2">
              Mais uma Festa Realizada! 🎉🎈
            </h1>

            {/* Subtitle */}
            <p className="text-xs text-zinc-350 font-medium px-2 mb-5 leading-relaxed">
              O pedido foi entregue e o saldo liquidado! Cada decoração montada com excelência e carinho eterniza momentos felizes para nossos clientes. Bom trabalho! 💕🥳
            </p>

            {/* Quote of delivery */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl mb-5 text-left space-y-1">
              <span className="block text-[9px] font-extrabold text-emerald-450 uppercase tracking-widest">Incentivo Oxente Festeje:</span>
              <p className="text-xs italic text-zinc-400 font-medium leading-relaxed">
                "Entregar um dream perfeito é a maior recompensa do nosso atelier. O amor é nossa melhor decoração!" 🌸✨
              </p>
            </div>

            {/* CTA button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-5 bg-gradient-to-r from-emerald-500 via-teal-500 to-zinc-800 hover:brightness-110 active:scale-[0.98] transition-all text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/15 cursor-pointer"
            >
              Continuar Fazendo Festas! 🚀
            </button>
          </motion.div>
        ) : type === 'welcome' ? (
          // WELCOME CARD FOR FIRST LOGIN OF THE DAY
          <motion.div
            key="welcome-card"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.1 }}
            className="relative z-10 w-full max-w-sm mx-4 bg-zinc-950 border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.25)] p-7 text-center pointer-events-auto no-print"
          >
            {/* Sparkly corner highlights */}
            <div className="absolute top-4 left-4 text-amber-400 animate-pulse">
              <Sun className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 right-4 text-pink-500 animate-pulse delay-75">
              <Heart className="h-5 w-5" />
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Glowing Sun morning Icon */}
            <motion.div 
              animate={{ 
                scale: [1, 1.08, 1],
                rotate: [0, 8, -8, 0]
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-pink-500 text-black shadow-xl shadow-amber-500/25 mb-5"
            >
              <Sun className="h-8 w-8 stroke-[2.2] animate-spin" style={{ animationDuration: '24s' }} />
            </motion.div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-bold text-amber-450 uppercase tracking-widest mb-3">
              <Coffee className="h-3.5 w-3.5 text-amber-400 fill-amber-400/25" />
              Bom Dia &amp; Bom Trabalho! 💕
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-450 to-pink-405 tracking-tight leading-tight mb-2">
              Olá, {userName || 'Colaborador'}! 🌟
            </h1>

            {/* Subtitle */}
            <p className="text-xs text-zinc-350 font-medium px-4 mb-5 leading-relaxed">
              Desejamos que o seu dia na loja seja incrivelmente criativo, produtivo e cheio de festas. Vamos criar artes lindas e fechar excelentes pedidos hoje! ☕🎈✨
            </p>

            {/* Warm Quote Display */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl mb-5 text-left space-y-1">
              <span className="block text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Incentivo do Oxente:</span>
              <p className="text-xs italic text-zinc-400 font-medium leading-relaxed">
                "Grandes realizações começam com pequenos detalhes feitos com amor e carinho!" ✨
              </p>
            </div>

            {/* CTA button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-5 bg-gradient-to-r from-amber-500 via-purple-500 to-pink-550 hover:brightness-110 active:scale-[0.98] transition-all text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/15 cursor-pointer"
            >
              Iniciar Dia de Sucesso 🚀
            </button>
          </motion.div>
        ) : type === 'critical_stock' ? (
          // CRITICAL STOCK ALERT CARD
          <motion.div
            key="critical-stock-card"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.1 }}
            className="relative z-10 w-full max-w-sm mx-4 bg-zinc-950 border border-red-500/35 rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.3)] p-7 text-center pointer-events-auto no-print"
          >
            {/* Sparkly corner highlights */}
            <div className="absolute top-4 left-4 text-red-500 animate-pulse">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 right-4 text-amber-500 animate-pulse delay-75">
              <AlertOctagon className="h-5 w-5" />
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Glowing warning icon */}
            <motion.div 
              animate={{ 
                scale: [1, 1.15, 1],
                rotate: [0, 4, -4, 0]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 via-orange-500 to-amber-500 text-white shadow-xl shadow-red-500/25 mb-5"
            >
              <AlertTriangle className="h-8 w-8 stroke-[2.2] animate-bounce" />
            </motion.div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3">
              🚨 Atenção: Estoque Crítico!
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 tracking-tight leading-tight mb-2">
              Produto Acabando! ⚠️
            </h1>

            {/* Product Details Section */}
            <div className="bg-zinc-900/80 border border-red-500/20 p-4 rounded-xl mb-4 text-left">
              <span className="block text-[9px] font-black text-red-400 uppercase tracking-wider mb-1">Item Identificado:</span>
              <p className="text-sm font-extrabold text-zinc-100 mb-1.5 line-clamp-2">
                {productName || 'Brinde/Brinco'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Quantidade Restante:</span>
                <span className="px-2 py-0.5 bg-red-550 text-white font-extrabold text-xs rounded-full animate-pulse">
                  {productStock !== undefined ? `${productStock} un.` : 'Pouco estoque'}
                </span>
              </div>
            </div>

            {/* Subtitle */}
            <p className="text-xs text-zinc-450 font-medium px-2 mb-5 leading-relaxed">
              Sugerimos providenciar a reposição ou produção deste item o quanto antes para continuarmos realizando festas lindas sem surpresas! 🌸📦✨
            </p>

            {/* CTA button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-5 bg-gradient-to-r from-red-600 to-orange-500 hover:brightness-110 active:scale-[0.98] transition-all text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-500/15 cursor-pointer animate-pulse"
            >
              Ciente, vou verificar! 🚀
            </button>
          </motion.div>
        ) : type === 'weekly_50_orders' ? (
          // WEEKLY 50 ORDERS SYSTEM ACHIEVEMENT CARD
          <motion.div
            key="weekly-50-orders-card"
            initial={{ scale: 0.7, opacity: 0, y: 70 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0, y: 70 }}
            transition={{ type: 'spring', damping: 12, stiffness: 90, delay: 0.1 }}
            className="relative z-10 w-full max-w-sm mx-4 bg-zinc-950 border-2 border-amber-500/50 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.3)] p-7 text-center pointer-events-auto no-print overflow-hidden"
          >
            {/* Background glowing effects */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Sparkly corner highlights */}
            <div className="absolute top-4 left-4 text-amber-400 animate-pulse">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 right-4 text-pink-400 animate-pulse delay-75">
              <Sparkles className="h-5 w-5" />
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer shadow-sm"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Triumphant Symbol */}
            <motion.div 
              animate={{ 
                scale: [1, 1.15, 1],
                rotate: [0, -8, 8, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse'
              }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-400 via-amber-500 to-pink-500 text-black shadow-xl shadow-amber-500/20 mb-5"
            >
              <Crown className="h-8 w-8 stroke-[2.2]" />
            </motion.div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-3">
              👑 Meta Semanal Batida! 👑
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-pink-500 tracking-tight leading-tight mb-2">
              50 Pedidos Alcançados! 🌟🎉
            </h1>

            {/* Subtitle */}
            <p className="text-xs text-zinc-350 font-medium px-2 mb-5 leading-relaxed">
              Incrível! Toda a equipe está de parabéns! Vocês alcançaram a marca impressionante de <strong className="text-yellow-400">50 pedidos registrados</strong> nesta semana (segunda a sexta). A <strong className="text-pink-400">Oxente Festeje</strong> brilha cada vez mais forte com a dedicação e o amor de todos vocês! 💕🚀
            </p>

            {/* Metrics display */}
            <div className="bg-zinc-900/80 border border-amber-500/10 p-4 rounded-xl mb-5 text-left space-y-2 relative">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-zinc-400 uppercase tracking-wider">Desempenho da Semana</span>
                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] font-black text-amber-400 uppercase tracking-widest animate-pulse">Meta Superada!</span>
              </div>
              
              {/* Progress visual */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>Progresso de Seg a Sex:</span>
                  <span className="font-extrabold text-amber-400">50 / 50 Pedidos (100%)</span>
                </div>
                <div className="w-full bg-zinc-950 h-2.5 p-0.5 rounded-full overflow-hidden border border-zinc-850">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-pink-500 via-amber-500 to-yellow-400 relative overflow-hidden"
                  >
                    <span className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.25)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.25)_50%,rgba(255,255,255,0.25)_75%,transparent_75%,transparent)] bg-[length:15px_15px] animate-[shimmer_1.5s_infinite_linear]" />
                  </motion.div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-850">
                <span className="text-zinc-550 font-medium">Balanço Semanal:</span>
                <strong className="text-amber-400 font-extrabold">Sucesso absoluto! 🥳🍿</strong>
              </div>
            </div>

            {/* CTA button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-5 bg-gradient-to-r from-yellow-500 to-pink-500 hover:brightness-110 active:scale-[0.98] transition-all text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              Continuar Brilhando! 🚀✨
            </button>
          </motion.div>
        ) : (
          // HALFWAY CARD (5 sales)
          <motion.div
            key="halfway-card"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.1 }}
            className="relative z-10 w-full max-w-sm mx-4 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-[0_0_50px_rgba(34,197,94,0.15)] p-7 text-center pointer-events-auto no-print"
          >
            {/* Sparkly corner highlights */}
            <div className="absolute top-4 left-4 text-emerald-500/40 animate-pulse">
              <Flame className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 right-4 text-amber-500/40 animate-pulse delay-75">
              <Zap className="h-5 w-5" />
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Flying Rocket Logo Icon */}
            <motion.div 
              animate={{ 
                y: [0, -6, 0],
                rotate: [0, 4, -4, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 text-black shadow-xl shadow-emerald-500/20 mb-5"
            >
              <Rocket className="h-8 w-8 stroke-[2.2]" />
            </motion.div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">
              <Flame className="h-3 w-3 text-amber-400 fill-amber-400 animate-bounce" />
              Metade do Caminho!
              <Flame className="h-3 w-3 text-amber-400 fill-amber-400 animate-bounce" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight leading-tight mb-2">
              5º Pedido Concluído! 🚀
            </h1>

            {/* Subtitle */}
            <p className="text-xs text-zinc-400 font-medium px-4 mb-5 leading-relaxed">
              Estamos na metade! Vocês já completaram <strong className="text-emerald-400">5 pedidos hoje</strong>. Segura o rojão que faltam só mais <strong className="text-amber-400">5 para a meta</strong>! 🔥
            </p>

            {/* Progress bar and metrics */}
            <div className="bg-zinc-900/55 border border-zinc-850 p-4 rounded-xl mb-5 text-left space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-zinc-400 uppercase tracking-wider text-[10px]">Meta de Hoje (10 pedidos)</span>
                <span className="font-black text-emerald-400">50% Pronto</span>
              </div>
              <div className="w-full h-3.5 bg-zinc-950 rounded-full p-0.5 overflow-hidden border border-zinc-850">
                <motion.div 
                  initial={{ width: '0%' }}
                  animate={{ width: '50%' }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 relative overflow-hidden"
                >
                  <span className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:15px_15px] animate-[shimmer_1.5s_infinite_linear]" />
                </motion.div>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>Início</span>
                <span className="font-bold text-amber-400">Faltam 5 para os 10!</span>
                <span>Meta</span>
              </div>
            </div>

            {/* CTA button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-[0.98] transition-all text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              Bora com Tudo! 🚀
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
