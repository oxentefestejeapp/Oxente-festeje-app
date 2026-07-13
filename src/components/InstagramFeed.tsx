import React, { useRef, useState, useEffect } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { OptimizedImage, compressImageFile } from '../utils/imageOptimizer';
import { dbSupabase } from '../lib/supabase';
import { InstagramPost } from '../types';

const INSTAGRAM_POSTS: InstagramPost[] = [
  {
    id: 1,
    imageUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=600&auto=format&fit=crop",
    likes: "1.2k",
    comments: 48,
    caption: "Mais uma remessa linda de copos neon saindo para brilhar! Os mais pedidos do Nordeste ✨🕺 #coposneon",
    tag: "Copos Long Drink",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 2,
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop",
    likes: "842",
    comments: 32,
    caption: "Tirantes super resistentes e coloridos para sua atlética ou carnaval! Carregue seu copo com muito estilo 🌵🍻",
    tag: "Tirantes Exclusivos",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 3,
    imageUrl: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=600&auto=format&fit=crop",
    likes: "958",
    comments: 55,
    caption: "Sustentabilidade e beleza! Nossos copos ecológicos personalizados fazem o maior sucesso nos eventos 🌱🥂",
    tag: "Copos Ecológicos",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 4,
    imageUrl: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?q=80&w=600&auto=format&fit=crop",
    likes: "1.5k",
    comments: 73,
    caption: "Brinde com quem você ama! Kit festa com taças de gin personalizadas de altíssima qualidade 🎉❤️",
    tag: "Taças de Gin",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 5,
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600&auto=format&fit=crop",
    likes: "1.1k",
    comments: 41,
    caption: "Seus convidados vão pirar com essas cores vibrantes! Brindes que marcam momentos inesquecíveis 🔥🍹",
    tag: "Canecas Térmicas",
    link: "https://www.instagram.com/oxentefesteje/"
  },
  {
    id: 6,
    imageUrl: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=600&auto=format&fit=crop",
    likes: "789",
    comments: 29,
    caption: "Sofisticação e exclusividade para o aniversário de 15 anos ou evento da sua empresa 💼🎓",
    tag: "Copos Acrílicos",
    link: "https://www.instagram.com/oxentefesteje/"
  }
];

export const InstagramFeed: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
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
  
  // Feed posts state moved to the top of the component to prevent block-scoped variable hoisting issues
  
  const [loading, setLoading] = useState(true);
  
  // Security/Admin state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

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
        setSubmitStatus({ type: 'success', message: 'Foto adicionada com sucesso ao mural!' });
        
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

  // Ensure there's always posts to show
  const activePosts = posts.length > 0 ? posts : INSTAGRAM_POSTS;
  const duplicatedPosts = [...activePosts, ...activePosts];

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
      <div className="flex flex-col items-center text-center mb-2.5 sm:mb-4">
        <div className="relative group/badge inline-flex items-center justify-center">
          <div 
            className="select-none pointer-events-none"
            id="btn-mural-gold-badge"
          >
            <OptimizedImage
              src="/banner-topo.webp"
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
                <motion.a
                  key={`${post.id}-1-${idx}`}
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-[128px] min-[375px]:w-[144px] min-[410px]:w-[162px] sm:w-[245px] h-[162px] min-[375px]:h-[187px] min-[410px]:h-[204px] sm:h-[326px] rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-md sm:shadow-lg block group"
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => {
                    if (draggedDistanceRef.current > 15) {
                      e.preventDefault();
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
                    <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider border-t border-white/10 pt-2.5">
                      <span className="flex items-center gap-1">
                        Ver no Instagram <ExternalLink className="h-3 w-3" />
                      </span>
                      <span className="text-stone-400 lowercase">@oxentefesteje</span>
                    </div>
                  </div>

                  {/* Static subtle overlay for high image readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none md:group-hover:opacity-0 transition-opacity duration-300" />
                </motion.a>
              ))}
            </div>

            {/* Segunda metade (Sempre idêntica para o looping infinito sem sobressalto) */}
            <div className="flex gap-2.5 sm:gap-6 shrink-0 pr-2.5 sm:pr-6">
              {activePosts.map((post, idx) => (
                <motion.a
                  key={`${post.id}-2-${idx}`}
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-[128px] min-[375px]:w-[144px] min-[410px]:w-[162px] sm:w-[245px] h-[162px] min-[375px]:h-[187px] min-[410px]:h-[204px] sm:h-[326px] rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-md sm:shadow-lg block group"
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => {
                    if (draggedDistanceRef.current > 15) {
                      e.preventDefault();
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
                    <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider border-t border-white/10 pt-2.5">
                      <span className="flex items-center gap-1">
                        Ver no Instagram <ExternalLink className="h-3 w-3" />
                      </span>
                      <span className="text-stone-400 lowercase">@oxentefesteje</span>
                    </div>
                  </div>

                  {/* Static subtle overlay for high image readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none md:group-hover:opacity-0 transition-opacity duration-300" />
                </motion.a>
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
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-stone-900 border border-amber-500/20 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative"
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
        )}
      </AnimatePresence>

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
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Tag / Categoria</label>
                    <input
                      type="text"
                      placeholder="Ex: Copos Long Drink"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Link do Post (Insta)</label>
                    <input
                      type="text"
                      placeholder="URL do Instagram"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Curtidas (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: 1.5k"
                      value={likes}
                      onChange={(e) => setLikes(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Comentários (opcional)</label>
                    <input
                      type="number"
                      placeholder="Ex: 45"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none transition-colors"
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
    </motion.div>
  );
};
