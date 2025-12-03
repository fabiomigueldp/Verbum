import React, { useMemo, useState, useEffect } from 'react';
import DiffMatchPatch from 'diff-match-patch';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  className?: string;
}

// Staggered animation component for each diff segment
const DiffSegment: React.FC<{
  type: number;
  text: string;
  index: number;
  totalChanges: number;
}> = ({ type, text, index, totalChanges }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Stagger animation based on position, with a max delay cap
    const baseDelay = type === 0 ? 0 : Math.min(index * 30, 300);
    const timer = setTimeout(() => setIsVisible(true), baseDelay);
    return () => clearTimeout(timer);
  }, [index, type]);

  // Unchanged text - subtle fade, readable but not prominent
  if (type === 0) {
    return (
      <span
        className={`
          text-neutral-400
          transition-all duration-500 ease-out
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
      >
        {text}
      </span>
    );
  }

  // Added text - elegant reveal with glow
  if (type === 1) {
    return (
      <span
        className={`
          inline
          text-white/90
          rounded-sm px-0.5 mx-0.5
          transition-all duration-700 ease-out
          ${isVisible
            ? 'opacity-100 bg-white/[0.08] shadow-[0_0_20px_rgba(255,255,255,0.05)]'
            : 'opacity-0 bg-transparent translate-y-1'
          }
        `}
        style={{
          transitionDelay: isVisible ? '0ms' : `${Math.min(index * 20, 200)}ms`
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
          line-through decoration-neutral-600/50 decoration-1
          mx-0.5 select-none
          transition-all duration-500 ease-out
          ${isVisible
            ? 'opacity-40 text-neutral-600'
            : 'opacity-0 text-neutral-400'
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

  return null;
};

export const DiffViewer: React.FC<DiffViewerProps> = ({ oldText, newText, className = '' }) => {
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

  return (
    <div
      className={`
        w-full h-full 
        text-2xl font-light leading-relaxed 
        whitespace-pre-wrap break-words
        custom-scrollbar overflow-y-auto
        py-6
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
};
