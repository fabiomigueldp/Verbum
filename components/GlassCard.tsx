import React, { forwardRef } from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  /** Muted variant for skeleton/loading states */
  muted?: boolean;
  /** Active/focused state for contextual depth */
  isActive?: boolean;
  /** Enable breathing glow animation when active */
  breathingGlow?: boolean;
  /** Custom border intensity (0-1) */
  borderIntensity?: number;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(({ 
  children, 
  className = '', 
  hoverEffect = false,
  muted = false,
  isActive = false,
  breathingGlow = false,
  borderIntensity,
}, ref) => {
  // Calculate border opacity based on state
  const getBorderClass = () => {
    if (muted) return 'border-transparent';
    if (borderIntensity !== undefined) {
      // Use custom intensity
      return '';
    }
    if (isActive) return 'border-white/[0.12]';
    return 'border-white/[0.04]';
  };

  const getBorderStyle = () => {
    if (borderIntensity !== undefined) {
      return { borderColor: `rgba(255, 255, 255, ${borderIntensity})` };
    }
    return {};
  };

  return (
    <div 
      ref={ref}
      style={getBorderStyle()}
      className={`
        relative overflow-hidden
        ${muted ? 'bg-neutral-900/30' : 'bg-neutral-900/40'}
        backdrop-blur-2xl
        border ${getBorderClass()}
        rounded-2xl
        
        /* Shadow - Contextual Depth */
        ${isActive 
          ? 'shadow-[0_0_40px_rgba(255,255,255,0.03),0_8px_32px_rgba(0,0,0,0.4)]' 
          : 'shadow-[0_8px_32px_rgba(0,0,0,0.35)]'
        }
        
        /* Transitions - Luxurious timing */
        transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]
        
        ${hoverEffect ? `
          hover:bg-neutral-800/50 
          hover:border-white/[0.08] 
          hover:shadow-[0_8px_40px_rgba(0,0,0,0.45),0_0_30px_rgba(255,255,255,0.02)] 
          hover:-translate-y-[2px]
        ` : ''}
        ${className}
      `}
    >
      {/* Primary shine gradient - top-left origin */}
      <div 
        className={`
          absolute top-0 left-0 w-full h-full 
          bg-gradient-to-br from-white/[0.04] via-white/[0.01] to-transparent 
          pointer-events-none 
          transition-opacity duration-700
          ${muted ? 'opacity-20' : isActive ? 'opacity-100' : 'opacity-50'}
        `} 
      />

      {/* Breathing glow layer - subtle inner radiance */}
      {breathingGlow && (
        <div 
          className={`
            absolute inset-0
            bg-gradient-to-b from-white/[0.02] via-transparent to-transparent
            pointer-events-none
            transition-opacity duration-1000
            ${isActive ? 'opacity-100 animate-[breatheGlow_4s_ease-in-out_infinite]' : 'opacity-0'}
          `}
        />
      )}

      {/* Edge highlight - metallic rim effect */}
      <div 
        className={`
          absolute inset-0 rounded-2xl
          pointer-events-none
          transition-opacity duration-500
          ${isActive 
            ? 'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]' 
            : 'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]'
          }
        `}
      />
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
});

GlassCard.displayName = 'GlassCard';
