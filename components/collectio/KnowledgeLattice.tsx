import React, { memo, useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { ShardCard } from './ShardCard';
import { Shard } from '../../hooks/useCollectio';

// ============================================================================
// KNOWLEDGE LATTICE COMPONENT
// Semantic domain grouping with Lattice Sector architecture
// Premium minimalist aesthetic with staggered mechanical assembly
// ============================================================================

interface KnowledgeLatticeProps {
  shards: Shard[];
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}

/**
 * Grouped shards by domain
 */
type GroupedShards = Record<string, Shard[]>;

/**
 * Format count with leading zeros for tabular display
 */
const formatCount = (n: number): string => n.toString().padStart(2, '0');

/**
 * Lattice Sector Header - Technical label aesthetic
 * Minimalist divider with embedded domain label
 */
const SectorHeader = memo<{ 
  domain: string; 
  count: number; 
  index: number;
}>(({ domain, count, index }) => {
  // Staggered animation delay based on sector index
  const animationDelay = `${index * 80}ms`;
  
  return (
    <div 
      className="
        flex items-center gap-4 mb-5
        opacity-0 animate-[fadeSlideIn_0.5s_ease-out_forwards]
      "
      style={{ animationDelay }}
    >
      {/* Leading line segment */}
      <div className="h-px flex-1 bg-white/[0.06]" />
      
      {/* Domain label cluster */}
      <div className="flex items-center gap-3">
        <span className="
          text-[10px] font-medium uppercase tracking-[0.25em]
          text-neutral-500
          select-none
        ">
          {domain}
        </span>
        <span className="
          text-[10px] font-mono tabular-nums
          text-neutral-700
          px-1.5 py-0.5
          bg-white/[0.02]
          border border-white/[0.04]
          rounded
        ">
          {formatCount(count)}
        </span>
      </div>
      
      {/* Trailing line segment */}
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
});

SectorHeader.displayName = 'SectorHeader';

/**
 * Lattice Sector - Domain grouping container
 * Contains header and grid of shards for a single domain
 */
const LatticeSector = memo<{
  domain: string;
  shards: Shard[];
  sectorIndex: number;
  globalOffset: number;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}>(({ domain, shards, sectorIndex, globalOffset, onDelete, onRetry, selectedIds, onToggleSelection }) => {
  // Staggered animation for entire sector
  const sectorDelay = `${sectorIndex * 100}ms`;
  
  return (
    <div 
      className="
        mb-10 last:mb-0
        opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]
      "
      style={{ animationDelay: sectorDelay }}
    >
      <SectorHeader 
        domain={domain} 
        count={shards.length} 
        index={sectorIndex}
      />
      
      {/* Shard Grid within Sector */}
      <div className="
        grid 
        grid-cols-1 
        sm:grid-cols-2 
        lg:grid-cols-3
        gap-4
      ">
        {shards.map((shard, localIndex) => (
          <ShardCard
            key={shard.id}
            shard={shard}
            onDelete={onDelete}
            onRetry={onRetry}
            index={globalOffset + localIndex}
            isSelected={selectedIds?.has(shard.id) ?? false}
            onToggleSelection={onToggleSelection}
          />
        ))}
      </div>
    </div>
  );
});

LatticeSector.displayName = 'LatticeSector';

/**
 * Empty state display
 */
const EmptyLattice = memo(() => (
  <div className="
    flex flex-col items-center justify-center 
    py-20 px-8
    text-center
    opacity-0 animate-[fadeIn_0.6s_ease-out_0.2s_forwards]
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

/**
 * Lattice Statistics Bar
 * Minimal telemetry display
 */
const LatticeStats = memo<{ 
  totalShards: number; 
  totalDomains: number;
}>(({ totalShards, totalDomains }) => (
  <div className="
    flex items-center justify-between
    mb-8 pb-4
    border-b border-white/[0.04]
  ">
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-600">
          Shards
        </span>
        <span className="text-[11px] font-mono tabular-nums text-neutral-400">
          {formatCount(totalShards)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-600">
          Domains
        </span>
        <span className="text-[11px] font-mono tabular-nums text-neutral-400">
          {formatCount(totalDomains)}
        </span>
      </div>
    </div>
    <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-neutral-700">
      Knowledge Lattice
    </span>
  </div>
));

LatticeStats.displayName = 'LatticeStats';

export const KnowledgeLattice: React.FC<KnowledgeLatticeProps> = memo(({ 
  shards, 
  onDelete,
  onRetry,
  selectedIds,
  onToggleSelection
}) => {
  // Memoized grouping logic - groups shards by domain
  // "Uncategorized" is always placed last
  const { groupedShards, sortedDomains } = useMemo(() => {
    const groups: GroupedShards = {};
    
    for (const shard of shards) {
      const domain = shard.metadata?.domain || 'Uncategorized';
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(shard);
    }
    
    // Sort domains alphabetically, with "Uncategorized" last
    const domains = Object.keys(groups).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
    
    // Sort shards within each group by timestamp (newest first)
    for (const domain of domains) {
      groups[domain].sort((a, b) => b.timestamp - a.timestamp);
    }
    
    return { groupedShards: groups, sortedDomains: domains };
  }, [shards]);

  if (shards.length === 0) {
    return <EmptyLattice />;
  }

  // Calculate global offset for staggered card animations
  let globalOffset = 0;

  return (
    <div className="w-full">
      <LatticeStats 
        totalShards={shards.length} 
        totalDomains={sortedDomains.length}
      />
      
      {/* Render Sectors */}
      {sortedDomains.map((domain, sectorIndex) => {
        const sectorShards = groupedShards[domain];
        const currentOffset = globalOffset;
        globalOffset += sectorShards.length;
        
        return (
          <LatticeSector
            key={domain}
            domain={domain}
            shards={sectorShards}
            sectorIndex={sectorIndex}
            globalOffset={currentOffset}
            onDelete={onDelete}
            onRetry={onRetry}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
          />
        );
      })}
    </div>
  );
});

KnowledgeLattice.displayName = 'KnowledgeLattice';
