import React from 'react';

interface OrbIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  glow?: boolean;
}

export const OrbIcon: React.FC<OrbIconProps> = ({ size = 'md', className = '', glow = true }) => {
  let dim = 20;
  if (typeof size === 'number') {
    dim = size;
  } else {
    switch (size) {
      case 'xs': dim = 14; break;
      case 'sm': dim = 16; break;
      case 'md': dim = 20; break;
      case 'lg': dim = 26; break;
      case 'xl': dim = 34; break;
    }
  }

  return (
    <div 
      className={`relative flex items-center justify-center flex-shrink-0 select-none ${className}`}
      style={{ width: dim, height: dim }}
    >
      <svg 
        width={dim} 
        height={dim} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={glow ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.85)] transition-all duration-300" : ""}
      >
        <defs>
          {/* Main sphere gradient */}
          <radialGradient id="orbCore" cx="35%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#F5F7FA" />
            <stop offset="70%" stopColor="#CBD5E1" />
            <stop offset="92%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#64748B" />
          </radialGradient>

          {/* Outer soft glow ring */}
          <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#E2E8F0" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          {/* Top gloss reflection */}
          <linearGradient id="orbGloss" x1="20%" y1="10%" x2="50%" y2="60%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
          </linearGradient>

          {/* Inner bottom rim reflection */}
          <linearGradient id="orbRim" x1="50%" y1="100%" x2="50%" y2="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#C084FC" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Soft background aura */}
        <circle cx="50" cy="50" r="48" fill="url(#orbGlow)" />

        {/* Main Sphere */}
        <circle cx="50" cy="50" r="42" fill="url(#orbCore)" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.6" />

        {/* Rim Light / Edge Glow */}
        <circle cx="50" cy="50" r="41" fill="url(#orbRim)" />

        {/* Gloss Curved Highlight */}
        <ellipse cx="44" cy="32" rx="26" ry="16" fill="url(#orbGloss)" transform="rotate(-18 44 32)" />

        {/* Sparkle Highlight Star */}
        <path 
          d="M 68 28 C 68 28 68 22 71 22 C 74 22 74 28 74 28 C 74 28 80 28 80 31 C 80 34 74 34 74 34 C 74 34 74 40 71 40 C 68 40 68 34 68 34 C 68 34 62 34 62 31 C 62 28 68 28 68 28 Z" 
          fill="#FFFFFF" 
          opacity="0.95"
        />

        {/* Tiny secondary sparkle dot */}
        <circle cx="28" cy="68" r="3" fill="#FFFFFF" opacity="0.8" />
      </svg>
    </div>
  );
};
