import React, { useState, useMemo, useCallback } from 'react';
import { Download, Trash2, X, ChevronDown, AlertTriangle, BarChart3, DollarSign, Calendar } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { SimpleDropdown } from './SimpleDropdown';
import { RequestLog } from '../types';
import { formatNanoDollars } from '../utils/pricing';
import {
  getRequestLogs,
  clearRequestLogs,
  exportRequestLogs,
  getRequestStats,
  getCostsByProvider,
  getCostHistory,
  getEffectiveCostNano,
} from '../services/core/telemetry';

interface RequestLogViewerProps {
  onClose: () => void;
}

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

type FilterOp = 'all' | 'translate' | 'refine' | 'index' | 'manifest';
type FilterStatus = 'all' | 'success' | 'error';
type FilterProvider = 'all' | string;
type ViewMode = 'list' | 'performance' | 'costs';

const OP_OPTIONS = [
  { value: 'all' as FilterOp, label: 'All Operations' },
  { value: 'translate' as FilterOp, label: 'Translate' },
  { value: 'refine' as FilterOp, label: 'Refine' },
  { value: 'index' as FilterOp, label: 'Index' },
  { value: 'manifest' as FilterOp, label: 'Manifest' },
];

const STATUS_OPTIONS = [
  { value: 'all' as FilterStatus, label: 'All Status' },
  { value: 'success' as FilterStatus, label: 'Success' },
  { value: 'error' as FilterStatus, label: 'Error' },
];

interface ModelPerformance {
  model: string;
  provider: string;
  calls: number;
  errors: number;
  avgDuration: number;
  avgTokensPerSecond: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostNano: bigint;
  costPer1KTokens: number;
}

export const RequestLogViewer: React.FC<RequestLogViewerProps> = ({ onClose }) => {
  const [filterOp, setFilterOp] = useState<FilterOp>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterProvider, setFilterProvider] = useState<FilterProvider>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const logs = useMemo(() => getRequestLogs(), []);
  const stats = useMemo(() => getRequestStats(), [logs]);

  const providerOptions = useMemo(() => {
    const providers = new Set<string>();
    for (const log of logs) providers.add(log.provider);
    const sorted = Array.from(providers).sort();
    return [
      { value: 'all' as FilterProvider, label: 'All Providers' },
      ...sorted.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })),
    ];
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filterOp !== 'all' && log.operation !== filterOp) return false;
      if (filterStatus !== 'all' && log.status !== filterStatus) return false;
      if (filterProvider !== 'all' && log.provider !== filterProvider) return false;
      return true;
    });
  }, [logs, filterOp, filterStatus, filterProvider]);

  // Performance summary grouped by model
  const performanceData = useMemo((): ModelPerformance[] => {
    const map = new Map<string, {
      provider: string;
      calls: number;
      errors: number;
      totalDuration: number;
      totalTPS: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCostNano: bigint;
      totalTokens: number;
    }>();

    for (const log of filtered) {
      if (log.status !== 'success') continue;
      const key = log.model; // Group by model ID only
      const existing = map.get(key);
      if (existing) {
        existing.calls += 1;
        existing.totalDuration += log.durationMs;
        existing.totalTPS += log.tokensPerSecond;
        existing.totalInputTokens += log.inputTokens;
        existing.totalOutputTokens += log.outputTokens;
        existing.totalCostNano += getEffectiveCostNano(log);
        existing.totalTokens += log.totalTokens;
      } else {
        map.set(key, {
          provider: log.provider,
          calls: 1,
          errors: 0,
          totalDuration: log.durationMs,
          totalTPS: log.tokensPerSecond,
          totalInputTokens: log.inputTokens,
          totalOutputTokens: log.outputTokens,
          totalCostNano: getEffectiveCostNano(log),
          totalTokens: log.totalTokens,
        });
      }
    }

    // Count errors separately
    for (const log of filtered) {
      if (log.status === 'error') {
        const key = log.model;
        const existing = map.get(key);
        if (existing) {
          existing.errors += 1;
        }
      }
    }

    const result: ModelPerformance[] = [];
    for (const [model, data] of map) {
      const avgDuration = data.calls > 0 ? Math.round(data.totalDuration / data.calls) : 0;
      const avgTPS = data.calls > 0 ? Math.round((data.totalTPS / data.calls) * 10) / 10 : 0;
      const totalCostUsd = Number(data.totalCostNano) / 1_000_000_000;
      const costPer1K = data.totalTokens > 0
        ? (totalCostUsd / data.totalTokens) * 1000
        : 0;

      result.push({
        model,
        provider: data.provider,
        calls: data.calls,
        errors: data.errors,
        avgDuration,
        avgTokensPerSecond: avgTPS,
        totalInputTokens: data.totalInputTokens,
        totalOutputTokens: data.totalOutputTokens,
        totalCostNano: data.totalCostNano,
        costPer1KTokens: costPer1K,
      });
    }

    return result.sort((a, b) => b.calls - a.calls);
  }, [filtered]);

  const handleExport = () => {
    const blob = new Blob([exportRequestLogs()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verbum-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirm('Clear all operation logs? This cannot be undone.')) {
      clearRequestLogs();
      onClose();
    }
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <GlassCard
        className="w-full max-w-2xl h-[80vh] relative animate-slide-up flex flex-col"
        hoverEffect={false}
      >
        <div className="p-5 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h3 className="text-sm font-medium text-white tracking-tight">Operation Log</h3>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                {stats.totalOps} ops · {stats.totalErrors} errors · avg {stats.avgDuration}ms
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.05] transition-all"
                title="Export JSON"
              >
                <Download size={14} />
              </button>
              <button
                onClick={handleClear}
                className="p-2 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06] transition-all"
                title="Clear Logs"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.05] transition-all"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 mb-3 shrink-0 bg-white/[0.03] rounded-lg p-1 w-fit">
            <button
              onClick={() => setViewMode('list')}
              className={`
                px-3 py-1.5 rounded-md text-[10px] uppercase tracking-[0.15em] font-medium
                transition-all duration-200
                ${viewMode === 'list'
                  ? 'bg-white/[0.08] text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
                }
              `}
            >
              Chronological
            </button>
            <button
              onClick={() => setViewMode('performance')}
              className={`
                px-3 py-1.5 rounded-md text-[10px] uppercase tracking-[0.15em] font-medium
                transition-all duration-200 flex items-center gap-1.5
                ${viewMode === 'performance'
                  ? 'bg-white/[0.08] text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
                }
              `}
            >
              <BarChart3 size={10} />
              Performance
            </button>
            <button
              onClick={() => setViewMode('costs')}
              className={`
                px-3 py-1.5 rounded-md text-[10px] uppercase tracking-[0.15em] font-medium
                transition-all duration-200 flex items-center gap-1.5
                ${viewMode === 'costs'
                  ? 'bg-white/[0.08] text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
                }
              `}
            >
              <DollarSign size={10} />
              Costs
            </button>
          </div>

          {/* Content Area — min-h-0 prevents flex overflow issues */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {/* Performance View */}
            {viewMode === 'performance' && (
              <div className="h-full overflow-y-auto custom-scrollbar">
                {performanceData.length === 0 ? (
                  <div className="text-center py-10 text-neutral-600 text-[12px]">
                    No performance data yet.
                  </div>
                ) : (
                  <div className="border border-white/[0.04] rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/[0.04]">
                          <th className="px-3 py-2 text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-bold">Model</th>
                          <th className="px-3 py-2 text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-bold text-right w-16">Calls</th>
                          <th className="px-3 py-2 text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-bold text-right w-20">Avg ms</th>
                          <th className="px-3 py-2 text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-bold text-right w-20">Tok/s</th>
                          <th className="px-3 py-2 text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-bold text-right w-24">$/1K tok</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performanceData.map((row) => (
                          <tr
                            key={row.model}
                            className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-3 py-2">
                              <div className="flex flex-col">
                                <span className="text-[11px] text-neutral-300 font-mono truncate max-w-[200px]">
                                  {row.model}
                                </span>
                                <span className="text-[9px] text-neutral-600">{row.provider}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-[11px] text-neutral-300 font-mono tabular-nums">
                                {row.calls}
                              </span>
                              {row.errors > 0 && (
                                <span className="text-[9px] text-neutral-400 ml-1">+{row.errors} err</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-[11px] text-neutral-300 font-mono tabular-nums">
                                {formatDuration(row.avgDuration)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-[11px] text-neutral-300 font-mono tabular-nums">
                                {row.avgTokensPerSecond}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-[11px] text-neutral-300 font-mono tabular-nums">
                                ${row.costPer1KTokens.toFixed(6)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="h-full flex flex-col min-h-0">
                {/* Filters */}
                <div className="flex items-center gap-2 mb-3 shrink-0">
                  <SimpleDropdown
                    value={filterOp}
                    options={OP_OPTIONS}
                    onChange={(v) => setFilterOp(v as FilterOp)}
                  />
                  <SimpleDropdown
                    value={filterStatus}
                    options={STATUS_OPTIONS}
                    onChange={(v) => setFilterStatus(v as FilterStatus)}
                  />
                  <SimpleDropdown
                    value={filterProvider}
                    options={providerOptions}
                    onChange={(v) => setFilterProvider(v as FilterProvider)}
                  />
                  <span className="text-[10px] text-neutral-600 ml-auto">
                    {filtered.length} entries
                  </span>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1 custom-scrollbar min-h-0">
                  {filtered.length === 0 ? (
                    <div className="text-center py-10 text-neutral-600 text-[12px]">
                      No operations logged yet.
                    </div>
                  ) : (
                    filtered.map((log) => {
                      const isExpanded = expandedId === log.id;
                      const isError = log.status === 'error';
                      const hasPreview = log.operation === 'translate' || log.operation === 'refine';
                      return (
                        <div
                          key={log.id}
                          className={`
                            rounded-lg border transition-all duration-200
                            ${isError
                              ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
                              : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08]'
                            }
                          `}
                        >
                          {/* Row */}
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="w-full px-3 py-2.5 flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-[10px] text-neutral-500 w-16 capitalize shrink-0">{log.operation}</span>
                              <span className="text-[11px] text-neutral-300 truncate">{log.model}</span>
                              {isError && <AlertTriangle size={10} className="text-neutral-400 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] text-neutral-500 font-mono tabular-nums">{formatDuration(log.durationMs)}</span>
                              <ChevronDown
                                size={12}
                                className={`text-neutral-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </div>
                          </button>

                          {/* Expanded with smooth height transition */}
                          <div
                            className={`
                              overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                              ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                            `}
                          >
                            <div className="px-3 pb-3 space-y-2 border-t border-white/[0.03]">
                              <div className="flex items-center justify-between pt-2">
                                <span className="text-[9px] text-neutral-500">{formatTime(log.timestamp)}</span>
                                <span className="text-[9px] text-neutral-500">{log.provider}</span>
                              </div>

                              {!isError && (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-neutral-400">
                                      {log.inputTokens} → {log.outputTokens} tok
                                    </span>
                                    <span className="text-[10px] text-neutral-400 font-mono">
                                      {log.tokensPerSecond} tok/s
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-neutral-400">
                                      ${formatNanoDollars(getEffectiveCostNano(log), 9)}
                                    </span>
                                    <span className="text-[9px] text-neutral-500">
                                      {log.inputLength} → {log.outputLength ?? 0} chars
                                    </span>
                                  </div>
                                  {hasPreview && (log.inputPreview || log.outputPreview) && (
                                    <div className="space-y-1 pt-1">
                                      {log.inputPreview && (
                                        <p className="text-[10px] text-neutral-500 italic truncate">
                                          In: &ldquo;{log.inputPreview}&rdquo;
                                        </p>
                                      )}
                                      {log.outputPreview && (
                                        <p className="text-[10px] text-neutral-500 italic truncate">
                                          Out: &ldquo;{log.outputPreview}&rdquo;
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}

                              {isError && log.errorMessage && (
                                <p className="text-[10px] text-neutral-400">{log.errorMessage}</p>
                              )}

                              <span className="text-[9px] text-neutral-600 font-mono block pt-1">{log.id}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {/* Costs View */}
            {viewMode === 'costs' && (
              <div className="h-full overflow-y-auto custom-scrollbar">
                <CostsView />
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

// ---------------------------------------------------------------------------
// COSTS SUB-COMPONENT
// ---------------------------------------------------------------------------

const CostsView: React.FC = () => {
  const [period, setPeriod] = useState<7 | 30>(7);

  const providerCosts = useMemo(() => getCostsByProvider(), []);
  const history = useMemo(() => getCostHistory(period), [period]);

  const totalCostNano = useMemo(() => {
    return providerCosts.reduce((sum, p) => sum + p.costNano, 0n);
  }, [providerCosts]);

  const totalOps = useMemo(() => {
    return providerCosts.reduce((sum, p) => sum + p.ops, 0);
  }, [providerCosts]);

  const maxDayCost = useMemo(() => {
    if (history.length === 0) return 1;
    const max = Math.max(...history.map((d) => Number(d.costNano)));
    return max > 0 ? max : 1;
  }, [history]);

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-bold">Period</span>
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-1">
          <button
            onClick={() => setPeriod(7)}
            className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-[0.1em] font-medium transition-all ${
              period === 7 ? 'bg-white/[0.08] text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setPeriod(30)}
            className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-[0.1em] font-medium transition-all ${
              period === 30 ? 'bg-white/[0.08] text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Total summary */}
      <div className="bg-white/[0.03] rounded-xl border border-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Total Spent</span>
            <span className="text-lg text-white font-mono tracking-tight">
              ${formatNanoDollars(totalCostNano, 9)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Operations</span>
            <span className="text-sm text-neutral-300 font-mono">{totalOps}</span>
          </div>
        </div>
      </div>

      {/* Daily history chart */}
      {history.some((d) => d.costNano > 0n) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar size={10} className="text-neutral-600" />
            <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-bold">Daily Spend</span>
          </div>
          <div className="flex items-end gap-[2px] h-24 bg-white/[0.02] rounded-lg border border-white/[0.04] p-3">
            {history.map((day) => {
              const heightPct = Math.max(4, (Number(day.costNano) / maxDayCost) * 100);
              const hasData = day.costNano > 0n;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className={`
                      w-full rounded-sm transition-all duration-300
                      ${hasData ? 'bg-white/[0.12] group-hover:bg-white/[0.2]' : 'bg-white/[0.03]'}
                    `}
                    style={{ height: `${heightPct}%` }}
                    title={`${day.date}: $${formatNanoDollars(day.costNano, 9)} (${day.ops} ops)`}
                  />
                  <span className="text-[8px] text-neutral-600 font-mono">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Provider breakdown */}
      <div className="space-y-2">
        <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-bold block">
          By Provider
        </span>
        {providerCosts.length === 0 ? (
          <div className="text-center py-6 text-neutral-600 text-[12px]">No cost data yet.</div>
        ) : (
          <div className="space-y-2">
            {providerCosts.map((p) => {
              const costNum = Number(p.costNano);
              const totalNum = Number(totalCostNano);
              const pct = totalNum > 0 ? Math.round((costNum / totalNum) * 100) : 0;
              return (
                <div key={p.provider} className="bg-white/[0.02] rounded-lg border border-white/[0.04] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-neutral-300 capitalize">{p.provider}</span>
                    <span className="text-[12px] text-white font-mono">
                      ${formatNanoDollars(p.costNano, 9)}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-white/[0.15] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-500">
                    <span>{p.ops} ops · {p.inputTokens + p.outputTokens} tokens</span>
                    <span>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
