import React, { useState, useRef, useCallback, memo, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Send, Loader2, Mic, Sparkles, Sliders, Eye, RotateCcw, GitCompareArrows, Check } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../types';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Detects if text contains predominantly RTL characters (Arabic, Hebrew)
 * Uses Unicode ranges for Arabic (0600-06FF) and Hebrew (0590-05FF)
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

/**
 * Gets RTL status from language config
 */
const isLanguageRTL = (langCode: Exclude<LanguageCode, 'unknown'>): boolean => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
  return lang?.dir === 'rtl';
};

// ============================================================================
// TYPES
// ============================================================================

export interface ComposerRef {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
}

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRefine: () => void;
  onShowSettings: () => void;
  
  // States
  loading?: boolean;
  isRefining?: boolean;
  isListening?: boolean;
  isSpeechSupported?: boolean;
  hasApiKey?: boolean;
  provider?: 'gemini' | 'xai';
  
  // Diff Mode
  originalInput?: string | null;
  showDiff?: boolean;
  onToggleDiff?: () => void;
  onRevert?: () => void;
  onApplyEnhancement?: () => void;
  
  // Voice
  onToggleListening?: () => void;
  
  // Feature flags
  autoEnhance?: boolean;
  contextEnabled?: boolean;
  
  // Language Matrix
  anchorLanguage?: Exclude<LanguageCode, 'unknown'>;
  targetLanguage?: Exclude<LanguageCode, 'unknown'>;
}

// ============================================================================
// SUB-COMPONENTS (Memoized for performance)
// ============================================================================

/**
 * Premium Toolbar Button with magnetic hover and mechanical press
 */
const ToolbarButton = memo<{
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'ghost' | 'subtle' | 'primary' | 'danger';
  title?: string;
  className?: string;
  children: React.ReactNode;
}>(({ onClick, disabled, active, variant = 'ghost', title, className = '', children }) => {
  const baseStyles = `
    relative overflow-hidden
    transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]
    disabled:pointer-events-none
    focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20
  `;
  
  const variants = {
    ghost: `
      text-neutral-500
      hover:text-white hover:bg-white/[0.04]
      active:scale-[0.97] active:bg-white/[0.06]
      disabled:text-neutral-700 disabled:bg-transparent
      ${active ? 'text-white bg-white/[0.08]' : ''}
    `,
    subtle: `
      text-neutral-400 bg-white/[0.03]
      hover:text-white hover:bg-white/[0.06]
      active:scale-[0.97] active:bg-white/[0.08]
      disabled:text-neutral-700 disabled:bg-white/[0.02]
      ${active ? 'text-white bg-white/[0.08]' : ''}
    `,
    primary: `
      bg-neutral-200 text-neutral-900
      hover:bg-white
      active:scale-[0.97] active:bg-neutral-100
      shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.3)]
      hover:shadow-[0_0_20px_rgba(255,255,255,0.15),0_2px_12px_rgba(0,0,0,0.4)]
      disabled:bg-neutral-800 disabled:text-neutral-600 disabled:shadow-none
    `,
    danger: `
      text-red-400/80 bg-red-500/[0.08]
      border border-red-500/20
      hover:text-red-400 hover:bg-red-500/[0.12]
      active:scale-[0.97]
      shadow-[0_0_15px_rgba(239,68,68,0.2)]
    `,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {/* Magnetic glow effect on hover */}
      <span 
        className="
          absolute inset-0 opacity-0 
          bg-gradient-to-r from-transparent via-white/[0.03] to-transparent
          group-hover:opacity-100
          transition-opacity duration-500
          pointer-events-none
        " 
      />
      {children}
    </button>
  );
});

ToolbarButton.displayName = 'ToolbarButton';

/**
 * Vertical Divider - metallic ridge aesthetic
 */
const ToolbarDivider = memo(() => (
  <div className="h-5 w-px bg-gradient-to-b from-transparent via-neutral-700 to-transparent mx-2 opacity-50" />
));

ToolbarDivider.displayName = 'ToolbarDivider';

/**
 * Diff Mode Controls - cinematic reveal
 */
const DiffControls = memo<{
  showDiff: boolean;
  onToggleDiff: () => void;
  onRevert: () => void;
  onApply: () => void;
}>(({ showDiff, onToggleDiff, onRevert, onApply }) => (
  <div 
    className="
      flex items-center gap-1 
      bg-white/[0.03] 
      rounded-full p-1
      border border-white/[0.04]
      animate-[fadeSlideIn_400ms_cubic-bezier(0.16,1,0.3,1)_forwards]
    "
  >
    {/* Preview/Diff Toggle */}
    <ToolbarButton
      onClick={onToggleDiff}
      active={showDiff}
      variant="ghost"
      title={showDiff ? "Edit Text" : "View Changes"}
      className="flex items-center gap-2 py-1.5 px-3 rounded-full"
    >
      {showDiff ? (
        <>
          <GitCompareArrows size={13} className="opacity-80" />
          <span className="text-[10px] uppercase tracking-[0.15em] font-medium hidden sm:inline">Diff</span>
        </>
      ) : (
        <>
          <Eye size={13} className="opacity-80" />
          <span className="text-[10px] uppercase tracking-[0.15em] font-medium hidden sm:inline">Preview</span>
        </>
      )}
    </ToolbarButton>

    <div className="w-px h-3 bg-white/[0.06]" />

    {/* Revert Button */}
    <ToolbarButton
      onClick={onRevert}
      variant="ghost"
      title="Revert to Original"
      className="p-2 rounded-full"
    >
      <RotateCcw size={13} />
    </ToolbarButton>

    <div className="w-px h-3 bg-white/[0.06]" />

    {/* Apply Button - Primary Action */}
    <ToolbarButton
      onClick={onApply}
      variant="primary"
      title="Apply Enhancement"
      className="flex items-center gap-1.5 py-1.5 px-3 rounded-full"
    >
      <Check size={13} strokeWidth={2.5} />
      <span className="text-[10px] uppercase tracking-[0.15em] font-semibold hidden sm:inline">Apply</span>
    </ToolbarButton>
  </div>
));

DiffControls.displayName = 'DiffControls';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const Composer = memo(forwardRef<ComposerRef, ComposerProps>(({
  value,
  onChange,
  onSubmit,
  onRefine,
  onShowSettings,
  loading = false,
  isRefining = false,
  isListening = false,
  isSpeechSupported = false,
  hasApiKey = false,
  provider = 'gemini',
  originalInput = null,
  showDiff = false,
  onToggleDiff,
  onRevert,
  onApplyEnhancement,
  onToggleListening,
  autoEnhance = false,
  contextEnabled = false,
  anchorLanguage = 'pt',
  targetLanguage = 'en',
}, ref) => {
  // Focus state for the vessel's "breathing" active state
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // RTL Detection - based on content or target language
  const contentDirection = useMemo(() => {
    // First, detect from content
    const contentIsRTL = detectRTL(value);
    if (contentIsRTL) return 'rtl';
    
    // If content has no strong direction, check if anchor or target is RTL
    // and we have no content yet
    if (!value.trim()) {
      // Default to LTR for empty content
      return 'ltr';
    }
    
    return 'ltr';
  }, [value]);

  // Expose imperative handle for parent control
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    getValue: () => value,
    setValue: (newValue: string) => onChange(newValue),
  }));

  // Handlers
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }, [onSubmit]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  // Derived state
  const hasContent = value.trim().length > 0;
  const isDisabled = loading || isRefining;
  const showDiffControls = originalInput && !isRefining;

  return (
    <div className="w-full animate-[slideUp_500ms_cubic-bezier(0.16,1,0.3,1)_forwards]">
      {/* ================================================================
          THE VESSEL - Premium Glass Card with Active State
          ================================================================ */}
      <div
        ref={containerRef}
        className={`
          relative overflow-hidden
          bg-neutral-900/40
          backdrop-blur-2xl
          rounded-2xl
          
          /* Border - Contextual Depth */
          border
          transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isFocused 
            ? 'border-white/[0.12] shadow-[0_0_40px_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.4)]' 
            : 'border-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
          }
        `}
      >
        {/* Subtle shine gradient - top-left origin */}
        <div 
          className={`
            absolute top-0 left-0 w-full h-full 
            bg-gradient-to-br from-white/[0.04] to-transparent 
            pointer-events-none
            transition-opacity duration-700
            ${isFocused ? 'opacity-100' : 'opacity-50'}
          `} 
        />

        {/* Inner active glow - breathing effect when focused */}
        <div 
          className={`
            absolute inset-0
            bg-gradient-to-b from-white/[0.02] via-transparent to-transparent
            pointer-events-none
            transition-opacity duration-1000
            ${isFocused ? 'opacity-100 animate-[breatheGlow_4s_ease-in-out_infinite]' : 'opacity-0'}
          `}
        />
        
        {/* Content Container */}
        <div className="relative z-10 flex flex-col h-[420px] p-4 sm:p-8">
          
          {/* ================================================================
              MAIN INPUT AREA - Zero Layout Shift
              ================================================================ */}
          <div className="flex-1 relative min-h-0">
            {showDiff && originalInput ? (
              <DiffViewer
                oldText={originalInput}
                newText={value}
                className="
                  [mask-image:linear-gradient(to_bottom,transparent_0px,black_24px,black_calc(100%-24px),transparent_100%)]
                "
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder="Enter text or use dictation..."
                readOnly={isDisabled}
                spellCheck={false}
                dir={contentDirection}
                className={`
                  w-full h-full 
                  bg-transparent 
                  
                  /* Typography - Precision */
                  text-[1.375rem] 
                  font-light 
                  text-white
                  leading-[1.7]
                  tracking-[-0.01em]
                  antialiased
                  
                  /* Placeholder - Extremely subtle */
                  placeholder:text-neutral-700
                  placeholder:font-light
                  placeholder:transition-opacity
                  placeholder:duration-500
                  
                  /* Caret - Pure white */
                  caret-white
                  
                  /* Layout */
                  resize-none 
                  py-6
                  
                  /* Kill all borders/outlines - Visual Artifact Fix */
                  border-none
                  outline-none
                  shadow-none
                  focus:outline-none 
                  focus:ring-0
                  focus:border-none
                  
                  /* Scrollbar - Ultra minimal, transparent track */
                  [scrollbar-width:thin]
                  [scrollbar-color:rgba(255,255,255,0.06)_transparent]
                  
                  /* Webkit scrollbar - Explicit transparent track */
                  [&::-webkit-scrollbar]:w-[3px]
                  [&::-webkit-scrollbar]:bg-transparent
                  [&::-webkit-scrollbar-track]:bg-transparent
                  [&::-webkit-scrollbar-track]:border-none
                  [&::-webkit-scrollbar-thumb]:bg-white/[0.06]
                  [&::-webkit-scrollbar-thumb]:rounded-full
                  [&:hover::-webkit-scrollbar-thumb]:bg-white/[0.1]
                  
                  /* Mask - Edge fade (inset slightly to avoid 1px edge artifacts) */
                  [mask-image:linear-gradient(to_bottom,transparent_0px,black_20px,black_calc(100%-20px),transparent_100%)]
                  
                  /* Numeric alignment */
                  [font-variant-numeric:tabular-nums]
                  
                  /* Refining state */
                  transition-all duration-700
                  ${isRefining ? 'text-neutral-600 blur-[0.5px]' : ''}
                  
                  /* RTL text alignment */
                  ${contentDirection === 'rtl' ? 'text-right' : 'text-left'}
                `}
              />
            )}
          </div>

          {/* ================================================================
              TOOLBAR - Control Surface (Metallic Ridge)
              ================================================================ */}
          <div 
            className="
              shrink-0 
              pt-6 
              flex items-center justify-between 
              border-t border-white/[0.04]
              mt-2
            "
          >
            {/* Left Side: Refinement Tools */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Language Indicator - Hidden on mobile when diff is active */}
              <button
                onClick={onShowSettings}
                title="Configure Languages"
                className={`
                  flex items-center gap-1
                  px-2 py-1.5 rounded-md
                  text-[10px] font-medium tracking-[0.1em]
                  text-neutral-600
                  hover:text-neutral-400
                  hover:bg-white/[0.03]
                  transition-all duration-300
                  focus:outline-none
                  ${showDiffControls ? 'hidden sm:flex' : 'flex'}
                `}
              >
                <span className="text-neutral-500">{anchorLanguage.toUpperCase()}</span>
                <span className="text-neutral-700">/</span>
                <span className="text-neutral-500">{targetLanguage.toUpperCase()}</span>
              </button>

              <ToolbarDivider />

              {/* Settings Button */}
              <ToolbarButton
                onClick={onShowSettings}
                active={autoEnhance || contextEnabled}
                variant="ghost"
                title="Settings"
                className="p-3 rounded-full"
              >
                <Sliders size={17} />
              </ToolbarButton>

              {/* API Key Indicator */}
              {!hasApiKey && (
                <ToolbarButton
                  onClick={onShowSettings}
                  variant="subtle"
                  title={provider === 'xai' ? 'Add an xAI API key' : 'Add a Gemini API key'}
                  className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/[0.06]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
                  <span className="text-[10px] tracking-[0.15em] uppercase text-neutral-500">API Key</span>
                </ToolbarButton>
              )}

              <ToolbarDivider />

              {/* Enhance Button - Discrete but visible, Pro aesthetic */}
              <button
                onClick={onRefine}
                disabled={!hasContent || isDisabled || showDiff}
                title={showDiff ? "Exit diff mode to enhance again" : "Refine Text"}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full
                  transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]
                  focus:outline-none
                  
                  /* Base state - visible but understated */
                  text-neutral-500
                  bg-transparent
                  
                  /* Hover - gentle highlight */
                  hover:text-neutral-300
                  hover:bg-white/[0.05]
                  
                  /* Active/Press */
                  active:scale-[0.97]
                  
                  /* Disabled - muted */
                  disabled:text-neutral-700
                  disabled:bg-transparent
                  disabled:pointer-events-none
                  
                  /* Refining state */
                  ${isRefining ? 'text-neutral-300 bg-white/[0.06]' : ''}
                `}
              >
                <Sparkles 
                  size={15} 
                  className={`
                    transition-all duration-500
                    ${isRefining ? 'animate-[spin_3s_linear_infinite]' : ''}
                  `} 
                />
                <span className="text-[10px] tracking-[0.14em] uppercase font-medium hidden sm:block">
                  {isRefining ? 'Improving...' : 'Enhance'}
                </span>
              </button>

              {/* Diff Controls - Cinematic Reveal */}
              {showDiffControls && onToggleDiff && onRevert && onApplyEnhancement && (
                <DiffControls
                  showDiff={showDiff}
                  onToggleDiff={onToggleDiff}
                  onRevert={onRevert}
                  onApply={onApplyEnhancement}
                />
              )}
            </div>

            {/* Right Side: Action Tools */}
            <div className="flex items-center gap-4">
              {/* Microphone Button */}
              {isSpeechSupported && onToggleListening && (
                <div className="flex items-center gap-3">
                  {isListening && (
                    <span className="text-[10px] tracking-[0.2em] text-red-400/80 font-medium uppercase animate-pulse">
                      REC
                    </span>
                  )}
                  <ToolbarButton
                    onClick={onToggleListening}
                    disabled={showDiff}
                    variant={isListening ? 'danger' : 'ghost'}
                    title={isListening ? "Stop Recording" : "Start Dictation"}
                    className="p-3 rounded-full"
                  >
                    <div className="relative">
                      {isListening && (
                        <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                      )}
                      <Mic size={18} className={isListening ? "animate-pulse" : ""} />
                    </div>
                  </ToolbarButton>
                </div>
              )}

              <ToolbarDivider />

              {/* Send/Translate Button - Ghost-to-Fill Premium */}
              <button
                onClick={onSubmit}
                disabled={!hasContent || isDisabled}
                title="Translate (Enter)"
                className={`
                  relative overflow-hidden
                  w-12 h-12 rounded-xl
                  flex items-center justify-center
                  transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]
                  focus:outline-none
                  group
                  
                  /* Ghost state - border only */
                  border border-neutral-600
                  bg-transparent
                  text-neutral-500
                  
                  /* Hover - Fill with white */
                  hover:bg-white
                  hover:border-white
                  hover:text-neutral-900
                  hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]
                  
                  /* Active - Mechanical press */
                  active:scale-[0.95]
                  
                  /* Disabled - Powered down */
                  disabled:border-neutral-800
                  disabled:text-neutral-700
                  disabled:bg-transparent
                  disabled:shadow-none
                  disabled:pointer-events-none
                `}
              >
                {/* Fill animation layer */}
                <span 
                  className="
                    absolute inset-0 
                    bg-white 
                    rounded-xl
                    scale-0 
                    group-hover:scale-100 
                    transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]
                    origin-center
                  " 
                />
                
                {/* Icon layer */}
                <span className="relative z-10">
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send 
                      size={18} 
                      className="
                        transition-transform duration-300 
                        ease-[cubic-bezier(0.16,1,0.3,1)]
                        group-hover:translate-x-0.5 
                        group-hover:-translate-y-0.5
                      " 
                    />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}));

Composer.displayName = 'Composer';

export default Composer;
