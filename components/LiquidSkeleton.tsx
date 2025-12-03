import React, { useMemo } from 'react';
import { GlassCard } from './GlassCard';

// ============================================================================
// DESIGN SYSTEM: Premium Matte Skeleton
// Calm, minimal, deeply integrated placeholder for TranslationItem
// Aesthetic: Quiet, professional, premium — never flashy or attention-grabbing
// ============================================================================

// Golden Ratio for harmonious proportions
const PHI_INV = 0.618033988749;

// Line configurations matching TranslationItem typography
const LINE_CONFIGS = {
  short: [
    { width: '70%', height: 20, isMain: true },
  ],
  medium: [
    { width: '100%', height: 20, isMain: true },
    { width: '55%', height: 12, isMain: false },
  ],
  paragraph: [
    { width: '100%', height: 20, isMain: true },
    { width: '92%', height: 12, isMain: false },
    { width: `${PHI_INV * 100}%`, height: 12, isMain: false },
  ],
};

// Stagger delays - logarithmic for organic feel
const getStaggerDelay = (index: number): number => {
  return Math.round(120 * Math.log2(index + 2));
};

// ============================================================================
// Types
// ============================================================================
interface LiquidSkeletonProps {
  /** Estimated character length for adaptive rendering */
  estimatedLength?: number;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Bone Primitive
// Matte, low-contrast placeholder element
// ============================================================================
interface BoneProps {
  width: string;
  height: number;
  delay?: number;
  isMain?: boolean;
  variant?: 'default' | 'pill' | 'circle';
}

const Bone: React.FC<BoneProps> = ({
  width,
  height,
  delay = 0,
  isMain = false,
  variant = 'default',
}) => {
  const staggerDelay = getStaggerDelay(delay);
  const borderRadius = variant === 'pill' ? 6 : variant === 'circle' ? '50%' : height / 2;
  
  // Main lines slightly more present, secondary lines softer
  const opacity = isMain ? 0.5 : 0.35;
  
  return (
    <div
      className="skeleton-bone relative overflow-hidden"
      style={{
        width: variant === 'circle' ? height : width,
        height,
        borderRadius,
        // Matte, soft appearance
        background: `linear-gradient(
          135deg,
          rgba(255,255,255,${opacity * 0.08}) 0%,
          rgba(255,255,255,${opacity * 0.04}) 100%
        )`,
        // Subtle inset for depth without shine
        boxShadow: `
          inset 0 1px 0 0 rgba(255,255,255,0.03),
          inset 0 -1px 0 0 rgba(0,0,0,0.08)
        `,
        border: '1px solid rgba(255,255,255,0.02)',
      }}
    >
      {/* Gentle breathing animation */}
      <div 
        className="absolute inset-0 animate-skeleton-breathe"
        style={{
          animationDelay: `${staggerDelay}ms`,
          background: `radial-gradient(
            ellipse 100% 100% at 50% 50%,
            rgba(255,255,255,0.02) 0%,
            transparent 70%
          )`,
          borderRadius,
        }}
      />
      
      {/* Slow, subtle flow effect */}
      <div 
        className="absolute inset-0 overflow-hidden"
        style={{ borderRadius }}
      >
        <div
          className="absolute inset-y-0 w-[200%] left-0 animate-skeleton-flow"
          style={{
            animationDelay: `${staggerDelay + 500}ms`,
            background: `linear-gradient(
              90deg,
              transparent 0%,
              transparent 40%,
              rgba(255,255,255,0.015) 50%,
              transparent 60%,
              transparent 100%
            )`,
          }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Circle Bone (Action button placeholders)
// Visually simpler, clearly non-interactive
// ============================================================================
const CircleBone: React.FC<{ delay: number; size?: number }> = ({ 
  delay, 
  size = 32 
}) => {
  const staggerDelay = getStaggerDelay(delay);
  
  return (
    <div
      className="skeleton-bone relative rounded-full"
      style={{
        width: size,
        height: size,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.025)',
      }}
    >
      {/* Very subtle breathing */}
      <div 
        className="absolute inset-0 rounded-full animate-skeleton-breathe"
        style={{
          animationDelay: `${staggerDelay}ms`,
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.015) 0%, transparent 70%)',
        }}
      />
    </div>
  );
};

// ============================================================================
// Ambient Layer
// Nearly imperceptible depth and atmosphere
// ============================================================================
const AmbientLayer: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      {/* Very subtle ambient light - barely visible */}
      <div 
        className="absolute inset-[-20%] animate-skeleton-drift"
        style={{
          background: `
            radial-gradient(ellipse 50% 40% at 30% 30%, rgba(255,255,255,0.012) 0%, transparent 50%),
            radial-gradient(ellipse 40% 50% at 70% 70%, rgba(255,255,255,0.008) 0%, transparent 50%)
          `,
        }}
      />
      
      {/* Edge darkening for depth - very subtle */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.06) 100%)',
        }}
      />
    </div>
  );
};

// ============================================================================
// Get Line Configuration
// Adaptive based on estimated content length
// ============================================================================
const getLineConfig = (estimatedLength?: number) => {
  if (estimatedLength !== undefined && estimatedLength < 60) {
    return LINE_CONFIGS.short;
  }
  if (estimatedLength !== undefined && estimatedLength < 120) {
    return LINE_CONFIGS.medium;
  }
  return LINE_CONFIGS.paragraph;
};

// ============================================================================
// Main Component: LiquidSkeleton
// Ghost of TranslationItem — same layout, muted presence
// ============================================================================
export const LiquidSkeleton: React.FC<LiquidSkeletonProps> = ({
  estimatedLength,
  className = '',
}) => {
  const lines = useMemo(() => getLineConfig(estimatedLength), [estimatedLength]);
  
  return (
    <div
      className={`group mb-4 ${className}`}
      aria-hidden="true"
      aria-label="Loading translation"
      role="status"
    >
      <GlassCard className="relative" hoverEffect={false} muted={true}>
        {/* Ambient atmosphere - nearly imperceptible */}
        <AmbientLayer />
        
        {/* Content Layer - matches TranslationItem exactly */}
        <div className="p-6 relative z-10">
          {/* ============================================
              Header: Language Pill + Timestamp + Actions
              Matches TranslationItem header pixel-perfect
              ============================================ */}
          <div className="flex justify-between items-start mb-4">
            {/* Left: Language chip + timestamp */}
            <div className="flex items-center gap-3">
              {/* Language pill - 80px width, 22px height to match LanguageChip */}
              <Bone
                width="80px"
                height={22}
                delay={0}
                variant="pill"
              />
              {/* Timestamp - ~48px for "00:00" format */}
              <Bone
                width="36px"
                height={12}
                delay={1}
              />
            </div>
            
            {/* Right: Action buttons (4 circles) */}
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((idx) => (
                <CircleBone key={idx} delay={idx + 2} size={32} />
              ))}
            </div>
          </div>

          {/* ============================================
              Body: Text line placeholders
              Matches TranslationItem body typography
              ============================================ */}
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <Bone
                key={idx}
                width={line.width}
                height={line.height}
                delay={6 + idx}
                isMain={line.isMain}
              />
            ))}
          </div>
        </div>
        
        {/* Top-left ambient glow - extremely subtle */}
        <div
          className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top left, rgba(255,255,255,0.008) 0%, transparent 60%)',
          }}
        />
      </GlassCard>
    </div>
  );
};

export default LiquidSkeleton;
