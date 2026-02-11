import { useEffect, useMemo, useState, useRef } from 'react';
import { Check, X, Plus, Trash2, Zap, Link, Boxes, KeyRound, Eye, EyeOff, ChevronDown, Globe } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { ToneOption, CustomTone, UsageSession, LanguageCode, SUPPORTED_LANGUAGES } from '../types';
import { CustomToneModal } from './CustomToneModal';
import { TokenTelemetry } from './TokenTelemetry';

interface RefineModalProps {
  currentTone: ToneOption;
  customTones: CustomTone[];
  autoEnhance: boolean;
  onToggleAutoEnhance: (enabled: boolean) => void;
  contextEnabled: boolean;
  onToggleContext: (enabled: boolean) => void;
  contextDepth: number;
  onUpdateContextDepth: (depth: number) => void;
  provider: 'gemini' | 'xai';
  onProviderChange: (provider: 'gemini' | 'xai') => void;
  model: string;
  geminiApiKey: string;
  xaiApiKey: string;
  resolvedApiKey: string;
  isEnvKey?: boolean;
  onModelChange: (model: string) => void;
  onGeminiApiKeyChange: (key: string) => void;
  onXaiApiKeyChange: (key: string) => void;
  sessionStats: UsageSession;
  onResetSessionStats: () => void;
  // Language Matrix
  anchorLanguage: Exclude<LanguageCode, 'unknown'>;
  targetLanguage: Exclude<LanguageCode, 'unknown'>;
  onAnchorLanguageChange: (lang: Exclude<LanguageCode, 'unknown'>) => void;
  onTargetLanguageChange: (lang: Exclude<LanguageCode, 'unknown'>) => void;
  onSelect: (tone: ToneOption) => void;
  onAddCustomTone: (tone: CustomTone) => void;
  onDeleteCustomTone: (id: string) => void;
  onClose: () => void;
}

const STANDARD_TONES: { id: string; label: string; desc: string }[] = [
  { id: 'standard', label: 'Standard Review', desc: 'Grammar, spelling, and flow corrections.' },
  { id: 'executive', label: 'Executive', desc: 'Sophisticated, authoritative, and professional.' },
  { id: 'concise', label: 'Concise', desc: 'Direct, short, and to the point. Removes fluff.' },
  { id: 'softer', label: 'Softer Tone', desc: 'Diplomatic, empathetic, and polite.' },
];

const MODEL_OPTIONS: { id: string; label: string; desc: string; badge?: string; badgeStyle?: string }[] = [
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    desc: 'Maximum speed. Instant latency.',
    badge: 'Fastest',
    badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10'
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    desc: 'Balanced performance.',
    badge: 'Balanced',
    badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10'
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    desc: 'Complex reasoning.',
    badge: 'Pro',
    badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10'
  },
  {
    id: 'gemini-2.5-flash-lite-preview-09-2025',
    label: 'Gemini 2.5 Flash Lite Preview',
    desc: 'Experimental speed build.',
    badge: 'Preview',
    badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10'
  },
  {
    id: 'gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash Lite',
    desc: 'Stable low-latency option.',
    badge: 'Lite',
    badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10'
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    desc: 'Next-gen speed preview.',
    badge: 'Preview',
    badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10'
  },
];

export const RefineModal = ({
  currentTone,
  customTones,
  autoEnhance,
  onToggleAutoEnhance,
  contextEnabled,
  onToggleContext,
  contextDepth,
  onUpdateContextDepth,
  provider,
  onProviderChange,
  model,
  geminiApiKey,
  xaiApiKey,
  resolvedApiKey,
  isEnvKey,
  onModelChange,
  onGeminiApiKeyChange,
  onXaiApiKeyChange,
  sessionStats,
  onResetSessionStats,
  anchorLanguage,
  targetLanguage,
  onAnchorLanguageChange,
  onTargetLanguageChange,
  onSelect,
  onAddCustomTone,
  onDeleteCustomTone,
  onClose
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);

  // Local state for slider to prevent parent re-renders on every drag event
  const [localDepth, setLocalDepth] = useState(contextDepth);

  useEffect(() => {
    setLocalDepth(contextDepth);
  }, [contextDepth]);

  const hasResolvedApiKey = Boolean(resolvedApiKey);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const currentModelLabel = MODEL_OPTIONS.find((m) => m.id === model)?.label || 'Model';
  const isGemini = provider === 'gemini';
  const modelLabel = isGemini ? currentModelLabel : 'Grok 4.1 Fast (Non-Reasoning)';
  const apiKeyValue = isGemini ? geminiApiKey : xaiApiKey;

  useEffect(() => {
    if (!hasResolvedApiKey && showModels) {
      const timer = setTimeout(() => apiKeyInputRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [hasResolvedApiKey, showModels, provider]);

  if (isCreating) {
    return (
      <CustomToneModal
        onSave={(tone) => {
          onAddCustomTone(tone);
          setIsCreating(false);
        }}
        onBack={() => setIsCreating(false)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content - Fixed height to prevent jumping */}
      <GlassCard className="w-full max-w-md max-h-[85vh] relative animate-slide-up bg-neutral-900/90" hoverEffect={false}>
        <div className="p-6 flex flex-col min-h-0 max-h-[85vh]">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">
              Settings
            </h3>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="overflow-y-auto pr-2 -mr-2 space-y-6 custom-scrollbar flex-1 min-h-0">

            {/* Language Matrix - Smart Pivot Configuration */}
            <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowLanguages(!showLanguages)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-neutral-900 text-white border border-white/10">
                    <Globe size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white block">Language Matrix</span>
                    <span className="text-xs text-neutral-500 font-light">
                      {anchorLanguage.toUpperCase()} / {targetLanguage.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-neutral-500">
                  <span className="text-[10px] uppercase tracking-[0.2em]">Configure</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${showLanguages ? 'rotate-180 text-white' : ''}`}
                  />
                </div>
              </button>

              {showLanguages && (
                <div className="px-4 pt-4 pb-4 space-y-5 animate-fade-in border-t border-white/5">
                  {/* Anchor Language */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold">
                        Anchor (Native)
                      </span>
                      <span className="text-[10px] text-neutral-600 font-light">Your primary language</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                          key={`anchor-${lang.code}`}
                          onClick={() => {
                            if (lang.code !== targetLanguage) {
                              onAnchorLanguageChange(lang.code);
                            }
                          }}
                          disabled={lang.code === targetLanguage}
                          title={lang.name}
                          className={`
                            px-2 py-1.5 rounded-lg text-center transition-all duration-300 relative group/lang
                            ${anchorLanguage === lang.code
                              ? 'bg-white/10 border border-white/20 text-white'
                              : lang.code === targetLanguage
                                ? 'bg-transparent border border-white/5 text-neutral-700 cursor-not-allowed'
                                : 'bg-transparent border border-white/5 text-neutral-400 hover:border-white/15 hover:text-white'
                            }
                            ${lang.dir === 'rtl' ? 'font-medium' : ''}
                          `}
                        >
                          <span className="text-[10px] font-medium tracking-wide">{lang.code.toUpperCase()}</span>
                          {/* RTL indicator */}
                          {lang.dir === 'rtl' && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white/30" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target Language */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold">
                        Target (Foreign)
                      </span>
                      <span className="text-[10px] text-neutral-600 font-light">Translation destination</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                          key={`target-${lang.code}`}
                          onClick={() => {
                            if (lang.code !== anchorLanguage) {
                              onTargetLanguageChange(lang.code);
                            }
                          }}
                          disabled={lang.code === anchorLanguage}
                          title={lang.name}
                          className={`
                            px-2 py-1.5 rounded-lg text-center transition-all duration-300 relative group/lang
                            ${targetLanguage === lang.code
                              ? 'bg-white/10 border border-white/20 text-white'
                              : lang.code === anchorLanguage
                                ? 'bg-transparent border border-white/5 text-neutral-700 cursor-not-allowed'
                                : 'bg-transparent border border-white/5 text-neutral-400 hover:border-white/15 hover:text-white'
                            }
                            ${lang.dir === 'rtl' ? 'font-medium' : ''}
                          `}
                        >
                          <span className="text-[10px] font-medium tracking-wide">{lang.code.toUpperCase()}</span>
                          {/* RTL indicator */}
                          {lang.dir === 'rtl' && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white/30" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Smart Pivot Explanation */}
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-[10px] text-neutral-600 font-light leading-relaxed">
                      Smart Pivot: Text in {anchorLanguage.toUpperCase()} translates to {targetLanguage.toUpperCase()}, 
                      and vice versa. Any other language translates to {anchorLanguage.toUpperCase()}.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Model & Access */}
            <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowModels(!showModels)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-neutral-900 text-white border border-white/10">
                    <Boxes size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white block">Model</span>
                    <span className="text-xs text-neutral-500 font-light">Current: {modelLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-neutral-500">
                  <span className="text-[10px] uppercase tracking-[0.2em]">Expand</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${showModels ? 'rotate-180 text-white' : ''}`}
                  />
                </div>
              </button>

              {showModels && (
                <div className="px-4 pt-4 pb-4 space-y-4 animate-fade-in border-t border-white/5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Provider</span>
                      <span className="text-[10px] text-neutral-600 font-light">Applies to Translation + Collectio</span>
                    </div>
                    <div className="relative inline-flex items-center rounded-full border border-white/10 bg-neutral-950/60 p-1">
                      <span
                        className={`
                          absolute top-1 bottom-1 w-[50%] rounded-full
                          bg-white/10 border border-white/20
                          transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
                          ${provider === 'xai' ? 'translate-x-full' : 'translate-x-0'}
                        `}
                      />
                      {([
                        { id: 'gemini', label: 'Gemini' },
                        { id: 'xai', label: 'Grok' },
                      ] as const).map((option) => (
                        <button
                          key={option.id}
                          onClick={() => onProviderChange(option.id)}
                          className={`
                            relative z-10 px-4 py-2 rounded-full
                            text-[11px] uppercase tracking-[0.18em]
                            transition-colors duration-300
                            ${provider === option.id
                              ? 'text-white'
                              : 'text-neutral-500 hover:text-neutral-300'}
                          `}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                    <div className={`transition-opacity duration-300 ${isGemini ? 'opacity-100' : 'opacity-90'}`}>
                  {isGemini ? (
                    <div className="space-y-2">
                      {MODEL_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => onModelChange(option.id)}
                          className={`
                            w-full text-left p-3 rounded-lg border transition-all duration-300 group relative
                            ${model === option.id
                              ? 'bg-white/10 border-white/15 shadow-[0_0_12px_rgba(255,255,255,0.05)]'
                              : 'bg-transparent border-white/5 hover:border-white/10 hover:bg-white/5'}
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-white">{option.label}</span>
                              {option.badge && (
                                <span className={`text-[10px] uppercase px-2 py-1 rounded-full border tracking-[0.15em] ${option.badgeStyle}`}>
                                  {option.badge}
                                </span>
                              )}
                            </div>
                            {model === option.id ? (
                              <Check size={14} className="text-white" />
                            ) : (
                              <span className="text-[10px] text-neutral-500 uppercase tracking-[0.15em]">Use</span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                            {option.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-white block">Grok 4.1 Fast (Non-Reasoning)</span>
                          <span className="text-xs text-neutral-500 font-light">Fixed model for xAI</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">Fixed</span>
                      </div>
                    </div>
                  )}
                  </div>

                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-neutral-800 text-neutral-200 border border-white/10">
                          <KeyRound size={16} />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white block">API Key</span>
                          <span className="text-xs text-neutral-500 font-light">
                            {isEnvKey ? 'Loaded from Environment Variables' : 'Stored locally on this device'}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${hasResolvedApiKey ? 'text-neutral-200' : 'text-neutral-500'}`}>
                        {hasResolvedApiKey ? 'Active' : 'Missing'}
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        ref={apiKeyInputRef}
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKeyValue}
                        onChange={(e) => {
                          if (isGemini) {
                            onGeminiApiKeyChange(e.target.value);
                          } else {
                            onXaiApiKeyChange(e.target.value);
                          }
                        }}
                        placeholder={isGemini ? "Gemini API key" : "xAI API key"}
                        className={`w-full bg-neutral-950/60 border rounded-lg px-3 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/30 transition-colors pr-10 ${hasResolvedApiKey ? 'border-white/10' : 'border-white/20 shadow-[0_0_18px_rgba(255,255,255,0.06)]'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                        title={showApiKey ? "Hide API key" : "Show API key"}
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {!hasResolvedApiKey && (
                      <p className="text-[11px] text-neutral-500 leading-relaxed flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white/50 animate-pulse" />
                        {isGemini ? (
                          <>
                            Obtain a Gemini key at{" "}
                            <a
                              href="https://aistudio.google.com/api-keys"
                              target="_blank"
                              rel="noreferrer"
                              className="text-white hover:underline"
                            >
                              aistudio.google.com/api-keys
                            </a>.
                          </>
                        ) : (
                          <>
                            Obtain an xAI key at{" "}
                          <a
                            href="https://console.x.ai/team/default/api-keys"
                            target="_blank"
                            rel="noreferrer"
                            className="text-white hover:underline"
                          >
                            console.x.ai/api-keys
                          </a>.
                          </>
                        )}
                      </p>
                    )}
                    <p className="text-[10px] text-neutral-600 font-light">
                      Keys typed here are stored only in your browser (localStorage). If empty, we fall back to your environment key when available.
                    </p>

                    {/* Token Telemetry */}
                    <TokenTelemetry stats={sessionStats} onReset={onResetSessionStats} />
                  </div>
                </div>
              )}
            </div>

            {/* Auto-Enhance Toggle */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${autoEnhance ? 'bg-white/20 text-white' : 'bg-neutral-800 text-neutral-500'}`}>
                    <Zap size={16} className={autoEnhance ? 'fill-current' : ''} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white block">Auto-Enhance</span>
                    <span className="text-xs text-neutral-500 font-light">Refine tone automatically</span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleAutoEnhance(!autoEnhance)}
                  className={`
                    w-11 h-6 rounded-full transition-colors duration-300 relative
                    ${autoEnhance ? 'bg-white' : 'bg-neutral-800'}
                  `}
                >
                  <div className={`
                    absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300
                    ${autoEnhance ? 'translate-x-5 bg-black' : 'bg-neutral-500'}
                  `} />
                </button>
              </div>
            </div>

            {/* Smart Context Settings */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${contextEnabled ? 'bg-white/20 text-white' : 'bg-neutral-800 text-neutral-500'}`}>
                    <Link size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white block">Smart Context</span>
                    <span className="text-xs text-neutral-500 font-light">Use history for context</span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleContext(!contextEnabled)}
                  className={`
                    w-11 h-6 rounded-full transition-colors duration-300 relative
                    ${contextEnabled ? 'bg-white' : 'bg-neutral-800'}
                  `}
                >
                  <div className={`
                    absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300
                    ${contextEnabled ? 'translate-x-5 bg-black' : 'bg-neutral-500'}
                  `} />
                </button>
              </div>

              {contextEnabled && (
                <div className="pt-2 animate-fade-in">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Memory Depth</span>
                    <span className="text-xs font-mono text-white">{localDepth} msgs</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="512"
                    value={localDepth}
                    onChange={(e) => setLocalDepth(parseInt(e.target.value))}
                    onMouseUp={() => onUpdateContextDepth(localDepth)}
                    onTouchEnd={() => onUpdateContextDepth(localDepth)}
                    className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <p className="text-[10px] text-neutral-600 mt-2 font-light italic">
                    Includes up to {localDepth} previous messages to understand context.
                  </p>
                </div>
              )}
            </div>

            <div className="h-[1px] bg-white/5 w-full"></div>

            {/* Standard Tones */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-bold ml-1">Refinement Presets</p>
              {STANDARD_TONES.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => {
                    onSelect(tone.id);
                    onClose();
                  }}
                  className={`
                    w-full text-left p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden
                    ${currentTone === tone.id
                      ? 'bg-white/10 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                      : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}
                  `}
                >
                  <div className="flex justify-between items-center mb-1 relative z-10">
                    <span className={`text-sm font-medium ${currentTone === tone.id ? 'text-white' : 'text-neutral-300 group-hover:text-white'}`}>
                      {tone.label}
                    </span>
                    {currentTone === tone.id && <Check size={14} className="text-white" />}
                  </div>
                  <p className="text-xs text-neutral-500 group-hover:text-neutral-400 font-light leading-relaxed relative z-10">
                    {tone.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* Custom Tones */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-bold ml-1 mt-6">Custom Presets</p>

              {customTones.map((tone) => (
                <div key={tone.id} className="relative group/item">
                  <button
                    onClick={() => {
                      onSelect(tone.id);
                      onClose();
                    }}
                    className={`
                      w-full text-left p-4 rounded-xl border transition-all duration-300 group relative
                      ${currentTone === tone.id
                        ? 'bg-white/10 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                        : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}
                    `}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm font-medium ${currentTone === tone.id ? 'text-white' : 'text-neutral-300 group-hover:text-white'}`}>
                        {tone.label}
                      </span>
                      {currentTone === tone.id && <Check size={14} className="text-white" />}
                    </div>
                    <p className="text-xs text-neutral-500 group-hover:text-neutral-400 font-light leading-relaxed line-clamp-2 pr-6">
                      {tone.description}
                    </p>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCustomTone(tone.id);
                    }}
                    className="absolute right-3 bottom-3 p-2 text-neutral-700 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all z-20"
                    title="Delete Tone"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              <button
                onClick={() => setIsCreating(true)}
                className="w-full p-3 rounded-xl border border-dashed border-neutral-800 hover:border-neutral-600 text-neutral-600 hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                <Plus size={14} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs uppercase tracking-widest font-medium">Create New</span>
              </button>
            </div>

          </div>
        </div>
      </GlassCard>
    </div>
  );
};
