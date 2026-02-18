import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Check, Trash2, RotateCcw, FileText, Clock, Loader2, Sparkles, Undo2, AlertTriangle, Copy, X } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { UsageSession } from '../../types';
import { TokenCounter, CurrencyCounter } from '../RollingCounter';
import { formatNanoDollars } from '../../utils/pricing';
import { estimateReadTime } from '../../services/indexerService';
import { CollectionManifest, UndoState } from '../../hooks/useCollectio';

// ============================================================================
// COMPILER HUD COMPONENT - "Liquid" Design
// Floating utility bar with physics-based container morphing
// Smooth content transitions, no instant layout changes
// Premium Apple-like micro-interactions at 60fps
// ============================================================================

// Premium easing: fast start, soft landing
const PREMIUM_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

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
  hasRecoverableShards?: boolean;
  onUndoDelete?: () => void;
  undoState?: UndoState;
  storageError?: string | null;
  duplicateDetected?: boolean;
  selectedCount?: number;
  selectedReadyCount?: number;
  onDeselectAll?: () => void;
  onCopySelectedRaw?: () => { content: string; count: number };
}

/**
 * Stat display block with smooth value transitions
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

/**
 * Animated Banner - Slides in/out with physics
 */
const AnimatedBanner = memo<{
  isVisible: boolean;
  variant: 'success' | 'warning' | 'info';
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
}>(({ isVisible, variant, icon, title, subtitle, badge }) => {
  const variantStyles = {
    success: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', badgeBg: 'bg-emerald-500/10' },
    warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', badgeBg: 'bg-amber-500/10' },
    info: { bg: 'bg-blue-500/20', text: 'text-blue-400', badgeBg: 'bg-blue-500/10' },
  };
  
  const styles = variantStyles[variant];
  
  return (
    <div 
      className="grid transition-all duration-500 transform-gpu"
      style={{ 
        gridTemplateRows: isVisible ? '1fr' : '0fr',
        transitionTimingFunction: PREMIUM_EASE,
      }}
    >
      <div className="overflow-hidden">
        <div className="pb-4 mb-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${styles.bg} flex items-center justify-center`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[12px] font-medium ${styles.text} truncate`}>
                {title}
              </div>
              {subtitle && (
                <div className="text-[10px] text-neutral-500 font-mono">
                  {subtitle}
                </div>
              )}
            </div>
            {badge && (
              <div className={`
                px-2 py-1 rounded ${styles.badgeBg}
                text-[9px] uppercase tracking-wider ${styles.text}/80
              `}>
                {badge}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

AnimatedBanner.displayName = 'AnimatedBanner';

/**
 * Liquid Button - Smooth width transitions for dynamic labels
 */
const LiquidButton = memo<{
  onClick: () => void;
  disabled?: boolean;
  variant: 'primary' | 'danger' | 'ghost';
  isActive?: boolean;
  children: React.ReactNode;
  title?: string;
  className?: string;
}>(({ onClick, disabled, variant, isActive, children, title, className = '' }) => {
  const baseStyles = `
    flex items-center justify-center gap-2
    rounded-lg transition-all duration-300 transform-gpu
    disabled:cursor-not-allowed
  `;
  
  const variantStyles = {
    primary: `
      px-4 py-2.5
      text-[11px] font-medium uppercase tracking-[0.15em]
      ${isActive 
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
        : 'bg-neutral-200 text-neutral-900 hover:bg-white active:scale-[0.97]'
      }
      ${!isActive && 'shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.3)]'}
      ${!isActive && 'hover:shadow-[0_0_20px_rgba(255,255,255,0.15),0_2px_12px_rgba(0,0,0,0.4)]'}
      disabled:bg-neutral-800 disabled:text-neutral-600 disabled:shadow-none
    `,
    danger: `
      p-2
      text-neutral-600 hover:text-red-400
      bg-transparent hover:bg-red-500/10
      disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-600
    `,
    ghost: `
      p-2
      text-neutral-600 hover:text-neutral-400
      bg-transparent hover:bg-white/[0.04]
    `,
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      {children}
    </button>
  );
});

LiquidButton.displayName = 'LiquidButton';

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
  undoState,
  storageError,
  duplicateDetected = false,
  selectedCount = 0,
  selectedReadyCount = 0,
  onDeselectAll,
  onCopySelectedRaw,
}) => {
  const [copied, setCopied] = useState(false);
  const [lastManifest, setLastManifest] = useState<CollectionManifest | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedRawCount, setCopiedRawCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const estimatedReadMinutes = estimateReadTime(totalTokens);
  const hasShards = totalShards > 0;
  const hasReadyShards = readyShards > 0;
  const hasSelectedReady = selectedReadyCount > 0;
  const effectiveHasUndo = (undoState ? undoState.canUndo : hasRecoverableShards) && !!onUndoDelete;
  const undoCount = undoState?.affectedCount ?? 0;
  const undoLabel = undoState?.kind === 'clear_all' ? 'Undo Clear' : 'Undo Delete';
  const undoTitle = undoCount > 0 ? `${undoLabel} (${undoCount})` : undoLabel;

  // Copy text to clipboard with fallback
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
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
        
        setTimeout(() => {
          setCopied(false);
          setTimeout(() => setLastManifest(null), 1000);
        }, 3000);
      }
    } catch (err) {
      console.error('Compilation failed:', err);
    }
  }, [hasReadyShards, isCompiling, onCompile]);

  const handleCopySelected = useCallback(async () => {
    if (!hasSelectedReady || !onCopySelectedRaw) return;
    const { content, count } = onCopySelectedRaw();
    if (!content) return;
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedRawCount(count);
      setCopiedRaw(true);
      setTimeout(() => {
        setCopiedRaw(false);
        setTimeout(() => setCopiedRawCount(0), 1000);
      }, 2200);
    }
  }, [hasSelectedReady, onCopySelectedRaw]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-4xl mx-auto px-4 pb-6">
        {/* Liquid Container - morphs smoothly with content changes */}
        <div 
          ref={containerRef}
          className="pointer-events-auto transition-all duration-500 transform-gpu"
          style={{ transitionTimingFunction: PREMIUM_EASE }}
        >
          <GlassCard 
            isActive={hasShards}
            className="overflow-hidden"
          >
            <div 
              className="px-5 py-4 transition-all duration-400"
              style={{ transitionTimingFunction: PREMIUM_EASE }}
            >
              {/* Success Banner - Animated */}
              <AnimatedBanner
                isVisible={copied && !!lastManifest}
                variant="success"
                icon={<Sparkles size={14} className="text-emerald-400" />}
                title={lastManifest?.title || ''}
                subtitle={lastManifest ? `${lastManifest.suggestedFilename}.md • ${lastManifest.type}` : ''}
                badge="Copied"
              />

              {/* Storage Warning Banner */}
              <AnimatedBanner
                isVisible={!!storageError}
                variant="warning"
                icon={<AlertTriangle size={14} className="text-amber-400" />}
                title={storageError || ''}
              />

              {/* Duplicate Detection Banner */}
              <AnimatedBanner
                isVisible={duplicateDetected}
                variant="info"
                icon={<Copy size={14} className="text-blue-400" />}
                title="Duplicate content detected — shard skipped"
              />

              <AnimatedBanner
                isVisible={copiedRaw}
                variant="success"
                icon={<Copy size={14} className="text-emerald-400" />}
                title={copiedRawCount > 0 ? `${copiedRawCount} original shards copied` : 'Original shards copied'}
                subtitle="raw text • separator ---"
                badge="Copied"
              />

              {/* Main Content Row */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
                
                {/* Stats Section - Stable anchor */}
                <div className="flex items-center gap-4 md:gap-5 lg:gap-6 flex-wrap md:flex-nowrap min-w-0">
                  <StatBlock label="Shards">
                    <TokenCounter value={totalShards} duration={400} />
                  </StatBlock>
                  
                  <div className="w-px h-8 bg-white/[0.06] hidden sm:block" />
                  
                  <StatBlock label="Volume">
                    <TokenCounter value={totalTokens} duration={600} />
                  </StatBlock>
                  
                  <div className="w-px h-8 bg-white/[0.06] hidden sm:block" />
                  
                  <StatBlock label="Read Time">
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-neutral-500" />
                      <span>{estimatedReadMinutes} min</span>
                    </div>
                  </StatBlock>

                  <div className="w-px h-8 bg-white/[0.06] hidden md:block" />
                  
                  <StatBlock label="Cost">
                    {sessionStats.estimatedCostNano && sessionStats.estimatedCostNano !== '0' ? (
                      <span className="font-mono">${formatNanoDollars(BigInt(sessionStats.estimatedCostNano), 9)}</span>
                    ) : (
                      <CurrencyCounter 
                        value={sessionStats.estimatedCost}
                        decimals={9}
                        duration={800}
                      />
                    )}
                  </StatBlock>
                </div>

                {/* Actions Section - Liquid layout */}
                <div className="flex items-center gap-2 md:gap-3 flex-wrap md:flex-nowrap shrink-0">
                  <LiquidButton
                    onClick={onResetStats}
                    variant="ghost"
                    title="Reset Stats"
                  >
                    <RotateCcw size={14} />
                  </LiquidButton>

                  {/* Undo Delete - Reserved slot, no layout shift */}
                  <div className="relative w-8 h-8 shrink-0">
                    <button
                      onClick={onUndoDelete}
                      disabled={!effectiveHasUndo}
                      aria-hidden={!effectiveHasUndo}
                      tabIndex={effectiveHasUndo ? 0 : -1}
                      className={
                        `
                          absolute inset-0
                          flex items-center justify-center
                          rounded-lg
                          border transform-gpu
                          transition-[opacity,transform,background-color,color,border-color,box-shadow]
                          duration-300 motion-reduce:transition-none
                          ${effectiveHasUndo
                            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/16 hover:border-amber-500/30 hover:shadow-[0_0_16px_rgba(245,158,11,0.22)] active:scale-[0.97]'
                            : 'opacity-0 translate-y-1 scale-[0.98] pointer-events-none text-neutral-600 bg-transparent border-transparent'
                          }
                        `
                      }
                      style={{ transitionTimingFunction: PREMIUM_EASE }}
                      title={undoTitle}
                    >
                      <Undo2 size={14} />
                    </button>
                  </div>

                  <LiquidButton
                    onClick={onClearAll}
                    disabled={!hasShards || isCompiling}
                    variant="danger"
                    title="Clear All Shards"
                  >
                    <Trash2 size={14} />
                  </LiquidButton>

                  <div className="w-px h-8 bg-white/[0.06] hidden md:block" />

                  {/* Deselect All - Slides in with count */}
                    <div 
                      className="grid transition-all duration-400 transform-gpu"
                      style={{ 
                        gridTemplateRows: selectedCount > 0 && onDeselectAll ? '1fr' : '0fr',
                        gridTemplateColumns: selectedCount > 0 && onDeselectAll ? '1fr' : '0fr',
                        transitionTimingFunction: PREMIUM_EASE,
                      }}
                    >
                      <div className="overflow-hidden">
                        <button
                          onClick={onDeselectAll}
                          className="
                            flex items-center gap-1.5
                            px-2.5 py-2
                            text-[10px] font-medium uppercase tracking-[0.12em]
                            text-neutral-400 hover:text-white
                            bg-white/[0.04] hover:bg-white/[0.08]
                            border border-white/[0.06] hover:border-white/[0.1]
                            rounded-lg
                            transition-all duration-300
                            whitespace-nowrap
                          "
                          style={{ transitionTimingFunction: PREMIUM_EASE }}
                          title="Deselect All"
                        >
                          <X size={12} />
                          <span className="text-[9px] font-mono tabular-nums text-neutral-500">{selectedCount}</span>
                        </button>
                      </div>
                    </div>

                  {/* Copy Selected - Slides in */}
                  <div
                    className="grid transition-all duration-400 transform-gpu"
                    style={{
                      gridTemplateRows: hasSelectedReady && onCopySelectedRaw ? '1fr' : '0fr',
                      gridTemplateColumns: hasSelectedReady && onCopySelectedRaw ? '1fr' : '0fr',
                      transitionTimingFunction: PREMIUM_EASE,
                    }}
                  >
                    <div className="overflow-hidden">
                      <button
                        onClick={handleCopySelected}
                        className={`
                          flex items-center gap-1.5
                          px-2.5 py-2
                          text-[10px] font-medium uppercase tracking-[0.12em]
                          rounded-lg
                          transition-all duration-300 transform-gpu
                          whitespace-nowrap
                          ${copiedRaw
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1]'
                          }
                        `}
                        style={{ transitionTimingFunction: PREMIUM_EASE }}
                        title="Copy Selected (Raw)"
                      >
                        {copiedRaw ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span className="text-[9px] font-mono tabular-nums text-neutral-500">
                          {selectedReadyCount}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Compile Button - Liquid label transitions */}
                  <button
                    onClick={handleCompile}
                    disabled={!hasReadyShards || isCompiling}
                    className={`
                      flex items-center gap-2
                      px-4 py-2.5
                      text-[11px] font-medium uppercase tracking-[0.15em]
                      rounded-lg
                      transition-all duration-300 transform-gpu
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
                    style={{ 
                      transitionTimingFunction: PREMIUM_EASE,
                      // Stable width to avoid layout shift
                      minWidth: '170px',
                    }}
                  >
                    {isCompiling ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Synthesizing...</span>
                      </>
                    ) : copied ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        <span>Compiled</span>
                      </>
                    ) : selectedCount > 0 ? (
                      <>
                        <FileText size={14} />
                        <span>Compile</span>
                        <span className="
                          ml-0.5 px-1.5 py-0.5 
                          text-[9px] tabular-nums
                          bg-neutral-900/30 
                          rounded
                          transition-all duration-300
                        ">
                          {selectedCount}
                        </span>
                      </>
                    ) : (
                      <>
                        <FileText size={14} />
                        <span>Compile</span>
                        <span className="
                          ml-0.5 px-1.5 py-0.5 
                          text-[9px] tabular-nums
                          bg-neutral-900/30 
                          rounded
                          transition-all duration-300
                        ">
                          All
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
});

CompilerHUD.displayName = 'CompilerHUD';
