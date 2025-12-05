import React, { memo, useState } from 'react';
import { Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { Shard } from '../../hooks/useCollectio';

// ============================================================================
// SHARD CARD COMPONENT
// Individual knowledge fragment display with loading/ready/error states
// Premium minimalist aesthetic with mechanical feedback
// ============================================================================

interface ShardCardProps {
  shard: Shard;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  index: number;
}

/**
 * Density visualization bar
 * Shows relative information density (token count based)
 */
const DensityBar = memo<{ tokens: number }>(({ tokens }) => {
  // Normalize to 0-100 (assuming max ~2000 tokens for a typical fragment)
  const density = Math.min(100, Math.round((tokens / 2000) * 100));
  
  return (
    <div className="w-16 h-1 bg-white/[0.04] rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-white/20 to-white/40 rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `${density}%` }}
      />
    </div>
  );
});

DensityBar.displayName = 'DensityBar';

/**
 * Loading skeleton for pending/indexing shards
 */
const ShardSkeleton = memo(() => (
  <div className="animate-pulse">
    <div className="flex items-center justify-between mb-3">
      <div className="h-3 w-20 bg-white/[0.06] rounded" />
      <div className="h-3 w-12 bg-white/[0.04] rounded" />
    </div>
    <div className="h-5 w-3/4 bg-white/[0.08] rounded mb-3" />
    <div className="flex items-center gap-3">
      <div className="h-2 w-16 bg-white/[0.04] rounded" />
      <div className="h-1 w-16 bg-white/[0.04] rounded-full" />
    </div>
  </div>
));

ShardSkeleton.displayName = 'ShardSkeleton';

/**
 * Error state display
 */
const ShardError = memo<{ message?: string; onRetry: () => void }>(({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-2 gap-2">
    <AlertCircle size={16} className="text-red-400/70" />
    <span className="text-[10px] text-red-400/70 uppercase tracking-wider">
      {message || 'Indexing Failed'}
    </span>
    <button
      onClick={onRetry}
      className="
        flex items-center gap-1.5 px-3 py-1.5 
        text-[10px] uppercase tracking-wider
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

export const ShardCard: React.FC<ShardCardProps> = memo(({ 
  shard, 
  onDelete, 
  onRetry,
  index 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const isLoading = shard.status === 'pending' || shard.status === 'indexing';
  const isError = shard.status === 'error';
  const isReady = shard.status === 'ready' && shard.metadata;

  // Staggered animation delay
  const animationDelay = `${Math.min(index * 50, 300)}ms`;

  return (
    <div
      style={{ animationDelay }}
      className="
        opacity-0 animate-[fadeSlideIn_400ms_cubic-bezier(0.16,1,0.3,1)_forwards]
      "
    >
      <GlassCard
        hoverEffect
        isActive={isHovered}
        className="relative group"
      >
        <div
          className="p-4"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Delete Button - Appears on hover */}
          <button
            onClick={() => onDelete(shard.id)}
            className="
              absolute top-3 right-3
              p-1.5 rounded-md
              opacity-0 group-hover:opacity-100
              text-neutral-600 hover:text-red-400
              bg-transparent hover:bg-red-500/10
              border border-transparent hover:border-red-500/20
              transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
              transform translate-y-1 group-hover:translate-y-0
            "
            title="Delete Shard"
          >
            <Trash2 size={12} />
          </button>

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
            <>
              {/* Domain Badge & Token Count */}
              <div className="flex items-center justify-between mb-3">
                <span 
                  className="
                    text-[10px] font-mono uppercase tracking-[0.15em]
                    text-neutral-500 
                    px-2 py-0.5 
                    bg-white/[0.04] 
                    border border-white/[0.06]
                    rounded
                  "
                >
                  [{shard.metadata.domain}]
                </span>
                <span className="text-[10px] font-mono text-neutral-600 tabular-nums">
                  {shard.tokenCount.toLocaleString()} tokens
                </span>
              </div>

              {/* Title */}
              <h3 className="
                text-[15px] font-medium text-neutral-200 
                leading-snug mb-3
                line-clamp-2
              ">
                {shard.metadata.title}
              </h3>

              {/* Tags & Density Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {shard.metadata.tags.map((tag, i) => (
                    <span 
                      key={i}
                      className="
                        text-[9px] font-mono text-neutral-600
                        uppercase tracking-wider
                      "
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <DensityBar tokens={shard.tokenCount} />
              </div>

              {/* Hover Reveal - Abstract */}
              <div 
                className={`
                  overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                  ${isHovered ? 'max-h-20 opacity-100 mt-3 pt-3 border-t border-white/[0.04]' : 'max-h-0 opacity-0 mt-0 pt-0 border-t-0'}
                `}
              >
                <p className="text-[11px] text-neutral-500 italic leading-relaxed">
                  {shard.metadata.abstract}
                </p>
              </div>
            </>
          )}
        </div>
      </GlassCard>
    </div>
  );
});

ShardCard.displayName = 'ShardCard';
