import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { estimateTokens } from '../../services/indexerService';

// ============================================================================
// INGESTION DECK COMPONENT
// High-speed text input vessel for the Knowledge Lattice
// "Fire and Forget" paradigm - paste, execute, process
// ============================================================================

interface IngestionDeckProps {
  onIngest: (content: string) => void;
  disabled?: boolean;
}

/**
 * Live token counter display
 */
const TokenDisplay = memo<{ count: number }>(({ count }) => (
  <div className="flex items-center gap-2 text-neutral-600">
    <span className="text-[10px] font-mono uppercase tracking-[0.15em]">
      Tokens
    </span>
    <span className="text-[13px] font-mono tabular-nums text-neutral-400">
      {count.toLocaleString()}
    </span>
  </div>
));

TokenDisplay.displayName = 'TokenDisplay';

export const IngestionDeck: React.FC<IngestionDeckProps> = memo(({ 
  onIngest,
  disabled = false 
}) => {
  const [content, setContent] = useState('');
  const [tokenCount, setTokenCount] = useState(0);
  const [isIngesting, setIsIngesting] = useState(false);
  const [fillProgress, setFillProgress] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update token count on content change
  useEffect(() => {
    setTokenCount(estimateTokens(content));
  }, [content]);

  // Handle paste event with detection
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Let the default paste happen, then update state
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      // Flash effect on paste
      textareaRef.current?.classList.add('ring-1', 'ring-white/20');
      setTimeout(() => {
        textareaRef.current?.classList.remove('ring-1', 'ring-white/20');
      }, 150);
    }
  }, []);

  // Handle ingestion with liquid-fill animation
  const handleIngest = useCallback(async () => {
    if (!content.trim() || isIngesting || disabled) return;

    setIsIngesting(true);
    
    // Liquid fill animation
    const duration = 400;
    const steps = 20;
    const stepDuration = duration / steps;
    
    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      setFillProgress((i / steps) * 100);
    }

    // Execute ingestion
    onIngest(content);
    
    // Clear and reset
    setContent('');
    setFillProgress(0);
    setIsIngesting(false);
    
    // Refocus textarea
    textareaRef.current?.focus();
  }, [content, isIngesting, disabled, onIngest]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleIngest();
    }
  }, [handleIngest]);

  const hasContent = content.trim().length > 0;

  return (
    <GlassCard 
      isActive={hasContent}
      breathingGlow={hasContent}
      className="relative overflow-hidden"
    >
      {/* Liquid Fill Animation Layer */}
      {isIngesting && (
        <div 
          className="
            absolute inset-0 z-10 
            bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03]
            pointer-events-none
            transition-transform duration-100 ease-linear
          "
          style={{ 
            transform: `translateX(${fillProgress - 100}%)`,
          }}
        />
      )}

      <div className="p-5 relative z-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-neutral-600" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">
              Ingestion Deck
            </span>
          </div>
          <TokenDisplay count={tokenCount} />
        </div>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          disabled={disabled || isIngesting}
          placeholder="Paste or type raw data for ingestion..."
          className="
            w-full min-h-[120px] max-h-[300px]
            bg-transparent
            text-[14px] text-neutral-300 
            placeholder:text-neutral-700
            leading-relaxed
            resize-none
            outline-none
            border-none
            font-sans
            transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          }}
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.04]">
          {/* Keyboard Hint */}
          <div className="flex items-center gap-1.5 text-neutral-700">
            <kbd className="
              text-[9px] font-mono uppercase
              px-1.5 py-0.5
              bg-white/[0.04]
              border border-white/[0.06]
              rounded
            ">
              ⌘
            </kbd>
            <span className="text-[9px]">+</span>
            <kbd className="
              text-[9px] font-mono uppercase
              px-1.5 py-0.5
              bg-white/[0.04]
              border border-white/[0.06]
              rounded
            ">
              ↵
            </kbd>
            <span className="text-[10px] ml-1.5">to ingest</span>
          </div>

          {/* Ingest Button */}
          <button
            onClick={handleIngest}
            disabled={!hasContent || isIngesting || disabled}
            className="
              flex items-center gap-2
              px-4 py-2
              text-[11px] font-medium uppercase tracking-[0.15em]
              bg-neutral-200 text-neutral-900
              rounded-lg
              transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
              hover:bg-white
              active:scale-[0.97]
              disabled:bg-neutral-800 disabled:text-neutral-600
              disabled:cursor-not-allowed
              shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.3)]
              hover:shadow-[0_0_20px_rgba(255,255,255,0.15),0_2px_12px_rgba(0,0,0,0.4)]
              disabled:shadow-none
            "
          >
            {isIngesting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Processing
              </>
            ) : (
              <>
                <Database size={12} />
                Ingest
              </>
            )}
          </button>
        </div>
      </div>
    </GlassCard>
  );
});

IngestionDeck.displayName = 'IngestionDeck';
