export function getThemeTokens(isLight: boolean) {
  return {
    // Backgrounds
    bgBase: isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]',
    bgSurface: isLight ? 'bg-white' : 'bg-[#18181c]',
    bgElevated: isLight ? 'bg-white' : 'bg-[#1a1a1e]',
    bgGlass: isLight ? 'bg-black/[0.04]' : 'bg-white/[0.04]',
    bgGlassHover: isLight ? 'hover:bg-black/[0.08]' : 'hover:bg-white/[0.08]',
    
    // Borders
    borderGlass: isLight ? 'border-black/[0.08]' : 'border-white/[0.08]',
    borderGlassStrong: isLight ? 'border-black/[0.15]' : 'border-white/[0.15]',
    
    // Text
    textPrimary: isLight ? 'text-[#1C1C1E]' : 'text-white/95',
    textSecondary: isLight ? 'text-[#2C2C2E]' : 'text-white/70',
    textTertiary: isLight ? 'text-[#48484A]' : 'text-white/45',
    textQuaternary: isLight ? 'text-[#7A7A80]' : 'text-white/30',

    // Accents
    accentBg: isLight ? 'bg-[#444444]' : 'bg-[#AAAAAA]',
    accentText: isLight ? 'text-[#444444]' : 'text-[#AAAAAA]',
    accentGlass: isLight ? 'bg-[#444444]/[0.06] text-[#444444]' : 'bg-[#AAAAAA]/[0.15] text-[#AAAAAA]',
    accentGlassHover: isLight ? 'hover:bg-[#444444]/[0.1] hover:text-[#222222]' : 'hover:bg-[#AAAAAA]/[0.25] hover:text-white',
    accentBorder: isLight ? 'border-[#444444]/[0.15]' : 'border-[#AAAAAA]/[0.25]',

    // Button Base Styles (heights, radius, shadows)
    // Primary: 44-48px (h-11 or h-12)
    // Secondary/Icon: 34-36px (h-9)
    // Tiny: 28-32px (h-8)
    
    // Buttons (Full Class Sets)
    btnPrimary: `h-11 px-6 rounded-2xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2 ${
      isLight 
        ? 'bg-[#444444] text-white hover:bg-[#222222]' 
        : 'bg-[#AAAAAA] text-[#121214] hover:bg-white'
    }`,
    btnSecondary: `h-11 px-6 rounded-2xl font-semibold transition-all border flex items-center justify-center gap-2 ${
      isLight 
        ? 'bg-black/[0.04] border-black/[0.08] hover:bg-black/[0.08] text-[#1C1C1E]' 
        : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-white/95'
    }`,
    btnIcon: `w-9 h-9 rounded-full flex items-center justify-center transition-all border shrink-0 ${
      isLight 
        ? 'bg-black/[0.04] border-black/[0.08] hover:bg-black/[0.08] text-[#1C1C1E]' 
        : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-white/95'
    }`,
    btnIconActive: `w-9 h-9 rounded-full flex items-center justify-center transition-all border shrink-0 ${
      isLight 
        ? 'bg-[#444444]/[0.06] border-[#444444]/[0.15] text-[#444444]' 
        : 'bg-[#AAAAAA]/[0.15] border-[#AAAAAA]/[0.25] text-[#AAAAAA]'
    }`,
    btnTiny: `h-8 px-4 rounded-xl text-[13px] font-semibold transition-all border flex items-center justify-center gap-1.5 ${
      isLight 
        ? 'bg-black/[0.04] border-black/[0.08] hover:bg-black/[0.08] text-[#1C1C1E]' 
        : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-white/95'
    }`,
    btnTinyActive: `h-8 px-4 rounded-xl text-[13px] font-semibold transition-all border flex items-center justify-center gap-1.5 ${
      isLight 
        ? 'bg-[#444444]/[0.06] border-[#444444]/[0.15] text-[#444444]' 
        : 'bg-[#AAAAAA]/[0.15] border-[#AAAAAA]/[0.25] text-[#AAAAAA]'
    }`,
    btnDestructive: `h-11 px-6 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20`,
    btnDestructiveIcon: `w-9 h-9 rounded-full flex items-center justify-center transition-all bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20`,

    // Glass panel overlay components
    glassPanel: `backdrop-blur-xl border ${
      isLight
        ? 'bg-white/70 border-black/[0.08]'
        : 'bg-[#121214]/70 border-white/[0.08]'
    }`,

    // Structural specific sizes
    radiusContainer: 'rounded-[20px]',
    radiusCard: 'rounded-2xl',
    radiusElement: 'rounded-xl',
  };
}
