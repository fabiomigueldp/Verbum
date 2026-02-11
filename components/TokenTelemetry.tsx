import React from 'react';
import { RotateCcw } from 'lucide-react';
import { UsageSession } from '../types';
import { TokenCounter, CurrencyCounter } from './RollingCounter';
import { formatNanoDollars } from '../utils/pricing';

interface TokenTelemetryProps {
  stats: UsageSession;
  onReset: () => void;
}

export const TokenTelemetry: React.FC<TokenTelemetryProps> = ({ stats, onReset }) => {
  return (
    <div className="bg-white/5 rounded-lg border border-white/5 p-3 mt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] uppercase tracking-[0.2em] text-neutral-500 font-bold">
          Token Telemetry
        </span>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-neutral-600 hover:text-neutral-300 transition-colors"
          title="Reset Counter"
        >
          <RotateCcw size={10} />
          <span>Reset</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Input</span>
          <TokenCounter 
            value={stats.totalInput} 
            className="text-sm text-neutral-300"
            duration={800}
          />
        </div>

        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Output</span>
          <TokenCounter 
            value={stats.totalOutput}
            className="text-sm text-neutral-300"
            duration={800}
          />
        </div>

        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Requests</span>
          <TokenCounter 
            value={stats.requestCount}
            className="text-sm text-neutral-300"
            duration={600}
          />
        </div>

        <div className="flex flex-col ml-auto">
          <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Est. Cost</span>
          {stats.estimatedCostNano ? (
            <span className="text-sm text-neutral-300 font-mono">
              ${formatNanoDollars(BigInt(stats.estimatedCostNano), 9)}
            </span>
          ) : (
            <CurrencyCounter 
              value={stats.estimatedCost}
              decimals={9}
              className="text-sm text-neutral-300"
              duration={1000}
              easing="expo"
            />
          )}
        </div>
      </div>
    </div>
  );
};
