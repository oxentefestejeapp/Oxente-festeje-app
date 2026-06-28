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
  AlertCircle
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
  
  // Feed posts state
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
      // Compresses to max 600px, 0.6 quality, ultra fast and lightweight (approx 20kb - 40kb)
      const compressedBase64 = await compressImageFile(file, 600, 0.6);
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
      className="w-full mt-20 mb-14 px-4 overflow-hidden relative z-20"
      id="instagram-feed-section"
    >
      {/* Feed Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500/10 via-amber-500/10 to-red-500/10 px-4 py-1.5 rounded-full border border-amber-500/20 shadow-[0_2px_12px_rgba(245,158,11,0.05)] mb-3">
          <Instagram className="h-4 w-4 text-pink-400 animate-pulse" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
            Mural do Instagram <Sparkles className="h-3 w-3 text-amber-400 fill-amber-400" />
          </span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-display font-black text-amber-100 uppercase tracking-tight">
          Siga @oxentefesteje
        </h3>
        <p className="text-stone-300 text-xs sm:text-sm max-w-lg mt-2 font-sans">
          Veja as novidades mais recentes diretamente do nosso feed. Clique em qualquer foto para ver no Instagram!
        </p>
      </div>

      {/* Infinite Rolling Slider Outer Container */}
      <div 
        className="relative w-full overflow-hidden py-4 cursor-grab active:cursor-grabbing select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        ref={containerRef}
      >
        {/* Soft fading overlays on edges for cinema-like depth */}
        <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-r from-[#0c0a09] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-l from-[#0c0a09] to-transparent z-10 pointer-events-none" />

        {/* Rolling Track */}
        <motion.div
          animate={isPaused ? {} : {
            x: ["0%", "-50%"]
          }}
          transition={{
            ease: "linear",
            duration: 25,
            repeat: Infinity
          }}
          className="flex gap-4 sm:gap-6 w-max"
        >
          {duplicatedPosts.map((post, idx) => (
            <motion.a
              key={`${post.id}-${idx}`}
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-64 sm:w-72 h-80 sm:h-96 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-lg block group"
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Image background */}
              <OptimizedImage
                src={post.imageUrl}
                alt={post.caption}
                width={360}
                quality={70}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Instagram tag badge */}
              <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-[10px] text-amber-200 font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-amber-500/20 z-10">
                {post.tag}
              </span>

              {/* Dark overlay & info displayed on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-20">
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none group-hover:opacity-0 transition-opacity duration-300" />
            </motion.a>
          ))}
        </motion.div>
      </div>

      {/* Interactive Action Button to visit profile directly + Invisible Password Trigger */}
      <div className="flex justify-center items-center gap-4 mt-6">
        <motion.a
          href="https://www.instagram.com/oxentefesteje/"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white font-display font-black text-xs uppercase tracking-wider px-6 py-3 rounded-full shadow-lg shadow-black/30 transition-all cursor-pointer border border-white/10"
          id="btn-acessar-instagram"
        >
          <Instagram className="h-4 w-4" />
          Acessar Perfil Completo
        </motion.a>

        {/* 
          BOTÃO INVISÍVEL:
          Conforme solicitado, posicionado bem ao lado do botão principal do Instagram.
          Fica transparente (opacity-0) e só se revela discretamente ao passar o mouse ou focar,
          desbloqueando o gerenciamento de fotos com a senha "69fotos69".
        */}
        <button
          onClick={() => {
            if (isAdminMode) {
              setIsAdminMode(false);
            } else {
              setShowPasswordModal(true);
            }
          }}
          className={`h-9 px-3 rounded-full border border-stone-800 flex items-center justify-center transition-all duration-300 cursor-pointer ${
            isAdminMode 
              ? 'bg-amber-950/40 text-amber-400 border-amber-500/30' 
              : 'opacity-0 hover:opacity-40 bg-stone-900/40 text-stone-500 hover:text-stone-300'
          }`}
          title="Configuração do Mural"
          id="btn-mural-config-invisivel"
        >
          {isAdminMode ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-stone-600" />}
        </button>
      </div>

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
            className="mt-12 bg-stone-900/50 border border-amber-500/10 rounded-3xl p-6 relative overflow-hidden"
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
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500/30 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Link do Post (Insta)</label>
                    <input
                      type="text"
                      placeholder="URL do Instagram"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500/30 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none"
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
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500/30 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">Comentários (opcional)</label>
                    <input
                      type="number"
                      placeholder="Ex: 45"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500/30 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none"
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
                    className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500/30 rounded-lg px-3 py-2 text-xs text-stone-200 outline-none resize-none"
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
