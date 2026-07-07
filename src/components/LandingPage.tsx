import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { initGoogleAds, trackGoogleAdsEvent } from '../lib/analytics';

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
  Quote,
  Loader2,
  Calendar,
  AlertCircle,
  Heart,
  Award,
  Users,
  Clock,
  Gift
} from 'lucide-react';
import { supabase, mapDbToSale } from '../lib/supabase';
import { Sale } from '../types';
import { MagneticButton } from './MagneticButton';
import { InstagramFeed } from './InstagramFeed';
import { OptimizedImage } from '../utils/imageOptimizer';


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
    role: "Noiva & Organizadora",
    rating: 5,
    comment: "A melhor loja de João Pessoa disparado! O atendimento é sensacional e a variedade de brindes e lembranças personalizadas é impressionante.",
    tag: "Brindes Impecáveis"
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
    comment: "Ganhei um cupom de desconto incrível logo no meu primeiro orçamento! O preço é ótimo e a qualidade das canecas e copos personalizados é maravilhosa.",
    tag: "Melhores Descontos"
  },
  {
    id: 4,
    name: "Felipe Guedes",
    role: "Cliente Recorrente",
    rating: 5,
    comment: "Atendimento pelo WhatsApp super rápido, me ajudaram a escolher a combinação perfeita de cores para os brindes corporativos. Estão de parabéns pelo capricho!",
    tag: "Super Atenciosos"
  },
  {
    id: 5,
    name: "Amanda Lins",
    role: "Aniversariante do Mês",
    rating: 5,
    comment: "Tudo lindo! Comprei as lembranças personalizadas e todos os convidados elogiaram a qualidade. É o verdadeiro brilho de qualquer comemoração!",
    tag: "Lembranças Perfeitas"
  },
  {
    id: 6,
    name: "Juliana Mendes",
    role: "Mãe Festeira",
    rating: 5,
    comment: "Fiz as lembranças do aniversário de 1 ano do meu filho e ficou impecável! Todo mundo no Instagram perguntou de onde eram. Atendimento nota 10!",
    tag: "Festas Infantis"
  }
];

export function LandingPage({ onUnlockSystem, savedPhone, savedAddress }: LandingPageProps) {
  // Initialize Google Ads Pixel/Tag on mount
  useEffect(() => {
    initGoogleAds();
  }, []);

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

  // Celebration fireworks state
  interface FireworkParticle {
    id: number;
    angle: number;
    distance: number;
    size: number;
  }
  interface Firework {
    id: number;
    x: number; // percentage
    y: number; // percentage
    color: string;
    particles: FireworkParticle[];
    launchDelay: number;
  }

  const [fireworks, setFireworks] = useState<Firework[]>([]);
  const [showCelebration, setShowCelebration] = useState(true);

  // Trigger celebration fireworks on page mount (load/refresh)
  useEffect(() => {
    const fireworkColors = [
      '#f43f5e', // Rose/Pink
      '#fbbf24', // Yellow/Gold
      '#ea580c', // Orange
      '#10b981', // Emerald
      '#06b6d4', // Cyan
      '#8b5cf6', // Purple
      '#ec4899'  // Hot Pink
    ];

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

    const generatedFireworks: Firework[] = Array.from({ length: 12 }).map((_, i) => {
      const particles: FireworkParticle[] = Array.from({ length: 20 }).map((_, pIdx) => {
        const angle = (pIdx * 360) / 20 + (Math.random() * 15 - 7.5);
        const distance = 80 + Math.random() * 80; // Larger radius of explosion
        const size = Math.random() * 4.5 + 2.5; // Slightly larger sparkles
        return { id: pIdx, angle, distance, size };
      });

      const yVal = isDesktop 
        ? 3 + Math.random() * 20  // Explode higher on desktop (upper 3% to 23%)
        : 6 + Math.random() * 28; // Explode higher on mobile (upper 6% to 34%)

      return {
        id: i,
        x: 15 + Math.random() * 70, // Spread across 15% to 85%
        y: yVal,
        color: fireworkColors[i % fireworkColors.length],
        particles,
        launchDelay: i * 0.95, // Staggered launches spread over a longer period
      };
    });
    setFireworks(generatedFireworks);

    // Completely disappear and clean up all fireworks after 14 seconds (extended by 3 seconds)
    const timer = setTimeout(() => {
      setShowCelebration(false);
      setFireworks([]);
    }, 14000);

    return () => clearTimeout(timer);
  }, []);

  // Speech bubble state for custom interaction
  const [speechBubble, setSpeechBubble] = useState<'sanfona' | 'zabumba' | 'triangulo' | 'casal' | 'cacto_esq' | 'cacto_dir' | null>(null);
  const [triangleSpeechText, setTriangleSpeechText] = useState("toque em mim pra fazer música!");

  // Scroll listener for premium parallax sky backgrounds
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-clear speech bubble after 4 seconds
  useEffect(() => {
    if (speechBubble) {
      const timer = setTimeout(() => {
        setSpeechBubble(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [speechBubble]);

  // Auto trigger triangle speech bubble after 35 seconds of page load
  useEffect(() => {
    const timer = setTimeout(() => {
      setTriangleSpeechText("toque em mim pra fazer música!");
      triggerSpeech('triangulo');
    }, 35000);
    return () => clearTimeout(timer);
  }, []);

  const triggerSpeech = (character: 'sanfona' | 'zabumba' | 'triangulo' | 'casal' | 'cacto_esq' | 'cacto_dir') => {
    setSpeechBubble(character);
    
    // Play happy instruments audio feedback using web audio synthesizers
    try {
      // Cacti only trigger visual speech bubble (no sound output)
      if (character === 'cacto_esq' || character === 'cacto_dir') {
        return;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      
      if (character === 'sanfona') {
        // High-quality Accordion: Rich multi-reed chorused tones with a bellows-squeeze volume curve
        const playSqueeze = (startTime: number, duration: number, vol: number) => {
          // Accordion reed frequencies for a happy major chord
          const freqs = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (C Major Chord)
          freqs.forEach((f, idx) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            
            // Mixing triangle & sawtooth shapes gives that distinct dry "accordion reed" rasp
            osc.type = idx % 2 === 0 ? 'triangle' : 'sawtooth';
            // Chorusing effect via subtle pitch detuning
            osc.frequency.setValueAtTime(f + (idx % 2 === 0 ? 1.8 : -1.8), startTime);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(750, startTime);
            filter.frequency.exponentialRampToValueAtTime(1300, startTime + duration * 0.35);
            filter.frequency.exponentialRampToValueAtTime(550, startTime + duration);
            
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            // Envelope: Simulate pressure swell when bellows are compressed/expanded
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(vol * 0.07, startTime + duration * 0.25);
            gainNode.gain.linearRampToValueAtTime(vol * 0.07, startTime + duration * 0.65);
            gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            
            osc.start(startTime);
            osc.stop(startTime + duration + 0.05);
          });
        };

        // Play two rapid energetic accordion bellows presses: "wheeze-wheeze!"
        playSqueeze(now, 0.28, 1.0);
        playSqueeze(now + 0.32, 0.42, 0.85);

      } else if (character === 'zabumba') {
        // High-quality physical Zabumba: Deep pitch-sliding leather skin boom, mid-wood body resonance, and mallet strike click
        const bufferSize = audioCtx.sampleRate * 0.8;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          noiseData[i] = Math.random() * 2 - 1;
        }

        const playBassThump = (time: number, vol: number) => {
          // 1. Ultra-deep sub bass boom (sine wave slide)
          const oscSub = audioCtx.createOscillator();
          const gainSub = audioCtx.createGain();
          oscSub.type = 'sine';
          oscSub.frequency.setValueAtTime(95, time);
          oscSub.frequency.exponentialRampToValueAtTime(45, time + 0.12);
          oscSub.frequency.linearRampToValueAtTime(38, time + 0.5);

          // 2. Punchy body drum resonance (triangle wave slide)
          const oscBody = audioCtx.createOscillator();
          const gainBody = audioCtx.createGain();
          oscBody.type = 'triangle';
          oscBody.frequency.setValueAtTime(160, time);
          oscBody.frequency.exponentialRampToValueAtTime(65, time + 0.1);
          oscBody.frequency.linearRampToValueAtTime(48, time + 0.3);

          // 3. Thick leather skin impact (lowpass filtered white noise burst)
          const noiseNode = audioCtx.createBufferSource();
          noiseNode.buffer = noiseBuffer;
          const noiseGain = audioCtx.createGain();
          const noiseFilter = audioCtx.createBiquadFilter();
          
          noiseFilter.type = 'lowpass';
          noiseFilter.frequency.setValueAtTime(120, time);

          oscSub.connect(gainSub);
          gainSub.connect(audioCtx.destination);

          oscBody.connect(gainBody);
          gainBody.connect(audioCtx.destination);

          noiseNode.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(audioCtx.destination);

          // Volume Envelopes - generous levels for a powerful boom
          gainSub.gain.setValueAtTime(0, time);
          gainSub.gain.linearRampToValueAtTime(vol * 1.85, time + 0.015);
          gainSub.gain.exponentialRampToValueAtTime(0.001, time + 0.75); // longer decay for sustained boom!

          gainBody.gain.setValueAtTime(0, time);
          gainBody.gain.linearRampToValueAtTime(vol * 0.75, time + 0.01);
          gainBody.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

          noiseGain.gain.setValueAtTime(0, time);
          noiseGain.gain.linearRampToValueAtTime(vol * 0.85, time + 0.003);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

          oscSub.start(time);
          oscBody.start(time);
          noiseNode.start(time);

          oscSub.stop(time + 0.7);
          oscBody.stop(time + 0.4);
          noiseNode.stop(time + 0.1);
        };
        
        const playStickTap = (time: number, vol: number) => {
          // Tight, dry "bacalhau" wooden stick stroke / leather rim slap
          const noiseNode = audioCtx.createBufferSource();
          noiseNode.buffer = noiseBuffer;
          const noiseGain = audioCtx.createGain();
          const noiseFilter = audioCtx.createBiquadFilter();
          
          noiseFilter.type = 'bandpass';
          noiseFilter.frequency.setValueAtTime(1600, time);
          noiseFilter.Q.setValueAtTime(4.5, time);

          const oscTap = audioCtx.createOscillator();
          const gainTap = audioCtx.createGain();
          oscTap.type = 'triangle';
          oscTap.frequency.setValueAtTime(950, time);
          oscTap.frequency.exponentialRampToValueAtTime(400, time + 0.04);

          noiseNode.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(audioCtx.destination);

          oscTap.connect(gainTap);
          gainTap.connect(audioCtx.destination);

          noiseGain.gain.setValueAtTime(0, time);
          noiseGain.gain.linearRampToValueAtTime(vol * 0.12, time + 0.002);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);

          gainTap.gain.setValueAtTime(0, time);
          gainTap.gain.linearRampToValueAtTime(vol * 0.08, time + 0.001);
          gainTap.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

          noiseNode.start(time);
          oscTap.start(time);

          noiseNode.stop(time + 0.07);
          oscTap.stop(time + 0.05);
        };

        // Two strong traditional drum beats: "BOOOM! BOOOM!"
        playBassThump(now, 1.8);            // First massive BOOOM
        playStickTap(now + 0.18, 0.95);     // Soft stick tap
        playBassThump(now + 0.38, 1.75);    // Second massive BOOOM
        playStickTap(now + 0.58, 1.0);      // Soft stick tap

      } else if (character === 'triangulo') {
        // High-quality metallic Triângulo: Shimmering inharmonic additive synthesis with striker impact clicking
        const playTriangleDing = (time: number, duration: number, isMuted: boolean, vol: number) => {
          // Complex metallic steel rod modal frequencies
          const frequencies = [2420, 2980, 3540, 4110, 5300];
          
          const hpFilter = audioCtx.createBiquadFilter();
          hpFilter.type = 'highpass';
          hpFilter.frequency.setValueAtTime(2000, time);
          
          const bpFilter = audioCtx.createBiquadFilter();
          bpFilter.type = 'peaking';
          bpFilter.frequency.setValueAtTime(3200, time);
          bpFilter.Q.setValueAtTime(1.5, time);
          bpFilter.gain.setValueAtTime(3, time);

          hpFilter.connect(bpFilter);
          bpFilter.connect(audioCtx.destination);

          // Steel striker hit click (extremely short bandpassed noise burst)
          const strikeNoise = audioCtx.createBufferSource();
          const strikeNoiseGain = audioCtx.createGain();
          const strikeNoiseFilter = audioCtx.createBiquadFilter();

          const sampleRate = audioCtx.sampleRate;
          const noiseBuf = audioCtx.createBuffer(1, sampleRate * 0.1, sampleRate);
          const noiseD = noiseBuf.getChannelData(0);
          for (let i = 0; i < noiseBuf.length; i++) {
            noiseD[i] = Math.random() * 2 - 1;
          }
          strikeNoise.buffer = noiseBuf;

          strikeNoiseFilter.type = 'bandpass';
          strikeNoiseFilter.frequency.setValueAtTime(4500, time);
          strikeNoiseFilter.Q.setValueAtTime(3.0, time);

          strikeNoise.connect(strikeNoiseFilter);
          strikeNoiseFilter.connect(strikeNoiseGain);
          strikeNoiseGain.connect(bpFilter);

          strikeNoiseGain.gain.setValueAtTime(0, time);
          strikeNoiseGain.gain.linearRampToValueAtTime(vol * 0.16, time + 0.001);
          strikeNoiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.012);

          // Oscillators for steel body resonance
          frequencies.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = idx === 0 ? 'sine' : (idx % 2 === 0 ? 'sine' : 'triangle');
            
            // Add slight random detune to create beautiful shimmering metallic beat frequencies
            osc.frequency.setValueAtTime(freq + (Math.random() * 8 - 4), time);
            
            osc.connect(gainNode);
            gainNode.connect(hpFilter);
            
            const overtoneVol = idx === 0 ? 1.0 : (1.0 / (idx + 1)) * 0.6;
            
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(vol * 0.055 * overtoneVol, time + 0.003);
            
            if (isMuted) {
              gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
            } else {
              gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
            }
            
            osc.start(time);
            osc.stop(time + (isMuted ? 0.06 : duration + 0.05));
          });

          strikeNoise.start(time);
          strikeNoise.stop(time + 0.03);
        };

        // Traditional high-energy brazilian "Ding-chi-chi, Ding-chi-chi" triangle cell!
        playTriangleDing(now, 0.75, false, 1.0);        // Ringing Open (Ting!)
        playTriangleDing(now + 0.14, 0.05, true, 0.7);  // Muted slap (chi)
        playTriangleDing(now + 0.24, 0.05, true, 0.8);  // Muted slap (chi)
        
        playTriangleDing(now + 0.35, 0.65, false, 0.95); // Ringing Open (Ting!)
        playTriangleDing(now + 0.49, 0.05, true, 0.7);  // Muted slap (chi)
        playTriangleDing(now + 0.59, 0.05, true, 0.8);  // Muted slap (chi)
        
        playTriangleDing(now + 0.70, 0.85, false, 1.05); // Resonant ending strike (Ting!)

      } else if (character === 'casal') {
        // High-quality Casal Dançarino: A gorgeous, short syncopated 1.8-second upbeat Forró rhythmic melody!
        const playBassBeat = (time: number, freq: number, vol: number) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(freq, time);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.45, time + 0.16);
          gainNode.gain.setValueAtTime(0, time);
          gainNode.gain.linearRampToValueAtTime(vol * 0.16, time + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
          osc.start(time);
          osc.stop(time + 0.17);
        };

        const playTriangleBeat = (time: number, isMuted: boolean, vol: number) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2450, time);
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          gainNode.gain.setValueAtTime(vol * 0.035, time);
          gainNode.gain.exponentialRampToValueAtTime(0.001, time + (isMuted ? 0.05 : 0.25));
          osc.start(time);
          osc.stop(time + (isMuted ? 0.06 : 0.27));
        };

        const playChordBeat = (time: number, notes: number[], duration: number, vol: number) => {
          notes.forEach((f) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, time);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(850, time);
            
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(vol * 0.032, time + 0.04);
            gainNode.gain.linearRampToValueAtTime(vol * 0.032, time + duration * 0.7);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            osc.start(time);
            osc.stop(time + duration + 0.04);
          });
        };

        const C_maj = [261.63, 329.63, 392.00, 523.25];
        const G_maj = [246.94, 293.66, 392.00, 493.88];
        const F_maj = [261.63, 349.23, 440.00, 523.25];

        // Beat 1 (t=0s): C major forró bounce
        playBassBeat(now, 110, 1.0);
        playTriangleBeat(now, false, 0.8);
        playChordBeat(now, C_maj, 0.28, 1.0);

        // Beat 1.5 (t=0.25s): Triangle tap
        playTriangleBeat(now + 0.25, true, 0.6);

        // Beat 2 (t=0.5s): G major transition
        playBassBeat(now + 0.5, 98, 0.85);
        playTriangleBeat(now + 0.5, false, 0.8);
        playChordBeat(now + 0.5, G_maj, 0.28, 0.9);

        // Beat 2.5 (t=0.75s): Triangle tap
        playTriangleBeat(now + 0.75, true, 0.6);

        // Beat 3 (t=1.0s): F major accent
        playBassBeat(now + 1.0, 110, 1.0);
        playTriangleBeat(now + 1.0, false, 0.8);
        playChordBeat(now + 1.0, F_maj, 0.24, 0.95);

        // Beat 3.5 (t=1.25s): Quick G major slide back
        playTriangleBeat(now + 1.25, true, 0.6);
        playChordBeat(now + 1.25, G_maj, 0.18, 0.8);

        // Beat 4 (t=1.5s): Final resolved accented C major beat!
        playBassBeat(now + 1.5, 110, 1.15);
        playTriangleBeat(now + 1.5, false, 1.0);
        playChordBeat(now + 1.5, C_maj, 0.42, 1.05);
      }
    } catch (e) {
      console.log('Audio contextual note failed:', e);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessPassword === '69pagina69') {
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

  // Format phone for WhatsApp
  const cleanPhone = (savedPhone || '(83) 99876-5432').replace(/\D/g, '');
  const whatsAppLink = `https://wa.me/55${cleanPhone || '83998765432'}?text=Olá,%20gostaria%20de%20fazer%20um%20orçamento!`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(savedAddress || 'Rua Josina Lessa Feitosa 176 Mangabeira João Pessoa PB')}`;

  return (
    <div 
      className="relative min-h-screen font-sans antialiased overflow-x-hidden selection:bg-brand-pink/20 selection:text-brand-dark"
      style={{ backgroundColor: '#110801' }}
    >
      <style>{`
        @keyframes light-sweep {
          0% {
            background-position: -200% 0;
          }
          50% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        .animate-sweep {
          background: linear-gradient(to right, #ffe17d 0%, #f43f5e 30%, #ffffff 50%, #f43f5e 70%, #ffaa47 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-fill-color: transparent;
          animation: light-sweep 4.5s ease-in-out infinite;
        }
      `}</style>
      
      {/* Festive Celebration Party Background Image */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <OptimizedImage
          src="https://images.unsplash.com/photo-1506224477000-07aa8a76be89"
          width={1000}
          quality={55}
          isAboveFold={true}
          alt="Cactos do Sertão Oxente Festeje"
          className="w-full h-full object-cover opacity-20 filter brightness-75 contrast-110 saturate-110 scale-105"
        />
        {/* PREMIUM ANIMATION 1: Floating Ambient Orbs for rich layout depth */}
        <motion.div 
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -60, 40, 0],
            scale: [1, 1.25, 0.85, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-[20%] left-[10%] w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] rounded-full bg-amber-500/15 filter blur-[80px] sm:blur-[120px] pointer-events-none z-0"
        />
        <motion.div 
          animate={{
            x: [0, -70, 50, 0],
            y: [0, 80, -50, 0],
            scale: [1, 0.9, 1.15, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute bottom-[30%] right-[10%] w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full bg-rose-500/10 filter blur-[90px] sm:blur-[130px] pointer-events-none z-0"
        />

        {/* PARALLAX SKY ELEMENTS (Moon and Clouds) */}
        {/* Full Moon (Lua do Sertão) */}
        <div 
          style={{ transform: `translateY(${scrollY * 0.28}px)` }}
          className="absolute top-[120px] right-[8%] w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 shadow-[0_0_60px_rgba(245,158,11,0.3)] opacity-75 z-10 pointer-events-none transition-transform duration-75 ease-out"
        >
          {/* Lunar details */}
          <div className="absolute top-[25%] left-[25%] w-4 h-4 rounded-full bg-amber-600/10" />
          <div className="absolute top-[55%] left-[45%] w-6 h-6 rounded-full bg-amber-600/10" />
          <div className="absolute top-[40%] left-[65%] w-3 h-3 rounded-full bg-amber-600/10" />
        </div>

        {/* Fluffy Cloud 1 (Left Side) */}
        <div 
          style={{ transform: `translate(${scrollY * 0.14}px, ${scrollY * 0.08}px)` }}
          className="absolute top-[160px] left-[5%] w-32 h-8 rounded-full bg-white/5 filter blur-xs opacity-35 border border-white/5 z-10 pointer-events-none transition-transform duration-75 ease-out"
        >
          <div className="absolute -top-[12px] left-[18px] w-12 h-12 rounded-full bg-white/5" />
          <div className="absolute -top-[20px] left-[45px] w-14 h-14 rounded-full bg-white/5" />
        </div>

        {/* Fluffy Cloud 2 (Right Side) */}
        <div 
          style={{ transform: `translate(${-scrollY * 0.12}px, ${scrollY * 0.05}px)` }}
          className="absolute top-[280px] right-[4%] w-40 h-10 rounded-full bg-white/5 filter blur-xs opacity-30 border border-white/5 z-10 pointer-events-none transition-transform duration-75 ease-out"
        >
          <div className="absolute -top-[16px] left-[25px] w-14 h-14 rounded-full bg-white/5" />
          <div className="absolute -top-[24px] left-[60px] w-16 h-16 rounded-full bg-white/5" />
        </div>

        {/* Subtle vignette overlays to preserve the gold-to-brown gradient and keep text readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/45" />
        <div className="absolute inset-0 bg-radial-at-t from-transparent via-transparent to-black/50" />
      </div>

      {/* Background Animated Celebration Fireworks Layer (One-time, on-load/on-refresh) */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
          {fireworks.map((f) => (
            <div key={f.id} className="absolute inset-0">
              {/* Rocket Rising Trail */}
              <motion.div
                className="absolute w-[2.5px] rounded-full"
                style={{
                  left: `${f.x}%`,
                  bottom: 0,
                  height: '45px',
                  background: `linear-gradient(to top, transparent 10%, ${f.color} 80%, #ffffff 100%)`,
                  boxShadow: `0 0 14px ${f.color}`,
                }}
                initial={{ y: '100vh', opacity: 1 }}
                animate={{
                  y: `-${100 - f.y}vh`,
                  opacity: [1, 1, 0]
                }}
                transition={{
                  duration: 1.0,
                  ease: "easeOut",
                  delay: f.launchDelay,
                }}
              />

              {/* Explosion Sparkles */}
              <div
                className="absolute"
                style={{
                  left: `${f.x}%`,
                  top: `${f.y}%`,
                }}
              >
                {/* Center Expansion Glow */}
                <motion.div
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
                  style={{
                    width: '85px',
                    height: '85px',
                    backgroundColor: f.color,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 2.8, 0],
                    opacity: [0, 0.45, 0]
                  }}
                  transition={{
                    duration: 1.0,
                    ease: "easeOut",
                    delay: f.launchDelay + 1.0,
                  }}
                />

                {/* Particle Stars */}
                {f.particles.map((p) => {
                  const targetX = Math.cos(p.angle * Math.PI / 180) * p.distance;
                  const targetY = Math.sin(p.angle * Math.PI / 180) * p.distance + 50; // gravity downward drift
                  return (
                    <motion.div
                      key={p.id}
                      className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
                      style={{
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        backgroundColor: p.id % 2 === 0 ? '#ffffff' : f.color,
                        boxShadow: `0 0 10px ${f.color}, 0 0 4px #ffffff`,
                      }}
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                      animate={{
                        x: targetX,
                        y: targetY,
                        opacity: [0, 1, 1, 0.6, 0],
                        scale: [0, 1.6, 1.3, 0.5, 0]
                      }}
                      transition={{
                        duration: 2.0,
                        ease: "easeOut",
                        delay: f.launchDelay + 1.0,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ANIMATED NORTHEAST CANGAÇO BACKGROUND CHARACTERS (Inspired by reference family image) */}
      
      {/* 1. Sr. Mandacaru (Cute Cactus wearing traditional Lampião leather hat) */}
      <motion.div
        onClick={() => triggerSpeech('cacto_esq')}
        className="fixed bottom-0 left-[2%] md:left-[4%] z-40 w-24 md:w-32 cursor-pointer pointer-events-auto select-none"
        animate={{ y: [15, 0, 15], rotate: [-1, 2, -1] }}
        transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
      >
        <AnimatePresence>
          {speechBubble === 'cacto_esq' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 15 }}
              className="absolute -top-16 left-1/2 -translate-x-1/2 bg-zinc-950/95 text-amber-300 font-display font-black text-xs px-3 py-2 rounded-2xl shadow-xl border-2 border-amber-500/80 whitespace-nowrap z-50 flex items-center gap-1"
            >
              <span>🌵 Oxente! 🌵</span>
              <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-amber-500" />
            </motion.div>
          )}
        </AnimatePresence>
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
        onClick={() => triggerSpeech('cacto_dir')}
        className="fixed bottom-0 right-[2%] md:right-[4%] z-40 w-24 md:w-32 cursor-pointer pointer-events-auto select-none"
        animate={{ y: [18, 0, 18], rotate: [1, -2, 1] }}
        transition={{ repeat: Infinity, duration: 4.8, ease: "easeInOut" }}
      >
        <AnimatePresence>
          {speechBubble === 'cacto_dir' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 15 }}
              className="absolute -top-16 left-1/2 -translate-x-1/2 bg-zinc-950/95 text-amber-300 font-display font-black text-xs px-3 py-2 rounded-2xl shadow-xl border-2 border-amber-500/80 whitespace-nowrap z-50 flex items-center gap-1"
            >
              <span>🌵 Festeje! 🎉</span>
              <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-amber-500" />
            </motion.div>
          )}
        </AnimatePresence>
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
        onClick={() => triggerSpeech('sanfona')}
        className="fixed bottom-[3%] left-[28%] md:left-[31%] z-40 w-16 md:w-20 cursor-pointer pointer-events-auto select-none"
        animate={{ x: [-3, 3, -3], scaleX: [0.95, 1.05, 0.95], rotate: [-2, 2, -2] }}
        transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
      >
        <AnimatePresence>
          {speechBubble === 'sanfona' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 15 }}
              className="absolute -top-16 left-1/2 -translate-x-1/2 bg-zinc-950/95 text-amber-300 font-display font-black text-[10px] md:text-xs px-3 py-2 rounded-2xl shadow-xl border-2 border-amber-500/80 whitespace-nowrap z-50 flex items-center gap-1"
            >
              <span>🌵 uai, bora fazer seu pedido! 🌵</span>
              <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-amber-500" />
            </motion.div>
          )}
        </AnimatePresence>
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

      {/* 4. Triângulinho (Cute traditional triangle instrument character) - Placed next to Seu Sanfoninha */}
      <motion.div
        onClick={(e) => {
          e.stopPropagation();
          setTriangleSpeechText("olha o triângulo do forró! ✨️");
          triggerSpeech('triangulo');
        }}
        className="fixed bottom-[3%] left-[48%] md:left-[50%] -translate-x-1/2 z-40 w-14 md:w-18 cursor-pointer pointer-events-auto select-none"
        animate={{ y: [-5, 5, -5], rotate: [-6, 6, -6] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        <AnimatePresence>
          {speechBubble === 'triangulo' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 15 }}
              className="absolute -top-16 left-1/2 -translate-x-1/2 bg-zinc-950/95 text-amber-300 font-display font-black text-[10px] md:text-xs px-3 py-2 rounded-2xl shadow-xl border-2 border-amber-500/80 whitespace-nowrap z-50 flex items-center gap-1"
            >
              <span>📐 {triangleSpeechText} 🎵</span>
              <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-amber-500" />
            </motion.div>
          )}
        </AnimatePresence>
        <svg viewBox="0 0 100 120" className="w-full h-auto drop-shadow-md">
          {/* Hanging loop line */}
          <path d="M50,15 L50,30" stroke="#a16207" strokeWidth="2.5" strokeLinecap="round" />
          
          {/* Main Triangle metallic bar */}
          <path d="M50,30 L15,95 L85,95 Z" fill="none" stroke="#facc15" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          {/* Inner silver gleam */}
          <path d="M50,32 L18,93 L82,93" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          
          {/* Face background inside the triangle for high contrast with landpage background */}
          <polygon points="50,38 25,90 75,90" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />

          {/* Little Leather Hat on top of the Triangle */}
          <path d="M38,26 C38,12 62,12 62,26 Z" fill="#854d0e" stroke="#451a03" strokeWidth="1.5" />
          <path d="M30,25 C40,28 60,28 70,25 C74,22 74,29 70,28 C60,30 40,30 30,28 C26,29 26,22 30,25 Z" fill="#a16207" stroke="#451a03" strokeWidth="1.5" />

          {/* Cute face in the center */}
          <g transform="translate(0, 15)">
            <circle cx="42" cy="62" r="3.5" fill="#1c1917" />
            <circle cx="58" cy="62" r="3.5" fill="#1c1917" />
            <circle cx="41" cy="60" r="1" fill="#ffffff" />
            <circle cx="57" cy="60" r="1" fill="#ffffff" />
            {/* Blushing cheeks */}
            <circle cx="38" cy="66" r="3" fill="#f43f5e" opacity="0.6" />
            <circle cx="62" cy="66" r="3" fill="#f43f5e" opacity="0.6" />
            <path d="M47,68 Q50,72 53,68" fill="none" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Triangle striker stick animating */}
          <motion.line 
            x1="12" y1="75" x2="38" y2="60" 
            stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" 
            animate={{ rotate: [0, 20, -10, 0] }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
            style={{ originX: "38px", originY: "60px" }}
          />
        </svg>
      </motion.div>

      {/* 5. Zabumbinha (Cute traditional bouncing drum character) */}
      <motion.div
        onClick={() => triggerSpeech('zabumba')}
        className="fixed bottom-[3%] right-[28%] md:right-[31%] z-40 w-14 md:w-18 cursor-pointer pointer-events-auto select-none"
        animate={{ y: [-6, 4, -6], rotate: [5, -5, 5] }}
        transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
      >
        <AnimatePresence>
          {speechBubble === 'zabumba' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 15 }}
              className="absolute -top-16 left-1/2 -translate-x-1/2 bg-zinc-950/95 text-amber-300 font-display font-black text-[10px] md:text-xs px-3 py-2 rounded-2xl shadow-xl border-2 border-amber-500/80 whitespace-nowrap z-50 flex items-center gap-1"
            >
              <span>🎉 Bem vindo a Oxente Festeje, bora comemorar! 🌵</span>
              <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-amber-500" />
            </motion.div>
          )}
        </AnimatePresence>
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

      {/* Full-width Profile Header */}
      <div id="whatsapp-profile-header" className="relative w-full overflow-hidden z-20">
        
        {/* Cover Banner (Festa Junina / Bonfire background) */}
        <div className="relative h-56 sm:h-64 md:h-80 lg:h-[400px] w-full overflow-hidden">
          <OptimizedImage 
            src="/banner.png" 
            fallbackSrc="https://images.unsplash.com/photo-1506224477000-07aa8a76be89"
            width={1200}
            quality={65}
            alt="Oxente Festeje Banner" 
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              const currentSrc = e.currentTarget.src;
              if (currentSrc.includes('/banner.png')) {
                e.currentTarget.src = '/banner.jpg';
              } else if (currentSrc.includes('/banner.jpg')) {
                e.currentTarget.src = '/input_file_1.png';
              } else if (currentSrc.includes('/input_file_1.png')) {
                e.currentTarget.src = '/capa.png';
              } else {
                e.currentTarget.src = "https://images.unsplash.com/photo-1506224477000-07aa8a76be89?auto=format&fit=crop&w=1200&q=65&fm=webp";
              }
            }}
          />
        </div>

      </div>

      {/* Main Container */}
      <div className="relative max-w-4xl mx-auto px-6 pt-10 pb-32 z-20 flex flex-col items-center text-center">
        
        {/* Gold Highlight Badge (A loja de brindes mais seguida...) */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-fit max-w-full mx-auto mb-8"
        >
          <motion.div
            animate={{
              x: [0, -3, 3, -3, 3, -1.5, 1.5, 0],
              rotate: [0, -1.5, 1.5, -1.2, 1.2, -0.6, 0.6, 0],
              boxShadow: [
                "0px 0px 30px rgba(245, 158, 11, 0.4)",
                "0px 0px 55px rgba(251, 191, 36, 0.95)",
                "0px 0px 55px rgba(251, 191, 36, 0.95)",
                "0px 0px 30px rgba(245, 158, 11, 0.4)"
              ],
              borderColor: [
                "rgba(253, 224, 71, 0.6)",
                "rgba(253, 224, 71, 1.0)",
                "rgba(253, 224, 71, 1.0)",
                "rgba(253, 224, 71, 0.6)"
              ]
            }}
            transition={{
              delay: 0.7, // Começa exatamente quando o fade-in do botão termina
              repeat: Infinity,
              duration: 1.0, // Tremida mais rápida e chamativa na primeira vez e subsequentes
              ease: "easeInOut",
              repeatDelay: 2.5,
            }}
            className="relative overflow-hidden px-4 py-3 sm:px-6 sm:py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 border-2 flex items-center justify-center gap-1.5 sm:gap-3 cursor-default flex-nowrap"
            id="gold-highlight-badge"
          >
            {/* Shimmer/Light ray sliding effect */}
            <motion.div
              className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-white to-transparent -skew-x-20 z-10 mix-blend-overlay opacity-90 sm:opacity-100"
              animate={{
                left: ['-100%', '200%'],
              }}
              transition={{
                repeat: Infinity,
                duration: 2.0,
                ease: "linear",
              }}
            />

            <Award className="h-4 w-4 sm:h-5 sm:w-5 text-amber-950 fill-amber-950/10 animate-bounce shrink-0 relative z-20" />
            <span className="font-display font-black text-amber-950 text-[9px] min-[375px]:text-[11px] sm:text-xs md:text-sm uppercase tracking-wider relative z-20 sm:whitespace-nowrap whitespace-normal text-center max-w-[220px] sm:max-w-none leading-relaxed">
              A loja de brindes mais seguida de João Pessoa com mais de 100mil seguidores
            </span>
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-amber-950 fill-amber-950/10 animate-pulse shrink-0 relative z-20" />
          </motion.div>
        </motion.div>

        {/* Central Dashboard Card with custom CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative w-full max-w-lg md:max-w-3xl bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-amber-500/35 p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-4 md:gap-6 mb-12"
        >
          <h2 className="text-lg md:text-2xl font-display font-bold text-amber-100 flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-4">
            <Sparkles className="h-5 w-5 md:h-7 md:w-7 text-amber-400 fill-amber-400 animate-pulse" />
            <span>O que você deseja fazer hoje?</span>
          </h2>

          {/* BUTTON 1: WhatsApp Chat Link */}
          <MagneticButton
            href={whatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            delay={0.15}
            glowColor="rgba(16, 185, 129, 0.3)"
            onClick={() => {
              trackGoogleAdsEvent('click_whatsapp_orcamento', 'Fazer Orçamento no WhatsApp');
            }}
            className="relative flex items-center gap-4 md:gap-6 bg-gradient-to-r from-emerald-600 to-green-800 text-white font-display font-bold p-4 md:p-6 rounded-2xl md:rounded-3xl hover:brightness-110 transition-all text-left group overflow-hidden w-full"
          >
            <div className="bg-white/10 p-2.5 md:p-3.5 rounded-xl md:rounded-2xl group-hover:scale-110 transition-transform flex-shrink-0 relative z-10">
              <MessageSquare className="h-5 w-5 md:h-7 md:w-7 text-white" />
            </div>
            <div className="flex-1 relative z-10">
              <span className="block text-sm md:text-lg">Fazer Orçamento no WhatsApp</span>
              <span className="block text-xs md:text-sm font-normal text-emerald-100/85 mt-0.5 font-sans">Fale diretamente com nossa equipe</span>
            </div>
            <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-white/75 group-hover:translate-x-1 transition-transform mr-1 relative z-10" />
          </MagneticButton>

          {/* BUTTON 2: Instagram Direct Link */}
          <MagneticButton
            href="https://www.instagram.com/oxentefesteje/"
            target="_blank"
            rel="noopener noreferrer"
            delay={0.25}
            glowColor="rgba(225, 48, 108, 0.3)"
            onClick={() => {
              trackGoogleAdsEvent('click_instagram', 'Siga-nos no Instagram');
            }}
            className="relative flex items-center gap-4 md:gap-6 bg-gradient-to-r from-[#e1306c] via-[#f77737] to-[#fcb045] text-white font-display font-black p-4 md:p-6 rounded-2xl md:rounded-3xl hover:brightness-110 transition-all text-left group overflow-hidden w-full"
          >
            <div className="bg-black/10 p-2.5 md:p-3.5 rounded-xl md:rounded-2xl group-hover:scale-110 transition-transform flex-shrink-0 relative z-10">
              <Instagram className="h-5 w-5 md:h-7 md:w-7 text-white" />
            </div>
            <div className="flex-1 relative z-10">
              <span className="block text-sm md:text-lg">Siga-nos no Instagram</span>
              <span className="block text-xs md:text-sm font-bold text-zinc-100/85 mt-0.5 font-sans">@oxentefesteje · Inspirações diárias</span>
            </div>
            <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-zinc-100/75 group-hover:translate-x-1 transition-transform mr-1 relative z-10" />
          </MagneticButton>

          {/* BUTTON 3: Google Maps Direct Link */}
          <MagneticButton
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            delay={0.35}
            glowColor="rgba(217, 119, 6, 0.3)"
            onClick={() => {
              trackGoogleAdsEvent('click_como_chegar', 'Como Chegar na Loja (Google Maps)');
            }}
            className="relative flex items-center gap-4 md:gap-6 bg-gradient-to-r from-amber-600 to-amber-800 text-amber-50 font-display font-bold p-4 md:p-6 rounded-2xl md:rounded-3xl hover:brightness-110 transition-all text-left group overflow-hidden w-full"
          >
            <div className="bg-white/10 p-2.5 md:p-3.5 rounded-xl md:rounded-2xl group-hover:scale-110 transition-transform flex-shrink-0 relative z-10">
              <MapPin className="h-5 w-5 md:h-7 md:w-7 text-amber-50" />
            </div>
            <div className="flex-1 relative z-10">
              <span className="block text-sm md:text-lg">Como Chegar na Loja</span>
              <span className="block text-xs md:text-sm font-normal text-amber-200/80 mt-0.5 font-sans">Clique para abrir no Google Maps</span>
            </div>
            <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-amber-200/75 group-hover:translate-x-1 transition-transform mr-1 relative z-10" />
          </MagneticButton>

          {/* BUTTON 4: Order Real-time Tracking Panel */}
          <MagneticButton
            onClick={() => setShowTrackingModal(true)}
            delay={0.45}
            glowColor="rgba(245, 158, 11, 0.2)"
            className="relative flex items-center gap-4 md:gap-6 bg-gradient-to-r from-amber-900 to-[#3e240a] border border-amber-500/20 text-amber-100 font-display font-bold p-4 md:p-6 rounded-2xl md:rounded-3xl hover:border-amber-500/40 transition-all text-left group cursor-pointer overflow-hidden w-full"
          >
            <div className="bg-white/10 p-2.5 md:p-3.5 rounded-xl md:rounded-2xl group-hover:scale-110 transition-transform flex-shrink-0 relative z-10">
              <Search className="h-5 w-5 md:h-7 md:w-7 text-amber-100" />
            </div>
            <div className="flex-1 relative z-10">
              <span className="block text-sm md:text-lg">Acompanhar meu Pedido</span>
              <span className="block text-xs md:text-sm font-normal text-amber-200/80 mt-0.5 font-sans">Consulte o andamento da sua entrega</span>
            </div>
            <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-amber-200/75 group-hover:translate-x-1 transition-transform mr-1 relative z-10" />
          </MagneticButton>

          {/* Tracking Highlight Badge (A única que você acompanha seu pedido em tempo real) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="w-fit max-w-full mx-auto mt-3"
          >
            <motion.div
              animate={{
                x: [0, -3, 3, -3, 3, -1.5, 1.5, 0],
                rotate: [0, -1.5, 1.5, -1.2, 1.2, -0.6, 0.6, 0],
                boxShadow: [
                  "0px 0px 15px rgba(120, 53, 4, 0.3)",
                  "0px 0px 35px rgba(245, 158, 11, 0.95)",
                  "0px 0px 35px rgba(245, 158, 11, 0.95)",
                  "0px 0px 15px rgba(120, 53, 4, 0.3)"
                ],
                borderColor: [
                  "rgba(245, 158, 11, 0.3)",
                  "rgba(251, 191, 36, 0.9)",
                  "rgba(251, 191, 36, 0.9)",
                  "rgba(245, 158, 11, 0.3)"
                ]
              }}
              transition={{
                delay: 1.1, // Começa exatamente quando o fade-in do botão termina (delay 0.5s + duration 0.5s + margem)
                repeat: Infinity,
                duration: 1.0, // Tremida mais rápida e chamativa na primeira vez e subsequentes
                ease: "easeInOut",
                repeatDelay: 2.5,
              }}
              className="relative overflow-hidden px-4 py-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-950/60 via-[#2d1b08]/80 to-amber-950/60 border border-amber-500/30 flex items-center justify-center gap-1.5 sm:gap-2 cursor-default flex-nowrap"
              id="tracking-highlight-badge"
            >
              {/* Shimmer/Light ray sliding effect */}
              <motion.div
                className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-20 z-10 mix-blend-overlay opacity-90 sm:opacity-100"
                animate={{
                  left: ['-100%', '200%'],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.0,
                  ease: "linear",
                }}
              />

              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 fill-amber-400/10 animate-bounce shrink-0 relative z-20" />
              <span className="font-display font-black text-amber-200 text-[8px] min-[375px]:text-[10px] sm:text-[11px] md:text-xs uppercase tracking-wider relative z-20 sm:whitespace-nowrap whitespace-normal text-center max-w-[190px] sm:max-w-none leading-relaxed">
                A única que você acompanha seu pedido em tempo real
              </span>
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 fill-amber-400/10 animate-pulse shrink-0 relative z-20" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Instagram Feed Section */}
        <InstagramFeed />

        {/* Profile "About" / Bio Card - Highly Enhanced & Creative */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative w-full max-w-3xl mx-auto bg-[#1a0f07]/90 backdrop-blur-md rounded-3xl border border-amber-500/20 p-6 md:p-8 shadow-[0_15px_35px_rgba(0,0,0,0.6)] text-center mb-12 overflow-hidden"
        >
          {/* Subtle Festive Background Lights/Stars Inside the Card */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.08),transparent_50%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(244,63,94,0.05),transparent_40%)] pointer-events-none" />
          
          {/* Top Decorative Banner-styled Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-widest font-mono mb-6">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span>Nossa Essência & História</span>
            <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          </div>

          {/* Centered Brand Title with 3D animation & Cangaceiro Leather Hat on "O" */}
          <motion.div
            initial="initial"
            animate="animate"
            variants={{
              initial: {},
              animate: {
                transition: {
                  staggerChildren: 0.05
                }
              }
            }}
            className="relative flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2 text-3xl sm:text-4xl md:text-5xl font-display font-black tracking-wider text-[#ffeeaa] uppercase select-none pb-5"
          >
            {/* OXENTE with letter animation & Leather Hat on "O" */}
            <span className="inline-flex gap-0.5 sm:gap-1">
              {"Oxente".split("").map((char, index) => {
                if (index === 0) {
                  return (
                    <motion.span
                      key={index}
                      variants={{
                        initial: { y: 0, scale: 1, rotate: 0 },
                        animate: {
                          y: [0, -12, 1, -2, 0],
                          scale: [1, 1.15, 0.96, 1.02, 1],
                          rotate: [0, -8, 4, -2, 0],
                          transition: { duration: 1.2, ease: "easeOut" }
                        }
                      }}
                      className="relative inline-block"
                      style={{ 
                        textShadow: "0 1px 0 #f59e0b, 0 2px 0 #d97706, 0 3px 0 #b45309, 0 4px 0 #92400e, 0 5px 0 #78350f, 0 6px 0 #451a03, 0 7px 0 #1c0a01, 0 8px 12px rgba(0,0,0,0.9), 0 12px 24px rgba(69,26,3,0.6)" 
                      }}
                    >
                      {/* Leather Hat (Chapéu de Couro / Cangaço) precisely aligned over "O" to look like it is wearing it */}
                      <span className="absolute -top-[0.45em] md:-top-[0.43em] -left-[0.40em] w-[1.48em] h-[0.88em] pointer-events-none z-20 block select-none">
                        <svg viewBox="0 0 100 60" className="w-full h-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.7)] transform -rotate-[5deg]">
                          {/* Hat crown (leather dome) */}
                          <path d="M 22 36 C 22 10, 78 10, 78 36 Z" fill="#78350f" stroke="#451a03" strokeWidth="2.5" />
                          {/* Embroidery inside crown */}
                          <path d="M 33 36 C 33 16, 67 16, 67 36" fill="none" stroke="#fef3c7" strokeWidth="1.5" strokeDasharray="3,3" />
                          {/* Central Star emblem (cangaceiro style) */}
                          <path d="M 50 17 L 52.5 22 L 58 23.5 L 53.5 26.5 L 55 32 L 50 29 L 45 32 L 46.5 26.5 L 42 23.5 L 47.5 22 Z" fill="#f59e0b" stroke="#b45309" strokeWidth="0.5" />
                          {/* Left/Right decorative leather straps on crown */}
                          <path d="M 27 36 L 31 22" fill="none" stroke="#d97706" strokeWidth="1.5" />
                          <path d="M 73 36 L 69 22" fill="none" stroke="#d97706" strokeWidth="1.5" />
                          {/* Wide brim (curved upward at edges) */}
                          <path d="M 5 36 Q 50 24 95 36 C 90 47, 10 47, 5 36 Z" fill="#b45309" stroke="#451a03" strokeWidth="2.5" />
                          {/* Stitching on the brim */}
                          <path d="M 12 37 Q 50 28 88 37" fill="none" stroke="#fef3c7" strokeWidth="1.5" strokeDasharray="4,3" />
                          {/* Hanging leather chin straps (tassels) */}
                          <path d="M 45 39 Q 47 52 49 57" fill="none" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
                          <path d="M 55 39 Q 53 52 51 57" fill="none" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </span>
                      {char}
                    </motion.span>
                  );
                }
                return (
                  <motion.span
                    key={index}
                    variants={{
                      initial: { y: 0, scale: 1, rotate: 0 },
                      animate: {
                        y: [0, -12, 1, -2, 0],
                        scale: [1, 1.15, 0.96, 1.02, 1],
                        rotate: [0, -8, 4, -2, 0],
                        transition: { duration: 1.2, ease: "easeOut" }
                      }
                    }}
                    className="inline-block"
                    style={{ 
                      textShadow: "0 1px 0 #f59e0b, 0 2px 0 #d97706, 0 3px 0 #b45309, 0 4px 0 #92400e, 0 5px 0 #78350f, 0 6px 0 #451a03, 0 7px 0 #1c0a01, 0 8px 12px rgba(0,0,0,0.9), 0 12px 24px rgba(69,26,3,0.6)" 
                    }}
                  >
                    {char}
                  </motion.span>
                );
              })}
            </span>

            {/* FESTEJE with letter animation */}
            <span className="inline-flex gap-0.5 sm:gap-1">
              {"Festeje".split("").map((char, index) => {
                return (
                  <motion.span
                    key={index}
                    variants={{
                      initial: { y: 0, scale: 1, rotate: 0 },
                      animate: {
                        y: [0, -12, 1, -2, 0],
                        scale: [1, 1.15, 0.96, 1.02, 1],
                        rotate: [0, -8, 4, -2, 0],
                        transition: { duration: 1.2, ease: "easeOut" }
                      }
                    }}
                    className="inline-block"
                    style={{ 
                      textShadow: "0 1px 0 #f59e0b, 0 2px 0 #d97706, 0 3px 0 #b45309, 0 4px 0 #92400e, 0 5px 0 #78350f, 0 6px 0 #451a03, 0 7px 0 #1c0a01, 0 8px 12px rgba(0,0,0,0.9), 0 12px 24px rgba(69,26,3,0.6)" 
                    }}
                  >
                    {char}
                  </motion.span>
                );
              })}
            </span>
          </motion.div>

          {/* Interactive storytelling description */}
          <p className="text-sm md:text-base text-stone-200 leading-relaxed font-sans max-w-2xl mx-auto mb-8">
            Personalizando a sua festa há mais de 11 anos. Hoje, somos <strong className="text-amber-400 font-bold">a loja de brindes mais seguida e querida de João Pessoa</strong>, onde cada detalhe é feito com carinho e você acompanha tudo passo a passo! 🌵✨
          </p>

          {/* 3 Pillars layout - Beautifully styled cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left pt-2 border-t border-amber-500/10">
            {/* Pillar 1 - Tempo Real */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.03, borderColor: "rgba(16, 185, 129, 0.35)", boxShadow: "0 10px 20px rgba(0,0,0,0.3)" }}
              className="bg-zinc-950/50 p-4 rounded-2xl border border-amber-500/10 flex flex-col gap-2 transition-all cursor-default relative z-10"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-display font-bold">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <Clock className="h-4 w-4" />
                </div>
                <span className="text-xs uppercase tracking-wider font-mono">Tempo Real</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed font-sans">
                A única loja de brindes onde você acompanha seu pedido por link em tempo real, desde a produção até ele ficar pronto!
              </p>
            </motion.div>

            {/* Pillar 2 - + De 100mil seguidores */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.03, borderColor: "rgba(245, 158, 11, 0.35)", boxShadow: "0 10px 20px rgba(0,0,0,0.3)" }}
              className="bg-zinc-950/50 p-4 rounded-2xl border border-amber-500/10 flex flex-col gap-2 transition-all cursor-default relative z-10"
            >
              <div className="flex items-center gap-2 text-amber-400 font-display font-bold">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Users className="h-4 w-4" />
                </div>
                <span className="text-xs uppercase tracking-wider font-mono">+ De 100mil seguidores</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed font-sans">
                A comunidade mais apaixonada do Instagram que escolhe e recomenda nossos brindes diariamente.
              </p>
            </motion.div>

            {/* Pillar 3 - Cupons & Promoções */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.03, borderColor: "rgba(239, 68, 68, 0.5)", boxShadow: "0 10px 20px rgba(239, 68, 68, 0.25)" }}
              className="bg-zinc-950/50 p-4 rounded-2xl border border-red-500/25 flex flex-col gap-2 transition-all cursor-default relative z-10"
            >
              <div className="flex items-center gap-2 text-red-500 font-display font-bold animate-pulse-subtle">
                <div className="p-1.5 rounded-lg bg-red-500/15 border border-red-500/20">
                  <Gift className="h-4 w-4 text-red-500" />
                </div>
                <span className="text-xs uppercase tracking-wider font-mono font-extrabold text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">Cupons & Promoções</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed font-sans">
                Descontos especiais e ofertas imperdíveis para garantir que a sua festa caiba no orçamento com muita alegria!
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Mural de Recomendações (Love Wall) Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-full flex flex-col items-center mt-0 mb-12"
        >
          <div className="flex items-center gap-2 mb-2">
            <Quote className="h-6 w-6 text-amber-400 fill-amber-400/20" />
            <h3 className="text-2xl font-display font-black text-amber-100 uppercase tracking-tight">Mural de Recomendações</h3>
          </div>
          <p className="text-amber-200/70 text-xs md:text-sm max-w-md mb-8 font-sans font-medium">
            Veja o carinho de quem escolheu tornar seus eventos inesquecíveis com os nossos brindes e lembranças personalizadas!
          </p>

          {/* Grid Layout of post-it cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-left">
            {RECOMMENDATIONS.map((r, idx) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 35, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: idx * 0.08, ease: "easeOut" }}
                whileHover={{ 
                  y: -8, 
                  rotate: idx % 2 === 0 ? 1.5 : -1.5,
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                  borderColor: "rgba(197, 146, 24, 0.4)"
                }}
                className={`bg-stone-950/85 backdrop-blur-md rounded-2xl p-6 border border-amber-500/25 shadow-lg relative flex flex-col justify-between transition-all duration-300 ${
                  idx % 3 === 0 ? "border-l-4 border-l-brand-pink" :
                  idx % 3 === 1 ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-amber-700"
                }`}
              >
                <div>
                  <div className="flex gap-0.5 mb-2.5">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p className="text-zinc-100 text-[13.5px] font-medium leading-relaxed mb-4">
                    "{r.comment}"
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2 border-t border-zinc-800/80 pt-3">
                  <div>
                    <h4 className="text-xs font-display font-bold text-amber-200">{r.name}</h4>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Feedback notice badge */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-8 px-4 py-2 bg-emerald-950/30 border border-emerald-500/15 rounded-full flex items-center justify-center gap-2 shadow-inner"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-emerald-400">
              Mural feito baseado nos comentários de feedback no Whatsapp
            </span>
          </motion.div>
        </motion.div>

        {/* Success Counter (Social Proof) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-16 mb-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center z-30 relative py-3.5 px-6 rounded-2xl bg-stone-950/50 backdrop-blur-md border border-amber-500/15 max-w-xl mx-auto shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
        >
          <div className="flex items-center gap-2">
            <Gift className="h-4.5 w-4.5 text-amber-400 animate-pulse shrink-0" />
            <span className="font-display font-black text-amber-100 text-sm tracking-wide">
              + de 8.000 brindes personalizados entregues
            </span>
          </div>
          <div className="hidden sm:block h-3.5 w-px bg-stone-800" />
          <div className="flex items-center gap-1.5 text-xs text-stone-400 font-sans font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span>Garantindo o sucesso de centenas de festas</span>
          </div>
        </motion.div>

        {/* Footer info and secret entry */}
        <p className="text-[11px] text-zinc-400 font-medium mt-16 flex items-center gap-1.5 justify-center relative z-30">
          <span>© 2026 Oxente Festeje. João Pessoa - PB. Todos os direitos reservados.</span>
          <button
            onClick={() => {
              setAccessPassword('');
              setPasswordError(false);
              setShowAccessModal(true);
            }}
            className="text-zinc-700/25 hover:text-zinc-500/60 p-1 transition-all cursor-pointer inline-flex items-center relative"
            title="Acesso Secreto (Backup)"
          >
            {/* Pulsing breathing indicator ring */}
            <motion.div
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.5, 0.9, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute -inset-0.5 rounded-full bg-amber-500/15 blur-xs pointer-events-none"
            />
            <Lock className="h-3 w-3 relative z-10" />
          </button>
        </p>

        {/* MODAL 1: Order Tracking Lookup dialog */}
        <AnimatePresence>
          {showTrackingModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-amber-500/35"
              >
                {/* Header card banner */}
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/15 to-orange-500/10 p-6 text-left relative overflow-hidden border-b border-amber-500/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
                  <h3 className="text-xl font-display font-black text-amber-100 flex items-center gap-2">
                    <Search className="h-5 w-5 text-amber-400" />
                    <span>Rastrear Seu Pedido</span>
                  </h3>
                  <p className="text-stone-400 text-xs mt-1">
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
                        className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500/50 rounded-xl px-4 py-3 text-sm text-amber-100 font-bold focus:outline-none placeholder:text-stone-600"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={trackingLoading}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-display font-black text-xs uppercase tracking-widest px-5 py-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-black/25"
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
                      className="bg-red-950/45 text-red-400 rounded-xl p-4 text-xs font-semibold flex items-start gap-2 border border-red-900/30 mb-4"
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
                      className="bg-gradient-to-b from-stone-950/80 to-stone-950/40 rounded-2xl p-5 border border-amber-500/10 shadow-inner"
                    >
                      <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
                        <div>
                          <span className="block text-[10px] text-stone-500 font-bold uppercase tracking-wider">Cliente</span>
                          <span className="block text-sm font-black text-amber-100">{trackedSale.cliente}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] text-stone-500 font-bold uppercase tracking-wider">Nº Pedido</span>
                          <span className="block text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-lg">
                            #{trackedSale.numeroPedido || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Info lines */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-400 font-medium">Produto / Descrição:</span>
                          <span className="font-bold text-stone-200 truncate max-w-[200px]" title={trackedSale.produtoNome}>
                            {trackedSale.produtoNome}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-400 font-medium">Data do Pedido:</span>
                          <span className="font-bold text-stone-300 flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-stone-500" />
                            {trackedSale.data ? new Date(trackedSale.data).toLocaleDateString('pt-BR') : '-'}
                          </span>
                        </div>
                        
                        {/* Interactive Status Indicator bar */}
                        <div className="mt-4 pt-3 border-t border-stone-800">
                          <span className="block text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-2">Status da Produção</span>
                          
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                              trackedSale.statusProducao === 'Entregue' 
                                ? 'bg-emerald-950/45 text-emerald-400 border-emerald-900/30' 
                                : trackedSale.statusProducao === 'Pronto para Retirada'
                                ? 'bg-amber-950/45 text-amber-400 border-amber-900/30'
                                : 'bg-blue-950/45 text-blue-400 border-blue-900/30'
                            }`}>
                              <Check className="h-3.5 w-3.5" />
                              {trackedSale.statusProducao || 'Pendente'}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-400 mt-2 leading-relaxed">
                            {trackedSale.statusProducao === 'Entregue' 
                              ? 'O seu pedido já foi retirado ou entregue com sucesso! Obrigado por festejar com a gente! 🥳'
                              : trackedSale.statusProducao === 'Pronto para Retirada'
                              ? 'Excelente notícia! O seu pedido está finalizado e aguardando você vir buscá-lo na loja! 📍'
                              : 'O seu pedido está sendo preparado com muito carinho por nossa equipe de artesãos e designers. Logo estará pronto! 🎁'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Modal footer back actions */}
                <div className="bg-stone-950/50 px-6 py-4 flex justify-end border-t border-stone-800/80">
                  <button
                    onClick={() => {
                      setShowTrackingModal(false);
                      setTrackedSale(null);
                      setTypedOrderId('');
                      setTrackingError(null);
                    }}
                    className="text-stone-400 hover:text-amber-300 font-bold text-sm px-4 py-2 hover:bg-stone-900 rounded-xl transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 2: Locked app entry dialog with (69pagina69) password */}
        <AnimatePresence>
          {showAccessModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-amber-500/35"
              >
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/15 to-orange-500/10 p-6 text-left relative overflow-hidden border-b border-amber-500/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
                  <h3 className="text-lg font-display font-black text-amber-100 flex items-center gap-2">
                    <Lock className="h-5 w-5 text-amber-400" />
                    <span>Área Administrativa</span>
                  </h3>
                  <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                    Acesso restrito para colaboradores. Digite a senha para entrar no sistema de gerenciamento.
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="p-6 text-left">
                  <div className="mb-4">
                    <label className="block text-xs font-mono uppercase text-stone-500 mb-2">Senha do App</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={accessPassword}
                      onChange={(e) => setAccessPassword(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500/50 rounded-xl px-4 py-3 text-sm font-bold text-amber-100 tracking-widest placeholder:text-stone-600 focus:outline-none"
                      required
                      autoFocus
                    />
                  </div>

                  {passwordError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-950/45 text-red-400 rounded-xl p-3 text-xs font-bold border border-red-900/30 flex items-center gap-1.5 mb-4"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Senha incorreta! Tente novamente.</span>
                    </motion.div>
                  )}

                  <div className="flex gap-2 justify-end pt-2 border-t border-stone-800/80 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccessModal(false);
                        setPasswordError(false);
                      }}
                      className="text-stone-400 hover:text-amber-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer hover:bg-stone-950"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-display font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
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
