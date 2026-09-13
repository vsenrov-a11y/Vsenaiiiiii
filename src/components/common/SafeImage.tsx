import React, { useState, useEffect } from 'react';
import { useAsset } from '../../utils/fileDb';

interface SafeImageProps extends Omit<React.ComponentPropsWithoutRef<'img'>, 'src'> {
  src?: string | null | undefined;
  fallbackSrc?: string;
}

export function SafeImage({ src, fallbackSrc, onError, style, className, alt, ...props }: SafeImageProps) {
  const resolved = useAsset(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src, resolved]);

  // If resolved is available and not a raw db ref, use it. Otherwise, if src is already a direct url, use src.
  let displaySrc: string | undefined = undefined;
  if (hasError && fallbackSrc) {
    displaySrc = fallbackSrc;
  } else if (resolved && !resolved.startsWith('db:')) {
    displaySrc = resolved;
  } else if (src && !src.startsWith('db:')) {
    displaySrc = src;
  }

  const isValidSrc = Boolean(displaySrc && typeof displaySrc === 'string' && displaySrc.trim().length > 0);

  if (!isValidSrc) {
    return (
      <img 
        alt={alt || ''}
        className={className}
        {...props} 
        style={{ 
          ...style, 
          opacity: 0,
          pointerEvents: 'none',
        }} 
      />
    );
  }

  return (
    <img 
      src={displaySrc} 
      alt={alt || ''}
      onError={(e) => {
        setHasError(true);
        if (onError) onError(e);
      }}
      className={className}
      {...props} 
      style={{ 
        ...style, 
        opacity: style?.opacity !== undefined ? style.opacity : 1,
        transition: style?.transition || 'opacity 0.2s ease-in-out',
      }} 
    />
  );
}
