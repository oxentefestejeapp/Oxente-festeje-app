import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Instagram, 
  MessageSquare, 
  Search, 
  Lock, 
  Check, 
  Star, 
  Volume2, 
  VolumeX, 
  ArrowRight,
  Sparkles,
  PartyPopper,
  Quote,
  Loader2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { supabase, mapDbToSale } from '../lib/supabase';
import { Sale } from '../types';
import { BrandLogo } from './BrandLogo';

interface LandingPageProps {
  onUnlockSystem: () => void;
  savedPhone?: string;
  savedAddress?: string;
}

// Staggered cute customer reviews for the Mural de Recomendações
const RECOMMENDATIONS = [
  {
    id: 1,
    name: "Mariana Costa",
    role: "Mãe do Leo (6 anos)",
    rating: 5,
    comment: "A melhor loja de João Pessoa disparado! O atendimento é sensacional e a variedade de balões e decorações é impressionante.",
    tag: "Decoração Impecável"
  },
  {
    id: 2,
    name: "Bruno Albuquerque",
    role: "Organizador de Eventos",
    rating: 5,
    comment: "Poder acompanhar o andamento do meu pedido em tempo real facilita demais a logística de retirada. Nenhuma outra loja tem essa transparência!",
    tag: "Tecnologia & Praticidade"
  },
  {
    id: 3,
    name: "Carla Souza",
    role: "Noiva",
    rating: 5,
    comment: "Ganhei um cupom de desconto incrível logo no meu primeiro orçamento! O preço é ótimo e a qualidade das peças é maravilhosa.",
    tag: "Melhores Descontos"
  },
  {
    id: 4,
    name: "Felipe Guedes",
    role: "Cliente Recorrente",
    rating: 5,
    comment: "Atendimento pelo WhatsApp super rápido, me ajudaram a escolher a combinação perfeita de cores. Estão de parabéns pelo capricho!",
    tag: "Super Atenciosos"
  },
  {
    id: 5,
    name: "Amanda Lins",
    role: "Aniversariante do Mês",
    rating: 5,
    comment: "Tudo lindo! Comprei os balões personalizados e todos os convidados elogiaram a decoração. É o verdadeiro brilho de qualquer comemoração!",
    tag: "Balões Perfeitos"
  }
];

export function LandingPage({ onUnlockSystem, savedPhone, savedAddress }: LandingPageProps) {
  // Sound management
  const [isMuted, setIsMuted] = useState(true);
  
  // Balloon list for the animation
  const [balloons, setBalloons] = useState<Array<{ id: number; x: number; color: string; size: number; delay: number; speed: number; label: string; popped?: boolean }>>([]);

  // Count of popped balloons
  const [poppedCount, setPoppedCount] = useState<number>(() => {
    return Number(localStorage.getItem('oxente_popped_count') || '0');
  });
  
  // Access state
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessPassword, setAccessPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Tracking modal / lookup state
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [typedOrderId, setTypedOrderId] = useState('');
  const [trackedSale, setTrackedSale] = useState<Sale | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Trigger floating balloon generators on start
  useEffect(() => {
    const colors = [
      'from-pink-400 via-pink-500 to-rose-600', // Metallic Pink
      'from-[#fbbf24] via-[#d97706] to-[#78350f]', // Majestic Gold
      'from-orange-400 via-orange-500 to-red-600', // Rich Coral/Orange
      'from-purple-400 via-purple-500 to-indigo-700', // Imperial Purple
      'from-teal-400 via-teal-500 to-emerald-700', // Shiny Emerald/Teal
      'from-rose-400 via-pink-500 to-red-600' // Crimson Gloss
    ];
    const words = ['Festa', 'Balões', 'Alegria', 'Oxente', 'Amor', 'Brilho', 'Sucesso', 'Sorrisos'];

    // Generate initial balloons
    const initialBalloons = Array.from({ length: 18 }).map((_, i) => {
      const speed = Math.random() * 8 + 12; // Majestically slow, 12 to 20 seconds to cross screen
      return {
        id: i,
        x: Math.random() * 90 + 5, // Percent from left
        color: colors[i % colors.length],
        size: Math.random() * 26 + 36, // Slightly larger, more realistic presence
        // Negative delay starting from -speed to 0 means they start already floating at random heights!
        delay: -Math.random() * speed, 
        speed: speed,
        label: words[i % words.length]
      };
    });
    setBalloons(initialBalloons);

    // Play a happy soft pop sound if unmuted
    if (!isMuted) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.16);
      } catch (err) {
        console.log(err);
      }
    }
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessPassword === '69app69') {
      setPasswordError(false);
      setShowAccessModal(false);
      localStorage.setItem('oxente_landing_bypassed', 'true');
      onUnlockSystem();
    } else {
      setPasswordError(true);
      // Play brief error buzz
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.26);
      } catch {}
    }
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedOrderId.trim()) return;
    setTrackingLoading(true);
    setTrackingError(null);
    setTrackedSale(null);

    try {
      // Look up by ID or by custom friendly numerical code
      const searchVal = typedOrderId.trim();
      const { data, error } = await supabase
        .from('oxente_sales')
        .select('*')
        .or(`id.eq.${searchVal},numero_pedido.eq.${searchVal}`)
        .maybeSingle();

      if (error) {
        console.error(error);
        setTrackingError('Erro ao buscar pedido. Tente novamente mais tarde.');
      } else if (!data) {
        setTrackingError('Não encontramos nenhum pedido com esse número. Verifique os dígitos e tente novamente.');
      } else {
        setTrackedSale(mapDbToSale(data));
      }
    } catch (err) {
      console.error(err);
      setTrackingError('Erro no servidor de rastreio.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleBalloonClick = (id: number) => {
    // Prevent double clicking on same balloon
    setBalloons(prev => {
      const b = prev.find(item => item.id === id);
      if (!b || b.popped) return prev;
      
      // Realistic high-quality pop sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(450, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        osc2.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.08);
        
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        
        osc.start();
        osc2.start();
        osc.stop(audioCtx.currentTime + 0.13);
        osc2.stop(audioCtx.currentTime + 0.13);
      } catch {}

      // Increment popped balloon count
      setPoppedCount(prevCount => {
        const nextCount = prevCount + 1;
        localStorage.setItem('oxente_popped_count', String(nextCount));
        return nextCount;
      });

      return prev.map(item => item.id === id ? { ...item, popped: true } : item);
    });

    // Remove from active balloons array after animation finishes
    setTimeout(() => {
      setBalloons(prev => prev.filter(b => b.id !== id));
    }, 250);
  };

  const handleSpawnShower = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(350, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(950, audioCtx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.26);
    } catch {}

    const colors = [
      'from-pink-400 via-pink-500 to-rose-600',
      'from-[#fbbf24] via-[#d97706] to-[#78350f]',
      'from-orange-400 via-orange-500 to-red-600',
      'from-purple-400 via-purple-500 to-indigo-700',
      'from-teal-400 via-teal-500 to-emerald-700',
      'from-rose-400 via-pink-500 to-red-600'
    ];
    const words = ['OXENTE!', 'EITA!', 'BALÃO!', 'POU!', 'FESTA!', 'BRILHO!', 'AMOR!', 'SORRISO!'];

    // Spawn 8 fresh fast balloons starting already at bottom with random staggered entries
    const shower = Array.from({ length: 8 }).map((_, i) => {
      const speed = Math.random() * 4 + 7; // Fast rising (7 to 11s)
      return {
        id: Date.now() + i,
        x: Math.random() * 90 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 24 + 38,
        delay: Math.random() * 0.8,
        speed: speed,
        label: words[i % words.length]
      };
    });

    setBalloons(prev => [...prev, ...shower]);
  };

  // Format phone for WhatsApp
  const cleanPhone = (savedPhone || '(83) 99876-5432').replace(/\D/g, '');
  const whatsAppLink = `https://wa.me/55${cleanPhone || '83998765432'}?text=Olá,%20gostaria%20de%20fazer%20um%20orçamento!`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(savedAddress || 'Rua Josina Lessa Feitosa 176 Mangabeira João Pessoa PB')}`;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-brand-light via-[#FFFDF9] to-[#f4ebd4] font-sans antialiased overflow-x-hidden selection:bg-brand-pink/20 selection:text-brand-dark">
      
      {/* Festive Celebration Party Background Image */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1506224477000-07aa8a76be89?q=80&w=1920&auto=format&fit=crop"
          alt="Cactos do Sertão Oxente Festeje"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-30 filter brightness-95 contrast-110 saturate-110 scale-105"
        />
        {/* Semi-transparent gold cream overlays to maintain supreme text contrast and brand theme */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-light/75 via-[#FFFDF9]/85 to-[#f4ebd4]/90 mix-blend-multiply" />
        <div className="absolute inset-0 bg-radial-at-t from-transparent via-transparent to-brand-dark/15" />
      </div>

      {/* Background Animated Rising Balloons Layer - Fixed so they rise across the visible page continuously */}
      <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
        {balloons.map((b) => (
          <motion.div
            key={b.id}
            onClick={() => handleBalloonClick(b.id)}
            className="absolute bottom-[-150px] cursor-pointer pointer-events-auto select-none"
            style={{ left: `${b.x}%` }}
            initial={{ y: 0, x: 0 }}
            animate={b.popped ? { y: -1200, scale: [1, 1.4, 0] } : { 
              y: -1200, // Move past the top of the viewport
              x: [0, 15, -15, 10, -10, 0]
            }}
            transition={{
              y: {
                duration: b.speed,
                ease: "linear",
                delay: b.delay,
                repeat: b.popped ? 0 : Infinity
              },
              x: {
                duration: 4.5,
                ease: "easeInOut",
                repeat: b.popped ? 0 : Infinity,
                repeatType: "reverse"
              },
              scale: {
                duration: 0.25,
                ease: "easeOut"
              }
            }}
          >
            {b.popped ? (
              <div 
                className="relative flex items-center justify-center pointer-events-none"
                style={{ width: `${b.size}px`, height: `${b.size * 1.35}px` }}
              >
                {/* Visual pop sparkles / confetti lines */}
                <svg className="absolute inset-[-40px] w-[200%] h-[200%] overflow-visible" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="15" fill="none" stroke="#f43f5e" strokeWidth="4" className="animate-ping" />
                  <path d="M 50 20 L 50 5 M 50 80 L 50 95 M 20 50 L 5 50 M 80 50 L 95 50 M 28 28 L 15 15 M 72 72 L 85 85 M 28 72 L 15 85 M 72 28 L 85 15" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="absolute text-brand-pink font-black text-[10px] uppercase select-none tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] whitespace-nowrap bg-white/95 px-2 py-0.5 rounded-md border border-brand-pink/30 shadow-md">💥 POP!</span>
              </div>
            ) : (
              /* Realistically shaped balloon with 3D gradient, elegant glossy shine and tapered egg form */
              <div 
                className={`relative bg-gradient-to-br ${b.color} shadow-lg shadow-brand-dark/15 hover:shadow-brand-dark/30 hover:scale-105 flex flex-col items-center justify-center border border-white/25 text-[10px] font-bold text-white tracking-tight uppercase px-2 transition-transform select-none`}
                style={{ 
                  width: `${b.size}px`, 
                  height: `${b.size * 1.35}px`,
                  borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%' // Egg shape taper at bottom
                }}
              >
                {/* Glossy top-left 3D highlight */}
                <div className="absolute top-[8%] left-[12%] w-[25%] h-[18%] bg-white/45 rounded-full blur-[0.6px] rotate-[-25deg] pointer-events-none" />
                
                {/* Soft bottom-right counter reflection for 3D ambient bounce */}
                <div className="absolute bottom-[14%] right-[15%] w-[15%] h-[15%] bg-white/10 rounded-full blur-[1px] pointer-events-none" />

                <span className="opacity-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] z-10 text-[9px] tracking-wider">{b.label}</span>
                
                {/* Balloon knot */}
                <div 
                  className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-current opacity-90"
                  style={{ color: b.color.split(' ').pop()?.replace('to-[', '').replace(']', '') }}
                />
                
                {/* Balloon string */}
                <svg className="absolute bottom-[-75px] left-1/2 -translate-x-1/2 w-4 h-18" stroke="rgba(74,46,22,0.2)" strokeWidth="1.2" fill="none">
                  <path d="M 8 0 C 4 18, 12 36, 8 54 C 4 72, 12 90, 8 108" />
                </svg>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Fixed Interactive Balloon Popping Guide Button (Top-Right) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-1 pointer-events-auto select-none">
        <motion.button
          onClick={handleSpawnShower}
          whileHover={{ scale: 1.08, rotate: [0, -2, 2, 0] }}
          whileTap={{ scale: 0.95 }}
          className="relative flex items-center gap-2 bg-gradient-to-r from-brand-pink via-[#fbbf24] to-[#d97706] text-brand-dark px-4 py-3 rounded-full shadow-lg shadow-brand-dark/25 border-2 border-white font-display font-black text-xs uppercase tracking-wider cursor-pointer group"
        >
          {/* Pulsating live dot */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-pink opacity-80"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-pink"></span>
          </span>
          <span>💥 Estourar Balões! ({poppedCount}) 🎈</span>

          {/* Floating helpful pop tooltip */}
          <span className="absolute -bottom-9 right-2 bg-brand-dark/95 text-white text-[9px] font-bold py-1 px-2.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none tracking-wider shadow-md whitespace-nowrap">
            Toque aqui para gerar chuva de balões! 🌦️
          </span>
        </motion.button>
      </div>

      {/* ANIMATED NORTHEAST CANGAÇO BACKGROUND CHARACTERS (Inspired by reference family image) */}
      
      {/* 1. Sr. Mandacaru (Cute Cactus wearing traditional Lampião leather hat) */}
      <motion.div
        className="fixed bottom-0 left-[1%] md:left-[3%] z-10 w-28 md:w-36 pointer-events-none select-none"
        animate={{ y: [15, 0, 15], rotate: [-1, 2, -1] }}
        transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 120 160" className="w-full h-auto drop-shadow-md">
          {/* Cactus Arms */}
          <path d="M25,85 Q10,80 15,65 Q20,50 30,58 Q32,68 28,80" fill="#22c55e" stroke="#15803d" strokeWidth="2" />
          <path d="M95,75 Q110,70 105,55 Q100,40 90,48 Q88,58 92,70" fill="#22c55e" stroke="#15803d" strokeWidth="2" />
          
          {/* Cactus Main Body */}
          <rect x="30" y="45" width="60" height="110" rx="30" fill="#15803d" />
          <rect x="35" y="48" width="50" height="104" rx="25" fill="#22c55e" />
          
          {/* Needles */}
          <path d="M20,60 L14,58 M18,70 L10,72 M102,50 L108,48 M100,62 L108,65 M40,60 L36,55 M80,65 L84,60 M50,110 L44,112 M70,120 L76,122" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          
          {/* Vertical Rib lines for 3D Cactus look */}
          <path d="M48,48 C48,80 48,120 48,150 M72,48 C72,80 72,120 72,150" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          
          {/* Lampião / Leather Hat (Chapéu de Couro) */}
          <g>
            {/* Crown dome */}
            <path d="M25,48 C25,18 95,18 95,48 Z" fill="#854d0e" stroke="#451a03" strokeWidth="2" />
            {/* Gold ornaments inside dome */}
            <circle cx="45" cy="35" r="5" fill="#eab308" stroke="#451a03" strokeWidth="1" />
            <path d="M45,30 L45,40 M40,35 L50,35" stroke="#451a03" strokeWidth="1" />
            <circle cx="75" cy="35" r="5" fill="#eab308" stroke="#451a03" strokeWidth="1" />
            <path d="M75,30 L75,40 M70,35 L80,35" stroke="#451a03" strokeWidth="1" />
            
            {/* Curved Brim */}
            <path d="M15,46 C35,52 85,52 105,46 C115,40 115,54 105,52 C85,56 35,56 15,52 C5,54 5,40 15,46 Z" fill="#a16207" stroke="#451a03" strokeWidth="2" />
          </g>

          {/* Cute face */}
          <g>
            {/* Cheeks */}
            <circle cx="45" cy="80" r="6" fill="#f43f5e" opacity="0.6" />
            <circle cx="75" cy="80" r="6" fill="#f43f5e" opacity="0.6" />
            {/* Eyes */}
            <circle cx="48" cy="72" r="4.5" fill="#1c1917" />
            <circle cx="46" cy="70" r="1.5" fill="#ffffff" />
            <circle cx="72" cy="72" r="4.5" fill="#1c1917" />
            <circle cx="70" cy="70" r="1.5" fill="#ffffff" />
            {/* Red spectacles (Lampião style) */}
            <circle cx="48" cy="72" r="9" fill="none" stroke="#ef4444" strokeWidth="1.8" />
            <circle cx="72" cy="72" r="9" fill="none" stroke="#ef4444" strokeWidth="1.8" />
            <line x1="57" y1="72" x2="63" y2="72" stroke="#ef4444" strokeWidth="1.8" />
            {/* Happy mouth */}
            <path d="M54,82 Q60,90 66,82" fill="none" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Red neck scarf */}
          <path d="M50,96 L60,108 L70,96 L60,94 Z" fill="#dc2626" />
          <circle cx="60" cy="95" r="3.5" fill="#facc15" />
        </svg>
      </motion.div>

      {/* 2. Dona Maria Flor (Cute Lady Cactus with red glasses, pink flower & leather hat) */}
      <motion.div
        className="fixed bottom-0 right-[1%] md:right-[3%] z-10 w-28 md:w-36 pointer-events-none select-none"
        animate={{ y: [18, 0, 18], rotate: [1, -2, 1] }}
        transition={{ repeat: Infinity, duration: 4.8, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 120 160" className="w-full h-auto drop-shadow-md">
          {/* Cactus Arms */}
          <path d="M25,80 Q12,75 18,60 Q22,48 32,54 Q32,65 28,75" fill="#4ade80" stroke="#16a34a" strokeWidth="2" />
          <path d="M95,85 Q108,80 102,65 Q98,52 88,58 Q88,68 92,78" fill="#4ade80" stroke="#16a34a" strokeWidth="2" />
          
          {/* Cactus Main Body */}
          <rect x="30" y="45" width="60" height="110" rx="30" fill="#16a34a" />
          <rect x="35" y="48" width="50" height="104" rx="25" fill="#4ade80" />
          
          {/* Needles */}
          <path d="M22,58 L16,56 M104,58 L110,56 M38,62 L32,58 M82,62 L88,58 M50,115 L44,117 M70,115 L76,117" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          
          {/* Pink Flower on head */}
          <g transform="translate(60, 20)">
            <circle cx="0" cy="-6" r="6" fill="#f43f5e" />
            <circle cx="6" cy="0" r="6" fill="#f43f5e" />
            <circle cx="0" cy="6" r="6" fill="#f43f5e" />
            <circle cx="-6" cy="0" r="6" fill="#f43f5e" />
            <circle cx="0" cy="0" r="4.5" fill="#facc15" />
          </g>

          {/* Golden Cangaço Leather Hat */}
          <g>
            <path d="M30,48 C30,22 90,22 90,48 Z" fill="#a16207" stroke="#451a03" strokeWidth="1.8" />
            <circle cx="48" cy="36" r="4" fill="#ca8a04" stroke="#451a03" strokeWidth="1" />
            <circle cx="72" cy="36" r="4" fill="#ca8a04" stroke="#451a03" strokeWidth="1" />
            <path d="M20,46 C38,51 82,51 100,46 C110,41 110,52 100,50 C82,53 38,53 20,50 C10,52 10,41 20,46 Z" fill="#ca8a04" stroke="#451a03" strokeWidth="1.8" />
          </g>

          {/* Friendly face with glasses */}
          <g>
            {/* Blushing cheeks */}
            <circle cx="45" cy="82" r="7" fill="#fda4af" opacity="0.8" />
            <circle cx="75" cy="82" r="7" fill="#fda4af" opacity="0.8" />
            {/* Eyes winking/smiling */}
            <circle cx="48" cy="74" r="4.5" fill="#1c1917" />
            <circle cx="46" cy="72" r="1.5" fill="#ffffff" />
            
            {/* Happy wink eye */}
            <path d="M70,74 Q74,70 78,74" fill="none" stroke="#1c1917" strokeWidth="2.5" strokeLinecap="round" />
            
            {/* Elegant Red spectacles (Maria Bonita glasses!) */}
            <circle cx="48" cy="74" r="10" fill="none" stroke="#ef4444" strokeWidth="2" />
            <circle cx="72" cy="74" r="10" fill="none" stroke="#ef4444" strokeWidth="2" />
            <line x1="58" y1="74" x2="62" y2="74" stroke="#ef4444" strokeWidth="2" />
            
            {/* Cute smile */}
            <path d="M54,84 Q60,92 66,84" fill="none" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Red neck bandanna */}
          <path d="M52,98 L60,110 L68,98 Z" fill="#ef4444" />
        </svg>
      </motion.div>

      {/* 3. Seu Sanfoninha (Smiling Bouncing Accordion Character) */}
      <motion.div
        className="fixed bottom-[18%] left-[0.5%] md:left-[2%] z-10 w-20 md:w-26 pointer-events-none select-none"
        animate={{ x: [-5, 5, -5], scaleX: [0.94, 1.06, 0.94], rotate: [-3, 3, -3] }}
        transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 100 120" className="w-full h-auto drop-shadow-md">
          {/* Left Keyboard block */}
          <rect x="15" y="40" width="12" height="60" rx="3" fill="#dc2626" stroke="#451a03" strokeWidth="1.5" />
          {/* Black & white keys */}
          <rect x="17" y="45" width="8" height="5" fill="#ffffff" rx="1" />
          <rect x="17" y="52" width="8" height="5" fill="#ffffff" rx="1" />
          <rect x="17" y="59" width="8" height="5" fill="#ffffff" rx="1" />
          <rect x="17" y="66" width="8" height="5" fill="#ffffff" rx="1" />
          <rect x="17" y="73" width="8" height="5" fill="#ffffff" rx="1" />
          <rect x="17" y="80" width="8" height="5" fill="#ffffff" rx="1" />
          <rect x="17" y="87" width="8" height="5" fill="#ffffff" rx="1" />
          
          {/* Bellows (Sanfona folds in middle) */}
          <path d="M27,45 L35,40 L43,45 L51,40 L59,45 L67,40 L73,45 L73,95 L67,100 L59,95 L51,100 L43,95 L35,100 L27,95 Z" fill="#eab308" stroke="#451a03" strokeWidth="1.5" />
          <path d="M35,40 L35,100 M51,40 L51,100 M67,40 L67,100" stroke="#ca8a04" strokeWidth="1.5" />

          {/* Right Bass block */}
          <rect x="73" y="40" width="12" height="60" rx="3" fill="#dc2626" stroke="#451a03" strokeWidth="1.5" />
          {/* Bass Buttons */}
          <circle cx="79" cy="48" r="1.5" fill="#ffffff" />
          <circle cx="79" cy="56" r="1.5" fill="#ffffff" />
          <circle cx="79" cy="64" r="1.5" fill="#ffffff" />
          <circle cx="79" cy="72" r="1.5" fill="#ffffff" />
          <circle cx="79" cy="80" r="1.5" fill="#ffffff" />
          <circle cx="79" cy="88" r="1.5" fill="#ffffff" />

          {/* Cute face in the bellows */}
          <g>
            <circle cx="43" cy="65" r="3.5" fill="#1c1917" />
            <circle cx="57" cy="65" r="3.5" fill="#1c1917" />
            <circle cx="42" cy="63" r="1" fill="#ffffff" />
            <circle cx="56" cy="63" r="1" fill="#ffffff" />
            <path d="M47,72 Q50,76 53,72" fill="none" stroke="#1c1917" strokeWidth="1.8" strokeLinecap="round" />
          </g>

          {/* Mini Leather Hat on the Accordion */}
          <path d="M35,35 C35,20 65,20 65,35 Z" fill="#854d0e" stroke="#451a03" strokeWidth="1.5" />
          <path d="M28,34 C40,37 60,37 72,34 C76,31 76,38 72,37 C60,39 40,39 28,37 C24,38 24,31 28,34 Z" fill="#a16207" stroke="#451a03" strokeWidth="1.5" />
        </svg>
      </motion.div>

      {/* 4. Zabumbinha (Cute traditional bouncing drum character) */}
      <motion.div
        className="fixed bottom-[15%] right-[0.5%] md:right-[2%] z-10 w-18 md:w-24 pointer-events-none select-none"
        animate={{ y: [-6, 4, -6], rotate: [5, -5, 5] }}
        transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 100 120" className="w-full h-auto drop-shadow-md">
          {/* Drum body cylinder */}
          <ellipse cx="50" cy="50" rx="35" ry="15" fill="#854d0e" stroke="#451a03" strokeWidth="2" />
          <rect x="15" y="50" width="70" height="40" fill="#a16207" stroke="#451a03" strokeWidth="2" />
          <ellipse cx="50" cy="90" rx="35" ry="15" fill="#854d0e" stroke="#451a03" strokeWidth="2" />
          
          {/* Leather strings lace pattern around drum body */}
          <path d="M15,50 L27,90 L39,50 L51,90 L63,50 L75,90 L85,50" fill="none" stroke="#facc15" strokeWidth="1.8" strokeLinecap="round" />

          {/* Drum Skin Top */}
          <ellipse cx="50" cy="50" rx="32" ry="12" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />

          {/* Smiling drum face */}
          <g>
            <circle cx="40" cy="70" r="3.5" fill="#1c1917" />
            <circle cx="60" cy="70" r="3.5" fill="#1c1917" />
            <circle cx="39" cy="68" r="1" fill="#ffffff" />
            <circle cx="59" cy="68" r="1" fill="#ffffff" />
            <circle cx="36" cy="74" r="3.5" fill="#fda4af" opacity="0.6" />
            <circle cx="64" cy="74" r="3.5" fill="#fda4af" opacity="0.6" />
            <path d="M46,77 Q50,82 54,77" fill="none" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Mini Leather Hat on the drum */}
          <path d="M38,44 C38,30 62,30 62,44 Z" fill="#854d0e" stroke="#451a03" strokeWidth="1.5" />
          <path d="M30,43 C40,46 60,46 70,43 C74,40 74,47 70,46 C60,48 40,48 30,46 C26,47 26,40 30,43 Z" fill="#a16207" stroke="#451a03" strokeWidth="1.5" />
          
          {/* Little drum beating mallet/sticks crossing */}
          <line x1="12" y1="95" x2="40" y2="108" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="108" r="4.5" fill="#ef4444" />
        </svg>
      </motion.div>

      {/* Main Container */}
      <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-32 z-20 flex flex-col items-center text-center">
        
        {/* Decorative Brand Logo floating */}
        <motion.div
          initial={{ scale: 0, y: -20, rotate: -15 }}
          animate={{ scale: 1, y: 0, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 100, delay: 0.1 }}
          className="mb-4"
        >
          <BrandLogo size="lg" />
        </motion.div>

        {/* Playful Floating Elements */}
        <motion.div 
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, delay: 0.2 }}
          className="bg-brand-pink/15 text-brand-pink border border-brand-pink/30 font-display font-black text-xs px-4 py-1.5 rounded-full uppercase tracking-widest shadow-xs flex items-center gap-1.5 mb-6"
        >
          <PartyPopper className="h-4 w-4 text-brand-pink animate-bounce" />
          <span>Arretada de Linda</span>
        </motion.div>

        {/* Visual Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="flex flex-col items-center mb-8"
        >
          {/* Main Title - Inspired by Instagram Visual Identity and Gold Theme */}
          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-dark via-brand-pink to-[#825908] uppercase drop-shadow-xs">
            Oxente Festeje
          </h1>
          <p className="text-sm md:text-base text-brand-dark/85 font-medium mt-3.5 max-w-lg leading-relaxed font-sans">
            A maior e mais amada loja de balões personalizados e decorações de João Pessoa! Transformamos momentos simples em comemorações inesquecíveis. 🎈✨
          </p>
        </motion.div>

        {/* Central Dashboard Card with custom CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-lg bg-white/90 backdrop-blur-md rounded-3xl border border-brand-pink/30 p-8 shadow-[0_20px_50px_rgba(197,146,24,0.12)] flex flex-col gap-4 mb-16"
        >
          <h2 className="text-lg font-display font-bold text-brand-dark flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-brand-pink fill-brand-pink animate-pulse" />
            <span>O que você deseja fazer hoje?</span>
          </h2>

          {/* BUTTON 1: Google Maps Direct Link */}
          <motion.a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 bg-gradient-to-r from-brand-dark to-[#5c3d21] text-brand-light font-display font-bold p-4 rounded-2xl shadow-md shadow-brand-dark/15 hover:shadow-brand-dark/30 transition-all text-left group"
          >
            <div className="bg-white/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <MapPin className="h-5 w-5 text-brand-light" />
            </div>
            <div className="flex-1">
              <span className="block text-sm">Como Chegar na Loja</span>
              <span className="block text-xs font-normal text-brand-light/80 mt-0.5 font-sans">Clique para abrir no Google Maps</span>
            </div>
            <ArrowRight className="h-5 w-5 text-brand-light/75 group-hover:translate-x-1 transition-transform mr-1" />
          </motion.a>

          {/* BUTTON 2: Instagram Direct Link */}
          <motion.a
            href="https://www.instagram.com/oxentefesteje/"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 bg-gradient-to-r from-brand-pink via-[#e9d5a6] to-[#a3740e] text-brand-dark font-display font-black p-4 rounded-2xl shadow-md shadow-brand-pink/15 hover:shadow-brand-pink/35 transition-all text-left group"
          >
            <div className="bg-brand-dark/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <Instagram className="h-5 w-5 text-brand-dark" />
            </div>
            <div className="flex-1">
              <span className="block text-sm">Siga-nos no Instagram</span>
              <span className="block text-xs font-bold text-brand-dark/80 mt-0.5 font-sans">@oxentefesteje · Inspirações diárias</span>
            </div>
            <ArrowRight className="h-5 w-5 text-brand-dark/75 group-hover:translate-x-1 transition-transform mr-1" />
          </motion.a>

          {/* BUTTON 3: WhatsApp Chat Link */}
          <motion.a
            href={whatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 bg-gradient-to-r from-[#15803d] to-[#14532d] text-white font-display font-bold p-4 rounded-2xl shadow-md shadow-green-700/10 hover:shadow-green-700/25 transition-all text-left group"
          >
            <div className="bg-white/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <span className="block text-sm">Fazer Orçamento no WhatsApp</span>
              <span className="block text-xs font-normal text-green-100 mt-0.5 font-sans">Fale diretamente com nossa equipe</span>
            </div>
            <ArrowRight className="h-5 w-5 text-white/75 group-hover:translate-x-1 transition-transform mr-1" />
          </motion.a>

          {/* BUTTON 4: Order Real-time Tracking Panel */}
          <motion.button
            onClick={() => setShowTrackingModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 bg-gradient-to-r from-[#c59f4d] to-[#a3740e] text-brand-light font-display font-bold p-4 rounded-2xl shadow-md shadow-brand-pink/10 hover:shadow-brand-pink/25 transition-all text-left group cursor-pointer"
          >
            <div className="bg-white/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <Search className="h-5 w-5 text-brand-light" />
            </div>
            <div className="flex-1">
              <span className="block text-sm">Acompanhar meu Pedido</span>
              <span className="block text-xs font-normal text-brand-light/90 mt-0.5 font-sans">Consulte o andamento da sua entrega</span>
            </div>
            <ArrowRight className="h-5 w-5 text-brand-light/75 group-hover:translate-x-1 transition-transform mr-1" />
          </motion.button>
        </motion.div>

        {/* Mural de Recomendações (Love Wall) Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-full flex flex-col items-center mt-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <Quote className="h-6 w-6 text-brand-pink fill-brand-pink/20" />
            <h3 className="text-2xl font-display font-black text-brand-dark uppercase tracking-tight">Mural de Recomendações</h3>
          </div>
          <p className="text-brand-dark/70 text-xs md:text-sm max-w-md mb-8 font-sans">
            Veja o carinho de quem escolheu tornar seus eventos inesquecíveis com as nossas decorações!
          </p>

          {/* Grid Layout of post-it cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-left">
            {RECOMMENDATIONS.map((r, idx) => (
              <motion.div
                key={r.id}
                whileHover={{ y: -6, rotate: idx % 2 === 0 ? 1 : -1 }}
                className={`bg-white rounded-2xl p-6 border border-brand-pink/15 shadow-xs relative flex flex-col justify-between ${
                  idx % 3 === 0 ? 'border-l-4 border-l-brand-pink' :
                  idx % 3 === 1 ? 'border-l-4 border-l-[#a3740e]' : 'border-l-4 border-l-brand-dark'
                }`}
              >
                <div>
                  <div className="flex gap-0.5 mb-2.5">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-brand-pink fill-brand-pink" />
                    ))}
                  </div>
                  <p className="text-[#4a2e16] text-xs italic leading-relaxed mb-4">
                    "{r.comment}"
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2 border-t border-brand-light pt-3">
                  <div>
                    <h4 className="text-xs font-display font-bold text-brand-dark">{r.name}</h4>
                    <span className="text-[10px] text-brand-dark/50">{r.role}</span>
                  </div>
                  <span className="text-[9px] font-black bg-brand-light text-brand-pink border border-brand-pink/25 uppercase px-2.5 py-1 rounded-full tracking-wider">
                    {r.tag}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Footer info and secret entry */}
        <p className="text-[11px] text-zinc-400 font-medium mt-16 flex items-center gap-1.5 justify-center">
          <span>© 2026 Oxente Festeje. João Pessoa - PB. Todos os direitos reservados.</span>
        </p>

        {/* SECRET ACCESS BUTTON: discretely positioned at bottom right */}
        <div className="fixed bottom-6 right-6 z-50">
          <motion.div
            initial={{ opacity: 0.15 }}
            whileHover={{ opacity: 1, scale: 1.1 }}
            className="relative group"
          >
            {/* Subtle button with key/lock icon */}
            <button
              onClick={() => {
                setAccessPassword('');
                setPasswordError(false);
                setShowAccessModal(true);
              }}
              className="bg-zinc-800/40 hover:bg-brand-pink text-zinc-500 hover:text-black p-3 rounded-full backdrop-blur-sm border border-zinc-700/20 hover:border-brand-pink shadow-md transition-all cursor-pointer"
              title="Acesso Administrativo"
            >
              <Lock className="h-4 w-4" />
            </button>
            <span className="absolute right-14 top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none tracking-wider">
              Área Administrativa
            </span>
          </motion.div>
        </div>

        {/* MODAL 1: Order Tracking Lookup dialog */}
        <AnimatePresence>
          {showTrackingModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-amber-100"
              >
                {/* Header card banner */}
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
                  <h3 className="text-xl font-extrabold text-zinc-900 flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    <span>Rastrear Seu Pedido</span>
                  </h3>
                  <p className="text-zinc-850 text-xs mt-1">
                    Digite o número do pedido para ver seu status em tempo real.
                  </p>
                </div>

                <div className="p-6 text-left">
                  {/* Lookup form */}
                  <form onSubmit={handleTrackOrder} className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Ex: 5087 ou Código UUID..."
                        value={typedOrderId}
                        onChange={(e) => setTypedOrderId(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 focus:border-amber-400 rounded-xl px-4 py-3 text-sm text-zinc-850 font-bold focus:outline-none"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={trackingLoading}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold px-5 py-3 rounded-xl text-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {trackingLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span>Buscar</span>
                      )}
                    </button>
                  </form>

                  {/* Feedback error state */}
                  {trackingError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 text-red-600 rounded-xl p-4 text-xs font-semibold flex items-start gap-2 border border-red-100 mb-4"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{trackingError}</span>
                    </motion.div>
                  )}

                  {/* Order Status Display Section */}
                  {trackedSale && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-b from-amber-50/50 to-orange-50/20 rounded-2xl p-5 border border-amber-200/40"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                        <div>
                          <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cliente</span>
                          <span className="block text-sm font-black text-zinc-800">{trackedSale.cliente}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nº Pedido</span>
                          <span className="block text-sm font-black text-zinc-900 bg-amber-400/20 px-2.5 py-0.5 rounded-lg">
                            #{trackedSale.numeroPedido || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Info lines */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500 font-medium">Produto / Descrição:</span>
                          <span className="font-bold text-zinc-800 truncate max-w-[200px]" title={trackedSale.produtoNome}>
                            {trackedSale.produtoNome}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500 font-medium">Data do Pedido:</span>
                          <span className="font-bold text-zinc-700 flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                            {trackedSale.data ? new Date(trackedSale.data).toLocaleDateString('pt-BR') : '-'}
                          </span>
                        </div>
                        
                        {/* Interactive Status Indicator bar */}
                        <div className="mt-4 pt-3 border-t border-zinc-100">
                          <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2">Status da Produção</span>
                          
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                              trackedSale.statusProducao === 'Entregue' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : trackedSale.statusProducao === 'Pronto para Retirada'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              <Check className="h-3.5 w-3.5" />
                              {trackedSale.statusProducao || 'Pendente'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                            {trackedSale.statusProducao === 'Entregue' 
                              ? 'O seu pedido já foi retirado ou entregue com sucesso! Obrigado por festejar com a gente! 🥳'
                              : trackedSale.statusProducao === 'Pronto para Retirada'
                              ? 'Excelente notícia! O seu pedido está finalizado e aguardando você vir buscá-lo na loja! 📍'
                              : 'O seu pedido está sendo preparado com muito carinho por nossos designers de balões. Logo estará pronto! 🎈'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Modal footer back actions */}
                <div className="bg-zinc-50 px-6 py-4 flex justify-end border-t border-zinc-100">
                  <button
                    onClick={() => {
                      setShowTrackingModal(false);
                      setTrackedSale(null);
                      setTypedOrderId('');
                      setTrackingError(null);
                    }}
                    className="text-zinc-650 hover:text-zinc-900 font-bold text-sm px-4 py-2 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 2: Locked app entry dialog with (69app69) password */}
        <AnimatePresence>
          {showAccessModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-zinc-100"
              >
                <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 p-6 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Lock className="h-5 w-5 text-brand-pink" />
                    <span>Área Administrativa</span>
                  </h3>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    Acesso restrito para colaboradores. Digite a senha para entrar no sistema de gerenciamento.
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="p-6 text-left">
                  <div className="mb-4">
                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider mb-2">Senha do App</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={accessPassword}
                      onChange={(e) => setAccessPassword(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 focus:border-brand-pink rounded-xl px-4 py-3 text-sm font-bold text-zinc-850 tracking-widest focus:outline-none"
                      required
                      autoFocus
                    />
                  </div>

                  {passwordError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 text-red-600 rounded-xl p-3 text-xs font-bold border border-red-100 flex items-center gap-1.5 mb-4"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Senha incorreta! Tente novamente.</span>
                    </motion.div>
                  )}

                  <div className="flex gap-2 justify-end pt-2 border-t border-zinc-50 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccessModal(false);
                        setPasswordError(false);
                      }}
                      className="text-zinc-650 hover:text-zinc-900 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-brand-pink hover:bg-brand-pink/95 text-zinc-900 font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      Acessar App
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
