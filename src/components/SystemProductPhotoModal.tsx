import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Tag, 
  Layers, 
  Eye
} from 'lucide-react';
import { InstagramPost } from '../types';
import { INSTAGRAM_POSTS } from './InstagramFeed';
import { supabase } from '../lib/supabase';
import { OptimizedImage } from '../utils/imageOptimizer';

export const SystemProductPhotoModal: React.FC = () => {
  const [activePost, setActivePost] = useState<InstagramPost | null>(null);
  const [copied, setCopied] = useState(false);
  const [posts, setPosts] = useState<InstagramPost[]>(() => {
    try {
      const saved = localStorage.getItem('oxente_instagram_posts');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return INSTAGRAM_POSTS;
  });

  // Fetch updated posts from Supabase in background
  useEffect(() => {
    const fetchLatestPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('mural_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const formatted: InstagramPost[] = data.map((item: any) => ({
            id: item.id,
            imageUrl: item.image_url,
            likes: item.likes || '0',
            comments: item.comments || 0,
            caption: item.caption || '',
            tag: item.tag || 'Mural Oxente',
            link: item.link || '',
            categoria: item.categoria || 'Geral',
            createdAt: item.created_at
          }));
          setPosts(formatted);
          localStorage.setItem('oxente_instagram_posts', JSON.stringify(formatted));
        }
      } catch (err) {
        console.warn('Erro ao carregar fotos do mural no modal do sistema:', err);
      }
    };

    fetchLatestPosts();
  }, []);

  // Inspect URL parameters on mount and on popstate/hashchange
  useEffect(() => {
    const checkUrlParams = () => {
      try {
        const searchStr = window.location.search || '';
        const hashStr = window.location.hash || '';

        // Combine search params and hash query if any
        const searchParams = new URLSearchParams(searchStr);
        let hashParams = new URLSearchParams('');
        if (hashStr.includes('?')) {
          hashParams = new URLSearchParams(hashStr.substring(hashStr.indexOf('?')));
        }

        const fotoId = searchParams.get('foto') || searchParams.get('id') || searchParams.get('photo') ||
                       hashParams.get('foto') || hashParams.get('id') || hashParams.get('photo');
        
        const itemTag = searchParams.get('item') || searchParams.get('tag') || searchParams.get('modelo') ||
                        hashParams.get('item') || hashParams.get('tag') || hashParams.get('modelo');
        
        const tema = searchParams.get('tema') || searchParams.get('categoria') ||
                     hashParams.get('tema') || hashParams.get('categoria');

        const hasMuralSignal = searchParams.has('mural') || hashStr.includes('mural') || !!fotoId || !!itemTag || !!tema;

        if (!hasMuralSignal) {
          return;
        }

        const currentPool = posts.length > 0 ? posts : INSTAGRAM_POSTS;
        let matched: InstagramPost | undefined = undefined;

        // 1. Direct ID match
        if (fotoId) {
          matched = currentPool.find((p) => String(p.id).trim() === String(fotoId).trim());
        }

        // 2. Item tag match
        if (!matched && itemTag) {
          const normQuery = itemTag.toLowerCase().replace(/[-_]/g, ' ').trim();
          matched = currentPool.find((p) => {
            const normTag = (p.tag || '').toLowerCase().replace(/[-_]/g, ' ').trim();
            const normCap = (p.caption || '').toLowerCase().replace(/[-_]/g, ' ').trim();
            return normTag.includes(normQuery) || normQuery.includes(normTag) || normCap.includes(normQuery);
          });
        }

        // 3. Category match
        if (!matched && tema) {
          const normTema = tema.toLowerCase().replace(/[-_]/g, ' ').trim();
          matched = currentPool.find((p) => {
            const normCat = (p.categoria || '').toLowerCase().replace(/[-_]/g, ' ').trim();
            return normCat === normTema || normCat.includes(normTema);
          });
        }

        if (matched) {
          setActivePost(matched);
        }
      } catch (err) {
        console.error('Erro ao verificar parâmetros de foto no sistema:', err);
      }
    };

    checkUrlParams();

    window.addEventListener('popstate', checkUrlParams);
    window.addEventListener('hashchange', checkUrlParams);

    return () => {
      window.removeEventListener('popstate', checkUrlParams);
      window.removeEventListener('hashchange', checkUrlParams);
    };
  }, [posts]);

  // Handle closing modal and removing URL params gracefully without leaving the system or refreshing
  const handleClose = () => {
    setActivePost(null);
    try {
      // Remove the query parameters from URL bar smoothly
      const url = new URL(window.location.href);
      url.searchParams.delete('mural');
      url.searchParams.delete('foto');
      url.searchParams.delete('id');
      url.searchParams.delete('photo');
      url.searchParams.delete('item');
      url.searchParams.delete('tag');
      url.searchParams.delete('modelo');
      url.searchParams.delete('tema');
      url.searchParams.delete('categoria');
      if (url.hash.includes('mural')) {
        url.hash = '';
      }
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
    } catch (e) {
      console.warn('Erro ao atualizar URL:', e);
    }
  };

  const handleCopyDetails = () => {
    if (!activePost) return;
    const textToCopy = `📌 *Modelo:* ${activePost.tag}\n✨ *Categoria:* ${activePost.categoria || 'Geral'}\n📝 *Legenda:* ${activePost.caption}\n🌐 *Link:* ${activePost.link || window.location.href}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!activePost) return null;

  const modalContent = (
    <AnimatePresence>
      <div 
        id="system-product-photo-modal-root"
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-zinc-950 border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-850 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                    Modelo Solicitado no WhatsApp
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                    Sistema Ativo
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Visualização do produto sem sair do sistema de gestão
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              title="Fechar visualizador (permanecer no sistema)"
              id="btn-close-system-photo-modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[calc(92vh-130px)]">
            {/* Image Preview Container */}
            <div className="relative rounded-2xl overflow-hidden bg-black border border-zinc-800 flex items-center justify-center min-h-[260px] max-h-[380px]">
              <OptimizedImage
                src={activePost.imageUrl}
                alt={activePost.tag}
                width={800}
                quality={85}
                className="max-h-[380px] w-auto max-w-full object-contain mx-auto"
              />

              {/* Floating Badges */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none">
                <span className="px-3 py-1 rounded-full text-[11px] font-display font-bold uppercase tracking-wider bg-black/80 backdrop-blur-md text-amber-300 border border-amber-500/30 shadow-lg flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-amber-400" />
                  {activePost.categoria || 'Geral'}
                </span>

                <span className="px-3 py-1 rounded-full text-[11px] font-display font-bold uppercase tracking-wider bg-black/80 backdrop-blur-md text-white border border-white/20 shadow-lg flex items-center gap-1.5">
                  <Tag className="h-3 w-3 text-brand-pink" />
                  {activePost.tag}
                </span>
              </div>
            </div>

            {/* Product Meta & Description */}
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                <div>
                  <h3 className="text-base sm:text-lg font-display font-bold text-white tracking-wide">
                    {activePost.tag}
                  </h3>
                  <div className="text-xs font-mono text-amber-400/90 mt-0.5">
                    Categoria: <span className="text-zinc-200 font-semibold">{activePost.categoria || 'Geral'}</span>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-zinc-500 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-850 self-start sm:self-auto">
                  ID: #{activePost.id}
                </div>
              </div>

              {activePost.caption && (
                <div>
                  <div className="text-[10px] font-mono uppercase text-zinc-400 font-bold mb-1">
                    Legenda / Detalhes do Modelo
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed bg-zinc-950/60 p-3 rounded-xl border border-zinc-850/60">
                    {activePost.caption}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-4 sm:px-6 py-3 border-t border-zinc-850 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCopyDetails}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-display font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
              id="btn-copy-system-photo-info"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Dados Copiados!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-amber-400" />
                  <span>Copiar Dados do Modelo</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-zinc-950 font-display font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95 flex items-center gap-2"
              id="btn-confirm-close-system-photo"
            >
              <span>Fechar e Continuar no Sistema</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
