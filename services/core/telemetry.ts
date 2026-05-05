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
  outputTokens: number;
  totalTokens: number;
  estimatedCostNano: string;
  actualCostNano?: string;
  inputLength: number;
  outputLength?: number;
  inputPreview: string;
  outputPreview?: string;
  tokensPerSecond: number;
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

  // FIFO: add to front, trim to max
  const nextLogs = [log, ...logs].slice(0, MAX_ENTRIES);
  saveLogs(nextLogs);

  return log;
};

export const getRequestLogs = (): RequestLog[] => loadLogs();

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
  const totalCostNano = logs.reduce((sum, l) => sum + BigInt(l.estimatedCostNano || '0'), 0n);

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


