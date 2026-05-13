import { UsageSession } from '../../types';
import type { Shard, UndoTransaction } from '../useCollectio';
import { storageGet, storageSetJson } from '../../services/core/storage';

const STORAGE_KEY = 'verbum_collectio';
const STORAGE_KEY_V2 = 'verbum_collectio_v2';
const STATS_KEY = 'verbum_collectio_stats';

interface PersistedCollectioV2 {
  version: 2;
  shards: Shard[];
  undoTransactions: UndoTransaction[];
  nextIngestSeq: number;
}

export interface HydratedCollectioState {
  shards: Shard[];
  transactions: UndoTransaction[];
  nextIngestSeq: number;
  sessionStats?: UsageSession;
}

export interface PersistCollectioResult {
  ok: boolean;
  error?: 'quota' | 'unknown';
}

const normalizeShard = (shard: Shard): Shard => ({
  ...shard,
  status: shard.status === 'indexing' ? 'pending' : shard.status,
  contentHash: shard.contentHash || `legacy-${shard.id}`,
});

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

export const expireTransactions = (
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

export const hydrateCollectioState = (): HydratedCollectioState => {
  const now = Date.now();
  const savedV2 = storageGet(STORAGE_KEY_V2);

  if (savedV2) {
    try {
      const parsedV2 = JSON.parse(savedV2) as PersistedCollectioV2;
      if (parsedV2 && parsedV2.version === 2 && Array.isArray(parsedV2.shards)) {
        const normalizedShards = inferAndNormalizeShards(parsedV2.shards);
        const parsedTransactions = Array.isArray(parsedV2.undoTransactions)
          ? parsedV2.undoTransactions.filter(isUndoTransaction)
          : [];
        const { shards, transactions } = expireTransactions(normalizedShards, parsedTransactions, now);
        const inferredNext = shards.reduce((max, shard) => Math.max(max, shard.ingestSeq), 0) + 1;
        const persistedNext = typeof parsedV2.nextIngestSeq === 'number' && Number.isFinite(parsedV2.nextIngestSeq)
          ? parsedV2.nextIngestSeq
          : 1;
        return {
          shards,
          transactions,
          nextIngestSeq: Math.max(inferredNext, persistedNext),
          sessionStats: readCollectioStats(),
        };
      }
    } catch {
      // Fall through to legacy or empty state.
    }
  }

  const savedShards = storageGet(STORAGE_KEY);
  if (savedShards) {
    try {
      const parsed = JSON.parse(savedShards) as Shard[];
      const shards = inferAndNormalizeShards(parsed.filter((shard: Shard) => !shard.deletedAt));
      return {
        shards,
        transactions: [],
        nextIngestSeq: shards.reduce((max, shard) => Math.max(max, shard.ingestSeq), 0) + 1,
        sessionStats: readCollectioStats(),
      };
    } catch {
      // Fall through to empty state.
    }
  }

  return {
    shards: [],
    transactions: [],
    nextIngestSeq: 1,
    sessionStats: readCollectioStats(),
  };
};

export const persistCollectioState = (
  shards: Shard[],
  undoTransactions: UndoTransaction[],
  nextIngestSeq: number
): PersistCollectioResult => {
  const payload: PersistedCollectioV2 = {
    version: 2,
    shards,
    undoTransactions,
    nextIngestSeq,
  };
  const legacyShards = shards.filter(s => !s.deletedAt);

  try {
    const savedV2 = storageSetJson(STORAGE_KEY_V2, payload);
    const savedLegacy = storageSetJson(STORAGE_KEY, legacyShards);
    if (!savedV2 || !savedLegacy) {
      return { ok: false, error: 'unknown' };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      return { ok: false, error: 'quota' };
    }
    return { ok: false, error: 'unknown' };
  }
};

export const readCollectioStats = (): UsageSession | undefined => {
  const savedStats = storageGet(STATS_KEY);
  if (!savedStats) return undefined;
  try {
    return JSON.parse(savedStats) as UsageSession;
  } catch {
    return undefined;
  }
};

export const persistCollectioStats = (stats: UsageSession): void => {
  storageSetJson(STATS_KEY, stats);
};
