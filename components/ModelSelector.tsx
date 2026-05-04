import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import type { ProviderModel } from '../services/providers';

interface ModelSelectorProps {
  models: ProviderModel[];
  value: string;
  onChange: (modelId: string) => void;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

export const ModelSelector = memo<ModelSelectorProps>(({ models, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = models.find((m) => m.id === value);

  const measurePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  const openDropdown = useCallback(() => {
    measurePosition();
    setIsOpen(true);
  }, [measurePosition]);

  const toggleDropdown = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      openDropdown();
    }
  }, [isOpen, openDropdown]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      // Check if click is inside the dropdown portal
      const dropdown = document.getElementById('model-selector-dropdown');
      if (dropdown && dropdown.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Recalculate on resize / scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => measurePosition();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen, measurePosition]);

  const dropdownContent = isOpen && position ? (
    <div
      id="model-selector-dropdown"
      className="
        absolute z-[9999]
        bg-neutral-900/95 backdrop-blur-xl
        border border-white/[0.08]
        rounded-xl
        shadow-[0_8px_32px_rgba(0,0,0,0.5)]
        overflow-hidden
        animate-fade-in
      "
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
      }}
    >
      <div className="py-1">
        {models.map((model) => {
          const isSelected = model.id === value;
          return (
            <button
              key={model.id}
              onClick={() => {
                onChange(model.id);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center justify-between
                px-3 py-2.5
                text-left
                transition-all duration-200
                ${isSelected
                  ? 'bg-white/[0.06]'
                  : 'hover:bg-white/[0.03]'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className={`
                  text-[12px] tracking-tight
                  ${isSelected ? 'text-white font-medium' : 'text-neutral-400'}
                `}>
                  {model.label}
                </span>
                {model.badge && (
                  <span className={`
                    text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full border
                    ${model.badgeStyle || 'bg-neutral-900 text-neutral-400 border-white/10'}
                  `}>
                    {model.badge}
                  </span>
                )}
              </div>
              {isSelected && (
                <Check size={12} className="text-neutral-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={toggleDropdown}
        className={`
          w-full flex items-center justify-between
          px-3 py-2.5 rounded-lg
          bg-white/[0.03] border border-white/[0.06]
          hover:border-white/[0.12]
          transition-all duration-300
        `}
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-white tracking-tight">
            {selected?.label || 'Select model'}
          </span>
          {selected?.badge && (
            <span className={`
              text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full border
              ${selected.badgeStyle || 'bg-neutral-900 text-neutral-400 border-white/10'}
            `}>
              {selected.badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`
            text-neutral-500 transition-transform duration-300
            ${isOpen ? 'rotate-180' : ''}
          `}
        />
      </button>

      {/* Dropdown — Rendered via Portal to document.body, escaping all parent constraints */}
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
});

ModelSelector.displayName = 'ModelSelector';
