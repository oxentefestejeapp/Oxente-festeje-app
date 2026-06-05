import React from 'react';
import { motion } from 'motion/react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function BrandLogo({ className = '', size = 'md' }: BrandLogoProps) {
  const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-14 w-14',
    lg: 'h-24 w-24',
    xl: 'h-32 w-32'
  };

  return (
    <div className={`relative shrink-0 select-none ${sizeClasses[size]} ${className}`}>
      {/* Decorative Outer Aura with gentle breathing bloom */}
      <motion.div 
        className="absolute inset-0 rounded-full bg-brand-pink/15 blur-lg -z-10"
        animate={{ 
          scale: [1, 1.12, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
      >
        {/* Outer Golden/Bronze Leather Circular Frame */}
        <circle cx="50" cy="50" r="47" fill="#111113" stroke="#d97706" strokeWidth="2.2" />
        
        {/* Leather Stitching Path */}
        <circle cx="50" cy="50" r="44" stroke="#fef08a" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.85" />
        
        {/* Terracotta/Sunset Warm Background Gradient inside */}
        <mask id="inner-circle-mask">
          <circle cx="50" cy="50" r="43" fill="white" />
        </mask>
        
        <g mask="url(#inner-circle-mask)">
          {/* Desert Sunset Glow */}
          <radialGradient id="sunset-glow" cx="50%" cy="85%" r="75%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#b45309" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#111113" stopOpacity="0" />
          </radialGradient>
          <circle cx="50" cy="50" r="43" fill="url(#sunset-glow)" />

          {/* BACKGROUND ELEMENTS: Subtle desert mountains / dunes */}
          <path d="M5 82 C25 76, 40 85, 55 80 C70 75, 85 83, 95 81 L95 95 L5 95 Z" fill="#271c14" opacity="0.4" />
          <path d="M-5 88 C15 82, 35 90, 55 84 C75 78, 85 88, 105 85 L105 100 L-5 100 Z" fill="#1c120c" />

          {/* DYNAMIC ANIMATED MAIN CONTENT: CACTUS MANDACARU */}
          <motion.g
            initial={{ scale: 0, rotate: -35, y: 35, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
            transition={{ 
              type: "spring", 
              damping: 14, 
              stiffness: 90, 
              duration: 0.85,
              delay: 0.05
            }}
          >
            {/* Soft idle swaying and breathing motion loop */}
            <motion.g
              animate={{ 
                rotate: [-1.5, 1.5, -1.5],
                y: [0, -1.2, 0]
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{ transformOrigin: "50px 85px" }}
            >
              {/* Main Cactus Trunk */}
              <rect x="44" y="38" width="12" height="46" rx="6" fill="#15803d" stroke="#14532d" strokeWidth="1.5" />
              
              {/* Trunk Ribs/Textures with vertical lines */}
              <path d="M47 43 V78" stroke="#166534" strokeWidth="1" strokeLinecap="round" />
              <path d="M50 40 V82" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
              <path d="M53 43 V78" stroke="#166534" strokeWidth="1" strokeLinecap="round" />

              {/* LEFT ARM (Curving upwards) */}
              <path 
                d="M44 64 H36 C31 64, 30 58, 30 52 V44" 
                stroke="#15803d" 
                strokeWidth="7.5" 
                strokeLinecap="round" 
                fill="none" 
              />
              <path 
                d="M44 64 H36 C31 64, 30 58, 30 52 V44" 
                stroke="#166534" 
                strokeWidth="8.5" 
                strokeLinecap="round" 
                fill="none" 
                className="-z-10" 
              />
              {/* Left arm inner spine lines */}
              <path d="M30 46 V53 C30 57, 33 60, 37 60" stroke="#22c55e" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.8" />

              {/* RIGHT ARM (Curving upwards and slightly higher) */}
              <path 
                d="M56 58 H64 C69 58, 70 52, 70 46 V36" 
                stroke="#15803d" 
                strokeWidth="7.5" 
                strokeLinecap="round" 
                fill="none" 
              />
              <path 
                d="M56 58 H64 C69 58, 70 52, 70 46 V36" 
                stroke="#166534" 
                strokeWidth="8.5" 
                strokeLinecap="round" 
                fill="none" 
                className="-z-10" 
              />
              {/* Right arm inner spine lines */}
              <path d="M70 38 V45 C70 49, 67 54, 63 54" stroke="#22c55e" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.8" />

              {/* MANDACARU FLOWERS (Flor de Mandacaru - Celebration pink/yellow blooms) */}
              {/* Left Arm Flower */}
              <g transform="translate(30, 42)">
                <circle cx="0" cy="0" r="3.2" fill="#ec4899" />
                <circle cx="-3" cy="-1" r="1.8" fill="#f43f5e" />
                <circle cx="3" cy="1" r="1.8" fill="#f43f5e" />
                <circle cx="1" cy="-3" r="1.8" fill="#f43f5e" />
                <circle cx="-1" cy="3" r="1.8" fill="#f43f5e" />
                <circle cx="0" cy="0" r="1.2" fill="#fef08a" />
              </g>

              {/* Right Arm Flower (Larger festive bloom) */}
              <g transform="translate(70, 33)">
                <circle cx="0" cy="0" r="4.5" fill="#f43f5e" />
                {/* Petals */}
                <path d="M-5,-2 L2,-6 L5,2 L-2,6 Z" fill="#ec4899" opacity="0.9" />
                <path d="M-2,-5 L5,-2 L2,5 L-5,2 Z" fill="#db2777" />
                <circle cx="0" cy="0" r="1.8" fill="#fef08a" />
              </g>

              {/* NEEDLES / SPINES (Pequenos espinhos amarelos do cacto) */}
              {/* Spines on central trunk */}
              <path d="M40 50 L42 50 M41 62 L43 63 M40 74 L42 75" stroke="#fef08a" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M60 48 L58 49 M60 60 L58 61 M61 72 L59 71" stroke="#fef08a" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M50 45 L50 42 M52 56 L53 53 M48 68 L47 65" stroke="#fef08a" strokeWidth="1.2" strokeLinecap="round" />
              
              {/* Spines on arms */}
              <path d="M26 50 L28 51 M25 43 L28 44" stroke="#fef08a" strokeWidth="1" strokeLinecap="round" />
              <path d="M74 42 L72 43 M75 35 L72 36" stroke="#fef08a" strokeWidth="1" strokeLinecap="round" />

              {/* TRADITIONAL LEATHER HAT (Chapéu de Couro do Cacto Mandacaru) */}
              <g transform="translate(50, 36) rotate(-4)">
                {/* Hat Crown Shadow */}
                <path d="M-15,-1 C-15,-16 15,-16 15,-1 Z" fill="#2d1706" opacity="0.5" />
                
                {/* Main Crown */}
                <path d="M-13,-2 C-13,-17 13,-17 13,-2 Z" fill="#5c3d21" stroke="#3c220f" strokeWidth="1" />
                
                {/* Royal Yellow Stitching inside Hat */}
                <path d="M-10,-3 C-10,-13 10,-13 10,-3" stroke="#fef08a" strokeWidth="1" strokeDasharray="1.5 1.5" fill="none" />
                
                {/* Central Star Emblem (Estrela do Sertão Nordestino) */}
                <path d="M0,-10 L1.5,-6.5 L5,-6.5 L2,-4.5 L3.5,-1 L0,-3 L-3.5,-1 L-2,-4.5 L-5,-6.5 L-1.5,-6.5 Z" fill="#fef08a" />
                <circle cx="0" cy="-5" r="0.8" fill="#c59218" />

                {/* Hat Brim */}
                <path d="M-23,4 C-23,4 0,11 23,4 C25,2 18,1 0,1 C-18,1 -25,2 -23,4 Z" fill="#3a200e" stroke="#251205" strokeWidth="0.8" />
                {/* Brim stitch lines */}
                <path d="M-19,3.5 C-9,7.5 9,7.5 19,3.5" stroke="#fef08a" strokeWidth="0.8" strokeDasharray="2 2" fill="none" opacity="0.9" />

                {/* Hand-knotted leather chin strap */}
                <path d="M-9,2 C-9,7 -3,11 -1.5,13" stroke="#3a200e" strokeWidth="1" fill="none" strokeLinecap="round" />
                <path d="M9,2 C9,7 3,11 1.5,13" stroke="#3a200e" strokeWidth="1" fill="none" strokeLinecap="round" />
                <circle cx="0" cy="12.5" r="1.5" fill="#fef08a" />
              </g>

            </motion.g>
          </motion.g>

          {/* Golden Badge Bottom Ribbon for "OXENTE FESTEJE" */}
          <path d="M12 85 C30 92 70 92 88 85 L84 94 C68 97 32 97 16 94 Z" fill="#d97706" stroke="#92400e" strokeWidth="1" />
          {/* Ribbon Inner Stitches */}
          <path d="M16 87 C32 93 68 93 84 87" stroke="#fef08a" strokeWidth="0.8" strokeDasharray="2 2" fill="none" opacity="0.8" />
          
          {/* Brand Initials / text curved inside bottom ribbon */}
          <text 
            x="50" 
            y="91" 
            fill="#fef08a" 
            fontSize="4.5" 
            fontWeight="900" 
            textAnchor="middle" 
            fontFamily="sans-serif"
            letterSpacing="0.5"
          >
            OXENTE FESTEJE
          </text>
        </g>
      </svg>
    </div>
  );
}
