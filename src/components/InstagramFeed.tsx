import React, { useRef, useState, useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';
import { Instagram, Heart, MessageCircle, ExternalLink, Sparkles } from 'lucide-react';

interface InstagramPost {
  id: number;
  imageUrl: string;
  likes: string;
  comments: number;
  caption: string;
  tag: string;
  link: string;
}

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
  const [isPaused, setIsPaused] = useState(false);

  // Double the array to enable infinite seamless loop
  const duplicatedPosts = [...INSTAGRAM_POSTS, ...INSTAGRAM_POSTS];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="w-full mt-20 mb-14 px-4 overflow-hidden relative z-20"
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
              <img
                src={post.imageUrl}
                alt={post.caption}
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

      {/* Interactive Action Button to visit profile directly */}
      <div className="flex justify-center mt-6">
        <motion.a
          href="https://www.instagram.com/oxentefesteje/"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white font-display font-black text-xs uppercase tracking-wider px-6 py-3 rounded-full shadow-lg shadow-black/30 transition-all cursor-pointer border border-white/10"
        >
          <Instagram className="h-4 w-4" />
          Acessar Perfil Completo
        </motion.a>
      </div>
    </motion.div>
  );
};
