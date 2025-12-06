import React, { forwardRef, memo } from 'react';

// ============================================================================
// GLASS CARD COMPONENT
// High-performance glassmorphism container with decoupled rendering layers
// Eliminates GPU compositing artifacts by isolating blur from state changes
// Extends HTMLAttributes for full event handler support (onClick, etc.)
// ============================================================================

interface GlassCardOwnProps {
  children: React.ReactNode;
  hoverEffect?: boolean;
  /** Muted variant for skeleton/loading states */
  muted?: boolean;
  /** Active/focused state for contextual depth */
  isActive?: boolean;
  /** Selected state - distinct from active for selection UI */
  isSelected?: boolean;
  /** Enable breathing glow animation when active */
  breathingGlow?: boolean;
  /** Custom border intensity (0-1) */
  borderIntensity?: number;
}

// Extend HTMLAttributes to allow onClick, onMouseEnter, role, aria-*, etc.
type GlassCardProps = GlassCardOwnProps & Omit<React.HTMLAttributes<HTMLDivElement>, keyof GlassCardOwnProps>;

/**
 * State Layer - Decoupled from blur to prevent GPU compositing artifacts
 * Handles: selection highlight, active borders, hover states
 * This layer animates independently of the backdrop-blur
 */
const StateLayer = memo<{ 
  isActive: boolean; 
  isSelected: boolean;
  hoverEffect: boolean;
}>(({ isActive, isSelected, hoverEffect }) => (
  <div 
    className={`
      absolute inset-0 rounded-2xl
      pointer-events-none
      transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
      transform-gpu
      ${isSelected 
        ? 'bg-white/[0.05] border border-white/30 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' 
        : isActive 
          ? 'bg-white/[0.02] border border-white/[0.12]' 
          : 'bg-transparent border border-transparent'
      }
      ${hoverEffect && !isSelected && !isActive ? 'group-hover:bg-white/[0.02] group-hover:border-white/[0.08]' : ''}
    `}
    style={{ 
      // Promote to own compositing layer to isolate from blur
      willChange: 'background-color, border-color',
      contain: 'strict',
    }}
  />
));

StateLayer.displayName = 'StateLayer';

/**
 * Shine Layer - Static gradient overlay
 * Provides the "glossy" top-left highlight effect
 */
const ShineLayer = memo<{ muted: boolean; isActive: boolean }>(({ muted, isActive }) => (
  <div 
    className={`
      absolute inset-0 rounded-2xl
      bg-gradient-to-br from-white/[0.04] via-white/[0.01] to-transparent 
      pointer-events-none 
      transition-opacity duration-700
      ${muted ? 'opacity-20' : isActive ? 'opacity-100' : 'opacity-50'}
    `}
    style={{ contain: 'strict' }}
  />
));

ShineLayer.displayName = 'ShineLayer';

/**
 * Edge Highlight - Metallic rim effect
 * Inset shadow for premium depth
 */
const EdgeHighlight = memo<{ isActive: boolean }>(({ isActive }) => (
  <div 
    className={`
      absolute inset-0 rounded-2xl
      pointer-events-none
      transition-opacity duration-500
      ${isActive 
        ? 'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]' 
        : 'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]'
      }
    `}
    style={{ contain: 'strict' }}
  />
));

EdgeHighlight.displayName = 'EdgeHighlight';

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(({ 
  children, 
  className = '', 
  hoverEffect = false,
  muted = false,
  isActive = false,
  isSelected = false,
  breathingGlow = false,
  borderIntensity,
  // Spread remaining props (onClick, onMouseEnter, role, aria-*, etc.)
  ...props
}, ref) => {
  // Calculate base border for non-state scenarios
  const getBaseBorderClass = () => {
    if (muted) return 'border-transparent';
    if (borderIntensity !== undefined) return '';
    // Base border - state layer handles active/selected borders
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
      {...props}
      style={{ ...getBorderStyle(), ...props.style }}
      className={`
        relative overflow-hidden
        group
        rounded-2xl
        
        /* Base background - static, no animation on this property */
        ${muted ? 'bg-neutral-900/30' : 'bg-neutral-900/40'}
        
        /* Blur filter - NEVER animate properties on this element */
        backdrop-blur-2xl
        
        /* Base border - fallback when state layer is transparent */
        border ${getBaseBorderClass()}
        
        /* Shadow - GPU accelerated, safe to animate */
        ${isSelected
          ? 'shadow-[0_0_30px_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.4)]'
          : isActive 
            ? 'shadow-[0_0_40px_rgba(255,255,255,0.03),0_8px_32px_rgba(0,0,0,0.4)]' 
            : 'shadow-[0_8px_32px_rgba(0,0,0,0.35)]'
        }
        
        /* Transform for hover lift - GPU accelerated */
        transform-gpu
        ${hoverEffect ? 'hover:-translate-y-[2px]' : ''}
        
        /* Transition only safe properties */
        transition-[transform,box-shadow] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]
        
        ${className}
      `}
    >
      {/* Layer 1: Shine gradient (z-0) */}
      <ShineLayer muted={muted} isActive={isActive || isSelected} />

      {/* Layer 2: State layer for selection/hover (z-10) */}
      <StateLayer 
        isActive={isActive} 
        isSelected={isSelected}
        hoverEffect={hoverEffect}
      />

      {/* Layer 3: Edge highlight (z-20) */}
      <EdgeHighlight isActive={isActive || isSelected} />

      {/* Breathing glow layer - subtle inner radiance */}
      {breathingGlow && (
        <div 
          className={`
            absolute inset-0 rounded-2xl
            bg-gradient-to-b from-white/[0.02] via-transparent to-transparent
            pointer-events-none
            transition-opacity duration-1000
            ${isActive ? 'opacity-100 animate-[breatheGlow_4s_ease-in-out_infinite]' : 'opacity-0'}
          `}
          style={{ contain: 'strict' }}
        />
      )}
      
      {/* Layer 4: Content (z-30) */}
      <div className="relative z-30">
        {children}
      </div>
    </div>
  );
});

GlassCard.displayName = 'GlassCard';
