import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  UsageMetadata, 
  UsageSession,
  ShardMetadata,
  CollectionManifest,
  CollectionType,
} from '../types';
import { indexText, generateCollectionManifest } from '../services/aiRouter';
import { calculateCostNano } from '../utils/pricing';
import { estimateTokens } from '../utils/tokens';
import { computeHash } from '../utils/cryptoUtils';
import {
  expireTransactions,
  hydrateCollectioState,
  persistCollectioState,
  persistCollectioStats,
} from './collectio/storage';
import {
  buildCollectionMarkdown,
  buildFallbackManifest,
} from './collectio/compiler';

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
  ingestSeq: number;
  tokenCount: number;
  timestamp: number;
  status: ShardStatus;
  metadata?: ShardMetadata;
  error?: string;
  /** Soft delete timestamp - if set, shard is marked for deletion */
  deletedAt?: number;
  deletedTxId?: string;
}

export type UndoTransactionKind = 'delete_one' | 'clear_all';
export type UndoTransactionStatus = 'open' | 'undone' | 'expired';

export interface UndoTransaction {
  id: string;
  kind: UndoTransactionKind;
  shardIds: string[];
  createdAt: number;
  expiresAt: number;
  status: UndoTransactionStatus;
}

export interface UndoState {
  canUndo: boolean;
  kind: UndoTransactionKind | null;
  affectedCount: number;
  expiresAt: number | null;
  msRemaining: number;
}

const SOFT_DELETE_TTL = 5000; // 5 seconds before permanent deletion

  const DEFAULT_SESSION_STATS: UsageSession = {
    totalInput: 0,
    totalOutput: 0,
    estimatedCost: 0,
    estimatedCostNano: '0',
    requestCount: 0,
  };

export const useCollectio = (apiKey?: string, provider: string = 'gemini', modelId?: string) => {
  // Internal state includes soft-deleted items
  const [allShards, setAllShards] = useState<Shard[]>([]);
  const [undoTransactions, setUndoTransactions] = useState<UndoTransaction[]>([]);
  const [sessionStats, setSessionStats] = useState<UsageSession>(DEFAULT_SESSION_STATS);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  
  // Storage & Integrity State
  const [storageError, setStorageError] = useState<string | null>(null);
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  
  // Selection State - Ghost Selection System
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Refs for undo scheduling and stale closure avoidance
  const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const allShardsRef = useRef<Shard[]>([]);
  const undoTransactionsRef = useRef<UndoTransaction[]>([]);
  const nextIngestSeqRef = useRef(1);

  useEffect(() => {
    allShardsRef.current = allShards;
  }, [allShards]);

  useEffect(() => {
    undoTransactionsRef.current = undoTransactions;
  }, [undoTransactions]);

  const expireDueTransactions = useCallback((now: number) => {
    const { shards, transactions } = expireTransactions(
      allShardsRef.current,
      undoTransactionsRef.current,
      now,
    );

    if (shards !== allShardsRef.current) {
      allShardsRef.current = shards;
      setAllShards(shards);
    }

    if (transactions !== undoTransactionsRef.current) {
      undoTransactionsRef.current = transactions;
      setUndoTransactions(transactions);
    }
  }, []);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const hydrated = hydrateCollectioState();
      setAllShards(hydrated.shards);
      setUndoTransactions(hydrated.transactions);
      nextIngestSeqRef.current = hydrated.nextIngestSeq;
      if (hydrated.sessionStats) setSessionStats(hydrated.sessionStats);
    } catch (e) {
      console.error('Failed to hydrate Collectio state:', e);
      nextIngestSeqRef.current = 1;
      setUndoTransactions([]);
    }
    setIsHydrated(true);
  }, []);

  // Persist shards and undo transactions (debounced) with storage safeguards
  useEffect(() => {
    if (!isHydrated) return;

    const timer = setTimeout(() => {
      const result = persistCollectioState(allShards, undoTransactions, nextIngestSeqRef.current);
      if (result.ok) {
        if (storageError) setStorageError(null);
      } else if (result.error === 'quota') {
        console.error('Storage quota exceeded while persisting Collectio state.');
        setStorageError('Storage full. Data will not persist after refresh. Consider clearing old shards.');
      } else {
        console.error('Failed to persist Collectio state.');
        setStorageError('Failed to save data. Changes may not persist.');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [allShards, undoTransactions, isHydrated, storageError]);

  // Persist stats with safeguards
  useEffect(() => {
    if (!isHydrated) return;
    try {
      persistCollectioStats(sessionStats);
    } catch (e) {
      // Stats are less critical, just log
      console.warn('Failed to persist stats:', e);
    }
  }, [sessionStats, isHydrated]);

  // Expire undo transactions using nearest-expiry scheduling
  useEffect(() => {
    if (!isHydrated) return;

    const now = Date.now();
    expireDueTransactions(now);

    const nearestExpiry = undoTransactions
      .filter(tx => tx.status === 'open')
      .reduce<number | null>((nearest, tx) => {
        if (nearest === null) return tx.expiresAt;
        return Math.min(nearest, tx.expiresAt);
      }, null);

    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    if (nearestExpiry !== null) {
      const delay = Math.max(0, nearestExpiry - now);
      expiryTimerRef.current = setTimeout(() => {
        expireDueTransactions(Date.now());
      }, delay);
    }

    return () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [undoTransactions, isHydrated, expireDueTransactions]);

  // Update session stats with usage metadata
  const updateStats = useCallback((usageMetadata?: UsageMetadata, actualCostNano?: string) => {
    if (!usageMetadata) return;
    const effectiveModelId = modelId || 'gemini-3.5-flash-lite';
    const inputTokens = usageMetadata.promptTokens;
    const outputTokens = usageMetadata.candidatesTokens;
    const costNano = calculateCostNano(
      effectiveModelId,
      inputTokens,
      outputTokens,
      usageMetadata.cachedPromptTokens ?? 0,
      usageMetadata.totalTokens
    );
    
    setSessionStats(prev => {
      const effectiveCostNano = actualCostNano ? BigInt(actualCostNano) : costNano;
      const nextNano = BigInt(prev.estimatedCostNano || '0') + effectiveCostNano;
      return {
        totalInput: prev.totalInput + usageMetadata.promptTokens,
        totalOutput: prev.totalOutput + usageMetadata.candidatesTokens,
        estimatedCost: Number(nextNano) / 1_000_000_000,
        estimatedCostNano: nextNano.toString(),
        requestCount: prev.requestCount + 1,
      };
    });
  }, [modelId]);

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

    const ingestSeq = nextIngestSeqRef.current;
    nextIngestSeqRef.current += 1;
    const ingestedAt = Date.now();

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
      ingestSeq,
      tokenCount,
      timestamp: ingestedAt,
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
      const result = await indexText(trimmedContent, provider, apiKey, uniqueDomains, modelId, uuidv4());
      
      setAllShards(prev => 
        prev.map(s => s.id === newShard.id ? { 
          ...s, 
          status: 'ready',
          metadata: result.metadata,
        } : s)
      );

      updateStats(result.usageMetadata, result.actualCostNano);
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
  }, [apiKey, allShards, modelId, provider, uniqueDomains, updateStats]);

  // Soft delete a shard (can be undone within TTL)
  const deleteShard = useCallback((id: string) => {
    const now = Date.now();
    const target = allShardsRef.current.find(s => s.id === id && !s.deletedAt);
    if (!target) return;

    const tx: UndoTransaction = {
      id: uuidv4(),
      kind: 'delete_one',
      shardIds: [id],
      createdAt: now,
      expiresAt: now + SOFT_DELETE_TTL,
      status: 'open',
    };

    setUndoTransactions(prev => [tx, ...prev]);
    setAllShards(prev =>
      prev.map(s => s.id === id ? { ...s, deletedAt: now, deletedTxId: tx.id } : s)
    );

    setSelectedIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Undo the most recent delete transaction
  const undoDelete = useCallback(() => {
    const now = Date.now();
    expireDueTransactions(now);

    const latestOpenTx = [...undoTransactionsRef.current]
      .filter(tx => tx.status === 'open' && tx.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!latestOpenTx) return;

    const txShardIds = new Set(latestOpenTx.shardIds);

    setAllShards(prev => {
      const activeHashes = new Set(
        prev
          .filter(s => !s.deletedAt)
          .map(s => s.contentHash)
      );

      const next: Shard[] = [];

      for (const shard of prev) {
        if (!txShardIds.has(shard.id) || shard.deletedTxId !== latestOpenTx.id || !shard.deletedAt) {
          next.push(shard);
          continue;
        }

        if (activeHashes.has(shard.contentHash)) {
          continue;
        }

        activeHashes.add(shard.contentHash);
        next.push({
          ...shard,
          deletedAt: undefined,
          deletedTxId: undefined,
        });
      }

      return next;
    });

    setUndoTransactions(prev =>
      prev.map(tx => tx.id === latestOpenTx.id ? { ...tx, status: 'undone' } : tx)
    );
  }, [expireDueTransactions]);

  // Clear all shards (soft delete all)
  const clearAll = useCallback(() => {
    const now = Date.now();
    const activeShardIds = allShardsRef.current
      .filter(s => !s.deletedAt)
      .map(s => s.id);
    if (activeShardIds.length === 0) return;

    const tx: UndoTransaction = {
      id: uuidv4(),
      kind: 'clear_all',
      shardIds: activeShardIds,
      createdAt: now,
      expiresAt: now + SOFT_DELETE_TTL,
      status: 'open',
    };

    setUndoTransactions(prev => [tx, ...prev]);
    setAllShards(prev =>
      prev.map(s => s.deletedAt ? s : { ...s, deletedAt: now, deletedTxId: tx.id })
    );
    setSelectedIds(new Set());
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

  const selectedReadyCount = useMemo(() => {
    if (selectedIds.size === 0) return 0;
    return allShards.filter(s => !s.deletedAt && s.status === 'ready' && selectedIds.has(s.id)).length;
  }, [allShards, selectedIds]);

  const orderShardsForCompilation = useCallback((shards: Shard[]) => {
    return [...shards].sort((a, b) => {
      if (a.ingestSeq !== b.ingestSeq) {
        return a.ingestSeq - b.ingestSeq;
      }
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.id.localeCompare(b.id);
    });
  }, []);

  const getCompileShards = useCallback(() => {
    let compileShards = allShards.filter(s => !s.deletedAt && s.status === 'ready' && s.metadata);
    if (selectedIds.size > 0) {
      compileShards = compileShards.filter(s => selectedIds.has(s.id));
    }
    return orderShardsForCompilation(compileShards);
  }, [allShards, selectedIds, orderShardsForCompilation]);

  const getSelectedReadyShards = useCallback(() => {
    if (selectedIds.size === 0) return [];
    const selected = allShards.filter(s => !s.deletedAt && s.status === 'ready' && selectedIds.has(s.id) && s.metadata);
    return orderShardsForCompilation(selected);
  }, [allShards, selectedIds, orderShardsForCompilation]);

  const getSelectedRawContent = useCallback(() => {
    if (selectedIds.size === 0) return { content: '', count: 0 };
    const selected = getSelectedReadyShards();
    const chunks = selected
      .map(s => s.content)
      .filter(text => text.trim().length > 0);
    return {
      content: chunks.join('\n\n---\n\n'),
      count: chunks.length,
    };
  }, [selectedIds.size, getSelectedReadyShards]);

  // Retry indexing for a failed shard
  const retry = useCallback(async (id: string) => {
    const shard = allShards.find(s => s.id === id && !s.deletedAt);
    if (!shard) return;

    setAllShards(prev => 
      prev.map(s => s.id === id ? { ...s, status: 'indexing', error: undefined } : s)
    );

    try {
      // Pass existing domains for taxonomic consistency on retry
      const result = await indexText(shard.content, provider, apiKey, uniqueDomains, modelId, uuidv4());
      
      setAllShards(prev => 
        prev.map(s => s.id === id ? { 
          ...s, 
          status: 'ready',
          metadata: result.metadata,
        } : s)
      );

      updateStats(result.usageMetadata, result.actualCostNano);
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
  }, [allShards, apiKey, modelId, provider, uniqueDomains, updateStats]);

  // Compile all shards to markdown with smart manifest generation
  // If selectedIds has items, compile ONLY selected shards; otherwise compile ALL ready shards
  const compile = useCallback(async (): Promise<{ markdown: string; manifest: CollectionManifest }> => {
    const activeShards = getCompileShards();
    
    const fallbackManifest = buildFallbackManifest();

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

      const result = await generateCollectionManifest(provider, shardSummaries, apiKey, modelId, uuidv4());
      manifest = result.manifest;
      
      // Update stats if we got usage metadata
      if (result.usageMetadata) {
        updateStats(result.usageMetadata, result.actualCostNano);
      }
    } catch (error) {
      console.error('Manifest generation failed, using fallback:', error);
      manifest = fallbackManifest;
    }

    const markdown = buildCollectionMarkdown(activeShards, manifest, totalTokens);

    return { markdown, manifest };
  }, [apiKey, getCompileShards, modelId, provider, updateStats]);

  // Active shards (filtered view for UI - excludes soft-deleted)
  const shards = allShards.filter(s => !s.deletedAt);

  const latestOpenUndoTransaction = useMemo(() => {
    const openTransactions = undoTransactions.filter(tx => tx.status === 'open');
    if (openTransactions.length === 0) return null;

    return openTransactions.reduce((latest, tx) => (
      tx.createdAt > latest.createdAt ? tx : latest
    ));
  }, [undoTransactions]);

  const undoState: UndoState = useMemo(() => {
    if (!latestOpenUndoTransaction) {
      return {
        canUndo: false,
        kind: null,
        affectedCount: 0,
        expiresAt: null,
        msRemaining: 0,
      };
    }

    const msRemaining = Math.max(0, latestOpenUndoTransaction.expiresAt - Date.now());
    return {
      canUndo: msRemaining > 0,
      kind: latestOpenUndoTransaction.kind,
      affectedCount: latestOpenUndoTransaction.shardIds.length,
      expiresAt: latestOpenUndoTransaction.expiresAt,
      msRemaining,
    };
  }, [latestOpenUndoTransaction]);

  // Backward-compatible boolean for existing UI branches
  const hasRecoverableShards = undoState.canUndo;

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
    undoState,
    
    // Domain taxonomy
    uniqueDomains,
    
    // Selection System
    selectedIds,
    selectedReadyCount,
    toggleSelection,
    selectAll,
    deselectAll,
    getSelectedRawContent,
    
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
export type { CollectionManifest, CollectionType } from '../types';
