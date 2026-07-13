import React, { useState } from 'react';

/**
 * Optimizes external image URLs (like Unsplash) by appending/replacing parameters
 * for custom width, lower quality, and modern format (WebP).
 */
export function optimizeImageUrl(url: string, width = 400, quality = 70): string {
  if (!url) return '';

  // If it's an Unsplash URL, apply parameters for fast loading
  if (url.includes('unsplash.com')) {
    try {
      const parsedUrl = new URL(url);
      
      // Update or append optimization parameters
      parsedUrl.searchParams.set('w', width.toString());
      parsedUrl.searchParams.set('q', quality.toString());
      parsedUrl.searchParams.set('fm', 'webp'); // Force ultra-compressed WebP format
      parsedUrl.searchParams.set('auto', 'format');
      parsedUrl.searchParams.set('fit', parsedUrl.searchParams.get('fit') || 'crop');
      
      return parsedUrl.toString();
    } catch {
      // Fallback if URL parsing fails
      return `${url.split('?')[0]}?auto=format&fit=crop&w=${width}&q=${quality}&fm=webp`;
    }
  }

  // Return unchanged for non-compatible URLs
  return url;
}

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  width?: number;
  quality?: number;
  isAboveFold?: boolean; // Set to true for hero/header images to load instantly
  fallbackSrc?: string;
}

/**
 * A highly optimized Image component that supports:
 * - Automatic Unsplash URL optimization (width, quality, webp format)
 * - Lazy loading for below-the-fold elements
 * - Asynchronous decoding to avoid main-thread lag
 * - Smooth fade-in transition once loaded
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  width = 400,
  quality = 70,
  isAboveFold = false,
  fallbackSrc,
  className = '',
  alt = '',
  onLoad,
  onError,
  ...props
}) => {
  const isLocal = src.startsWith('/') && !src.startsWith('//');
  const [isLoaded, setIsLoaded] = useState(isAboveFold || isLocal);
  const [currentSrc, setCurrentSrc] = useState(() => optimizeImageUrl(src, width, quality));

  React.useEffect(() => {
    const newSrc = optimizeImageUrl(src, width, quality);
    setCurrentSrc(prev => {
      if (prev !== newSrc) {
        setIsLoaded(isAboveFold || isLocal);
        return newSrc;
      }
      return prev;
    });
  }, [src, width, quality, isAboveFold, isLocal]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else if (onError) {
      onError(e);
    }
  };

  // Detect key layout classes from className to mirror them to the internal image element
  const isContain = className.includes('object-contain');
  const isHAuto = className.includes('h-auto') || className.includes('h-[auto]');

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Shimmer Placeholder before loading */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-stone-900/40 animate-pulse" />
      )}
      
      <img
        src={currentSrc}
        alt={alt}
        loading={isAboveFold ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        referrerPolicy="no-referrer"
        className={`w-full transition-opacity duration-500 ease-in-out ${
          isHAuto ? 'h-auto' : 'h-full'
        } ${
          isContain ? 'object-contain' : 'object-cover'
        } ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...props}
      />
    </div>
  );
};

/**
 * Compresses an uploaded image file on the client-side to keep file size ultra-low.
 * Resizes the image to a maximum dimension of 600px and returns a JPEG base64 string
 * at a low/medium quality.
 */
export function compressImageFile(file: File, maxWidth = 600, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string); // fallback to uncompressed base64
          return;
        }

        // Draw with a background so transparent PNGs become JPEG compatible cleanly
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => {
        reject(err);
      };
    };
    reader.onerror = (err) => {
      reject(err);
    };
  });
}
