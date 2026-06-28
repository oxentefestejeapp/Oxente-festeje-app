import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';

interface MagneticButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
  className?: string;
  delay?: number;
  glowColor?: string;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  onClick,
  href,
  target,
  rel,
  className,
  delay = 0,
  glowColor = 'rgba(245, 158, 11, 0.3)'
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!buttonRef.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
    
    // Calculate position relative to the center of the button
    const x = clientX - (left + width / 2);
    const y = clientY - (top + height / 2);

    // Displacement strength (max 10px to keep it elegant and usable)
    const maxDisplacement = 10;
    const strength = 0.25;
    const finalX = Math.max(-maxDisplacement, Math.min(maxDisplacement, x * strength));
    const finalY = Math.max(-maxDisplacement, Math.min(maxDisplacement, y * strength));

    setPosition({ x: finalX, y: finalY });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
    setIsHovered(false);
  };

  // Dynamically select tag based on whether it is an anchor or a button
  const Component = href ? motion.a : motion.button;

  return (
    <div
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className="relative w-full overflow-visible"
    >
      <Component
        href={href}
        onClick={onClick}
        target={target}
        rel={rel}
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10px" }}
        transition={{ 
          opacity: { duration: 0.6, delay },
          y: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }
        }}
        animate={{
          x: position.x,
          y: position.y,
          scale: isHovered ? 1.025 : 1,
          boxShadow: isHovered ? `0 20px 40px ${glowColor}` : '0 4px 10px rgba(0, 0, 0, 0.3)',
        }}
        whileTap={{ scale: 0.98 }}
        className={className}
        style={{
          transformStyle: "preserve-3d",
          perspective: 1000
        }}
      >
        {/* Glowing Hover Background backplate */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-[-1] filter blur-md"
          style={{
            background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`
          }}
        />

        {/* Shimmer / Golden shine sweep effect inside the button */}
        {isHovered && (
          <motion.div
            initial={{ left: '-120%' }}
            animate={{ left: '200%' }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              repeatDelay: 0.5,
              ease: "easeInOut" 
            }}
            className="absolute top-0 bottom-0 w-28 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-20 pointer-events-none z-20"
          />
        )}
        
        {children}
      </Component>
    </div>
  );
};
