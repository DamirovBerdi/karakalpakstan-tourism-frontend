import { useState, type ImgHTMLAttributes } from 'react';
import { getOptimizedImageUrl } from '@/lib/imageOptimizer';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt'> {
  src: string;
  alt?: string;
  widthParam?: number;
  qualityParam?: number;
  priority?: boolean;
  containerClassName?: string;
}

const FALLBACK_DESERT_IMG =
  'https://images.pexels.com/photos/28949995/pexels-photo-28949995.jpeg?auto=compress&cs=tinysrgb&w=600&q=70';

export default function OptimizedImage({
  src,
  alt = '',
  widthParam = 600,
  qualityParam = 70,
  priority = false,
  className = '',
  containerClassName = '',
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const optimizedSrc = getOptimizedImageUrl(
    hasError ? FALLBACK_DESERT_IMG : src,
    widthParam,
    qualityParam
  );

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Skeleton Pulse Shimmer Placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-sand-200/90 animate-pulse transition-opacity duration-300" />
      )}

      <img
        src={optimizedSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ fetchpriority: priority ? 'high' : 'auto' } as any)}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (!hasError) setHasError(true);
          setIsLoaded(true);
        }}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...props}
      />
    </div>
  );
}
