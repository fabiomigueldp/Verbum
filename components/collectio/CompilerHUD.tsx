import React, { memo, useState, useCallback } from 'react';
import { Check, Trash2, RotateCcw, FileText, Clock, Loader2, Sparkles, Undo2, AlertTriangle, Copy } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { UsageSession } from '../../types';
import { TokenCounter, CurrencyCounter } from '../RollingCounter';
import { estimateReadTime } from '../../services/indexerService';
import { CollectionManifest } from '../../hooks/useCollectio';

// ============================================================================
// COMPILER HUD COMPONENT
// Floating utility bar for Collectio - HUD style controls
// Displays stats and provides smart compile-to-clipboard functionality
// ============================================================================

interface CompileResult {
  markdown: string;
  manifest: CollectionManifest;
}

interface CompilerHUDProps {
  totalShards: number;
  readyShards: number;
  totalTokens: number;
  sessionStats: UsageSession;
  isCompiling: boolean;
  onCompile: () => Promise<CompileResult>;
  onClearAll: () => void;
  onResetStats: () => void;
  // Integrity & Safety Layer
  hasRecoverableShards?: boolean;
  onUndoDelete?: () => void;
  storageError?: string | null;
  duplicateDetected?: boolean;
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
  isCompiling,
  onCompile,
  onClearAll,
  onResetStats,
  hasRecoverableShards = false,
  onUndoDelete,
  storageError,
  duplicateDetected = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [lastManifest, setLastManifest] = useState<CollectionManifest | null>(null);

  const estimatedReadMinutes = estimateReadTime(totalTokens);
  const hasShards = totalShards > 0;
  const hasReadyShards = readyShards > 0;

  // Copy text to clipboard with fallback
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for non-secure contexts (HTTP, localhost)
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  };

  // Handle async compile and copy
  const handleCompile = useCallback(async () => {
    if (!hasReadyShards || isCompiling) return;

    try {
      const { markdown, manifest } = await onCompile();
      
      if (!markdown) return;

      const success = await copyToClipboard(markdown);
      
      if (success) {
        setLastManifest(manifest);
        setCopied(true);
        
        // Reset copied state after showing success
        setTimeout(() => {
          setCopied(false);
          // Keep manifest visible a bit longer for UX
          setTimeout(() => setLastManifest(null), 1000);
        }, 3000);
      }
    } catch (err) {
      console.error('Compilation failed:', err);
    }
  }, [hasReadyShards, isCompiling, onCompile]);

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
            {/* Success Toast - Shows manifest info after compilation */}
            {copied && lastManifest && (
              <div className="
                mb-4 pb-4 border-b border-white/[0.04]
                animate-[fadeSlideIn_300ms_ease-out]
              ">
                <div className="flex items-center gap-3">
                  <div className="
                    w-8 h-8 rounded-lg
                    bg-emerald-500/20
                    flex items-center justify-center
                  ">
                    <Sparkles size={14} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-emerald-400 truncate">
                      {lastManifest.title}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      {lastManifest.suggestedFilename}.md • {lastManifest.type}
                    </div>
                  </div>
                  <div className="
                    px-2 py-1 rounded
                    bg-emerald-500/10
                    text-[9px] uppercase tracking-wider
                    text-emerald-400/80
                  ">
                    Copied
                  </div>
                </div>
              </div>
            )}

            {/* Storage Warning Banner */}
            {storageError && (
              <div className="
                mb-4 pb-4 border-b border-white/[0.04]
                animate-[fadeSlideIn_300ms_ease-out]
              ">
                <div className="flex items-center gap-3">
                  <div className="
                    w-8 h-8 rounded-lg
                    bg-amber-500/20
                    flex items-center justify-center
                  ">
                    <AlertTriangle size={14} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-amber-400/90">
                      {storageError}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Duplicate Detection Banner */}
            {duplicateDetected && (
              <div className="
                mb-4 pb-4 border-b border-white/[0.04]
                animate-[fadeSlideIn_300ms_ease-out]
              ">
                <div className="flex items-center gap-3">
                  <div className="
                    w-8 h-8 rounded-lg
                    bg-blue-500/20
                    flex items-center justify-center
                  ">
                    <Copy size={14} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-blue-400/90">
                      Duplicate content detected — shard skipped
                    </div>
                  </div>
                </div>
              </div>
            )}

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

                {/* Undo Delete - Conditionally visible */}
                {hasRecoverableShards && onUndoDelete && (
                  <button
                    onClick={onUndoDelete}
                    className="
                      p-2 rounded-lg
                      text-amber-500/80 hover:text-amber-400
                      bg-amber-500/10 hover:bg-amber-500/20
                      transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                      animate-[fadeSlideIn_300ms_ease-out]
                    "
                    title="Undo Delete (5s)"
                  >
                    <Undo2 size={14} />
                  </button>
                )}

                {/* Clear All */}
                <button
                  onClick={onClearAll}
                  disabled={!hasShards || isCompiling}
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
                  disabled={!hasReadyShards || isCompiling}
                  className={`
                    flex items-center gap-2
                    px-4 py-2.5
                    text-[11px] font-medium uppercase tracking-[0.15em]
                    rounded-lg
                    transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                    disabled:cursor-not-allowed
                    ${copied 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : isCompiling
                        ? 'bg-neutral-700 text-neutral-300'
                        : 'bg-neutral-200 text-neutral-900 hover:bg-white active:scale-[0.97]'
                    }
                    ${!copied && !isCompiling && 'shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.3)]'}
                    ${!copied && !isCompiling && 'hover:shadow-[0_0_20px_rgba(255,255,255,0.15),0_2px_12px_rgba(0,0,0,0.4)]'}
                    disabled:bg-neutral-800 disabled:text-neutral-600 disabled:shadow-none
                    disabled:hover:bg-neutral-800
                  `}
                >
                  {isCompiling ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Synthesizing...
                    </>
                  ) : copied ? (
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
