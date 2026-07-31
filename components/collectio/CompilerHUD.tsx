import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Check, Trash2, RotateCcw, FileText, Clock, Loader2, Sparkles, Undo2, AlertTriangle, Copy, X } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { UsageSession } from '../../types';
import { TokenCounter, CurrencyCounter } from '../RollingCounter';
import { formatNanoDollars } from '../../utils/pricing';
import { estimateReadTime } from '../../utils/tokens';
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
  <div className="flex min-w-0 flex-col items-center">
    <span className="mb-1 whitespace-nowrap text-[7px] font-mono uppercase tracking-[0.14em] text-neutral-600 sm:text-[8px] sm:tracking-[0.2em]">
      {label}
    </span>
    <div className="max-w-full whitespace-nowrap text-[11px] font-mono tabular-nums text-neutral-300 sm:text-[13px]">
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
    success: { bg: 'bg-white/15', text: 'text-neutral-100', badgeBg: 'bg-white/10' },
    warning: { bg: 'bg-white/10', text: 'text-neutral-300', badgeBg: 'bg-white/[0.07]' },
    info: { bg: 'bg-white/[0.07]', text: 'text-neutral-400', badgeBg: 'bg-white/[0.05]' },
  };
  
  const styles = variantStyles[variant];
  
  return (
    <div 
      className="grid transform-gpu transition-all duration-200 motion-reduce:transition-none"
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
        ? 'bg-white/15 text-white border border-white/30'
        : 'bg-neutral-200 text-neutral-900 hover:bg-white active:scale-[0.97]'
      }
      ${!isActive && 'shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.3)]'}
      ${!isActive && 'hover:shadow-[0_0_20px_rgba(255,255,255,0.15),0_2px_12px_rgba(0,0,0,0.4)]'}
      disabled:bg-neutral-800 disabled:text-neutral-600 disabled:shadow-none
    `,
    danger: `
      p-2
      text-neutral-600 hover:text-neutral-200
      bg-transparent hover:bg-white/10
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
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-4xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-6">
        {/* Liquid Container - morphs smoothly with content changes */}
        <div 
          ref={containerRef}
          className="pointer-events-auto transform-gpu transition-all duration-200 motion-reduce:transition-none"
          style={{ transitionTimingFunction: PREMIUM_EASE }}
        >
          <GlassCard 
            isActive={hasShards}
            className="overflow-hidden"
          >
            <div 
              className="px-4 py-3 transition-all duration-200 motion-reduce:transition-none sm:px-5 sm:py-4"
              style={{ transitionTimingFunction: PREMIUM_EASE }}
            >
              {/* Success Banner - Animated */}
              <AnimatedBanner
                isVisible={copied && !!lastManifest}
                variant="success"
                icon={<Sparkles size={14} className="text-neutral-200" />}
                title={lastManifest?.title || ''}
                subtitle={lastManifest ? `${lastManifest.suggestedFilename}.md • ${lastManifest.type}` : ''}
                badge="Copied"
              />

              {/* Storage Warning Banner */}
              <AnimatedBanner
                isVisible={!!storageError}
                variant="warning"
                icon={<AlertTriangle size={14} className="text-neutral-400" />}
                title={storageError || ''}
              />

              {/* Duplicate Detection Banner */}
              <AnimatedBanner
                isVisible={duplicateDetected}
                variant="info"
                icon={<Copy size={14} className="text-neutral-400" />}
                title="Duplicate content detected — shard skipped"
              />

              <AnimatedBanner
                isVisible={copiedRaw}
                variant="success"
                icon={<Copy size={14} className="text-neutral-200" />}
                title={copiedRawCount > 0 ? `${copiedRawCount} original shards copied` : 'Original shards copied'}
                subtitle="raw text • separator ---"
                badge="Copied"
              />

              {/* Main Content Row */}
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
                
                {/* Stats Section - Stable anchor */}
                <div className="grid min-w-0 grid-cols-[0.7fr_1fr_1fr_1.6fr] items-center gap-1 md:flex md:flex-nowrap md:gap-5 lg:gap-6">
                  <StatBlock label="Shards">
                    <TokenCounter value={totalShards} duration={400} />
                  </StatBlock>
                  
                  <div className="hidden h-8 w-px bg-white/[0.06] md:block" />
                  
                  <StatBlock label="Volume">
                    <TokenCounter value={totalTokens} duration={600} />
                  </StatBlock>
                  
                  <div className="hidden h-8 w-px bg-white/[0.06] md:block" />
                  
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

                {/* Selection actions stay compact on mobile and preserve the desktop flow. */}
                {(selectedCount > 0 || hasSelectedReady) && (
                  <div className="flex min-h-11 items-center justify-end gap-2 md:hidden">
                    {selectedCount > 0 && onDeselectAll && (
                      <button
                        onClick={onDeselectAll}
                        className="
                          flex h-11 items-center gap-1.5 rounded-lg border border-white/[0.06]
                          bg-white/[0.04] px-3 text-[10px] font-medium uppercase tracking-[0.12em]
                          text-neutral-400 transition-colors duration-200
                        "
                        title="Deselect All"
                      >
                        <X size={12} />
                        <span className="text-[9px] font-mono tabular-nums text-neutral-500">{selectedCount}</span>
                      </button>
                    )}
                    {hasSelectedReady && onCopySelectedRaw && (
                      <button
                        onClick={handleCopySelected}
                        className={`
                          flex h-11 items-center gap-1.5 rounded-lg border px-3
                          text-[10px] font-medium uppercase tracking-[0.12em]
                          transition-colors duration-200
                          ${copiedRaw
                            ? 'border-white/30 bg-white/10 text-neutral-200'
                            : 'border-white/[0.06] bg-white/[0.04] text-neutral-400'
                          }
                        `}
                        title="Copy Selected (Raw)"
                      >
                        {copiedRaw ? <Check size={12} /> : <Copy size={12} />}
                        <span className="text-[9px] font-mono tabular-nums text-neutral-500">{selectedReadyCount}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Primary actions remain a single, stable row on narrow screens. */}
                <div className="grid w-full shrink-0 grid-cols-[44px_44px_44px_minmax(0,1fr)] items-center gap-2 md:flex md:w-auto md:flex-nowrap md:gap-3">
                  <LiquidButton
                    onClick={onResetStats}
                    variant="ghost"
                    title="Reset Stats"
                    className="h-11 w-11 md:h-auto md:w-auto"
                  >
                    <RotateCcw size={14} />
                  </LiquidButton>

                  {/* Undo Delete - Reserved slot, no layout shift */}
                  <div className="relative h-11 w-11 shrink-0 md:h-8 md:w-8">
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
                            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto text-neutral-200 bg-white/10 border-white/20 hover:bg-white/[0.16] hover:border-white/30 hover:shadow-[0_0_16px_rgba(255,255,255,0.12)] active:scale-[0.97]'
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
                    className="h-11 w-11 md:h-auto md:w-auto"
                  >
                    <Trash2 size={14} />
                  </LiquidButton>

                  <div className="w-px h-8 bg-white/[0.06] hidden md:block" />

                  {/* Deselect All - Slides in with count */}
                    <div 
                      className="hidden transform-gpu transition-all duration-200 md:grid"
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
                    className="hidden transform-gpu transition-all duration-200 md:grid"
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
                            ? 'bg-white/10 text-neutral-200 border border-white/30'
                            : 'text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1]'
                          }
                        `}
                        style={{ transitionTimingFunction: PREMIUM_EASE }}
                        title="Copy Selected (Raw)"
                      >
                        {copiedRaw ? <Check size={12} className="text-neutral-200" /> : <Copy size={12} />}
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
                      flex h-11 min-w-0 items-center justify-center gap-2
                      px-3 py-2.5 sm:px-4
                      text-[11px] font-medium uppercase tracking-[0.15em]
                      rounded-lg
                      transition-all duration-200 transform-gpu
                      disabled:cursor-not-allowed
                      md:min-w-[170px]
                      ${copied 
                        ? 'bg-white/15 text-white border border-white/30'
                        : isCompiling
                          ? 'bg-neutral-700 text-neutral-300'
                          : 'bg-neutral-200 text-neutral-900 hover:bg-white active:scale-[0.97]'
                      }
                      ${!copied && !isCompiling && 'shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.3)]'}
                      ${!copied && !isCompiling && 'hover:shadow-[0_0_20px_rgba(255,255,255,0.15),0_2px_12px_rgba(0,0,0,0.4)]'}
                      disabled:bg-neutral-800 disabled:text-neutral-600 disabled:shadow-none
                      disabled:hover:bg-neutral-800
                    `}
                    style={{ transitionTimingFunction: PREMIUM_EASE }}
                  >
                    {isCompiling ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Synthesizing...</span>
                      </>
                    ) : copied ? (
                      <>
                        <Check size={14} className="text-neutral-200" />
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
