import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SimpleDropdownOption {
  value: string;
  label: string;
}

interface SimpleDropdownProps {
  value: string;
  options: SimpleDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SimpleDropdown = memo<SimpleDropdownProps>(({ value, options, onChange, placeholder = 'Select' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const select = useCallback((v: string) => {
    onChange(v);
    setIsOpen(false);
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggle}
        className={`
          flex items-center gap-1.5
          px-2.5 py-1.5 rounded-lg
          bg-neutral-950/60 border border-white/[0.08]
          text-[11px] text-neutral-300
          hover:border-white/[0.15]
          transition-all duration-200
          focus:outline-none focus:border-white/20
          min-w-[100px]
        `}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown
          size={12}
          className={`text-neutral-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className={`
            absolute top-full left-0 mt-1 z-50
            min-w-[140px]
            bg-neutral-900/95 backdrop-blur-xl
            border border-white/[0.08]
            rounded-xl
            shadow-[0_8px_32px_rgba(0,0,0,0.5)]
            overflow-hidden
            animate-fade-in
          `}
        >
          <div className="py-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  onClick={() => select(option.value)}
                  className={`
                    w-full flex items-center justify-between
                    px-3 py-2
                    text-left
                    transition-all duration-150
                    ${isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}
                  `}
                >
                  <span className={`
                    text-[11px]
                    ${isSelected ? 'text-white font-medium' : 'text-neutral-400'}
                  `}>
                    {option.label}
                  </span>
                  {isSelected && <Check size={12} className="text-neutral-500" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

SimpleDropdown.displayName = 'SimpleDropdown';
