// ============================================================================
// CORE TELEMETRY
// Request logging, persistence, and query layer.
// Zero dependencies on UI. Backend-ready: replace localStorage with HTTP POST.
// ============================================================================

import { calculateCostNano } from '../../utils/pricing';

export type OperationType = 'translate' | 'refine' | 'index' | 'manifest';

export type ErrorType = 'network' | 'validation' | 'api' | 'timeout' | 'unknown';

export interface RequestLog {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  operation: OperationType;
  durationMs: number;
  status: 'success' | 'error';
  errorType?: ErrorType;
  errorMessage?: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
  estimatedCostNano: string;
  actualCostNano?: string;
  costSource?: 'estimated' | 'provider_actual';
  inputLength: number;
  outputLength?: number;
  inputPreview: string;
  outputPreview?: string;
  tokensPerSecond: number;
  glossaryTotalEntries?: number;
  glossaryApplicable?: number;
  glossaryMatched?: number;
  glossarySuspectedViolations?: number;
}

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'verbum_request_log_v1';
const MAX_ENTRIES = 250;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const generateId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

export const preview = (text: string, maxLen = 50): string => {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
};

export const classifyErrorForTelemetry = (error: unknown): { type: ErrorType; message: string } => {
  if (!error || typeof error !== 'object') {
    return { type: 'unknown', message: 'Unknown error' };
  }
  const e = error as Error;
  const msg = e.message || 'Unknown error';

  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return { type: 'timeout', message: msg };
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
    return { type: 'network', message: msg };
  }
  if (msg.includes('JSON') || msg.includes('schema') || msg.includes('validation')) {
    return { type: 'validation', message: msg };
  }
  if (msg.includes('API') || msg.includes('401') || msg.includes('403') || msg.includes('429')) {
    return { type: 'api', message: msg };
  }
  return { type: 'unknown', message: msg };
};

const computeTokensPerSecond = (totalTokens: number, durationMs: number): number => {
  if (durationMs <= 0 || totalTokens <= 0) return 0;
  return Math.round((totalTokens / (durationMs / 1000)) * 10) / 10;
};

// ---------------------------------------------------------------------------
// PERSISTENCE
// ---------------------------------------------------------------------------

const loadLogs = (): RequestLog[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RequestLog[];
    if (!Array.isArray(parsed)) return [];

    // Filter expired entries
    const now = Date.now();
    const valid = parsed.filter((log) => now - log.timestamp < TTL_MS);

    // If we removed expired entries, save back
    if (valid.length < parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }

    return valid;
  } catch {
    return [];
  }
};

const saveLogs = (logs: RequestLog[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('Telemetry: failed to persist logs', e);
  }
};

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

export const logRequest = (entry: Omit<RequestLog, 'id' | 'timestamp' | 'tokensPerSecond'> & { id?: string }): RequestLog => {
  const logs = loadLogs();

  const log: RequestLog = {
    ...entry,
    id: entry.id || generateId(),
    timestamp: Date.now(),
    tokensPerSecond: computeTokensPerSecond(entry.totalTokens, entry.durationMs),
  };

  const existingIndex = logs.findIndex((existing) => existing.id === log.id);
  const remainingLogs = existingIndex >= 0
    ? logs.filter((existing) => existing.id !== log.id)
    : logs;

  // FIFO: add to front, trim to max. Duplicate ids are replaced.
  const nextLogs = [log, ...remainingLogs].slice(0, MAX_ENTRIES);
  saveLogs(nextLogs);

  return log;
};

export const getRequestLogs = (): RequestLog[] => loadLogs();

export const getEffectiveCostNano = (log: Pick<RequestLog, 'actualCostNano' | 'estimatedCostNano'>): bigint =>
  BigInt(log.actualCostNano || log.estimatedCostNano || '0');

export const getRequestLogById = (id: string): RequestLog | undefined => {
  return loadLogs().find((log) => log.id === id);
};

export const clearRequestLogs = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const exportRequestLogs = (): string => {
  return JSON.stringify(loadLogs(), null, 2);
};

export interface RequestStats {
  totalOps: number;
  totalErrors: number;
  avgDuration: number;
  avgTokensPerSecond: number;
  totalCostNano: bigint;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export const getRequestStats = (): RequestStats => {
  const logs = loadLogs();
  if (logs.length === 0) {
    return {
      totalOps: 0,
      totalErrors: 0,
      avgDuration: 0,
      avgTokensPerSecond: 0,
      totalCostNano: 0n,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
  }

  const successLogs = logs.filter((l) => l.status === 'success');
  const totalDuration = successLogs.reduce((sum, l) => sum + l.durationMs, 0);
  const totalTPS = successLogs.reduce((sum, l) => sum + l.tokensPerSecond, 0);
  const totalCostNano = logs.reduce((sum, l) => sum + getEffectiveCostNano(l), 0n);

  return {
    totalOps: logs.length,
    totalErrors: logs.filter((l) => l.status === 'error').length,
    avgDuration: successLogs.length > 0 ? Math.round(totalDuration / successLogs.length) : 0,
    avgTokensPerSecond: successLogs.length > 0 ? Math.round((totalTPS / successLogs.length) * 10) / 10 : 0,
    totalCostNano,
    totalInputTokens: logs.reduce((sum, l) => sum + l.inputTokens, 0),
    totalOutputTokens: logs.reduce((sum, l) => sum + l.outputTokens, 0),
  };
};

// ---------------------------------------------------------------------------
// COST AGGREGATION
// ---------------------------------------------------------------------------

export interface ProviderCost {
  provider: string;
  ops: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costNano: bigint;
}

export const getCostsByProvider = (): ProviderCost[] => {
  const logs = loadLogs();
  const map = new Map<string, ProviderCost>();

  for (const log of logs) {
    const existing = map.get(log.provider);
    const costNano = getEffectiveCostNano(log);
    if (existing) {
      existing.ops += 1;
      existing.errors += log.status === 'error' ? 1 : 0;
      existing.inputTokens += log.inputTokens;
      existing.outputTokens += log.outputTokens;
      existing.totalTokens += log.totalTokens;
      existing.costNano += costNano;
    } else {
      map.set(log.provider, {
        provider: log.provider,
        ops: 1,
        errors: log.status === 'error' ? 1 : 0,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.totalTokens,
        costNano,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aCost = Number(a.costNano);
    const bCost = Number(b.costNano);
    return bCost - aCost;
  });
};

export interface DailyCost {
  date: string; // YYYY-MM-DD
  costNano: bigint;
  ops: number;
}

export const getCostHistory = (days: number): DailyCost[] => {
  const logs = loadLogs();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = logs.filter((l) => l.timestamp >= cutoff);

  const map = new Map<string, { costNano: bigint; ops: number }>();

  for (const log of filtered) {
    const date = new Date(log.timestamp).toISOString().slice(0, 10);
    const existing = map.get(date);
    const costNano = getEffectiveCostNano(log);
    if (existing) {
      existing.costNano += costNano;
      existing.ops += 1;
    } else {
      map.set(date, { costNano, ops: 1 });
    }
  }

  // Fill in missing days with zero
  const result: DailyCost[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    const entry = map.get(date);
    result.push({
      date,
      costNano: entry?.costNano ?? 0n,
      ops: entry?.ops ?? 0,
    });
  }

  return result;
};


