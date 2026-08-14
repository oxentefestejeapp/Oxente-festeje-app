import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Instagram, 
  Heart, 
  MessageCircle, 
  ExternalLink, 
  Sparkles, 
  Lock, 
  Unlock, 
  Trash2, 
  Plus, 
  X, 
  Upload, 
  Image as ImageIcon,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Share2,
  Check
} from 'lucide-react';
import { OptimizedImage, compressImageFile } from '../utils/imageOptimizer';
import { dbSupabase } from '../lib/supabase';
import { InstagramPost } from '../types';

const createComingSoonCard = (categoryTitle: string, emoji: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#18181b"/>
        <stop offset="50%" stop-color="#09090b"/>
        <stop offset="100%" stop-color="#1c1917"/>
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="25%" stop-color="#f59e0b"/>
        <stop offset="75%" stop-color="#d97706"/>
        <stop offset="100%" stop-color="#b45309"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" rx="32" fill="url(#bgGrad)"/>
    <rect x="20" y="20" width="560" height="560" rx="24" fill="none" stroke="url(#goldGrad)" stroke-width="2.5" stroke-dasharray="10 8" opacity="0.65"/>
    <rect x="36" y="36" width="528" height="528" rx="18" fill="none" stroke="url(#goldGrad)" stroke-width="1" opacity="0.25"/>
    
    <circle cx="300" cy="190" r="72" fill="#f59e0b" fill-opacity="0.08" stroke="url(#goldGrad)" stroke-width="2.5"/>
    <circle cx="300" cy="190" r="58" fill="#18181b" stroke="#fef08a" stroke-width="1" opacity="0.6"/>
    
    <path d="M300 145 L307 180 L342 187 L307 194 L300 229 L293 194 L258 187 L293 180 Z" fill="url(#goldGrad)"/>
    
    <text x="300" y="310" dominant-baseline="middle" text-anchor="middle" fill="#fef08a" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="28" letter-spacing="3">${categoryTitle.toUpperCase()} ${emoji}</text>
    
    <g transform="translate(90, 350)">
      <rect width="420" height="64" rx="32" fill="url(#goldGrad)"/>
      <text x="210" y="38" dominant-baseline="middle" text-anchor="middle" fill="#09090b" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="23" letter-spacing="1">EM BREVE MAIS FOTOS!</text>
    </g>
    
    <text x="300" y="460" dominant-baseline="middle" text-anchor="middle" fill="#d6d3d1" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="18">Estamos preparando novos modelos</text>
    
    <text x="300" y="520" dominant-baseline="middle" text-anchor="middle" fill="#f59e0b" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="16" letter-spacing="2">✨ OXENTE FESTEJE BRINDES ✨</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const INSTAGRAM_POSTS: InstagramPost[] = [
  // Geral
  {
    id: 1,
    imageUrl: createComingSoonCard("Geral", "✨"),
    likes: "0",
    comments: 0,
    caption: "Em breve mais fotos do nosso Mural Geral! Fique atento às novidades no nosso Instagram @oxentefesteje ✨",
    tag: "Mural Oxente",
    categoria: "Geral",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 2,
    imageUrl: createComingSoonCard("Geral", "🌵"),
    likes: "0",
    comments: 0,
    caption: "Mural de fotos exclusivo Oxente Festeje. Em breve novos modelos de brindes disponíveis! 🌵🍻",
    tag: "Oxente Festeje",
    categoria: "Geral",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 3,
    imageUrl: createComingSoonCard("Geral", "🥂"),
    likes: "0",
    comments: 0,
    caption: "Brindes e copos personalizados para todas as ocasiões. Novas fotos em breve! 🎉",
    tag: "Brindes Exclusivos",
    categoria: "Geral",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  // ABC
  {
    id: 7,
    imageUrl: createComingSoonCard("ABC", "🎓"),
    likes: "0",
    comments: 0,
    caption: "Em breve mais fotos do Tema ABC por aqui! Fique atento às novidades no nosso Instagram @oxentefesteje ✨✏️🎒",
    tag: "Tema ABC",
    categoria: "ABC",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 8,
    imageUrl: createComingSoonCard("ABC", "✏️"),
    likes: "0",
    comments: 0,
    caption: "Lembrancinhas e copos personalizados para Doutores do ABC! Em breve novos modelos disponíveis ✨🌟",
    tag: "Brindes ABC",
    categoria: "ABC",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 9,
    imageUrl: createComingSoonCard("ABC", "📘"),
    likes: "0",
    comments: 0,
    caption: "Cores e estampas exclusivas para encantar na festa de ABC! Novas fotos em breve 🎉",
    tag: "Lembrancinhas ABC",
    categoria: "ABC",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  // Formatura
  {
    id: 10,
    imageUrl: createComingSoonCard("Formatura", "🎓"),
    likes: "0",
    comments: 0,
    caption: "Em breve mais fotos de Formatura por aqui! Taças, tirantes e copos personalizados para o seu baile de formatura ✨🍾",
    tag: "Formatura",
    categoria: "Formatura",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 11,
    imageUrl: createComingSoonCard("Formatura", "🥂"),
    likes: "0",
    comments: 0,
    caption: "Taças de Gin e Canecas de Formatura personalizadas. Novas fotos da categoria em breve! 🎉🎓",
    tag: "Taças Formatura",
    categoria: "Formatura",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 12,
    imageUrl: createComingSoonCard("Formatura", "🍾"),
    likes: "0",
    comments: 0,
    caption: "Kits de formandos com tirantes e copos gravados a laser. Seu baile com identidade única! 🎓🔥",
    tag: "Kits Formandos",
    categoria: "Formatura",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  // Corporativo
  {
    id: 13,
    imageUrl: createComingSoonCard("Corporativo", "💼"),
    likes: "0",
    comments: 0,
    caption: "Em breve mais fotos de Brindes Corporativos por aqui! Brindes elegantes para marcas, convenções e eventos ✨🏢",
    tag: "Corporativo",
    categoria: "Corporativo",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 14,
    imageUrl: createComingSoonCard("Corporativo", "🏢"),
    likes: "0",
    comments: 0,
    caption: "Canecas térmicas e squeezes gravados com a logomarca para presentear clientes VIP 🤝☕",
    tag: "Eventos Empresas",
    categoria: "Corporativo",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 15,
    imageUrl: createComingSoonCard("Corporativo", "🎯"),
    likes: "0",
    comments: 0,
    caption: "Kits de integração e convenções corporativas com a qualidade Oxente Festeje 📈🎯",
    tag: "Kits Corporativos",
    categoria: "Corporativo",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  // Laser
  {
    id: 16,
    imageUrl: createComingSoonCard("Laser", "⚡"),
    likes: "0",
    comments: 0,
    caption: "Em breve mais fotos de Copos e Brindes com Gravação a Laser! Acabamento impecável e alta durabilidade ✨⚡",
    tag: "Gravação a Laser",
    categoria: "Laser",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 17,
    imageUrl: createComingSoonCard("Laser", "⚡"),
    likes: "0",
    comments: 0,
    caption: "Gravação a Laser em Copos Stanley, Kouda, Squeezes e Canecas Inox com sua marca 🎯⚡",
    tag: "Produtos Laser",
    categoria: "Laser",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 18,
    imageUrl: createComingSoonCard("Laser", "⚡"),
    likes: "0",
    comments: 0,
    caption: "Personalização a Laser com riqueza de detalhes para casamentos, formaturas e corporativo ⚡🔥",
    tag: "Gravação Exclusiva",
    categoria: "Laser",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  // Impressora 3D
  {
    id: 19,
    imageUrl: createComingSoonCard("Impressora 3D", "🖨️"),
    likes: "0",
    comments: 0,
    caption: "Em breve mais fotos de Brindes e Troféus em Impressão 3D! Modelagens exclusivas e personalizadas 🖨️✨",
    tag: "Impressora 3D",
    categoria: "Impressora 3D",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 20,
    imageUrl: createComingSoonCard("Impressora 3D", "🖨️"),
    likes: "0",
    comments: 0,
    caption: "Peças decorativas, topos de bolo e chaveiros exclusivos produzidos em Impressão 3D 💡🖨️",
    tag: "Peças 3D",
    categoria: "Impressora 3D",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 21,
    imageUrl: createComingSoonCard("Impressora 3D", "🖨️"),
    likes: "0",
    comments: 0,
    caption: "Prototipagem e brindes corporativos tecnológicos em 3D com a marca Oxente Festeje 🚀🖨️",
    tag: "Brindes 3D",
    categoria: "Impressora 3D",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  // Papelaria
  {
    id: 22,
    imageUrl: createComingSoonCard("Papelaria", "📝"),
    likes: "0",
    comments: 0,
    caption: "Em breve mais fotos de Itens de Papelaria Personalizada! Cadernos, blocos e convites em alta qualidade 📝✨",
    tag: "Papelaria Personalizada",
    categoria: "Papelaria",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 23,
    imageUrl: createComingSoonCard("Papelaria", "✏️"),
    likes: "0",
    comments: 0,
    caption: "Agendas, planners e embalagens de papelaria exclusivas para suas festas e escritório 🏷️✏️",
    tag: "Kits de Papelaria",
    categoria: "Papelaria",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 24,
    imageUrl: createComingSoonCard("Papelaria", "💌"),
    likes: "0",
    comments: 0,
    caption: "Convites e mimos especiais em papelaria refinada pela marca Oxente Festeje 💌🎉",
    tag: "Papelaria de Festa",
    categoria: "Papelaria",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  // Kit Presente
  {
    id: 25,
    imageUrl: createComingSoonCard("Kit Presente", "🎁"),
    likes: "0",
    comments: 0,
    caption: "Em breve mais fotos de Kits Presente Personalizados! Caixas, combos especiais e mimos inesquecíveis 🎁✨",
    tag: "Kits Especiais",
    categoria: "Kit Presente",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 26,
    imageUrl: createComingSoonCard("Kit Presente", "🎀"),
    likes: "0",
    comments: 0,
    caption: "Kits Presentes exclusivos para datas comemorativas, aniversários e homenagens 🎀✨",
    tag: "Kits Presente",
    categoria: "Kit Presente",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  // Promoções
  {
    id: 27,
    imageUrl: createComingSoonCard("Promoções", "🔥"),
    likes: "0",
    comments: 0,
    caption: "Aproveite nossas promoções exclusivas e combos com preços especiais de fábrica! 🔥🏷️",
    tag: "Ofertas Especiais",
    categoria: "Promoções",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 28,
    imageUrl: createComingSoonCard("Promoções", "🏷️"),
    likes: "0",
    comments: 0,
    caption: "Super ofertas e descontos imperdíveis em copos, taças e brindes personalizados ✨🔥",
    tag: "Super Promoção",
    categoria: "Promoções",
    link: "https://www.instagram.com/oxentefesteje/"
  }
];

export const InstagramFeed: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const isCatDraggingRef = useRef(false);
  const catStartXRef = useRef(0);
  const catScrollLeftRef = useRef(0);
  const catHasDraggedRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  // Feed posts state (declared first to be safe in dependency arrays)
  const [posts, setPosts] = useState<InstagramPost[]>(() => {
    // Immediate sync-load from localStorage to avoid flicker
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('oxente_instagram_posts');
      if (saved) {
        try { return JSON.parse(saved); } catch { return INSTAGRAM_POSTS; }
      }
    }
    return INSTAGRAM_POSTS;
  });
  
  const scrollXRef = useRef(0);
  const draggedDistanceRef = useRef(0);

  // Auto-scroll loop using requestAnimationFrame
  useEffect(() => {
    const slider = containerRef.current;
    if (!slider) return;

    let animationFrameId: number;
    const speed = 2.75; // Reduced speed by 20% from 3.44 as requested by the user to make reading even more comfortable

    // Align ref with current scroll position
    scrollXRef.current = slider.scrollLeft;

    const scroll = () => {
      if (!isPaused && !isDown) {
        scrollXRef.current += speed;
        
        const halfWidth = slider.scrollWidth / 2;
        if (halfWidth > 0) {
          if (scrollXRef.current >= halfWidth) {
            scrollXRef.current -= halfWidth;
          } else if (scrollXRef.current <= 0) {
            scrollXRef.current += halfWidth;
          }
        }
        
        slider.scrollLeft = Math.round(scrollXRef.current);
      }
      animationFrameId = requestAnimationFrame(scroll);
    };

    animationFrameId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, isDown, posts]);

  // Handle manual drag scroll events for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    const slider = containerRef.current;
    if (!slider) return;
    setIsDown(true);
    setIsPaused(true);
    setStartX(e.pageX - slider.offsetLeft);
    setScrollLeftState(slider.scrollLeft);
    scrollXRef.current = slider.scrollLeft;
    draggedDistanceRef.current = 0;
  };

  const handleMouseLeave = () => {
    setIsDown(false);
    setIsPaused(false);
    const slider = containerRef.current;
    if (slider) {
      scrollXRef.current = slider.scrollLeft;
    }
  };

  const handleMouseUp = () => {
    setIsDown(false);
    setIsPaused(false);
    const slider = containerRef.current;
    if (slider) {
      scrollXRef.current = slider.scrollLeft;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown) return;
    e.preventDefault();
    const slider = containerRef.current;
    if (!slider) return;
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 1.5; // Drag sensitivity
    draggedDistanceRef.current = Math.abs(walk);
    slider.scrollLeft = scrollLeftState - walk;
    scrollXRef.current = slider.scrollLeft;
  };

  // Infinite wrapping logic
  const handleScroll = () => {
    const slider = containerRef.current;
    if (!slider) return;
    
    const halfWidth = slider.scrollWidth / 2;
    if (halfWidth > 0) {
      if (slider.scrollLeft >= halfWidth) {
        const diff = halfWidth;
        slider.scrollLeft -= diff;
        scrollXRef.current = slider.scrollLeft;
        if (isDown) {
          setScrollLeftState(prev => prev - diff);
        }
      } else if (slider.scrollLeft <= 0) {
        const diff = halfWidth;
        slider.scrollLeft += diff;
        scrollXRef.current = slider.scrollLeft;
        if (isDown) {
          setScrollLeftState(prev => prev + diff);
        }
      } else {
        scrollXRef.current = slider.scrollLeft;
      }
    }
  };

  // Click scrolling helpers for arrow buttons
  const handlePrev = () => {
    const slider = containerRef.current;
    if (!slider) return;
    setIsPaused(true);
    const step = window.innerWidth < 640 ? 150 : 260; // sized to match our card width + spacing
    slider.scrollBy({
      left: -step,
      behavior: 'smooth'
    });
    
    setTimeout(() => {
      if (slider) {
        scrollXRef.current = slider.scrollLeft;
      }
      setIsPaused(false);
    }, 600);
  };

  const handleNext = () => {
    const slider = containerRef.current;
    if (!slider) return;
    setIsPaused(true);
    const step = window.innerWidth < 640 ? 150 : 260;
    slider.scrollBy({
      left: step,
      behavior: 'smooth'
    });
    
    setTimeout(() => {
      if (slider) {
        scrollXRef.current = slider.scrollLeft;
      }
      setIsPaused(false);
    }, 600);
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryBarRef.current) {
      const step = 130;
      categoryBarRef.current.scrollBy({
        left: direction === 'left' ? -step : step,
        behavior: 'smooth'
      });
    }
  };

  // Drag / Slide handlers for Category Bar
  const handleCatMouseDown = (e: React.MouseEvent) => {
    if (!categoryBarRef.current) return;
    isCatDraggingRef.current = true;
    catHasDraggedRef.current = false;
    catStartXRef.current = e.pageX - categoryBarRef.current.offsetLeft;
    catScrollLeftRef.current = categoryBarRef.current.scrollLeft;
  };

  const handleCatMouseMove = (e: React.MouseEvent) => {
    if (!isCatDraggingRef.current || !categoryBarRef.current) return;
    const x = e.pageX - categoryBarRef.current.offsetLeft;
    const walk = (x - catStartXRef.current) * 1.5;
    if (Math.abs(x - catStartXRef.current) > 4) {
      catHasDraggedRef.current = true;
    }
    categoryBarRef.current.scrollLeft = catScrollLeftRef.current - walk;
  };

  const handleCatMouseUpOrLeave = () => {
    isCatDraggingRef.current = false;
  };

  const handleCatTouchStart = (e: React.TouchEvent) => {
    if (!categoryBarRef.current || e.touches.length === 0) return;
    isCatDraggingRef.current = true;
    catHasDraggedRef.current = false;
    catStartXRef.current = e.touches[0].pageX - categoryBarRef.current.offsetLeft;
    catScrollLeftRef.current = categoryBarRef.current.scrollLeft;
  };

  const handleCatTouchMove = (e: React.TouchEvent) => {
    if (!isCatDraggingRef.current || !categoryBarRef.current || e.touches.length === 0) return;
    const x = e.touches[0].pageX - categoryBarRef.current.offsetLeft;
    const walk = (x - catStartXRef.current) * 1.5;
    if (Math.abs(x - catStartXRef.current) > 4) {
      catHasDraggedRef.current = true;
    }
    categoryBarRef.current.scrollLeft = catScrollLeftRef.current - walk;
  };

  const handleCatTouchEnd = () => {
    isCatDraggingRef.current = false;
  };
  
  // Feed posts state moved to the top of the component to prevent block-scoped variable hoisting issues
  
  const [loading, setLoading] = useState(true);
  const [selectedPostModal, setSelectedPostModal] = useState<InstagramPost | null>(null);
  
  // Security/Admin state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Helper to convert any image (data URL, SVG, remote URL) into a Blob
  const imageSrcToBlob = async (src: string): Promise<Blob> => {
    try {
      if (src.startsWith('data:image/svg+xml')) {
        const img = new Image();
        img.src = src;
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 600;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#18181b';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }
        return await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
        });
      } else if (src.startsWith('data:')) {
        const res = await fetch(src);
        return await res.blob();
      } else {
        const res = await fetch(src, { mode: 'cors' }).catch(() => null);
        if (res && res.ok) {
          return await res.blob();
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 500;
        canvas.height = img.naturalHeight || 500;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
        return await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
        });
      }
    } catch (err) {
      console.warn('Erro ao converter imagem em blob:', err);
      return new Blob();
    }
  };

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Copy photo directly to clipboard
  const handleCopyPhoto = async (post: InstagramPost) => {
    try {
      const blob = await imageSrcToBlob(post.imageUrl);
      if (navigator.clipboard && window.ClipboardItem && blob.size > 0) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopyFeedback('Foto copiada! Cole (Ctrl+V) direto no WhatsApp!');
        setTimeout(() => setCopyFeedback(null), 4000);
        return true;
      } else {
        setCopyFeedback('Dica: Use o botão Baixar Foto para enviar.');
        setTimeout(() => setCopyFeedback(null), 3000);
      }
    } catch (err) {
      console.warn('Falha ao copiar foto para clipboard:', err);
    }
    return false;
  };

  // Download photo directly to device
  const handleDownloadPhoto = async (post: InstagramPost) => {
    try {
      const blob = await imageSrcToBlob(post.imageUrl);
      if (blob.size > 0) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (post.tag || 'oxente-festeje-produto').toLowerCase().replace(/[^a-z0-9]/gi, '-');
        a.download = `${safeName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setCopyFeedback('Foto baixada no seu aparelho!');
        setTimeout(() => setCopyFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Erro ao baixar foto:', err);
    }
  };

  // Dispatch to WhatsApp or Native Share
  const handleSendToWhatsApp = async (post: InstagramPost) => {
    const phone = '5583988859302';
    
    let msg = `Olá, equipe Oxente Festeje! 👋\n`;
    msg += `Gostaria de um orçamento sobre este modelo que vi no mural:\n\n`;
    if (post.tag) msg += `🏷️ *Modelo:* ${post.tag}\n`;
    if (post.categoria) msg += `✨ *Categoria:* ${post.categoria}\n`;
    if (post.caption) msg += `📝 *Detalhes:* ${post.caption}\n`;
    
    // Auto-copy photo in background
    handleCopyPhoto(post).catch(() => {});

    // Try native share on mobile if supported
    try {
      const blob = await imageSrcToBlob(post.imageUrl);
      if (blob.size > 0 && navigator.canShare) {
        const safeName = (post.tag || 'produto').toLowerCase().replace(/[^a-z0-9]/gi, '-');
        const file = new File([blob], `${safeName}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Orçamento Oxente Festeje - ${post.tag || 'Produto'}`,
            text: msg,
            files: [file]
          });
          return;
        }
      }
    } catch (e) {
      console.log('Native share ignorado ou cancelado:', e);
    }

    // Direct WhatsApp Web / App redirect
    const waUrl = `https://api.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`;
    window.open(waUrl, '_blank');
  };

  // Keyboard navigation when modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedPostModal) return;
      if (e.key === 'Escape') {
        setSelectedPostModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPostModal]);

  // Category filter state
  const [activeCategory, setActiveCategory] = useState<'Geral' | 'ABC' | 'Formatura' | 'Corporativo' | 'Laser' | 'Impressora 3D' | 'Papelaria' | 'Kit Presente' | 'Promoções'>('Geral');
  const [selectedCategoryForm, setSelectedCategoryForm] = useState<'Geral' | 'ABC' | 'Formatura' | 'Corporativo' | 'Laser' | 'Impressora 3D' | 'Papelaria' | 'Kit Presente' | 'Promoções'>('Geral');

  // New photo form state
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [caption, setCaption] = useState('');
  const [tag, setTag] = useState('');
  const [link, setLink] = useState('https://www.instagram.com/oxentefesteje/');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load posts from Supabase with localStorage fallback
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const fetched = await dbSupabase.fetchInstagramPosts();
        if (fetched && fetched.length > 0) {
          setPosts(fetched);
          localStorage.setItem('oxente_instagram_posts', JSON.stringify(fetched));
        } else {
          const saved = localStorage.getItem('oxente_instagram_posts');
          if (saved) {
            setPosts(JSON.parse(saved));
          } else {
            setPosts(INSTAGRAM_POSTS);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar posts do Supabase, usando fallback local:', err);
        const saved = localStorage.getItem('oxente_instagram_posts');
        if (saved) {
          setPosts(JSON.parse(saved));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // Handle password unlock
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '69fotos69') {
      setIsAdminMode(true);
      setShowPasswordModal(false);
      setPasswordError(false);
      setPasswordInput('');
      setSelectedCategoryForm(activeCategory);
      setTimeout(() => {
        document.getElementById('panel-mural-admin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  // Handle image upload and compression
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setSubmitStatus(null);
    try {
      // Compresses to max 500px, 0.5 quality, ultra fast and lightweight (approx 15kb - 25kb)
      const compressedBase64 = await compressImageFile(file, 500, 0.5);
      setNewImage(compressedBase64);
    } catch (err) {
      console.error('Erro ao comprimir imagem:', err);
      setSubmitStatus({ type: 'error', message: 'Erro ao processar e comprimir a imagem.' });
    } finally {
      setIsCompressing(false);
    }
  };

  // Save new post
  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImage) {
      setSubmitStatus({ type: 'error', message: 'Por favor, selecione uma imagem.' });
      return;
    }

    setIsSaving(true);
    setSubmitStatus(null);

    const generatedLikes = likes.trim() || `${Math.floor(Math.random() * 800) + 200}`;
    const generatedComments = Number(comments) || Math.floor(Math.random() * 50) + 10;
    const finalCaption = caption.trim() || 'Novidade saindo direto de nossa produção! ✨🌵 #oxentefesteje';
    const finalTag = tag.trim() || 'Novidade';
    const finalLink = link.trim() || 'https://www.instagram.com/oxentefesteje/';

    const newPostData = {
      imageUrl: newImage,
      likes: generatedLikes,
      comments: generatedComments,
      caption: finalCaption,
      tag: finalTag,
      categoria: selectedCategoryForm,
      link: finalLink,
    };

    try {
      const success = await dbSupabase.saveInstagramPost(newPostData);
      if (success) {
        const fetched = await dbSupabase.fetchInstagramPosts();
        if (fetched && fetched.length > 0) {
          setPosts(fetched);
          localStorage.setItem('oxente_instagram_posts', JSON.stringify(fetched));
        } else {
          const localPost: InstagramPost = {
            id: `local-${Date.now()}`,
            ...newPostData,
            createdAt: new Date().toISOString()
          };
          const updatedPosts = [localPost, ...posts.filter(p => typeof p.id === 'string' || p.id > 10)];
          setPosts(updatedPosts);
          localStorage.setItem('oxente_instagram_posts', JSON.stringify(updatedPosts));
        }

        // Reset form
        setNewImage(null);
        setCaption('');
        setTag('');
        setLikes('');
        setComments('');
        setActiveCategory(selectedCategoryForm);
        setSubmitStatus({ type: 'success', message: `Foto adicionada com sucesso à categoria "${selectedCategoryForm}"!` });
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setSubmitStatus({ type: 'error', message: 'Erro ao salvar o post no Supabase.' });
      }
    } catch (err) {
      console.error('Erro ao salvar no Supabase:', err);
      setSubmitStatus({ type: 'error', message: 'Ocorreu um erro ao salvar o post.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete post
  const handleDeletePost = async (id: string | number) => {
    if (!window.confirm('Tem certeza que deseja remover esta foto do mural?')) return;

    try {
      const success = await dbSupabase.deleteInstagramPost(id);
      if (success || typeof id === 'number' || String(id).startsWith('local-')) {
        const updated = posts.filter(p => p.id !== id);
        setPosts(updated);
        localStorage.setItem('oxente_instagram_posts', JSON.stringify(updated));
      } else {
        alert('Não foi possível excluir do banco de dados do Supabase.');
      }
    } catch (err) {
      console.error('Erro ao deletar post:', err);
      alert('Não foi possível excluir do banco de dados.');
    }
  };

  // Restore Default static posts
  const handleRestoreDefaults = async () => {
    if (!window.confirm('Deseja apagar todas as fotos enviadas e restaurar o mural com as imagens padrão?')) return;

    try {
      await dbSupabase.clearInstagramPosts();
      setPosts(INSTAGRAM_POSTS);
      localStorage.removeItem('oxente_instagram_posts');
    } catch (err) {
      console.error('Erro ao restaurar padrões:', err);
      setPosts(INSTAGRAM_POSTS);
      localStorage.removeItem('oxente_instagram_posts');
    }
  };

  // Filtering for activeCategory:
  const activeCatLower = activeCategory.toLowerCase();
  
  // User uploaded posts for current active category
  const userCatPosts = posts.filter(post => {
    const postCat = (post.categoria || 'Geral').toLowerCase();
    return postCat === activeCatLower;
  });

  // Default / placeholder posts for current active category
  const defaultCatPosts = INSTAGRAM_POSTS.filter(post => {
    const postCat = (post.categoria || 'Geral').toLowerCase();
    return postCat === activeCatLower;
  }).map(post => {
    const cat = post.categoria || 'Geral';
    if (post.imageUrl.includes('unsplash.com') || !post.imageUrl) {
      const emoji = cat === 'ABC' ? '🎓' : cat === 'Formatura' ? '🥂' : cat === 'Corporativo' ? '💼' : cat === 'Laser' ? '⚡' : cat === 'Impressora 3D' ? '🖨️' : cat === 'Papelaria' ? '📝' : cat === 'Kit Presente' ? '🎁' : cat === 'Promoções' ? '🔥' : '✨';
      return {
        ...post,
        imageUrl: createComingSoonCard(cat, emoji)
      };
    }
    return post;
  });

  // If user uploaded photos exist for this category, display ONLY the user's photos!
  // Otherwise, show the default placeholders.
  const activePosts = userCatPosts.length > 0 ? userCatPosts : defaultCatPosts;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="w-full pt-2.5 sm:pt-4 mb-0 px-4 overflow-hidden relative z-20"
      id="instagram-feed-section"
    >
      {/* Feed Header */}
      <div className="flex flex-col items-center text-center mb-1.5 sm:mb-2">
        <div className="relative group/badge inline-flex items-center justify-center">
          <div 
            className="select-none pointer-events-none"
            id="btn-mural-gold-badge"
          >
            <OptimizedImage
              src="/logomural.png"
              alt="Oxente Festeje Logo"
              width={400}
              quality={75}
              isAboveFold={true}
              className="w-[220px] min-[375px]:w-[264px] sm:w-[330px] md:w-[396px] h-auto object-contain scale-x-[1.2] origin-center"
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent opening instagram
              if (isAdminMode) {
                setIsAdminMode(false);
              } else {
                setShowPasswordModal(true);
              }
            }}
            className={`absolute -right-8 p-1.5 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center ${
              isAdminMode 
                ? 'text-stone-950 bg-amber-200/40' 
                : 'opacity-0 w-0 overflow-hidden group-hover/badge:opacity-45 group-hover/badge:w-8 hover:!opacity-100 text-stone-400'
            }`}
            title="Configuração do Mural"
            id="btn-mural-config-invisivel"
          >
            {isAdminMode ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Gold Category Buttons - Positioned right below the logo and right above photo carousel */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 mb-3.5 sm:mb-5 relative z-30 px-2 max-w-full sm:max-w-2xl mx-auto">
        {/* Category Left Small Arrow */}
        <button
          type="button"
          onClick={() => scrollCategories('left')}
          className="p-1 sm:p-1.5 rounded-full bg-amber-500/15 hover:bg-amber-400 text-amber-300 hover:text-stone-950 border border-amber-400/30 hover:border-yellow-200 transition-all duration-300 cursor-pointer shrink-0 flex items-center justify-center shadow-sm active:scale-90"
          title="Categoria anterior"
          aria-label="Categoria anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5px]" />
        </button>

        {/* Scrollable Categories Row - Draggable, No scrollbar visible */}
        <div 
          ref={categoryBarRef}
          onMouseDown={handleCatMouseDown}
          onMouseMove={handleCatMouseMove}
          onMouseUp={handleCatMouseUpOrLeave}
          onMouseLeave={handleCatMouseUpOrLeave}
          onTouchStart={handleCatTouchStart}
          onTouchMove={handleCatTouchMove}
          onTouchEnd={handleCatTouchEnd}
          className="flex flex-nowrap items-center gap-1 min-[360px]:gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar py-1 px-0.5 max-w-full select-none cursor-grab active:cursor-grabbing"
        >
          {(['Geral', 'ABC', 'Formatura', 'Corporativo', 'Laser', 'Impressora 3D', 'Papelaria', 'Kit Presente', 'Promoções'] as const).map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={(e) => {
                  if (catHasDraggedRef.current) {
                    e.preventDefault();
                    return;
                  }
                  setActiveCategory(cat);
                  setSelectedCategoryForm(cat);
                  const slider = containerRef.current;
                  if (slider) {
                    slider.scrollLeft = 0;
                    scrollXRef.current = 0;
                  }
                }}
                className={`px-2.5 py-1 min-[360px]:px-3 min-[360px]:py-1.5 sm:px-5 sm:py-2 rounded-full font-display text-[10px] min-[360px]:text-[11px] sm:text-sm tracking-normal min-[380px]:tracking-wider uppercase transition-all duration-300 cursor-pointer flex-shrink-0 flex items-center justify-center gap-1 whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-stone-950 font-black border border-yellow-200 sm:border-2 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-[1.03] sm:scale-105'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold border border-amber-400/40 hover:border-amber-300 hover:text-yellow-200'
                }`}
                id={`btn-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span>{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Category Right Small Arrow */}
        <button
          type="button"
          onClick={() => scrollCategories('right')}
          className="p-1 sm:p-1.5 rounded-full bg-amber-500/15 hover:bg-amber-400 text-amber-300 hover:text-stone-950 border border-amber-400/30 hover:border-yellow-200 transition-all duration-300 cursor-pointer shrink-0 flex items-center justify-center shadow-sm active:scale-90"
          title="Próxima categoria"
          aria-label="Próxima categoria"
        >
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5px]" />
        </button>
      </div>

      {/* Infinite Rolling Slider Wrapper with Arrow Buttons */}
      <div className="relative w-full group/slider px-4 sm:px-10">
        {/* Left Arrow Button */}
        <button
          onClick={handlePrev}
          className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-40 bg-gradient-to-r from-amber-400 to-amber-500 border border-yellow-200/50 shadow-[0_4px_15px_rgba(245,158,11,0.55)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.7)] text-stone-950 p-2 sm:p-3 rounded-full cursor-pointer hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center opacity-[0.56] hover:opacity-100 hover:brightness-110"
          aria-label="Foto anterior"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 stroke-[3px]" />
        </button>

        {/* Infinite Rolling Slider Outer Container */}
        <div 
          className="relative w-full overflow-x-auto py-2.5 sm:py-4 cursor-grab active:cursor-grabbing select-none no-scrollbar"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => {
            setIsPaused(false);
            setIsDown(false);
          }}
          onScroll={handleScroll}
          ref={containerRef}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Inject CSS rule dynamically to fully hide webkit scrollbars */}
          <style>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none !important;
            }
          `}</style>

          {/* Rolling Track */}
          <div className="flex gap-0 w-max">
            {/* Primeira metade */}
            <div className="flex gap-2.5 sm:gap-6 shrink-0 pr-2.5 sm:pr-6">
              {activePosts.map((post, idx) => (
                <motion.div
                  key={`${post.id}-1-${idx}`}
                  role="button"
                  tabIndex={0}
                  className="relative w-[128px] min-[375px]:w-[144px] min-[410px]:w-[162px] sm:w-[245px] h-[162px] min-[375px]:h-[187px] min-[410px]:h-[204px] sm:h-[326px] rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-md sm:shadow-lg block group cursor-pointer text-left select-none"
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    if (draggedDistanceRef.current > 15) {
                      return;
                    }
                    setSelectedPostModal(post);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPostModal(post);
                    }
                  }}
                >
                  {/* Image background */}
                  <OptimizedImage
                    src={post.imageUrl}
                    alt={post.caption}
                    width={300}
                    quality={50}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 md:group-hover:scale-105"
                  />

                  {/* Instagram tag badge */}
                  <span className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 bg-black/70 backdrop-blur-md text-[7.5px] sm:text-[10px] text-amber-200 font-bold uppercase tracking-wider px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-amber-500/20 z-10">
                    {post.tag}
                  </span>

                  {/* Dark overlay & info displayed on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-20">
                    {/* Real-time Interaction Stats bar */}
                    <div className="flex items-center gap-4 text-white text-xs font-mono font-bold mb-2">
                      <span className="flex items-center gap-1 text-rose-400">
                        <Heart className="h-4 w-4 fill-rose-500 text-rose-500" /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1 text-sky-400">
                        <MessageCircle className="h-4 w-4 fill-sky-400/20 text-sky-400" /> {post.comments}
                      </span>
                    </div>

                    {/* Subtitle / Caption */}
                    <p className="text-stone-200 text-xs leading-relaxed font-sans font-medium line-clamp-3 mb-3">
                      {post.caption}
                    </p>

                    {/* Direct link footer action */}
                    <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-wider border-t border-white/10 pt-2.5">
                      <span className="flex items-center gap-1 text-amber-300">
                        <Sparkles className="h-3 w-3 text-amber-400" /> Ampliar & Orçar
                      </span>
                      <span className="text-emerald-400 font-mono text-[9px] flex items-center gap-0.5">
                        WhatsApp 💬
                      </span>
                    </div>
                  </div>

                  {/* Static subtle overlay for high image readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none md:group-hover:opacity-0 transition-opacity duration-300" />
                </motion.div>
              ))}
            </div>

            {/* Segunda metade (Sempre idêntica para o looping infinito sem sobressalto) */}
            <div className="flex gap-2.5 sm:gap-6 shrink-0 pr-2.5 sm:pr-6">
              {activePosts.map((post, idx) => (
                <motion.div
                  key={`${post.id}-2-${idx}`}
                  role="button"
                  tabIndex={0}
                  className="relative w-[128px] min-[375px]:w-[144px] min-[410px]:w-[162px] sm:w-[245px] h-[162px] min-[375px]:h-[187px] min-[410px]:h-[204px] sm:h-[326px] rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-md sm:shadow-lg block group cursor-pointer text-left select-none"
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    if (draggedDistanceRef.current > 15) {
                      return;
                    }
                    setSelectedPostModal(post);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPostModal(post);
                    }
                  }}
                >
                  {/* Image background */}
                  <OptimizedImage
                    src={post.imageUrl}
                    alt={post.caption}
                    width={300}
                    quality={50}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 md:group-hover:scale-105"
                  />

                  {/* Instagram tag badge */}
                  <span className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 bg-black/70 backdrop-blur-md text-[7.5px] sm:text-[10px] text-amber-200 font-bold uppercase tracking-wider px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-amber-500/20 z-10">
                    {post.tag}
                  </span>

                  {/* Dark overlay & info displayed on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-20">
                    {/* Real-time Interaction Stats bar */}
                    <div className="flex items-center gap-4 text-white text-xs font-mono font-bold mb-2">
                      <span className="flex items-center gap-1 text-rose-400">
                        <Heart className="h-4 w-4 fill-rose-500 text-rose-500" /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1 text-sky-400">
                        <MessageCircle className="h-4 w-4 fill-sky-400/20 text-sky-400" /> {post.comments}
                      </span>
                    </div>

                    {/* Subtitle / Caption */}
                    <p className="text-stone-200 text-xs leading-relaxed font-sans font-medium line-clamp-3 mb-3">
                      {post.caption}
                    </p>

                    {/* Direct link footer action */}
                    <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-wider border-t border-white/10 pt-2.5">
                      <span className="flex items-center gap-1 text-amber-300">
                        <Sparkles className="h-3 w-3 text-amber-400" /> Ampliar & Orçar
                      </span>
                      <span className="text-emerald-400 font-mono text-[9px] flex items-center gap-0.5">
                        WhatsApp 💬
                      </span>
                    </div>
                  </div>

                  {/* Static subtle overlay for high image readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none md:group-hover:opacity-0 transition-opacity duration-300" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={handleNext}
          className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-40 bg-gradient-to-r from-amber-400 to-amber-500 border border-yellow-200/50 shadow-[0_4px_15px_rgba(245,158,11,0.55)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.7)] text-stone-950 p-2 sm:p-3 rounded-full cursor-pointer hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center opacity-[0.56] hover:opacity-100 hover:brightness-110"
          aria-label="Próxima foto"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 stroke-[3px]" />
        </button>
      </div>

      {/* O gatilho do cadeado agora está ao lado do ícone do Instagram no cabeçalho do mural */}

      {/* Password Modal Popup */}
      {showPasswordModal && typeof document !== 'undefined' && createPortal(
        <AnimatePresence key="mural-password-portal">
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-stone-900 border-2 border-amber-500/40 p-6 sm:p-7 rounded-3xl max-w-sm w-full shadow-[0_20px_60px_rgba(0,0,0,0.9)] relative"
            >
              <button 
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError(false);
                  setPasswordInput('');
                }}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="text-center mb-5">
                <div className="mx-auto w-10 h-10 bg-amber-500/10 text-amber-400 flex items-center justify-center rounded-full mb-3">
                  <Lock className="h-5 w-5" />
                </div>
                <h4 className="text-base font-display font-black text-amber-200 uppercase tracking-wider">Acesso ao Mural</h4>
                <p className="text-xs text-stone-400 mt-1">Insira a chave de segurança para liberar o upload</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    placeholder="Digite a senha..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500/50 rounded-xl px-4 py-3 text-sm text-center font-mono text-amber-100 tracking-widest placeholder:tracking-normal outline-none transition-colors"
                    autoFocus
                  />
                  {passwordError && (
                    <p className="text-red-400 text-[10px] text-center mt-1.5 flex items-center justify-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Senha incorreta. Tente novamente!
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-display font-black text-xs uppercase tracking-widest py-3 rounded-xl shadow-lg transition-colors cursor-pointer"
                >
                  Confirmar Chave
                </button>
              </form>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* ADMIN PHOTO MANAGEMENT SYSTEM */}
      <AnimatePresence>
        {isAdminMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-12 bg-gradient-to-b from-stone-900 to-stone-950 border border-amber-500/35 rounded-3xl p-6 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
            id="panel-mural-admin"
          >
            {/* Header / Title */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-800 pb-4 mb-6 gap-4">
              <div>
                <h4 className="text-sm font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Gerenciador de Fotos do Mural
                </h4>
                <p className="text-[11px] text-stone-400 mt-1">
                  Adicione novas fotos e gerencie as fotos ativas. Uploads são automaticamente otimizados e comprimidos.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRestoreDefaults}
                  className="px-3 py-1.5 rounded-lg border border-stone-800 hover:border-red-500/30 text-[10px] text-stone-400 hover:text-red-400 font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Apagar fotos customizadas e voltar para as de fábrica"
                >
                  <RotateCcw className="h-3 w-3" /> Restaurar Padrões
                </button>

                <button
                  onClick={() => setIsAdminMode(false)}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <X className="h-3 w-3" /> Fechar Painel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form Side - Left */}
              <form onSubmit={handleSavePost} className="lg:col-span-5 space-y-4">
                <h5 className="text-xs font-display font-bold text-amber-200 uppercase tracking-wider">Nova Foto</h5>
                
                {/* File Upload Selector Block */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-800 hover:border-amber-500/30 bg-stone-950/60 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {newImage ? (
                    <div className="absolute inset-0 z-0">
                      <img 
                        src={newImage} 
                        alt="Preview comprimido" 
                        className="w-full h-full object-cover opacity-30 filter blur-[1px]"
                      />
                    </div>
                  ) : null}

                  <div className="relative z-10 flex flex-col items-center">
                    {isCompressing ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] text-amber-400 font-mono">Otimizando e comprimindo ao máximo...</span>
                      </div>
                    ) : newImage ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <CheckCircle className="h-6 w-6 text-emerald-400" />
                        <span className="text-xs font-bold text-stone-200">Foto Carregada e Comprimida!</span>
                        <span className="text-[9px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">Pronta para o site</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-stone-500 group-hover:text-amber-400 transition-colors mb-2" />
                        <span className="text-xs font-bold text-stone-300">Escolha ou Arraste uma Foto Real</span>
                        <span className="text-[10px] text-stone-500 mt-1">Será comprimida instantaneamente</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-amber-400 font-bold mb-1">Categoria / Tema</label>
                    <select
                      value={selectedCategoryForm}
                      onChange={(e) => setSelectedCategoryForm(e.target.value as any)}
                      className="w-full bg-stone-950 border border-amber-500/30 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-200 font-bold outline-none transition-colors cursor-pointer"
                    >
                      <option value="Geral">Geral</option>
                      <option value="ABC">ABC</option>
                      <option value="Formatura">Formatura</option>
                      <option value="Corporativo">Corporativo</option>
                      <option value="Laser">Laser</option>
                      <option value="Impressora 3D">Impressora 3D</option>
                      <option value="Papelaria">Papelaria</option>
                      <option value="Kit Presente">Kit Presente</option>
                      <option value="Promoções">Promoções</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Tag / Nome do Produto</label>
                    <input
                      type="text"
                      placeholder="Ex: Copos Long Drink"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Link Insta</label>
                    <input
                      type="text"
                      placeholder="URL do Instagram"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-2.5 py-2 text-xs text-stone-200 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Curtidas</label>
                    <input
                      type="text"
                      placeholder="Ex: 1.5k"
                      value={likes}
                      onChange={(e) => setLikes(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-2.5 py-2 text-xs text-stone-200 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Comentários</label>
                    <input
                      type="number"
                      placeholder="Ex: 45"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-2.5 py-2 text-xs text-stone-200 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Legenda da Foto</label>
                  <textarea
                    placeholder="Digite uma bela legenda para o mural..."
                    rows={2}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none resize-none transition-colors"
                  />
                </div>

                {submitStatus && (
                  <div className={`p-2.5 rounded-lg text-[11px] font-sans flex items-center gap-2 ${
                    submitStatus.type === 'success' 
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20' 
                      : 'bg-red-950/40 text-red-300 border border-red-500/20'
                  }`}>
                    {submitStatus.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span>{submitStatus.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSaving || isCompressing}
                  className="w-full bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 font-display font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Adicionar ao Mural
                    </>
                  )}
                </button>
              </form>

              {/* Photo List Side - Right */}
              <div className="lg:col-span-7 space-y-4">
                <h5 className="text-xs font-display font-bold text-amber-200 uppercase tracking-wider">
                  Fotos Ativas no Mural ({activePosts.length})
                </h5>

                <div className="max-h-[360px] overflow-y-auto pr-2 space-y-2 border border-stone-800/60 bg-stone-950/20 rounded-2xl p-3 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent">
                  {activePosts.map((post) => (
                    <div 
                      key={post.id}
                      className="flex items-center gap-3 bg-stone-950/50 border border-stone-800/60 p-2 rounded-xl group hover:border-amber-500/10 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-900 border border-stone-800 flex-shrink-0">
                        <img 
                          src={post.imageUrl} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider">{post.tag}</span>
                          <span className="text-[9px] text-stone-500">❤️ {post.likes}</span>
                        </div>
                        <p className="text-[11px] text-stone-300 truncate mt-0.5">{post.caption}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        className="p-2 text-stone-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                        title="Remover esta foto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Photo & WhatsApp Quote Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedPostModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-stone-950/85 backdrop-blur-md overflow-y-auto"
              onClick={() => setSelectedPostModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="relative w-full max-w-lg bg-zinc-900 border border-amber-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden my-auto"
                onClick={(e) => e.stopPropagation()}
                id="modal-ampliar-foto"
              >
                {/* Header Bar */}
                <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-stone-950 font-black text-[10px] sm:text-xs uppercase px-2.5 py-1 rounded-full shadow-sm shrink-0">
                      {selectedPostModal.categoria || 'Geral'}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                      {selectedPostModal.tag}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Navigation Buttons inside modal */}
                    {activePosts.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = activePosts.findIndex(p => p.id === selectedPostModal.id);
                            if (idx > 0) setSelectedPostModal(activePosts[idx - 1]);
                            else setSelectedPostModal(activePosts[activePosts.length - 1]);
                          }}
                          className="p-1.5 rounded-full bg-zinc-800 hover:bg-amber-400 text-stone-300 hover:text-stone-950 transition-colors cursor-pointer"
                          title="Foto anterior"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = activePosts.findIndex(p => p.id === selectedPostModal.id);
                            if (idx >= 0 && idx < activePosts.length - 1) setSelectedPostModal(activePosts[idx + 1]);
                            else setSelectedPostModal(activePosts[0]);
                          }}
                          className="p-1.5 rounded-full bg-zinc-800 hover:bg-amber-400 text-stone-300 hover:text-stone-950 transition-colors cursor-pointer"
                          title="Próxima foto"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedPostModal(null)}
                      className="p-1.5 rounded-full bg-zinc-800/80 hover:bg-red-500 text-stone-300 hover:text-white transition-colors ml-1 cursor-pointer"
                      title="Fechar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Big Image Preview */}
                <div className="relative w-full aspect-square max-h-[46vh] sm:max-h-[52vh] rounded-xl sm:rounded-2xl overflow-hidden bg-black/70 border border-zinc-800 mb-3 sm:mb-4 flex items-center justify-center">
                  <OptimizedImage
                    src={selectedPostModal.imageUrl}
                    alt={selectedPostModal.caption}
                    width={700}
                    quality={85}
                    className="w-full h-full object-contain"
                  />

                  {/* Likes badge overlay */}
                  <div className="absolute bottom-2.5 left-2.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-3 text-xs font-mono">
                    <span className="flex items-center gap-1 text-rose-400 font-bold">
                      <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" /> {selectedPostModal.likes}
                    </span>
                    <span className="flex items-center gap-1 text-sky-400 font-bold">
                      <MessageCircle className="h-3.5 w-3.5 fill-sky-400/20 text-sky-400" /> {selectedPostModal.comments}
                    </span>
                  </div>
                </div>

                {/* Caption / Description */}
                {selectedPostModal.caption && (
                  <p className="text-stone-200 text-xs sm:text-sm leading-relaxed mb-3.5 px-3 py-2.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80 max-h-24 overflow-y-auto">
                    {selectedPostModal.caption}
                  </p>
                )}

                {/* Copy Feedback Notification */}
                <AnimatePresence>
                  {copyFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="mb-3 px-3 py-2 bg-emerald-950/90 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 text-center shadow-lg"
                    >
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{copyFeedback}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Buttons */}
                <div className="space-y-2 sm:space-y-2.5">
                  {/* Button 1: WhatsApp Quote Button with Photo & Model pre-filled */}
                  <button
                    type="button"
                    onClick={() => handleSendToWhatsApp(selectedPostModal)}
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-display font-black text-xs sm:text-sm uppercase tracking-wide py-3 px-4 rounded-xl shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2.5 text-center group active:scale-[0.98] cursor-pointer"
                    id="btn-modal-whatsapp-orcamento"
                  >
                    <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                    <span>Pedir Orçamento no WhatsApp</span>
                  </button>

                  {/* Photo tools: Copy & Download */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPhoto(selectedPostModal)}
                      className="bg-zinc-800/90 hover:bg-zinc-700 text-stone-200 hover:text-white text-xs font-semibold py-2 px-3 rounded-xl border border-zinc-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Copiar imagem para colar no WhatsApp"
                    >
                      <Copy className="h-3.5 w-3.5 text-amber-400" />
                      <span>Copiar Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPhoto(selectedPostModal)}
                      className="bg-zinc-800/90 hover:bg-zinc-700 text-stone-200 hover:text-white text-xs font-semibold py-2 px-3 rounded-xl border border-zinc-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Baixar imagem no aparelho"
                    >
                      <Download className="h-3.5 w-3.5 text-amber-400" />
                      <span>Baixar Foto</span>
                    </button>
                  </div>

                  {/* Button 2: Instagram Details Button */}
                  <a
                    href={selectedPostModal.link || 'https://www.instagram.com/oxentefesteje/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-gradient-to-r from-pink-600 via-purple-600 to-amber-600 hover:brightness-110 text-white font-display font-bold text-xs sm:text-sm uppercase tracking-wide py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-center shadow-md active:scale-[0.98]"
                    id="btn-modal-ver-instagram"
                  >
                    <Instagram className="h-4 w-4" />
                    <span>Ver mais fotos no Instagram</span>
                    <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-80" />
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
};
