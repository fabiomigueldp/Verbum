import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Trash2, RefreshCw, AlertCircle, Check, Copy } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { Shard } from '../../hooks/useCollectio';

// ============================================================================
// SHARD CARD COMPONENT - "Breathing" Design
// Individual knowledge fragment with physics-based hover expansion
// Premium Apple-like micro-interactions: grid transition, hover intent
// Monochromatic aesthetic with 60fps animations
// ============================================================================

interface ShardCardProps {
  shard: Shard;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  index: number;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

// Premium easing: fast start, soft landing (mechanical feel)
const PREMIUM_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Density visualization bar
 * Shows relative information density (token count based)
 */
const DensityBar = memo<{ tokens: number }>(({ tokens }) => {
  const density = Math.min(100, Math.round((tokens / 2000) * 100));
  
  return (
    <div className="w-14 h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-white/20 to-white/40 rounded-full transform-gpu"
        style={{ 
          width: `${density}%`,
          transition: `width 700ms ${PREMIUM_EASE}`,
        }}
      />
    </div>
  );
});

DensityBar.displayName = 'DensityBar';

/**
 * Loading skeleton for pending/indexing shards
 */
const ShardSkeleton = memo(() => (
  <div className="animate-pulse p-4">
    <div className="h-5 w-3/4 bg-white/[0.08] rounded mb-3" />
    <div className="space-y-2 mb-3">
      <div className="h-3 w-full bg-white/[0.05] rounded" />
      <div className="h-3 w-2/3 bg-white/[0.05] rounded" />
    </div>
  </div>
));

ShardSkeleton.displayName = 'ShardSkeleton';

/**
 * Error state display
 */
const ShardError = memo<{ message?: string; onRetry: () => void }>(({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-6 px-4 gap-3">
    <AlertCircle size={18} className="text-red-400/60" />
    <span className="text-[10px] text-red-400/70 uppercase tracking-[0.15em] text-center">
      {message || 'Indexing Failed'}
    </span>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRetry();
      }}
      className={`
        flex items-center gap-1.5 px-4 py-2 
        text-[10px] uppercase tracking-[0.12em] font-medium
        text-neutral-400 bg-white/[0.04]
        border border-white/[0.08] rounded-md
        hover:text-white hover:bg-white/[0.08]
        transition-all duration-300
      `}
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      <RefreshCw size={10} />
      Retry
    </button>
  </div>
));

ShardError.displayName = 'ShardError';

/**
 * Action Zone - Contains Selection Ring and Delete Button
 * Uses pointer-events-none so clicks fall through to card
 */
const ActionZone = memo<{
  isSelected: boolean;
  isVisible: boolean;
  onDelete: (e: React.MouseEvent) => void;
  onCopy: (e: React.MouseEvent) => void;
  copied: boolean;
}>(({ isSelected, isVisible, onDelete, onCopy, copied }) => (
  <div className="absolute top-3 right-3 z-40 flex items-center gap-2 pointer-events-none">
    {/* Copy Button */}
    <button
      onClick={onCopy}
      className={`
        p-1.5 rounded-md transform-gpu
        ${copied
          ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
          : 'text-neutral-600 hover:text-neutral-200 bg-transparent hover:bg-white/5 border border-transparent'
        }
        transition-all duration-300
        ${isVisible 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 translate-y-1 pointer-events-none'
        }
      `}
      style={{ transitionTimingFunction: PREMIUM_EASE }}
      title={copied ? 'Copied' : 'Copy Raw'}
    >
      {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
    </button>

    {/* Delete Button */}
    <button
      onClick={onDelete}
      className={`
        p-1.5 rounded-md transform-gpu
        text-neutral-600 hover:text-red-400
        bg-transparent hover:bg-red-500/10
        border border-transparent hover:border-red-500/20
        transition-all duration-300
        ${isVisible 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 translate-y-1 pointer-events-none'
        }
      `}
      style={{ transitionTimingFunction: PREMIUM_EASE }}
      title="Delete Shard"
    >
      <Trash2 size={12} />
    </button>

    {/* Selection Ring */}
    <div 
      className={`
        w-[16px] h-[16px] rounded-full
        flex items-center justify-center
        transition-all duration-300 transform-gpu
        ${isSelected 
          ? 'bg-white border-2 border-white opacity-100 scale-100' 
          : isVisible 
            ? 'bg-transparent border-2 border-white/25 opacity-100 scale-100' 
            : 'bg-transparent border-2 border-white/10 opacity-0 scale-75'
        }
      `}
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      {isSelected && <Check size={9} className="text-black" strokeWidth={3} />}
    </div>
  </div>
));

ActionZone.displayName = 'ActionZone';

/**
 * Collapsible Footer - Uses CSS Grid trick for smooth height animation
 * grid-template-rows: 0fr -> 1fr enables fluid expansion
 */
const CollapsibleFooter = memo<{
  isExpanded: boolean;
  domain: string;
  tokenCount: number;
  tags: string[];
}>(({ isExpanded, domain, tokenCount, tags }) => (
  <div 
    className="grid transition-all duration-500 transform-gpu"
    style={{ 
      gridTemplateRows: isExpanded ? '1fr' : '0fr',
      transitionTimingFunction: PREMIUM_EASE,
      // Hover intent: delay expansion to prevent jitter
      transitionDelay: isExpanded ? '75ms' : '0ms',
    }}
  >
    <div className="overflow-hidden">
      <div className="pt-3 mt-2 border-t border-white/[0.04] flex items-center justify-between gap-3">
        {/* Left: Domain + Tags */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="
            shrink-0 text-[9px] font-mono uppercase tracking-[0.12em]
            text-neutral-500 px-1.5 py-0.5 
            bg-white/[0.03] border border-white/[0.05] rounded
          ">
            {domain}
          </span>
          
          <div className="hidden sm:flex items-center gap-1.5 overflow-hidden">
            {tags.slice(0, 2).map((tag, i) => (
              <span 
                key={i}
                className="text-[8px] font-mono text-neutral-600 uppercase tracking-wider truncate"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
        
        {/* Right: Token Count + Density */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[9px] font-mono text-neutral-600 tabular-nums">
            {tokenCount.toLocaleString()}
          </span>
          <DensityBar tokens={tokenCount} />
        </div>
      </div>
    </div>
  </div>
));

CollapsibleFooter.displayName = 'CollapsibleFooter';

export const ShardCard: React.FC<ShardCardProps> = memo(({ 
  shard, 
  onDelete, 
  onRetry,
  index,
  isSelected = false,
  onToggleSelection
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  
  const isLoading = shard.status === 'pending' || shard.status === 'indexing';
  const isError = shard.status === 'error';
  const isReady = shard.status === 'ready' && shard.metadata;

  // Staggered animation delay for entrance
  const animationDelay = `${Math.min(index * 50, 300)}ms`;

  // Expansion state: hover OR selected
  const isExpanded = isHovered || isSelected;

  // Handle card click for selection
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    
    if (isReady && onToggleSelection) {
      onToggleSelection(shard.id);
    }
  }, [isReady, onToggleSelection, shard.id]);

  // Handle delete with event stop
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(shard.id);
  }, [onDelete, shard.id]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!shard.content) return;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shard.content);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shard.content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopied(true);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed', err);
    }
  }, [shard.content]);

  // Action zone visibility
  const showActions = isHovered || isSelected;

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{ animationDelay }}
      className={`
        opacity-0 animate-[fadeSlideIn_400ms_forwards]
        transition-[z-index] duration-0
        ${isExpanded ? 'z-10 relative' : 'z-0'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GlassCard
        hoverEffect
        isActive={isHovered}
        isSelected={isSelected}
        className="relative cursor-pointer"
        onClick={handleCardClick}
        role={isReady && onToggleSelection ? 'button' : undefined}
        tabIndex={isReady && onToggleSelection ? 0 : undefined}
        aria-pressed={isReady && onToggleSelection ? isSelected : undefined}
        aria-expanded={isReady ? isExpanded : undefined}
        onKeyDown={isReady && onToggleSelection ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleSelection?.(shard.id);
          }
        } : undefined}
        // Enhanced border/shadow on expansion
        borderIntensity={isExpanded ? 0.15 : undefined}
        style={{
          // Elevated shadow when expanded
          boxShadow: isExpanded 
            ? '0 0 40px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)'
            : undefined,
          transition: `box-shadow 500ms ${PREMIUM_EASE}`,
        }}
      >
        {/* Action Zone */}
        {isReady && (
          <ActionZone
            isSelected={isSelected}
            isVisible={showActions}
            onDelete={handleDelete}
            onCopy={handleCopy}
            copied={copied}
          />
        )}

        {/* Loading State */}
        {isLoading && <ShardSkeleton />}

        {/* Error State */}
        {isError && (
          <ShardError 
            message={shard.error} 
            onRetry={() => onRetry(shard.id)} 
          />
        )}

        {/* Ready State - Breathing Content */}
        {isReady && (
          <div className="p-4">
            {/* Title - Always visible, clamped */}
            <h3 className="
              text-[15px] font-medium text-neutral-200 
              leading-snug mb-2 pr-16 line-clamp-2
            ">
              {shard.metadata.title}
            </h3>

            {/* Abstract - Expands on hover via grid trick */}
            <div 
              className="grid transition-all duration-500 transform-gpu"
              style={{ 
                gridTemplateRows: isExpanded ? '1fr' : '0fr',
                transitionTimingFunction: PREMIUM_EASE,
                transitionDelay: isExpanded ? '50ms' : '0ms',
              }}
            >
              <div className="overflow-hidden">
                {/* Idle: 2 lines clamped, Hover: full text */}
                <p className={`
                  text-[11px] text-neutral-500 leading-relaxed
                  transition-all duration-400
                  ${isExpanded ? '' : 'line-clamp-2'}
                `}>
                  {shard.metadata.abstract}
                </p>
              </div>
            </div>

            {/* Collapsed preview (idle state) */}
            {!isExpanded && (
              <p className="
                text-[11px] text-neutral-500 leading-relaxed
                line-clamp-2 mb-1
              ">
                {shard.metadata.abstract}
              </p>
            )}

            {/* Footer - Slides in on hover */}
            <CollapsibleFooter
              isExpanded={isExpanded}
              domain={shard.metadata.domain}
              tokenCount={shard.tokenCount}
              tags={shard.metadata.tags}
            />
          </div>
        )}
      </GlassCard>
    </div>
  );
});

ShardCard.displayName = 'ShardCard';
