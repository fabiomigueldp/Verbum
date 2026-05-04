import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eraser, Command, Languages, Database } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { TranslationItem } from './components/TranslationItem';
import { LiquidSkeleton } from './components/LiquidSkeleton';
import { RefineModal } from './components/RefineModal';
import { ApiKeyGate } from './components/ApiKeyGate';
import { Composer, ComposerRef } from './components/Composer';
import { LandingPage } from './components/LandingPage';
import { IngestionDeck, KnowledgeLattice, CompilerHUD } from './components/collectio';
import { useCollectio } from './hooks/useCollectio';
import { translateText, refineText, validateApiKey } from './services/aiRouter';
import { getProvider, getDefaultProviderId, isValidProvider } from './services/providers';
import type { ProviderConfig } from './services/providers';
import { 
  TranslationRecord, 
  ToneOption, 
  CustomTone, 
  ContextMessage, 
  UsageSession, 
  UsageMetadata,
  LanguageConfig,
  LanguageCode,
  ProviderOption,
  XAI_MODEL_ID
} from './types';
import { calculateCostNano } from './utils/pricing';

// ============================================================================
// APP
// ============================================================================

type AppMode = 'translation' | 'collectio';



declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

const STANDARD_TONES_MAP: Record<string, string> = {
  'standard': 'Correct grammar, spelling, and flow. Minimal stylistic changes.',
  'executive': 'Professional, authoritative, sophisticated vocabulary. Impressive but clear.',
  'concise': 'Short, direct, remove fluff and redundancy. High information density.',
  'softer': 'Diplomatic, empathetic, polite. Good for delivering feedback or bad news.'
};

const DEFAULT_SESSION_STATS: UsageSession = {
  totalInput: 0,
  totalOutput: 0,
  estimatedCost: 0,
  estimatedCostNano: '0',
  requestCount: 0,
};

const DEFAULT_PROVIDER = getDefaultProviderId();

const App: React.FC = () => {
  // -- Core Input / Translation --
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isSkeletonExiting, setIsSkeletonExiting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<TranslationRecord[]>([]);
  const [newItemId, setNewItemId] = useState<string | null>(null);

  // -- App Mode --
  const [appMode, setAppMode] = useState<AppMode>('translation');

  // -- Landing Page --
  const [showLanding, setShowLanding] = useState<boolean | null>(null);

  // -- Auth (generic) --
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isEnvKeyInvalid, setIsEnvKeyInvalid] = useState(false);

  // -- Settings --
  const [tone, setTone] = useState<ToneOption>('standard');
  const [customTones, setCustomTones] = useState<CustomTone[]>([]);
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(false);
  const [contextDepth, setContextDepth] = useState(64);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<'engine' | null>(null);

  // -- Provider / Model (generic) --
  const [provider, setProvider] = useState<ProviderOption>(DEFAULT_PROVIDER);
  const [model, setModel] = useState<string>('gemini-2.5-flash-lite');

  // -- API Keys (generic: Record<providerId, key>) --
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  // -- Session Stats --
  const [sessionStats, setSessionStats] = useState<UsageSession>(DEFAULT_SESSION_STATS);
  const sessionCostNanoRef = useRef<bigint>(0n);

  // -- Language --
  const [anchorLanguage, setAnchorLanguage] = useState<Exclude<LanguageCode, 'unknown'>>('pt');
  const [targetLanguage, setTargetLanguage] = useState<Exclude<LanguageCode, 'unknown'>>('en');

  // -- Diff / Refine --
  const [originalInput, setOriginalInput] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // -- Browser --
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // -- Skeleton --
  const [estimatedLength, setEstimatedLength] = useState<number>(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerRef>(null);
  const recognitionRef = useRef<any>(null);

  const SKELETON_DELAY = 180;
  const baseTextRef = useRef<string>('');
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Resolve current provider config --
  const providerConfig = getProvider(provider);

  // -- Resolve API key for current provider --
  const resolveApiKey = useCallback((): string => {
    const savedKey = apiKeys[provider]?.trim() || '';
    if (savedKey) return savedKey;
    // Fallback to env
    if (provider === 'gemini') {
      return (process.env.GEMINI_API_KEY || process.env.API_KEY || '');
    }
    if (provider === 'xai') {
      return (process.env.XAI_API_KEY || '');
    }
    return '';
  }, [apiKeys, provider]);

  const resolvedApiKey = resolveApiKey();
  const hasApiKey = Boolean(resolvedApiKey);

  // -- Collectio Hook --
  const collectio = useCollectio(resolvedApiKey, provider, provider === 'xai' ? XAI_MODEL_ID : model);



  // -- Landing --
  useEffect(() => {
    const hasSeenLanding = localStorage.getItem('verbum_has_launched');
    setShowLanding(hasSeenLanding !== 'true');
  }, []);

  const handleEnterApp = useCallback(() => {
    localStorage.setItem('verbum_has_launched', 'true');
    setShowLanding(false);
  }, []);

  // -- Auth Check --
  useEffect(() => {
    const checkAuth = async () => {
      // Migrate legacy keys to new generic format
      const legacyKeys: Record<string, string> = {};
      try {
        const raw = localStorage.getItem('verbum_api_keys');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            Object.assign(legacyKeys, parsed);
          }
        }
      } catch { /* ignore */ }

      // Backward compat: migrate old individual keys
      const oldGemini = localStorage.getItem('verbum_api_key_gemini');
      const oldXai = localStorage.getItem('verbum_api_key_xai');
      const oldLegacy = localStorage.getItem('verbum_api_key');
      if (oldGemini && !legacyKeys.gemini) legacyKeys.gemini = oldGemini;
      if (oldXai && !legacyKeys.xai) legacyKeys.xai = oldXai;
      if (oldLegacy && !legacyKeys.gemini) legacyKeys.gemini = oldLegacy;

      setApiKeys(legacyKeys);

      // Determine provider to check
      const savedProvider = localStorage.getItem('verbum_provider');
      const activeProvider = isValidProvider(savedProvider || '') ? (savedProvider as string) : DEFAULT_PROVIDER;
      setProvider(activeProvider);

      const keyToCheck = legacyKeys[activeProvider]?.trim() || '';
      const envKey = activeProvider === 'xai'
        ? (process.env.XAI_API_KEY || '')
        : (process.env.GEMINI_API_KEY || process.env.API_KEY || '');

      const candidateKey = keyToCheck || envKey;

      if (candidateKey) {
        const isValid = await validateApiKey(activeProvider, candidateKey);
        if (isValid) {
          setIsAuthorized(true);
          return;
        }
        if (envKey && !keyToCheck) {
          setIsEnvKeyInvalid(true);
        }
      }
      setIsAuthorized(false);
    };

    checkAuth();
  }, []);

  // -- Load Persistence --
  useEffect(() => {
    const savedHistory = localStorage.getItem('verbum_history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) { console.error("History parse error", e); }
    }
    const savedTones = localStorage.getItem('verbum_custom_tones');
    if (savedTones) {
      try { setCustomTones(JSON.parse(savedTones)); } catch (e) { console.error("Tones parse error", e); }
    }
    const savedAutoEnhance = localStorage.getItem('verbum_auto_enhance');
    if (savedAutoEnhance) {
      try { setAutoEnhance(JSON.parse(savedAutoEnhance)); } catch (e) { console.error("Auto Enhance parse error", e); }
    }
    const savedContextEnabled = localStorage.getItem('verbum_context_enabled');
    if (savedContextEnabled) {
      try { setContextEnabled(JSON.parse(savedContextEnabled)); } catch (e) { console.error("Context Enabled parse error", e); }
    }
    const savedContextDepth = localStorage.getItem('verbum_context_depth');
    if (savedContextDepth) {
      try { setContextDepth(JSON.parse(savedContextDepth)); } catch (e) { console.error("Context Depth parse error", e); }
    }

    const savedModel = localStorage.getItem('verbum_model');
    const allowedModels = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite-preview-09-2025',
      'gemini-2.0-flash-lite',
      'gemini-3-flash-preview',
      XAI_MODEL_ID,
    ];
    if (savedModel && allowedModels.includes(savedModel)) {
      setModel(savedModel);
    }

    const savedSessionStats = localStorage.getItem('verbum_session_stats');
    if (savedSessionStats) {
      try {
        const parsed = JSON.parse(savedSessionStats) as UsageSession;
        setSessionStats(parsed);
        if (parsed.estimatedCostNano) {
          sessionCostNanoRef.current = BigInt(parsed.estimatedCostNano);
        }
      } catch (e) {
        console.error("Session stats parse error", e);
      }
    }

    const savedAnchorLang = localStorage.getItem('verbum_anchor_language');
    if (savedAnchorLang) {
      setAnchorLanguage(savedAnchorLang as Exclude<LanguageCode, 'unknown'>);
    }
    const savedTargetLang = localStorage.getItem('verbum_target_language');
    if (savedTargetLang) {
      setTargetLanguage(savedTargetLang as Exclude<LanguageCode, 'unknown'>);
    }

    const savedAppMode = localStorage.getItem('verbum_app_mode');
    if (savedAppMode === 'translation' || savedAppMode === 'collectio') {
      setAppMode(savedAppMode);
    }
  }, []);

  // -- Save Persistence --
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('verbum_history', JSON.stringify(history));
    }, 1000);
    return () => clearTimeout(timer);
  }, [history]);

  useEffect(() => { localStorage.setItem('verbum_custom_tones', JSON.stringify(customTones)); }, [customTones]);
  useEffect(() => { localStorage.setItem('verbum_auto_enhance', JSON.stringify(autoEnhance)); }, [autoEnhance]);
  useEffect(() => { localStorage.setItem('verbum_context_enabled', JSON.stringify(contextEnabled)); }, [contextEnabled]);
  useEffect(() => { localStorage.setItem('verbum_context_depth', JSON.stringify(contextDepth)); }, [contextDepth]);
  useEffect(() => { localStorage.setItem('verbum_provider', provider); }, [provider]);
  useEffect(() => {
    localStorage.setItem('verbum_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);
  useEffect(() => { localStorage.setItem('verbum_model', model); }, [model]);
  useEffect(() => { localStorage.setItem('verbum_session_stats', JSON.stringify(sessionStats)); }, [sessionStats]);
  useEffect(() => { localStorage.setItem('verbum_anchor_language', anchorLanguage); }, [anchorLanguage]);
  useEffect(() => { localStorage.setItem('verbum_target_language', targetLanguage); }, [targetLanguage]);
  useEffect(() => { localStorage.setItem('verbum_app_mode', appMode); }, [appMode]);

  // -- Language config --
  const languageConfig: LanguageConfig = {
    anchor: anchorLanguage,
    target: targetLanguage,
  };

  const getRefinementInstruction = () => {
    let instruction = STANDARD_TONES_MAP[tone as string];
    if (!instruction) {
      const custom = customTones.find(t => t.id === tone);
      if (custom) instruction = custom.description;
      else instruction = STANDARD_TONES_MAP['standard'];
    }
    return instruction;
  };

  const updateSessionStats = (usageMetadata: UsageMetadata | undefined) => {
    if (!usageMetadata) return;
    const modelId = provider === 'xai' ? XAI_MODEL_ID : model;
    const inputTokens = usageMetadata.promptTokens;
    const outputTokens = usageMetadata.candidatesTokens;
    const costNano = calculateCostNano(modelId, inputTokens, outputTokens);
    const newTotalNano = sessionCostNanoRef.current + costNano;
    sessionCostNanoRef.current = newTotalNano;
    const exactCost = Number(newTotalNano) / 1_000_000_000;

    setSessionStats(prev => ({
      totalInput: prev.totalInput + usageMetadata.promptTokens,
      totalOutput: prev.totalOutput + usageMetadata.candidatesTokens,
      estimatedCost: exactCost,
      estimatedCostNano: newTotalNano.toString(),
      requestCount: prev.requestCount + 1,
    }));
  };

  const resetSessionStats = () => {
    sessionCostNanoRef.current = 0n;
    setSessionStats(DEFAULT_SESSION_STATS);
  };

  // -- Actions --
  const handleTranslate = async () => {
    if (!input.trim() || loading || isRefining) return;
    const effectiveApiKey = resolveApiKey();
    if (!effectiveApiKey) {
      setSettingsFocus('engine');
      setShowSettings(true);
      return;
    }

    setEstimatedLength(input.trim().length);
    setLoading(true);
    setOriginalInput(null);
    setShowDiff(false);
    setIsSkeletonExiting(false);

    skeletonTimerRef.current = setTimeout(() => {
      setShowSkeleton(true);
    }, SKELETON_DELAY);

    try {
      let instruction = undefined;
      if (autoEnhance) {
        instruction = getRefinementInstruction();
      }

      let contextPayload: ContextMessage[] = [];
      if (contextEnabled && history.length > 0) {
        const relevantHistory = history.slice(0, contextDepth).reverse();
        relevantHistory.forEach(record => {
          contextPayload.push({ role: 'user', content: record.original });
          contextPayload.push({ role: 'model', content: record.translation });
        });
      }

      const result = await translateText(input, languageConfig, instruction, contextPayload, { model, apiKey: effectiveApiKey, provider });
      updateSessionStats(result.usageMetadata);

      const newId = uuidv4();
      const newRecord: TranslationRecord = {
        id: newId,
        original: input.trim(),
        translation: result.translation,
        timestamp: Date.now(),
        sourceLang: result.detectedSourceLanguage,
        targetLang: result.targetLanguageUsed,
      };

      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }

      setNewItemId(newId);
      setTimeout(() => setNewItemId(null), 800);
      setHistory(prev => [newRecord, ...prev]);

      if (showSkeleton) {
        setIsSkeletonExiting(true);
        setTimeout(() => {
          setShowSkeleton(false);
          setIsSkeletonExiting(false);
        }, 400);
      } else {
        setShowSkeleton(false);
      }

      setInput('');
      if (scrollRef.current) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      console.error("Translation failed", error);
      setShowSkeleton(false);
      setIsSkeletonExiting(false);
    } finally {
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!input.trim() || loading || isRefining) return;
    const effectiveApiKey = resolveApiKey();
    if (!effectiveApiKey) {
      setSettingsFocus('engine');
      setShowSettings(true);
      return;
    }

    setIsRefining(true);
    const instruction = getRefinementInstruction();
    const currentText = input;

    try {
      const result = await refineText(currentText, instruction, { model, apiKey: effectiveApiKey, provider });
      updateSessionStats(result.usageMetadata);
      setOriginalInput(currentText);
      setInput(result.refined);
      setShowDiff(true);
    } catch (error) {
      console.error("Refinement failed", error);
    } finally {
      setIsRefining(false);
    }
  };

  const toggleDiffView = () => {
    if (!originalInput) return;
    setShowDiff(!showDiff);
  };

  const handleRevert = () => {
    if (originalInput) {
      setInput(originalInput);
      setOriginalInput(null);
      setShowDiff(false);
    }
  };

  const handleApplyEnhancement = () => {
    setOriginalInput(null);
    setShowDiff(false);
    composerRef.current?.focus();
  };

  const handleTextChange = useCallback((newValue: string) => {
    setInput(newValue);
    if (showDiff) setShowDiff(false);
  }, [showDiff]);

  const clearHistory = () => {
    if (confirm("Clear all translation history?")) {
      setHistory([]);
    }
  };

  const deleteItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleAddCustomTone = (newTone: CustomTone) => {
    setCustomTones(prev => [...prev, newTone]);
    setTone(newTone.id);
  };

  const handleDeleteCustomTone = (id: string) => {
    setCustomTones(prev => prev.filter(t => t.id !== id));
    if (tone === id) setTone('standard');
  };

  const handleProviderChange = useCallback((nextProvider: string) => {
    setProvider(nextProvider);
    setIsEnvKeyInvalid(false);
    setIsAuthorized(null);
    // Reset model to first available for new provider
    const p = getProvider(nextProvider);
    if (p && p.models.length > 0) {
      setModel(p.models[0].id);
    }
  }, []);

  const handleApiKeyChange = useCallback((providerId: string, key: string) => {
    setApiKeys(prev => ({ ...prev, [providerId]: key }));
  }, []);

  const handleGateOpenSettings = useCallback(() => {
    setSettingsFocus('engine');
    setShowSettings(true);
  }, []);

  const toggleListening = useCallback(() => {
    if (showDiff) setShowDiff(false);

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!isSpeechSupported) {
      return;
    }

    try {
      const recognition = new window.webkitSpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        baseTextRef.current = input;
      };

      recognition.onresult = (event: any) => {
        const sessionTranscript = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join('');
        const prefix = baseTextRef.current ? baseTextRef.current + ' ' : '';
        setInput(prefix + sessionTranscript);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        if (event.error === 'aborted') {
          setIsListening(false);
          return;
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        composerRef.current?.focus();
      };

      recognition.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      setIsListening(false);
    }
  }, [isListening, isSpeechSupported, input, showDiff]);

  const hasHistoryItems = history.length > 0;
  const shouldRenderSkeleton = showSkeleton || isSkeletonExiting;

  // -- Render --
  if (showLanding === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
      </div>
    );
  }

  if (showLanding) {
    return <LandingPage onEnter={handleEnterApp} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto selection:bg-white/20 selection:text-white">

      {/* Gentle API Key Prompt (non-blocking) */}
      {isAuthorized === false && (
        <ApiKeyGate
          onOpenSettings={handleGateOpenSettings}
          onDismiss={() => setIsAuthorized(null)}
          isEnvKeyInvalid={isEnvKeyInvalid}
          provider={provider}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <RefineModal
          currentTone={tone}
          customTones={customTones}
          autoEnhance={autoEnhance}
          onToggleAutoEnhance={setAutoEnhance}
          contextEnabled={contextEnabled}
          onToggleContext={setContextEnabled}
          contextDepth={contextDepth}
          onUpdateContextDepth={setContextDepth}
          model={model}
          provider={provider}
          apiKeys={apiKeys}
          resolvedApiKey={resolvedApiKey}
          isEnvKey={provider === 'xai'
            ? Boolean(!apiKeys.xai && process.env.XAI_API_KEY)
            : Boolean(!apiKeys.gemini && (process.env.GEMINI_API_KEY || process.env.API_KEY))}
          onProviderChange={handleProviderChange}
          onModelChange={setModel}
          onApiKeyChange={handleApiKeyChange}
          sessionStats={sessionStats}
          onResetSessionStats={resetSessionStats}
          anchorLanguage={anchorLanguage}
          targetLanguage={targetLanguage}
          onAnchorLanguageChange={setAnchorLanguage}
          onTargetLanguageChange={setTargetLanguage}
          onSelect={setTone}
          onAddCustomTone={handleAddCustomTone}
          onDeleteCustomTone={handleDeleteCustomTone}
          onClose={() => { setShowSettings(false); setSettingsFocus(null); }}
          initialFocus={settingsFocus}
        />
      )}

      {/* Mode Toggle — hidden when Settings is open */}
      <div className={`
        fixed top-6 left-1/2 -translate-x-1/2 z-40
        transition-all duration-200 ease-out
        ${showSettings ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}>
        <div className="
          flex items-center gap-1 p-1
          bg-neutral-900/60 backdrop-blur-xl
          border border-white/[0.04]
          rounded-full
          shadow-[0_4px_24px_rgba(0,0,0,0.3)]
        ">
          <button
            onClick={() => setAppMode('translation')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full
              text-[10px] font-medium uppercase tracking-[0.15em]
              transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
              ${appMode === 'translation'
                ? 'bg-white/[0.1] text-white'
                : 'text-neutral-500 hover:text-neutral-300'
              }
            `}
          >
            <Languages size={12} />
            Translate
          </button>
          <button
            onClick={() => setAppMode('collectio')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full
              text-[10px] font-medium uppercase tracking-[0.15em]
              transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
              ${appMode === 'collectio'
                ? 'bg-white/[0.1] text-white'
                : 'text-neutral-500 hover:text-neutral-300'
              }
            `}
          >
            <Database size={12} />
            Collectio
          </button>
        </div>
      </div>

      {/* Translation Mode */}
      {appMode === 'translation' && (
        <>
          <div className="w-full mb-12 z-20">
            <Composer
              ref={composerRef}
              value={input}
              onChange={handleTextChange}
              onSubmit={handleTranslate}
              onRefine={handleRefine}
              onShowSettings={() => setShowSettings(true)}
              loading={loading}
              isRefining={isRefining}
              isListening={isListening}
              isSpeechSupported={isSpeechSupported}
              hasApiKey={hasApiKey}
              provider={provider}
              originalInput={originalInput}
              showDiff={showDiff}
              onToggleDiff={toggleDiffView}
              onRevert={handleRevert}
              onApplyEnhancement={handleApplyEnhancement}
              onToggleListening={toggleListening}
              autoEnhance={autoEnhance}
              contextEnabled={contextEnabled}
              anchorLanguage={anchorLanguage}
              targetLanguage={targetLanguage}
            />
          </div>

          {hasHistoryItems && (
            <div className="w-full flex justify-between items-center mb-8 px-2 animate-fade-in opacity-60 hover:opacity-100 transition-opacity duration-500">
              <div className="flex items-center gap-2 text-neutral-600">
                <Command size={14} />
                <span className="text-[10px] tracking-[0.25em] uppercase font-bold">Session History</span>
              </div>
              <button
                onClick={clearHistory}
                className="text-[10px] text-neutral-600 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-[0.2em] font-bold py-2 px-4 rounded-full hover:bg-white/5"
              >
                <Eraser size={12} /> Clear All
              </button>
            </div>
          )}

          <div className="w-full relative z-10 pb-20" ref={scrollRef}>
            {(hasHistoryItems || shouldRenderSkeleton) ? (
              <div className="space-y-6 relative">
                {shouldRenderSkeleton && (
                  <div className={isSkeletonExiting ? 'absolute top-0 left-0 w-full z-20 pointer-events-none' : ''}>
                    <LiquidSkeleton
                      estimatedLength={estimatedLength}
                      isExiting={isSkeletonExiting}
                    />
                  </div>
                )}
                {history.map((item) => (
                  <TranslationItem
                    key={item.id}
                    item={item}
                    onDelete={deleteItem}
                    onIngest={collectio.ingest}
                    isNew={item.id === newItemId}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* Collectio Mode */}
      {appMode === 'collectio' && (
        <>
          <div className="w-full mb-10 z-20">
            <IngestionDeck
              onIngest={collectio.ingest}
              disabled={!hasApiKey}
            />
          </div>

          <div className="w-full pb-32">
            <KnowledgeLattice
              shards={collectio.shards}
              onDelete={collectio.deleteShard}
              onRetry={collectio.retry}
              selectedIds={collectio.selectedIds}
              onToggleSelection={collectio.toggleSelection}
            />
          </div>

          <CompilerHUD
            totalShards={collectio.totalShards}
            readyShards={collectio.readyShards}
            totalTokens={collectio.totalTokens}
            sessionStats={collectio.sessionStats}
            isCompiling={collectio.isCompiling}
            onCompile={collectio.compile}
            onClearAll={collectio.clearAll}
            onResetStats={collectio.resetStats}
            hasRecoverableShards={collectio.hasRecoverableShards}
            onUndoDelete={collectio.undoDelete}
            undoState={collectio.undoState}
            storageError={collectio.storageError}
            duplicateDetected={collectio.duplicateDetected}
            selectedCount={collectio.selectedIds.size}
            selectedReadyCount={collectio.selectedReadyCount}
            onDeselectAll={collectio.deselectAll}
            onCopySelectedRaw={collectio.getSelectedRawContent}
          />
        </>
      )}

    </div>
  );
};

export default App;
