import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  estimateTokens, 
  ShardMetadata,
  CollectionManifest,
  CollectionType
} from '../services/indexerService';
import { indexText, generateCollectionManifest } from '../services/aiRouter';
import { UsageMetadata, UsageSession, XAI_MODEL_ID } from '../types';
import { calculateCostNano } from '../utils/pricing';
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

interface CollectioState {
  shards: Shard[];
  sessionStats: UsageSession;
}

const STORAGE_KEY = 'verbum_collectio';
const STORAGE_KEY_V2 = 'verbum_collectio_v2';
const STATS_KEY = 'verbum_collectio_stats';
const SOFT_DELETE_TTL = 5000; // 5 seconds before permanent deletion

interface PersistedCollectioV2 {
  version: 2;
  shards: Shard[];
  undoTransactions: UndoTransaction[];
  nextIngestSeq: number;
}

const normalizeShard = (shard: Shard): Shard => ({
  ...shard,
  status: shard.status === 'indexing' ? 'pending' : shard.status,
  contentHash: shard.contentHash || `legacy-${shard.id}`,
});

const expireTransactions = (
  shards: Shard[],
  transactions: UndoTransaction[],
  now: number
) => {
  const expiredTxIds = new Set(
    transactions
      .filter(tx => tx.status === 'open' && tx.expiresAt <= now)
      .map(tx => tx.id)
  );

  if (expiredTxIds.size === 0) {
    return { shards, transactions };
  }

  const expiredShardIds = new Set<string>();
  for (const tx of transactions) {
    if (expiredTxIds.has(tx.id)) {
      for (const shardId of tx.shardIds) {
        expiredShardIds.add(shardId);
      }
    }
  }

  const nextShards = shards.filter(shard => {
    if (!shard.deletedAt) return true;
    if (!shard.deletedTxId) return false;
    return !expiredShardIds.has(shard.id);
  });

  const nextTransactions = transactions.map(tx => (
    expiredTxIds.has(tx.id) ? { ...tx, status: 'expired' as const } : tx
  ));

  return { shards: nextShards, transactions: nextTransactions };
};

const isUndoTransaction = (value: unknown): value is UndoTransaction => {
  if (!value || typeof value !== 'object') return false;
  const tx = value as Partial<UndoTransaction>;
  return (
    typeof tx.id === 'string' &&
    (tx.kind === 'delete_one' || tx.kind === 'clear_all') &&
    Array.isArray(tx.shardIds) &&
    typeof tx.createdAt === 'number' &&
    typeof tx.expiresAt === 'number' &&
    (tx.status === 'open' || tx.status === 'undone' || tx.status === 'expired')
  );
};

const inferAndNormalizeShards = (parsedShards: Shard[]): Shard[] => {
  let maxIngestSeq = 0;
  for (const shard of parsedShards) {
    if (typeof shard.ingestSeq === 'number' && Number.isFinite(shard.ingestSeq)) {
      maxIngestSeq = Math.max(maxIngestSeq, shard.ingestSeq);
    }
  }

  let inferredIngestSeq = maxIngestSeq + parsedShards.length;

  return parsedShards.map((rawShard: Shard) => {
    const hasValidIngestSeq = typeof rawShard.ingestSeq === 'number' && Number.isFinite(rawShard.ingestSeq);
    if (!hasValidIngestSeq) {
      inferredIngestSeq -= 1;
    }
    const normalized = normalizeShard(rawShard);
    return {
      ...normalized,
      ingestSeq: hasValidIngestSeq ? rawShard.ingestSeq : inferredIngestSeq,
    };
  });
};

  const DEFAULT_SESSION_STATS: UsageSession = {
    totalInput: 0,
    totalOutput: 0,
    estimatedCost: 0,
    estimatedCostNano: '0',
    requestCount: 0,
  };

const getModelId = (provider: 'gemini' | 'xai', modelId?: string) => (
  provider === 'xai' ? XAI_MODEL_ID : (modelId || 'gemini-2.5-flash-lite')
);

export const useCollectio = (apiKey?: string, provider: 'gemini' | 'xai' = 'gemini', modelId?: string) => {
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
      const now = Date.now();
      const savedV2 = localStorage.getItem(STORAGE_KEY_V2);
      let hydratedFromV2 = false;
      if (savedV2) {
        const parsedV2 = JSON.parse(savedV2) as PersistedCollectioV2;
        if (parsedV2 && parsedV2.version === 2 && Array.isArray(parsedV2.shards)) {
          const normalizedShards = inferAndNormalizeShards(parsedV2.shards);
          const parsedTransactions = Array.isArray(parsedV2.undoTransactions)
            ? parsedV2.undoTransactions.filter(isUndoTransaction)
            : [];
          const { shards, transactions } = expireTransactions(normalizedShards, parsedTransactions, now);
          setAllShards(shards);
          setUndoTransactions(transactions);

          const inferredNext = shards.reduce((max, shard) => Math.max(max, shard.ingestSeq), 0) + 1;
          const persistedNext = typeof parsedV2.nextIngestSeq === 'number' && Number.isFinite(parsedV2.nextIngestSeq)
            ? parsedV2.nextIngestSeq
            : 1;
          nextIngestSeqRef.current = Math.max(inferredNext, persistedNext);
          hydratedFromV2 = true;
        }
      }

      if (!hydratedFromV2) {
        const savedShards = localStorage.getItem(STORAGE_KEY);
        if (savedShards) {
          const parsed = JSON.parse(savedShards) as Shard[];
          const rehydrated = inferAndNormalizeShards(parsed.filter((shard: Shard) => !shard.deletedAt));
          setAllShards(rehydrated);
          setUndoTransactions([]);
          nextIngestSeqRef.current = rehydrated.reduce((max, shard) => Math.max(max, shard.ingestSeq), 0) + 1;
        } else {
          nextIngestSeqRef.current = 1;
          setUndoTransactions([]);
        }
      }

      const savedStats = localStorage.getItem(STATS_KEY);
      if (savedStats) {
        setSessionStats(JSON.parse(savedStats));
      }
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
      const v2Payload: PersistedCollectioV2 = {
        version: 2,
        shards: allShards,
        undoTransactions,
        nextIngestSeq: nextIngestSeqRef.current,
      };

      const legacyShards = allShards.filter(s => !s.deletedAt);

      try {
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2Payload));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyShards));
        if (storageError) setStorageError(null);
      } catch (e) {
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
  }, [allShards, undoTransactions, isHydrated, storageError]);

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
  const updateStats = useCallback((usageMetadata?: UsageMetadata) => {
    if (!usageMetadata) return;
    const effectiveModelId = getModelId(provider, modelId);
    const inputTokens = usageMetadata.promptTokens;
    const outputTokens = usageMetadata.candidatesTokens;
    const costNano = calculateCostNano(effectiveModelId, inputTokens, outputTokens);
    
    setSessionStats(prev => {
      const nextNano = BigInt(prev.estimatedCostNano || '0') + costNano;
      return {
        totalInput: prev.totalInput + usageMetadata.promptTokens,
        totalOutput: prev.totalOutput + usageMetadata.candidatesTokens,
        estimatedCost: Number(nextNano) / 1_000_000_000,
        estimatedCostNano: nextNano.toString(),
        requestCount: prev.requestCount + 1,
      };
    });
  }, [provider, modelId]);

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
      const result = await indexText(trimmedContent, provider, apiKey, uniqueDomains);
      
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
      const result = await indexText(shard.content, provider, apiKey, uniqueDomains);
      
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
    const activeShards = getCompileShards();
    
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

      const result = await generateCollectionManifest(provider, shardSummaries, apiKey);
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
  }, [getCompileShards, apiKey, updateStats]);

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
export type { CollectionManifest, CollectionType } from '../services/indexerService';
