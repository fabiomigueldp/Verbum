import React, { useMemo, useState, useEffect, memo } from 'react';
import DiffMatchPatch from 'diff-match-patch';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  className?: string;
  direction?: 'ltr' | 'rtl' | 'auto';
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Detects if text contains predominantly RTL characters (Arabic, Hebrew)
 */
const detectRTL = (text: string): boolean => {
  if (!text || text.trim().length === 0) return false;
  // Match RTL characters: Hebrew (U+0590-U+05FF, U+FB1D-U+FB4F) and Arabic (U+0600-U+06FF, U+FB50-U+FDFF, U+FE70-U+FEFF)
  const rtlChars = text.match(/[\u0590-\u05FF\uFB1D-\uFB4F\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  const ltrChars = text.match(/[A-Za-z\u00C0-\u024F\u0100-\u017F]/g); // Latin-based
  
  if (!rtlChars) return false;
  if (!ltrChars) return true;
  
  // If RTL characters are >30% of all directional characters, treat as RTL
  return rtlChars.length / (rtlChars.length + ltrChars.length) > 0.3;
};

// Staggered animation component for each diff segment
const DiffSegment = memo<{
  type: number;
  text: string;
  index: number;
  totalChanges: number;
}>(({ type, text, index, totalChanges }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Stagger animation based on position, with a max delay cap
    const baseDelay = type === 0 ? 0 : Math.min(index * 25, 250);
    const timer = setTimeout(() => setIsVisible(true), baseDelay);
    return () => clearTimeout(timer);
  }, [index, type]);

  // Unchanged text - subtle fade, readable but not prominent
  if (type === 0) {
    return (
      <span
        className={`
          text-neutral-500
          transition-all duration-[500ms] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
      >
        {text}
      </span>
    );
  }

  // Added text - elegant reveal with refined glow
  if (type === 1) {
    return (
      <span
        className={`
          inline
          text-white/95
          rounded-[2px] px-[3px] mx-[2px]
          transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isVisible
            ? 'opacity-100 bg-white/[0.06] shadow-[0_0_16px_rgba(255,255,255,0.03)]'
            : 'opacity-0 bg-transparent translate-y-[2px]'
          }
        `}
        style={{
          transitionDelay: isVisible ? '0ms' : `${Math.min(index * 15, 150)}ms`
        }}
      >
        {text}
      </span>
    );
  }

  // Removed text - fade out with strikethrough reveal
  if (type === -1) {
    return (
      <span
        className={`
          inline
          line-through decoration-neutral-700/60 decoration-[1px]
          mx-[2px] select-none
          transition-all duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isVisible
            ? 'opacity-30 text-neutral-600'
            : 'opacity-0 text-neutral-500'
          }
        `}
        style={{
          transitionDelay: isVisible ? '0ms' : `${Math.min(index * 12, 120)}ms`
        }}
      >
        {text}
      </span>
    );
  }

  return null;
});

DiffSegment.displayName = 'DiffSegment';

export const DiffViewer = memo<DiffViewerProps>(({ oldText, newText, className = '', direction = 'auto' }) => {
  const diffs = useMemo(() => {
    const dmp = new DiffMatchPatch();
    const diff = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diff);
    return diff;
  }, [oldText, newText]);

  // Count total changes for animation timing
  const totalChanges = useMemo(() =>
    diffs.filter(([type]) => type !== 0).length
    , [diffs]);

  // Pre-calculate indices to avoid mutation during render
  const diffsWithIndices = useMemo(() => {
    let changeIndex = 0;
    return diffs.map((part) => {
      const [type, text] = part;
      // Assign an index only if it's a change (type != 0)
      const currentChangeIndex = type !== 0 ? changeIndex++ : 0;
      return { type, text, currentChangeIndex };
    });
  }, [diffs]);

  // Determine text direction - auto-detect from content if direction is 'auto'
  const resolvedDirection = useMemo(() => {
    if (direction !== 'auto') return direction;
    // Check both old and new text for RTL content
    const combinedText = oldText + newText;
    return detectRTL(combinedText) ? 'rtl' : 'ltr';
  }, [direction, oldText, newText]);

  return (
    <div
      dir={resolvedDirection}
      className={`
        w-full h-full 
        
        /* Typography - Matching Composer precision */
        text-[1.375rem] 
        font-light 
        leading-[1.7]
        tracking-[-0.01em]
        antialiased
        
        whitespace-pre-wrap break-words
        
        /* Scrollbar - Ultra minimal */
        [scrollbar-width:thin]
        [scrollbar-color:rgba(255,255,255,0.06)_transparent]
        [&::-webkit-scrollbar]:w-[3px]
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:bg-white/[0.06]
        [&::-webkit-scrollbar-thumb]:rounded-full
        
        overflow-y-auto
        py-6
        ${resolvedDirection === 'rtl' ? 'text-right' : 'text-left'}
        ${className}
      `}
    >
      {diffsWithIndices.map((item, index) => (
        <DiffSegment
          key={index}
          type={item.type}
          text={item.text}
          index={item.type !== 0 ? item.currentChangeIndex : index}
          totalChanges={totalChanges}
        />
      ))}
    </div>
  );
});

DiffViewer.displayName = 'DiffViewer';
