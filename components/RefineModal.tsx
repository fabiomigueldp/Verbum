import { useEffect, useMemo, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Check, X, Plus, Trash2, Zap, Link, Boxes, KeyRound, Eye, EyeOff, ChevronDown, Globe, BookOpen } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { ProviderSelector } from './ProviderSelector';
import { ModelSelector } from './ModelSelector';
import { getProvider, getModelLabel, getAllProviders } from '../services/providers';
import type { ProviderConfig } from '../services/providers';
import { ToneOption, CustomTone, UsageSession, LanguageCode, SUPPORTED_LANGUAGES, GlossaryEntry } from '../types';
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
  provider: string;
  onProviderChange: (provider: string) => void;
  model: string;
  apiKeys: Record<string, string>;
  resolvedApiKey: string;
  isEnvKey?: boolean;
  onModelChange: (model: string) => void;
  onApiKeyChange: (providerId: string, key: string) => void;
  sessionStats: UsageSession;
  onResetSessionStats: () => void;
  onShowLogs?: () => void;
  anchorLanguage: Exclude<LanguageCode, 'unknown'>;
  targetLanguage: Exclude<LanguageCode, 'unknown'>;
  onAnchorLanguageChange: (lang: Exclude<LanguageCode, 'unknown'>) => void;
  onTargetLanguageChange: (lang: Exclude<LanguageCode, 'unknown'>) => void;
  onSelect: (tone: ToneOption) => void;
  onAddCustomTone: (tone: CustomTone) => void;
  onDeleteCustomTone: (id: string) => void;
  glossaryEntries: GlossaryEntry[];
  onAddGlossaryEntry: (entry: GlossaryEntry) => void;
  onDeleteGlossaryEntry: (id: string) => void;
  glossaryEnabled: boolean;
  onToggleGlossary: () => void;
  onClose: () => void;
  initialFocus?: 'engine' | null;
}

const STANDARD_TONES: { id: string; label: string; desc: string }[] = [
  { id: 'standard', label: 'Standard Review', desc: 'Grammar, spelling, and flow corrections.' },
  { id: 'executive', label: 'Executive', desc: 'Sophisticated, authoritative, and professional.' },
  { id: 'concise', label: 'Concise', desc: 'Direct, short, and to the point. Removes fluff.' },
  { id: 'softer', label: 'Softer Tone', desc: 'Diplomatic, empathetic, and polite.' },
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
  apiKeys,
  resolvedApiKey,
  isEnvKey,
  onModelChange,
  onApiKeyChange,
  sessionStats,
  onResetSessionStats,
  onShowLogs,
  anchorLanguage,
  targetLanguage,
  onAnchorLanguageChange,
  onTargetLanguageChange,
  onSelect,
  onAddCustomTone,
  onDeleteCustomTone,
  glossaryEntries,
  onAddGlossaryEntry,
  onDeleteGlossaryEntry,
  glossaryEnabled,
  onToggleGlossary,
  onClose,
  initialFocus,
}: RefineModalProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showEngine, setShowEngine] = useState(initialFocus === 'engine');
  const [showLanguages, setShowLanguages] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [newTermA, setNewTermA] = useState('');
  const [newTermB, setNewTermB] = useState('');

  const [localDepth, setLocalDepth] = useState(contextDepth);

  useEffect(() => {
    setLocalDepth(contextDepth);
  }, [contextDepth]);

  const providerConfig = getProvider(provider);
  const providerName = providerConfig?.name || provider;
  const modelLabel = getModelLabel(provider, model);
  const hasResolvedApiKey = Boolean(resolvedApiKey);
  const apiKeyValue = apiKeys[provider] || '';

  // Glossary: normalize current pair and filter entries
  const normalizedCurrentPair: [string, string] = anchorLanguage < targetLanguage
    ? [anchorLanguage, targetLanguage]
    : [targetLanguage, anchorLanguage];

  const currentPairEntries = useMemo(() => {
    return glossaryEntries
      .filter(e => e.pair[0] === normalizedCurrentPair[0] && e.pair[1] === normalizedCurrentPair[1])
      .sort((a, b) => {
        const aLeft = normalizedCurrentPair[0] === a.pair[0] ? a.termA : a.termB;
        const bLeft = normalizedCurrentPair[0] === b.pair[0] ? b.termA : b.termB;
        return aLeft.localeCompare(bLeft);
      });
  }, [glossaryEntries, normalizedCurrentPair]);

  const otherPairsCount = glossaryEntries.length - currentPairEntries.length;

  // Auto-expand engine if opened from gate
  useEffect(() => {
    if (initialFocus === 'engine') {
      setShowEngine(true);
    }
  }, [initialFocus]);

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

          <div className="overflow-y-auto pr-2 -mr-2 space-y-5 custom-scrollbar flex-1 min-h-0">

            {/* ================================================================
                ENGINE — Provider + Model + API Key
                ================================================================ */}
            <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowEngine(!showEngine)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-neutral-900 text-white border border-white/10">
                    <Boxes size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white block">Model</span>
                    <span className="text-xs text-neutral-500 font-light">
                      {providerName} / {modelLabel}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-neutral-500">
                  <span className="text-[10px] uppercase tracking-[0.2em]">Expand</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${showEngine ? 'rotate-180 text-white' : ''}`}
                  />
                </div>
              </button>

              {showEngine && (
                <div className="px-4 pt-2 pb-5 space-y-5 animate-fade-in border-t border-white/5">
                  {/* Provider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">
                        Provider
                      </span>
                      <span className="text-[10px] text-neutral-600 font-light">
                        Applies to Translation + Collectio
                      </span>
                    </div>
                    <ProviderSelector value={provider} onChange={onProviderChange} />
                  </div>

                  {/* Model */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold block">
                      Model
                    </span>
                    {providerConfig && providerConfig.models.length > 0 ? (
                      <ModelSelector
                        models={providerConfig.models}
                        value={model}
                        onChange={onModelChange}
                      />
                    ) : (
                      <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-[12px] text-neutral-400">No models available</span>
                      </div>
                    )}
                  </div>

                  {/* API Key */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">
                        API Key
                      </span>
                      <span className={`
                        text-[9px] uppercase tracking-[0.15em] font-bold
                        ${hasResolvedApiKey ? 'text-neutral-300' : 'text-neutral-600'}
                      `}>
                        {hasResolvedApiKey ? 'Active' : 'Missing'}
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKeyValue}
                        onChange={(e) => onApiKeyChange(provider, e.target.value)}
                        placeholder={providerConfig?.keyPlaceholder || 'API key'}
                        className={`
                          w-full bg-neutral-950/60 border rounded-lg px-3 py-3
                          text-sm text-white placeholder-neutral-600
                          focus:outline-none focus:border-white/30
                          transition-colors pr-10
                          ${hasResolvedApiKey ? 'border-white/10' : 'border-white/20 shadow-[0_0_18px_rgba(255,255,255,0.06)]'}
                        `}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-neutral-600 font-light">
                        {isEnvKey ? 'Loaded from public dev env' : 'Stored locally'}
                      </span>
                      {providerConfig?.keyUrl && (
                        <a
                          href={providerConfig.keyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
                        >
                          Get key
                          <span className="text-neutral-600">→</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Telemetry — Collapsed by default */}
                  <div className="pt-2 border-t border-white/5">
                    <button
                      onClick={() => setShowTelemetry(!showTelemetry)}
                      className="w-full flex items-center justify-between py-2 text-left"
                    >
                      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">
                        Telemetry
                      </span>
                      <ChevronDown
                        size={14}
                        className={`text-neutral-600 transition-transform duration-300 ${showTelemetry ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {showTelemetry && (
                      <div className="animate-fade-in">
                        <TokenTelemetry stats={sessionStats} onReset={onResetSessionStats} onShowLogs={onShowLogs} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ================================================================
                LANGUAGE MATRIX
                ================================================================ */}
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
                  <span className="text-[10px] uppercase tracking-[0.2em]">Expand</span>
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
                          {lang.dir === 'rtl' && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white/30" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5">
                    <p className="text-[10px] text-neutral-600 font-light leading-relaxed">
                      Smart Pivot: Text in {anchorLanguage.toUpperCase()} translates to {targetLanguage.toUpperCase()}, 
                      and vice versa. Any other language translates to {anchorLanguage.toUpperCase()}.
                    </p>
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

            {/* ================================================================
                TERMINOLOGY — Personal Glossary
                ================================================================ */}
            <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowGlossary(!showGlossary)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-neutral-900 text-white border border-white/10">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white block">Terminology</span>
                    <span className="text-xs text-neutral-500 font-light">
                      {glossaryEnabled
                        ? `${currentPairEntries.length} ${currentPairEntries.length === 1 ? 'entry' : 'entries'} for ${anchorLanguage.toUpperCase()}↔${targetLanguage.toUpperCase()}`
                        : 'Disabled'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Inline toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleGlossary();
                    }}
                    className={`
                      w-9 h-5 rounded-full transition-colors duration-300 relative flex-shrink-0
                      ${glossaryEnabled ? 'bg-white' : 'bg-neutral-800'}
                    `}
                    title={glossaryEnabled ? 'Disable glossary' : 'Enable glossary'}
                  >
                    <div className={`
                      absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-300
                      ${glossaryEnabled ? 'translate-x-4 bg-black' : 'bg-neutral-500'}
                    `} />
                  </button>
                  <div className="flex items-center gap-2 text-neutral-500">
                    <span className="text-[10px] uppercase tracking-[0.2em]">Expand</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${showGlossary ? 'rotate-180 text-white' : ''}`}
                    />
                  </div>
                </div>
              </button>

              {showGlossary && (
                <div className={`px-4 pt-3 pb-4 space-y-3 animate-fade-in border-t border-white/5 ${!glossaryEnabled ? 'opacity-40' : ''}`}>
                  {/* Entries list */}
                  {currentPairEntries.length > 0 && (
                    <div
                      className="space-y-0 overflow-y-auto custom-scrollbar"
                      style={{ maxHeight: `${Math.min(currentPairEntries.length * 44 + 8, 180)}px` }}
                    >
                      {currentPairEntries.map((entry) => {
                        const isForward = entry.pair[0] === anchorLanguage;
                        const leftTerm = isForward ? entry.termA : entry.termB;
                        const rightTerm = isForward ? entry.termB : entry.termA;
                        return (
                          <div
                            key={entry.id}
                            className="group/entry flex items-center justify-between py-2 border-b border-white/[0.04] last:border-b-0"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-[13px] text-white font-medium truncate">{leftTerm}</span>
                              <span className="text-neutral-500 text-[10px] flex-shrink-0">↔</span>
                              <span className="text-[13px] text-white font-medium truncate">{rightTerm}</span>
                            </div>
                            <button
                              onClick={() => onDeleteGlossaryEntry(entry.id)}
                              className="p-1.5 text-neutral-700 hover:text-red-400 opacity-0 group-hover/entry:opacity-100 transition-all flex-shrink-0"
                              title="Remove"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {currentPairEntries.length === 0 && (
                    <div className="py-3 text-center">
                      <p className="text-[11px] text-neutral-600 font-light">
                        No terms for {SUPPORTED_LANGUAGES.find(l => l.code === anchorLanguage)?.name} ↔ {SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name}.
                      </p>
                      <p className="text-[10px] text-neutral-700 font-light mt-1">
                        Add words you want consistently translated.
                      </p>
                    </div>
                  )}

                  {/* Ghost: terms in other pairs */}
                  {otherPairsCount > 0 && (
                    <div className="text-center">
                      <span className="text-[10px] text-neutral-700">
                        {otherPairsCount} {otherPairsCount === 1 ? 'term' : 'terms'} in other language {otherPairsCount === 1 ? 'pair' : 'pairs'}
                      </span>
                    </div>
                  )}

                  {/* Add form */}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={newTermA}
                      onChange={(e) => setNewTermA(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTermA.trim() && newTermB.trim()) {
                          e.preventDefault();
                          const pair: [Exclude<LanguageCode, 'unknown'>, Exclude<LanguageCode, 'unknown'>] =
                            anchorLanguage < targetLanguage
                              ? [anchorLanguage, targetLanguage]
                              : [targetLanguage, anchorLanguage];
                          onAddGlossaryEntry({
                            id: uuidv4(),
                            pair,
                            termA: anchorLanguage < targetLanguage ? newTermA.trim() : newTermB.trim(),
                            termB: anchorLanguage < targetLanguage ? newTermB.trim() : newTermA.trim(),
                          });
                          setNewTermA('');
                          setNewTermB('');
                        }
                      }}
                      placeholder={anchorLanguage.toUpperCase()}
                      className="flex-1 min-w-0 bg-transparent border-b border-white/[0.08] text-[13px] text-white placeholder-neutral-500 focus:border-white/30 focus:outline-none py-2 px-1"
                    />
                    <span className="text-neutral-500 text-[10px] flex-shrink-0">↔</span>
                    <input
                      type="text"
                      value={newTermB}
                      onChange={(e) => setNewTermB(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTermA.trim() && newTermB.trim()) {
                          e.preventDefault();
                          const pair: [Exclude<LanguageCode, 'unknown'>, Exclude<LanguageCode, 'unknown'>] =
                            anchorLanguage < targetLanguage
                              ? [anchorLanguage, targetLanguage]
                              : [targetLanguage, anchorLanguage];
                          onAddGlossaryEntry({
                            id: uuidv4(),
                            pair,
                            termA: anchorLanguage < targetLanguage ? newTermA.trim() : newTermB.trim(),
                            termB: anchorLanguage < targetLanguage ? newTermB.trim() : newTermA.trim(),
                          });
                          setNewTermA('');
                          setNewTermB('');
                        }
                      }}
                      placeholder={targetLanguage.toUpperCase()}
                      className="flex-1 min-w-0 bg-transparent border-b border-white/[0.08] text-[13px] text-white placeholder-neutral-500 focus:border-white/30 focus:outline-none py-2 px-1"
                    />
                    <button
                      onClick={() => {
                        if (!newTermA.trim() || !newTermB.trim()) return;
                        const pair: [Exclude<LanguageCode, 'unknown'>, Exclude<LanguageCode, 'unknown'>] =
                          anchorLanguage < targetLanguage
                            ? [anchorLanguage, targetLanguage]
                            : [targetLanguage, anchorLanguage];
                        onAddGlossaryEntry({
                          id: uuidv4(),
                          pair,
                          termA: anchorLanguage < targetLanguage ? newTermA.trim() : newTermB.trim(),
                          termB: anchorLanguage < targetLanguage ? newTermB.trim() : newTermA.trim(),
                        });
                        setNewTermA('');
                        setNewTermB('');
                      }}
                      disabled={!newTermA.trim() || !newTermB.trim()}
                      className="w-8 h-8 rounded-full bg-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
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
