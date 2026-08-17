import React, { useState } from 'react';

// An image that shows a shimmering placeholder until it has loaded, then fades
// in — so photos never "pop" in blank/slow. Wrap in a sized container.
export function SmartImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  fit = 'cover',
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  fit?: 'cover' | 'contain';
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="absolute inset-0 kulmi-skeleton" />}
      <img
        src={src}
        alt={alt}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`w-full h-full object-${fit} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
      />
    </div>
  );
}
