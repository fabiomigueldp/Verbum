import React, { memo, useState, useCallback } from 'react';
import { Clipboard, Check, Trash2, RotateCcw, FileText, Clock } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { UsageSession } from '../../types';
import { TokenCounter, CurrencyCounter } from '../RollingCounter';
import { estimateReadTime } from '../../services/indexerService';

// ============================================================================
// COMPILER HUD COMPONENT
// Floating utility bar for Collectio - HUD style controls
// Displays stats and provides compile-to-clipboard functionality
// ============================================================================

interface CompilerHUDProps {
  totalShards: number;
  readyShards: number;
  totalTokens: number;
  sessionStats: UsageSession;
  onCompile: () => string;
  onClearAll: () => void;
  onResetStats: () => void;
}

/**
 * Stat display block
 */
const StatBlock = memo<{ 
  label: string; 
  children: React.ReactNode;
}>(({ label, children }) => (
  <div className="flex flex-col items-center">
    <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-neutral-600 mb-1">
      {label}
    </span>
    <div className="text-[13px] font-mono tabular-nums text-neutral-300">
      {children}
    </div>
  </div>
));

StatBlock.displayName = 'StatBlock';

export const CompilerHUD: React.FC<CompilerHUDProps> = memo(({
  totalShards,
  readyShards,
  totalTokens,
  sessionStats,
  onCompile,
  onClearAll,
  onResetStats,
}) => {
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const estimatedReadMinutes = estimateReadTime(totalTokens);
  const hasShards = totalShards > 0;
  const hasReadyShards = readyShards > 0;

  // Handle compile and copy with fallback for non-secure contexts
  const handleCompile = useCallback(async () => {
    if (!hasReadyShards) return;

    setIsAnimating(true);
    
    const markdown = onCompile();
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(markdown);
      } else {
        // Fallback for non-secure contexts (HTTP, localhost)
        const textArea = document.createElement('textarea');
        textArea.value = markdown;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopied(true);
      
      // Reset copied state after animation
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
    
    setIsAnimating(false);
  }, [hasReadyShards, onCompile]);

  return (
    <div className="
      fixed bottom-0 left-0 right-0
      z-50
      pointer-events-none
    ">
      <div className="
        max-w-4xl mx-auto
        px-4 pb-6
      ">
        <GlassCard 
          isActive={hasShards}
          className="pointer-events-auto"
        >
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-6 flex-wrap">
              
              {/* Stats Section */}
              <div className="flex items-center gap-6">
                <StatBlock label="Shards">
                  <TokenCounter 
                    value={totalShards} 
                    duration={400}
                  />
                </StatBlock>
                
                <div className="w-px h-8 bg-white/[0.06]" />
                
                <StatBlock label="Volume">
                  <TokenCounter 
                    value={totalTokens} 
                    duration={600}
                  />
                </StatBlock>
                
                <div className="w-px h-8 bg-white/[0.06]" />
                
                <StatBlock label="Read Time">
                  <div className="flex items-center gap-1">
                    <Clock size={10} className="text-neutral-500" />
                    <span>{estimatedReadMinutes} min</span>
                  </div>
                </StatBlock>

                <div className="w-px h-8 bg-white/[0.06]" />
                
                <StatBlock label="Cost">
                  <CurrencyCounter 
                    value={sessionStats.estimatedCost}
                    decimals={5}
                    duration={800}
                  />
                </StatBlock>
              </div>

              {/* Actions Section */}
              <div className="flex items-center gap-3">
                {/* Reset Stats */}
                <button
                  onClick={onResetStats}
                  className="
                    p-2 rounded-lg
                    text-neutral-600 hover:text-neutral-400
                    bg-transparent hover:bg-white/[0.04]
                    transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                  "
                  title="Reset Stats"
                >
                  <RotateCcw size={14} />
                </button>

                {/* Clear All */}
                <button
                  onClick={onClearAll}
                  disabled={!hasShards}
                  className="
                    p-2 rounded-lg
                    text-neutral-600 hover:text-red-400
                    bg-transparent hover:bg-red-500/10
                    transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                    disabled:opacity-30 disabled:cursor-not-allowed
                    disabled:hover:bg-transparent disabled:hover:text-neutral-600
                  "
                  title="Clear All Shards"
                >
                  <Trash2 size={14} />
                </button>

                <div className="w-px h-8 bg-white/[0.06]" />

                {/* Compile & Copy Button */}
                <button
                  onClick={handleCompile}
                  disabled={!hasReadyShards || isAnimating}
                  className={`
                    flex items-center gap-2
                    px-4 py-2.5
                    text-[11px] font-medium uppercase tracking-[0.15em]
                    rounded-lg
                    transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                    disabled:cursor-not-allowed
                    ${copied 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-neutral-200 text-neutral-900 hover:bg-white active:scale-[0.97]'
                    }
                    ${!copied && 'shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.3)]'}
                    ${!copied && 'hover:shadow-[0_0_20px_rgba(255,255,255,0.15),0_2px_12px_rgba(0,0,0,0.4)]'}
                    disabled:bg-neutral-800 disabled:text-neutral-600 disabled:shadow-none
                    disabled:hover:bg-neutral-800
                  `}
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      Compiled
                    </>
                  ) : (
                    <>
                      <FileText size={14} />
                      Compile & Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
});

CompilerHUD.displayName = 'CompilerHUD';
