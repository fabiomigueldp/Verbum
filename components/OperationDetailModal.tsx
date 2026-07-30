import React, { useEffect, useRef } from 'react';
import { X, Clock, Zap, Type, DollarSign, AlertTriangle } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { RequestLog } from '../types';
import { formatNanoDollars } from '../utils/pricing';
import { getEffectiveCostNano } from '../services/core/telemetry';

interface OperationDetailModalProps {
  log: RequestLog;
  onClose: () => void;
}

export const OperationDetailModal: React.FC<OperationDetailModalProps> = ({ log, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const isError = log.status === 'error';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <GlassCard
        ref={cardRef}
        className="w-full max-w-sm relative animate-slide-up"
        hoverEffect={false}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">
                Operation Details
              </span>
              {isError && (
                <span className="flex items-center gap-1 text-[9px] text-neutral-300 uppercase tracking-[0.15em]">
                  <AlertTriangle size={10} />
                  Error
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-white transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Main metrics */}
          <div className="space-y-4">
            {/* Row: Operation + Provider */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Type</span>
                <span className="text-[13px] text-white capitalize">{log.operation}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Provider</span>
                <span className="text-[13px] text-neutral-300">{log.provider}</span>
              </div>
            </div>

            {/* Row: Model */}
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Model</span>
              <span className="text-[12px] text-neutral-300 font-mono">{log.model}</span>
            </div>

            <div className="h-px bg-white/[0.04]" />

            {/* Row: Time + Duration */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-neutral-600" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Time</span>
                  <span className="text-[12px] text-neutral-300 font-mono">{formatTime(log.timestamp)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-neutral-600" />
                <div className="flex flex-col items-end">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Duration</span>
                  <span className="text-[12px] text-neutral-300 font-mono">{formatDuration(log.durationMs)}</span>
                </div>
              </div>
            </div>

            {/* Throughput */}
            {!isError && (
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-neutral-600" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Throughput</span>
                  <span className="text-[12px] text-neutral-300 font-mono">{log.tokensPerSecond} tok/s</span>
                </div>
              </div>
            )}

            <div className="h-px bg-white/[0.04]" />

            {/* Tokens */}
            {!isError && (
              <div className="flex items-center gap-2">
                <Type size={12} className="text-neutral-600" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Tokens</span>
                  <span className="text-[12px] text-neutral-300 font-mono">
                    {log.inputTokens} → {log.outputTokens} ({log.totalTokens} total)
                  </span>
                </div>
              </div>
            )}

            {/* Cost */}
            {!isError && (
              <div className="flex items-center gap-2">
                <DollarSign size={12} className="text-neutral-600" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">
                    {log.actualCostNano ? 'Actual Cost' : 'Est. Cost'}
                  </span>
                  <span className="text-[12px] text-neutral-300 font-mono">
                    ${formatNanoDollars(getEffectiveCostNano(log), 9)}
                  </span>
                </div>
              </div>
            )}

            {/* Characters */}
            {!isError && (
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Characters</span>
                <span className="text-[12px] text-neutral-300 font-mono">
                  {log.inputLength} in / {log.outputLength ?? 0} out
                </span>
              </div>
            )}

            {/* Glossary */}
            {!isError && log.glossaryTotalEntries !== undefined && log.glossaryTotalEntries > 0 && (
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Glossary</span>
                <span className="text-[12px] text-neutral-300 font-mono">
                  {log.glossaryApplicable} applicable | {log.glossaryMatched} matched
                  {(log.glossarySuspectedViolations ?? 0) > 0 && (
                    <span className="text-neutral-500"> | {log.glossarySuspectedViolations} suspected</span>
                  )}
                </span>
              </div>
            )}

            {/* Preview */}
            {!isError && (log.inputPreview || log.outputPreview) && (
              <div className="space-y-2 pt-1">
                {log.inputPreview && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Input Preview</span>
                    <span className="text-[11px] text-neutral-400 italic leading-relaxed mt-0.5">
                      "{log.inputPreview}"
                    </span>
                  </div>
                )}
                {log.outputPreview && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Output Preview</span>
                    <span className="text-[11px] text-neutral-400 italic leading-relaxed mt-0.5">
                      "{log.outputPreview}"
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Error details */}
            {isError && log.errorMessage && (
              <div className="bg-white/[0.06] border border-white/10 rounded-lg p-3">
                <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-400 block mb-1">Error</span>
                <span className="text-[11px] text-neutral-300">{log.errorMessage}</span>
              </div>
            )}

            {/* Log ID */}
            <div className="pt-2 border-t border-white/[0.03]">
              <span className="text-[9px] text-neutral-600 font-mono">ID: {log.id}</span>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
