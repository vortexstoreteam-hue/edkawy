import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  fallbackTitle?: string;
  compact?: boolean;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  fallbackTitle,
  compact = false,
}: ResilientImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const resolvedLabel = fallbackLabel ?? fallbackTitle ?? alt;

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#10192D] text-[#94A3B8] ${compact ? 'p-2' : 'p-4'} text-center select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Store
          className={`${compact ? 'w-7 h-7' : 'w-7 h-7 mb-1.5'} text-[#FF7100] shrink-0`}
          aria-hidden="true"
        />
        {!compact && resolvedLabel ? (
          <span className="text-xs sm:text-sm font-semibold text-[#F8FAFC] line-clamp-2">
            {resolvedLabel}
          </span>
        ) : null}
      </div>
    );
  }

  const isDataUrl = src.startsWith('data:image/');

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy={isDataUrl ? undefined : 'no-referrer'}
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
