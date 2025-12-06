import React, { memo, useState, useCallback } from 'react';
import { Trash2, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { Shard } from '../../hooks/useCollectio';

// ============================================================================
// SHARD CARD COMPONENT
// Individual knowledge fragment display with loading/ready/error states
// Premium minimalist aesthetic with Ghost Selection system
// Redesigned layout: Action Zone top-right, Metadata anchored to footer
// ============================================================================

interface ShardCardProps {
  shard: Shard;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  index: number;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

/**
 * Density visualization bar
 * Shows relative information density (token count based)
 */
const DensityBar = memo<{ tokens: number }>(({ tokens }) => {
  // Normalize to 0-100 (assuming max ~2000 tokens for a typical fragment)
  const density = Math.min(100, Math.round((tokens / 2000) * 100));
  
  return (
    <div className="w-14 h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-white/20 to-white/40 rounded-full"
        style={{ 
          width: `${density}%`,
          transition: 'width 700ms cubic-bezier(0.16,1,0.3,1)',
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
    {/* Title placeholder */}
    <div className="h-5 w-3/4 bg-white/[0.08] rounded mb-4" />
    
    {/* Abstract placeholder */}
    <div className="space-y-2 mb-4">
      <div className="h-3 w-full bg-white/[0.05] rounded" />
      <div className="h-3 w-2/3 bg-white/[0.05] rounded" />
    </div>
    
    {/* Footer placeholder */}
    <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
      <div className="h-4 w-24 bg-white/[0.06] rounded" />
      <div className="h-3 w-16 bg-white/[0.04] rounded" />
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
      className="
        flex items-center gap-1.5 px-4 py-2 
        text-[10px] uppercase tracking-[0.12em] font-medium
        text-neutral-400 bg-white/[0.04]
        border border-white/[0.08] rounded-md
        hover:text-white hover:bg-white/[0.08]
        transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
      "
    >
      <RefreshCw size={10} />
      Retry
    </button>
  </div>
));

ShardError.displayName = 'ShardError';

/**
 * Action Zone - Contains Selection Ring and Delete Button
 * Positioned as a unified group in the top-right corner
 * Uses pointer-events-none so clicks fall through to card (selection)
 * Delete button uses pointer-events-auto to remain interactive
 */
const ActionZone = memo<{
  isSelected: boolean;
  isVisible: boolean;
  onDelete: (e: React.MouseEvent) => void;
}>(({ isSelected, isVisible, onDelete }) => (
  <div 
    className="
      absolute top-3 right-3 z-40
      flex items-center gap-2
      pointer-events-none
    "
  >
    {/* Delete Button - explicitly interactive */}
    <button
      onClick={onDelete}
      className={`
        p-1.5 rounded-md
        text-neutral-600 hover:text-red-400
        bg-transparent hover:bg-red-500/10
        border border-transparent hover:border-red-500/20
        transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        transform-gpu
        ${isVisible 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 translate-y-1 pointer-events-none'
        }
      `}
      title="Delete Shard"
    >
      <Trash2 size={12} />
    </button>

    {/* Selection Ring - purely visual, clicks pass through to card */}
    <div 
      className={`
        w-[16px] h-[16px]
        rounded-full
        flex items-center justify-center
        transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        transform-gpu
        ${isSelected 
          ? 'bg-white border-2 border-white opacity-100 scale-100' 
          : isVisible 
            ? 'bg-transparent border-2 border-white/25 opacity-100 scale-100' 
            : 'bg-transparent border-2 border-white/10 opacity-0 scale-75'
        }
      `}
    >
      {isSelected && (
        <Check size={9} className="text-black" strokeWidth={3} />
      )}
    </div>
  </div>
));

ActionZone.displayName = 'ActionZone';

/**
 * Footer Metadata - Domain Badge, Token Count, Density Bar
 * Anchored to the bottom of the card
 */
const FooterMetadata = memo<{
  domain: string;
  tokenCount: number;
  tags: string[];
}>(({ domain, tokenCount, tags }) => (
  <div className="
    pt-3 mt-3
    border-t border-white/[0.04]
    flex items-center justify-between gap-3
  ">
    {/* Left: Domain + Tags */}
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <span 
        className="
          shrink-0
          text-[9px] font-mono uppercase tracking-[0.12em]
          text-neutral-500 
          px-1.5 py-0.5 
          bg-white/[0.03] 
          border border-white/[0.05]
          rounded
        "
      >
        {domain}
      </span>
      
      {/* Tags - Hidden on very small cards, shown when space allows */}
      <div className="hidden sm:flex items-center gap-1 overflow-hidden">
        {tags.slice(0, 2).map((tag, i) => (
          <span 
            key={i}
            className="
              text-[8px] font-mono text-neutral-600
              uppercase tracking-wider
              truncate
            "
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
));

FooterMetadata.displayName = 'FooterMetadata';

export const ShardCard: React.FC<ShardCardProps> = memo(({ 
  shard, 
  onDelete, 
  onRetry,
  index,
  isSelected = false,
  onToggleSelection
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const isLoading = shard.status === 'pending' || shard.status === 'indexing';
  const isError = shard.status === 'error';
  const isReady = shard.status === 'ready' && shard.metadata;

  // Staggered animation delay
  const animationDelay = `${Math.min(index * 50, 300)}ms`;

  // Handle card click for selection (only when ready)
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger selection if clicking buttons
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

  // Determine if action zone should be visible
  const showActions = isHovered || isSelected;

  return (
    <div
      style={{ animationDelay }}
      className="
        opacity-0 animate-[fadeSlideIn_400ms_cubic-bezier(0.16,1,0.3,1)_forwards]
      "
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GlassCard
        hoverEffect
        isActive={isHovered}
        isSelected={isSelected}
        className="relative cursor-pointer"
        // Event handler on GlassCard root - entire card surface triggers selection
        onClick={handleCardClick}
        // Accessibility: card behaves as interactive element when selectable
        role={isReady && onToggleSelection ? 'button' : undefined}
        tabIndex={isReady && onToggleSelection ? 0 : undefined}
        aria-pressed={isReady && onToggleSelection ? isSelected : undefined}
        onKeyDown={isReady && onToggleSelection ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleSelection?.(shard.id);
          }
        } : undefined}
      >
        {/* Action Zone - Unified top-right controls (pointer-events pass-through) */}
        {isReady && (
          <ActionZone
            isSelected={isSelected}
            isVisible={showActions}
            onDelete={handleDelete}
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

        {/* Ready State - Main Content */}
        {isReady && (
          <div className="p-4">
            {/* Title - Primary content, with right padding for action zone */}
            <h3 className="
              text-[15px] font-medium text-neutral-200 
              leading-snug mb-2
              pr-16
              line-clamp-2
            ">
              {shard.metadata.title}
            </h3>

            {/* Abstract - Always visible, muted */}
            <p className="
              text-[11px] text-neutral-500 
              leading-relaxed
              line-clamp-2
              mb-1
            ">
              {shard.metadata.abstract}
            </p>

            {/* Footer: Domain, Tags, Token Count, Density */}
            <FooterMetadata
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
