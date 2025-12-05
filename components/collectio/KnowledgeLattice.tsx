import React, { memo } from 'react';
import { Grid3X3, Inbox } from 'lucide-react';
import { ShardCard } from './ShardCard';
import { Shard } from '../../hooks/useCollectio';

// ============================================================================
// KNOWLEDGE LATTICE COMPONENT
// Grid display for indexed shards with responsive masonry layout
// Premium minimalist aesthetic with staggered entry animations
// ============================================================================

interface KnowledgeLatticeProps {
  shards: Shard[];
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}

/**
 * Empty state display
 */
const EmptyLattice = memo(() => (
  <div className="
    flex flex-col items-center justify-center 
    py-20 px-8
    text-center
  ">
    <div className="
      w-16 h-16 mb-6
      flex items-center justify-center
      rounded-2xl
      bg-white/[0.02]
      border border-white/[0.04]
    ">
      <Inbox size={24} className="text-neutral-700" />
    </div>
    <h3 className="
      text-[13px] font-medium text-neutral-500 
      uppercase tracking-[0.2em]
      mb-2
    ">
      Empty Lattice
    </h3>
    <p className="text-[12px] text-neutral-600 max-w-xs leading-relaxed">
      Paste or type content into the Ingestion Deck above to begin building your knowledge lattice.
    </p>
  </div>
));

EmptyLattice.displayName = 'EmptyLattice';

export const KnowledgeLattice: React.FC<KnowledgeLatticeProps> = memo(({ 
  shards, 
  onDelete,
  onRetry 
}) => {
  if (shards.length === 0) {
    return <EmptyLattice />;
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 px-1">
        <Grid3X3 size={14} className="text-neutral-600" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">
          Knowledge Lattice
        </span>
        <span className="text-[10px] font-mono text-neutral-700 ml-auto">
          {shards.length} shard{shards.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid Layout */}
      <div className="
        grid 
        grid-cols-1 
        sm:grid-cols-2 
        lg:grid-cols-3
        gap-4
      ">
        {shards.map((shard, index) => (
          <ShardCard
            key={shard.id}
            shard={shard}
            onDelete={onDelete}
            onRetry={onRetry}
            index={index}
          />
        ))}
      </div>
    </div>
  );
});

KnowledgeLattice.displayName = 'KnowledgeLattice';
