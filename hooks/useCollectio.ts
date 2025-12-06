import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  indexText, 
  estimateTokens, 
  ShardMetadata,
  generateCollectionManifest,
  CollectionManifest,
  CollectionType
} from '../services/indexerService';
import { UsageMetadata, UsageSession } from '../types';
import { computeHash } from '../utils/cryptoUtils';

// ============================================================================
// COLLECTIO STATE MANAGEMENT
// Persistence layer for the Knowledge Lattice
// With Integrity & Safety Layer for large data handling
// ============================================================================

export type ShardStatus = 'pending' | 'indexing' | 'ready' | 'error';

export interface Shard {
  id: string;
  content: string;
  contentHash: string;
  tokenCount: number;
  timestamp: number;
  status: ShardStatus;
  metadata?: ShardMetadata;
  error?: string;
  /** Soft delete timestamp - if set, shard is marked for deletion */
  deletedAt?: number;
}

interface CollectioState {
  shards: Shard[];
  sessionStats: UsageSession;
}

const STORAGE_KEY = 'verbum_collectio';
const STATS_KEY = 'verbum_collectio_stats';
const SOFT_DELETE_TTL = 5000; // 5 seconds before permanent deletion

const DEFAULT_SESSION_STATS: UsageSession = {
  totalInput: 0,
  totalOutput: 0,
  estimatedCost: 0,
  requestCount: 0,
};

// Token pricing per 1M tokens for gemini-2.5-flash-lite
const FLASH_LITE_PRICING = { input: 0.075, output: 0.30 };

const calculateCost = (inputTokens: number, outputTokens: number): number => {
  const inputCost = (inputTokens / 1_000_000) * FLASH_LITE_PRICING.input;
  const outputCost = (outputTokens / 1_000_000) * FLASH_LITE_PRICING.output;
  return inputCost + outputCost;
};

export const useCollectio = (apiKey?: string) => {
  // Internal state includes soft-deleted items
  const [allShards, setAllShards] = useState<Shard[]>([]);
  const [sessionStats, setSessionStats] = useState<UsageSession>(DEFAULT_SESSION_STATS);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  
  // Storage & Integrity State
  const [storageError, setStorageError] = useState<string | null>(null);
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  
  // Selection State - Ghost Selection System
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Ref for prune timer
  const pruneTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const savedShards = localStorage.getItem(STORAGE_KEY);
      if (savedShards) {
        const parsed = JSON.parse(savedShards);
        // Re-hydrate any 'indexing' shards as 'pending' (they were interrupted)
        // Also filter out any previously soft-deleted items on reload
        const rehydrated = parsed
          .filter((shard: Shard) => !shard.deletedAt)
          .map((shard: Shard) => ({
            ...shard,
            status: shard.status === 'indexing' ? 'pending' : shard.status,
            // Ensure contentHash exists for legacy data
            contentHash: shard.contentHash || `legacy-${shard.id}`,
          }));
        setAllShards(rehydrated);
      }
      
      const savedStats = localStorage.getItem(STATS_KEY);
      if (savedStats) {
        setSessionStats(JSON.parse(savedStats));
      }
    } catch (e) {
      console.error('Failed to hydrate Collectio state:', e);
    }
    setIsHydrated(true);
  }, []);

  // Persist shards (debounced) with storage safeguards
  useEffect(() => {
    if (!isHydrated) return;
    
    const timer = setTimeout(() => {
      // Only persist non-deleted shards
      const shardsToSave = allShards.filter(s => !s.deletedAt);
      
      try {
        const serialized = JSON.stringify(shardsToSave);
        localStorage.setItem(STORAGE_KEY, serialized);
        // Clear any previous storage error on success
        if (storageError) setStorageError(null);
      } catch (e) {
        // Handle QuotaExceededError
        if (e instanceof DOMException && (
          e.name === 'QuotaExceededError' ||
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        )) {
          console.error('Storage quota exceeded:', e);
          setStorageError('Storage full. Data will not persist after refresh. Consider clearing old shards.');
        } else {
          console.error('Failed to persist shards:', e);
          setStorageError('Failed to save data. Changes may not persist.');
        }
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [allShards, isHydrated, storageError]);

  // Persist stats with safeguards
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(sessionStats));
    } catch (e) {
      // Stats are less critical, just log
      console.warn('Failed to persist stats:', e);
    }
  }, [sessionStats, isHydrated]);

  // Prune soft-deleted shards after TTL
  useEffect(() => {
    const hasDeletedShards = allShards.some(s => s.deletedAt);
    
    if (!hasDeletedShards) {
      if (pruneTimerRef.current) {
        clearInterval(pruneTimerRef.current);
        pruneTimerRef.current = null;
      }
      return;
    }

    // Start prune timer if not already running
    if (!pruneTimerRef.current) {
      pruneTimerRef.current = setInterval(() => {
        const now = Date.now();
        setAllShards(prev => {
          const pruned = prev.filter(s => 
            !s.deletedAt || (now - s.deletedAt) < SOFT_DELETE_TTL
          );
          // Only update if something was pruned
          return pruned.length !== prev.length ? pruned : prev;
        });
      }, 1000); // Check every second
    }

    return () => {
      if (pruneTimerRef.current) {
        clearInterval(pruneTimerRef.current);
        pruneTimerRef.current = null;
      }
    };
  }, [allShards]);

  // Update session stats with usage metadata
  const updateStats = useCallback((usageMetadata?: UsageMetadata) => {
    if (!usageMetadata) return;
    
    const cost = calculateCost(usageMetadata.promptTokens, usageMetadata.candidatesTokens);
    
    setSessionStats(prev => ({
      totalInput: prev.totalInput + usageMetadata.promptTokens,
      totalOutput: prev.totalOutput + usageMetadata.candidatesTokens,
      estimatedCost: prev.estimatedCost + cost,
      requestCount: prev.requestCount + 1,
    }));
  }, []);

  // Clear duplicate detected flag
  const clearDuplicateFlag = useCallback(() => {
    setDuplicateDetected(false);
  }, []);

  // Memoized unique domains derivation for taxonomic consistency
  // Only computes when allShards changes, filters out soft-deleted and non-ready shards
  const uniqueDomains = useMemo(() => {
    const domains = new Set<string>();
    for (const shard of allShards) {
      if (!shard.deletedAt && shard.status === 'ready' && shard.metadata?.domain) {
        // Normalize to Title Case for consistency
        const normalizedDomain = shard.metadata.domain
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        domains.add(normalizedDomain);
      }
    }
    // Sort alphabetically for consistent ordering, put "Uncategorized" last
    return Array.from(domains).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
  }, [allShards]);

  // Ingest new content with async hashing and deduplication
  const ingest = useCallback(async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    // Reset duplicate flag
    setDuplicateDetected(false);

    // Compute hash asynchronously (non-blocking for large strings)
    const contentHash = await computeHash(trimmedContent);

    // Check for duplicates in active (non-deleted) shards
    const existingShards = allShards.filter(s => !s.deletedAt);
    const isDuplicate = existingShards.some(s => s.contentHash === contentHash);
    
    if (isDuplicate) {
      console.warn('Duplicate content detected, skipping ingestion');
      setDuplicateDetected(true);
      // Auto-clear after 3 seconds
      setTimeout(() => setDuplicateDetected(false), 3000);
      return;
    }

    // Calculate token count once during ingestion
    const tokenCount = estimateTokens(trimmedContent);
    
    const newShard: Shard = {
      id: uuidv4(),
      content: trimmedContent,
      contentHash,
      tokenCount,
      timestamp: Date.now(),
      status: 'pending',
    };

    // Add to state immediately
    setAllShards(prev => [newShard, ...prev]);

    // Start indexing
    setAllShards(prev => 
      prev.map(s => s.id === newShard.id ? { ...s, status: 'indexing' } : s)
    );

    try {
      // Pass existing domains for taxonomic consistency
      const result = await indexText(trimmedContent, apiKey, uniqueDomains);
      
      setAllShards(prev => 
        prev.map(s => s.id === newShard.id ? { 
          ...s, 
          status: 'ready',
          metadata: result.metadata,
        } : s)
      );

      updateStats(result.usageMetadata);
    } catch (error) {
      console.error('Indexing failed:', error);
      setAllShards(prev => 
        prev.map(s => s.id === newShard.id ? { 
          ...s, 
          status: 'error',
          error: error instanceof Error ? error.message : 'Indexing failed',
        } : s)
      );
    }
  }, [apiKey, updateStats, allShards, uniqueDomains]);

  // Soft delete a shard (can be undone within TTL)
  const deleteShard = useCallback((id: string) => {
    setAllShards(prev => 
      prev.map(s => s.id === id ? { ...s, deletedAt: Date.now() } : s)
    );
  }, []);

  // Undo the most recent soft delete
  const undoDelete = useCallback(() => {
    setAllShards(prev => {
      // Find the most recently deleted shard
      const deletedShards = prev.filter(s => s.deletedAt);
      if (deletedShards.length === 0) return prev;
      
      const mostRecent = deletedShards.reduce((a, b) => 
        (a.deletedAt || 0) > (b.deletedAt || 0) ? a : b
      );
      
      return prev.map(s => 
        s.id === mostRecent.id ? { ...s, deletedAt: undefined } : s
      );
    });
  }, []);

  // Clear all shards (soft delete all)
  const clearAll = useCallback(() => {
    const now = Date.now();
    setAllShards(prev => 
      prev.map(s => s.deletedAt ? s : { ...s, deletedAt: now })
    );
  }, []);

  // Reset session stats
  const resetStats = useCallback(() => {
    setSessionStats(DEFAULT_SESSION_STATS);
  }, []);

  // Selection System - Toggle single shard selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all active (non-deleted, ready) shards
  const selectAll = useCallback(() => {
    const activeReadyIds = allShards
      .filter(s => !s.deletedAt && s.status === 'ready')
      .map(s => s.id);
    setSelectedIds(new Set(activeReadyIds));
  }, [allShards]);

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Retry indexing for a failed shard
  const retry = useCallback(async (id: string) => {
    const shard = allShards.find(s => s.id === id && !s.deletedAt);
    if (!shard) return;

    setAllShards(prev => 
      prev.map(s => s.id === id ? { ...s, status: 'indexing', error: undefined } : s)
    );

    try {
      // Pass existing domains for taxonomic consistency on retry
      const result = await indexText(shard.content, apiKey, uniqueDomains);
      
      setAllShards(prev => 
        prev.map(s => s.id === id ? { 
          ...s, 
          status: 'ready',
          metadata: result.metadata,
        } : s)
      );

      updateStats(result.usageMetadata);
    } catch (error) {
      console.error('Retry indexing failed:', error);
      setAllShards(prev => 
        prev.map(s => s.id === id ? { 
          ...s, 
          status: 'error',
          error: error instanceof Error ? error.message : 'Indexing failed',
        } : s)
      );
    }
  }, [allShards, apiKey, updateStats, uniqueDomains]);

  // Compile all shards to markdown with smart manifest generation
  // If selectedIds has items, compile ONLY selected shards; otherwise compile ALL ready shards
  const compile = useCallback(async (): Promise<{ markdown: string; manifest: CollectionManifest }> => {
    // Filter to active (non-deleted), ready shards
    let activeShards = allShards.filter(s => !s.deletedAt && s.status === 'ready' && s.metadata);
    
    // If selection exists, filter to only selected shards
    if (selectedIds.size > 0) {
      activeShards = activeShards.filter(s => selectedIds.has(s.id));
    }
    
    const fallbackManifest: CollectionManifest = {
      title: `Verbum Collection [${new Date().toISOString().split('T')[0]}]`,
      type: 'mixed',
      description: 'A curated collection of content fragments.',
      suggestedFilename: `verbum-collection-${Date.now()}`,
    };

    if (activeShards.length === 0) {
      return { markdown: '', manifest: fallbackManifest };
    }

    const totalTokens = activeShards.reduce((sum, s) => sum + s.tokenCount, 0);

    // Generate manifest by analyzing aggregate metadata
    // Use limited excerpt (500 chars) to avoid passing huge strings
    let manifest: CollectionManifest;
    try {
      const shardSummaries = activeShards.map(s => ({
        title: s.metadata!.title,
        domain: s.metadata!.domain,
        tags: s.metadata!.tags,
        excerpt: s.content.slice(0, 500).replace(/\n/g, ' '),
      }));

      const result = await generateCollectionManifest(shardSummaries, apiKey);
      manifest = result.manifest;
      
      // Update stats if we got usage metadata
      if (result.usageMetadata) {
        updateStats(result.usageMetadata);
      }
    } catch (error) {
      console.error('Manifest generation failed, using fallback:', error);
      manifest = fallbackManifest;
    }

    // Build markdown based on collection type
    let markdown = `# ${manifest.title}\n\n`;
    markdown += `> ${manifest.description}\n\n`;
    markdown += `**Type:** ${manifest.type} | **Shards:** ${activeShards.length} | **Tokens:** ${totalTokens.toLocaleString()}\n\n`;
    markdown += `## Table of Contents\n\n`;
    
    activeShards.forEach((shard, index) => {
      markdown += `${index + 1}. [${shard.metadata!.title}](#${index + 1}-${shard.metadata!.title.toLowerCase().replace(/\s+/g, '-')})\n`;
    });
    
    markdown += `\n---\n\n`;

    // Format content based on collection type
    activeShards.forEach((shard, index) => {
      const { title, domain, tags } = shard.metadata!;
      const tagsFormatted = tags.map(t => `#${t}`).join(' ');
      
      markdown += `## ${index + 1}. ${title}\n\n`;
      markdown += `**Domain:** ${domain} | **Tags:** ${tagsFormatted} | **Tokens:** ${shard.tokenCount.toLocaleString()}\n\n`;
      
      // Conditional formatting based on type
      if (manifest.type === 'codebase') {
        // Detect language hint from domain/tags
        const langHint = detectCodeLanguage(domain, tags);
        markdown += `\`\`\`${langHint}\n${shard.content}\n\`\`\`\n\n`;
      } else {
        markdown += `${shard.content}\n\n`;
      }
      
      if (index < activeShards.length - 1) {
        markdown += `---\n\n`;
      }
    });

    return { markdown, manifest };
  }, [allShards, apiKey, updateStats, selectedIds]);

  // Helper to detect code language from metadata
  const detectCodeLanguage = (domain: string, tags: string[]): string => {
    const allText = `${domain} ${tags.join(' ')}`.toLowerCase();
    
    if (allText.includes('typescript') || allText.includes('tsx')) return 'typescript';
    if (allText.includes('javascript') || allText.includes('jsx') || allText.includes('react')) return 'javascript';
    if (allText.includes('python')) return 'python';
    if (allText.includes('rust')) return 'rust';
    if (allText.includes('go') || allText.includes('golang')) return 'go';
    if (allText.includes('java')) return 'java';
    if (allText.includes('c++') || allText.includes('cpp')) return 'cpp';
    if (allText.includes('sql') || allText.includes('database')) return 'sql';
    if (allText.includes('bash') || allText.includes('shell')) return 'bash';
    if (allText.includes('css') || allText.includes('style')) return 'css';
    if (allText.includes('html')) return 'html';
    if (allText.includes('json')) return 'json';
    if (allText.includes('yaml') || allText.includes('yml')) return 'yaml';
    
    return ''; // No specific hint
  };

  // Active shards (filtered view for UI - excludes soft-deleted)
  const shards = allShards.filter(s => !s.deletedAt);
  
  // Check if there are recoverable (soft-deleted) shards
  const hasRecoverableShards = allShards.some(s => s.deletedAt);

  // Computed values (based on active shards only)
  const totalShards = shards.length;
  const readyShards = shards.filter(s => s.status === 'ready').length;
  const pendingShards = shards.filter(s => s.status === 'pending' || s.status === 'indexing').length;
  const totalTokens = shards.reduce((sum, s) => sum + s.tokenCount, 0);

  // Wrapped compile function with state management
  const compileWithState = useCallback(async () => {
    setIsCompiling(true);
    try {
      const result = await compile();
      return result;
    } finally {
      setIsCompiling(false);
    }
  }, [compile]);

  return {
    shards,
    sessionStats,
    isHydrated,
    isCompiling,
    
    // Integrity & Safety State
    storageError,
    duplicateDetected,
    hasRecoverableShards,
    
    // Domain taxonomy
    uniqueDomains,
    
    // Selection System
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    
    // Actions
    ingest,
    deleteShard,
    undoDelete,
    clearAll,
    resetStats,
    retry,
    compile: compileWithState,
    clearDuplicateFlag,
    
    // Computed
    totalShards,
    readyShards,
    pendingShards,
    totalTokens,
  };
};

// Re-export types for consumers
export type { CollectionManifest, CollectionType } from '../services/indexerService';
