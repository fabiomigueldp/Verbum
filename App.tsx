import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Eraser, Command, Languages, Database } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { TranslationItem } from './components/TranslationItem';
import { LiquidSkeleton } from './components/LiquidSkeleton';
import { ApiKeyGate } from './components/ApiKeyGate';
import { Composer, ComposerRef } from './components/Composer';
import { useCollectio } from './hooks/useCollectio';
import { translateText, refineText, validateApiKey, validateProviderModel } from './services/aiRouter';
import { getRequestLogById } from './services/core/telemetry';
import { getFirstModelId, getProvider, isValidModelForProvider } from './services/providers';
import { getPublicBuildTimeApiKey, hasPublicBuildTimeApiKey } from './services/core/env';
import { migrateSettingsStorage, persistModelForProvider } from './services/core/storageMigrations';
import { requestPersistentStorage, storageGet, storageSet, storageSetJson } from './services/core/storage';
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
  GlossaryEntry,
} from './types';
import { calculateCostNano } from './utils/pricing';
import LandingPage from './components/LandingPage';

// ============================================================================
// APP
// ============================================================================

type AppMode = 'translation' | 'collectio';

const RefineModal = lazy(() => import('./components/RefineModal').then(module => ({ default: module.RefineModal })));
const OperationDetailModal = lazy(() => import('./components/OperationDetailModal').then(module => ({ default: module.OperationDetailModal })));
const RequestLogViewer = lazy(() => import('./components/RequestLogViewer').then(module => ({ default: module.RequestLogViewer })));
const IngestionDeck = lazy(() => import('./components/collectio/IngestionDeck').then(module => ({ default: module.IngestionDeck })));
const KnowledgeLattice = lazy(() => import('./components/collectio/KnowledgeLattice').then(module => ({ default: module.KnowledgeLattice })));
const CompilerHUD = lazy(() => import('./components/collectio/CompilerHUD').then(module => ({ default: module.CompilerHUD })));



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

const App: React.FC = () => {
  const [initialSettings] = useState(() => migrateSettingsStorage());
  const initialApiKey = initialSettings.apiKeys[initialSettings.provider]?.trim()
    || getPublicBuildTimeApiKey(initialSettings.provider);

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
  const [showLanding, setShowLanding] = useState(
    () => storageGet('verbum_has_launched') !== 'true'
  );
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  // -- Auth (generic) --
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(
    initialApiKey ? null : false
  );
  const [isEnvKeyInvalid, setIsEnvKeyInvalid] = useState(false);

  // -- Settings --
  const [tone, setTone] = useState<ToneOption>('standard');
  const [customTones, setCustomTones] = useState<CustomTone[]>([]);
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [naturalProse, setNaturalProse] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(false);
  const [contextDepth, setContextDepth] = useState(64);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<'engine' | null>(null);

  // -- Provider / Model (generic) --
  const [provider, setProvider] = useState<ProviderOption>(initialSettings.provider);
  const [model, setModel] = useState<string>(initialSettings.activeModel);

  // -- API Keys (generic: Record<providerId, key>) --
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(initialSettings.apiKeys);
  const [modelByProvider, setModelByProvider] = useState<Record<string, string>>(
    initialSettings.modelByProvider
  );

  // -- Session Stats --
  const [sessionStats, setSessionStats] = useState<UsageSession>(DEFAULT_SESSION_STATS);
  const sessionCostNanoRef = useRef<bigint>(0n);

  // -- Language --
  const [anchorLanguage, setAnchorLanguage] = useState<Exclude<LanguageCode, 'unknown'>>('pt');
  const [targetLanguage, setTargetLanguage] = useState<Exclude<LanguageCode, 'unknown'>>('en');

  // -- Glossary --
  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([]);
  const [glossaryEnabled, setGlossaryEnabled] = useState(true);

  // -- Diff / Refine --
  const [originalInput, setOriginalInput] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // -- Browser --
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // -- Skeleton --
  const [estimatedLength, setEstimatedLength] = useState<number>(0);

  // -- Telemetry / Request Logs --
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerRef>(null);
  const recognitionRef = useRef<any>(null);

  const SKELETON_DELAY = 180;
  const baseTextRef = useRef<string>('');
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Resolve API key for current provider --
  const resolveApiKey = useCallback((): string => {
    const savedKey = apiKeys[provider]?.trim() || '';
    if (savedKey) return savedKey;
    return getPublicBuildTimeApiKey(provider);
  }, [apiKeys, provider]);

  const resolvedApiKey = resolveApiKey();
  const hasApiKey = Boolean(resolvedApiKey);

  // -- Collectio Hook --
  const collectio = useCollectio(resolvedApiKey, provider, model);



  const handleEnterApp = useCallback(() => {
    storageSet('verbum_has_launched', 'true');
    void requestPersistentStorage();
    setShowLanding(false);
  }, []);

  useEffect(() => {
    if (showLanding === false) {
      void requestPersistentStorage();
    }
  }, [showLanding]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // -- Provider/model health check --
  useEffect(() => {
    const key = resolvedApiKey.trim();
    if (!key) {
      setIsAuthorized(false);
      setIsEnvKeyInvalid(false);
      return;
    }

    let cancelled = false;
    setIsAuthorized(null);

    const timer = setTimeout(async () => {
      try {
        const isValidKey = await validateApiKey(provider, key);
        const isValidModel = isValidKey
          ? await validateProviderModel(provider, key, model)
          : false;
        if (cancelled) return;
        setIsAuthorized(isValidKey && isValidModel);
        setIsEnvKeyInvalid(!isValidKey && hasPublicBuildTimeApiKey(provider) && !apiKeys[provider]?.trim());
      } catch {
        if (!cancelled) {
          setIsAuthorized(false);
          setIsEnvKeyInvalid(hasPublicBuildTimeApiKey(provider) && !apiKeys[provider]?.trim());
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [apiKeys, model, provider, resolvedApiKey]);

  // -- Load Persistence --
  useEffect(() => {
    const savedHistory = storageGet('verbum_history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) { console.error("History parse error", e); }
    }
    const savedTones = storageGet('verbum_custom_tones');
    if (savedTones) {
      try { setCustomTones(JSON.parse(savedTones)); } catch (e) { console.error("Tones parse error", e); }
    }
    const savedAutoEnhance = storageGet('verbum_auto_enhance');
    if (savedAutoEnhance) {
      try { setAutoEnhance(JSON.parse(savedAutoEnhance)); } catch (e) { console.error("Auto Enhance parse error", e); }
    }
    const savedNaturalProse = storageGet('verbum_natural_prose');
    if (savedNaturalProse) {
      try { setNaturalProse(JSON.parse(savedNaturalProse)); } catch (e) { console.error("Natural Prose parse error", e); }
    }
    const savedContextEnabled = storageGet('verbum_context_enabled');
    if (savedContextEnabled) {
      try { setContextEnabled(JSON.parse(savedContextEnabled)); } catch (e) { console.error("Context Enabled parse error", e); }
    }
    const savedContextDepth = storageGet('verbum_context_depth');
    if (savedContextDepth) {
      try { setContextDepth(JSON.parse(savedContextDepth)); } catch (e) { console.error("Context Depth parse error", e); }
    }

    const savedSessionStats = storageGet('verbum_session_stats');
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

    const savedAnchorLang = storageGet('verbum_anchor_language');
    if (savedAnchorLang) {
      setAnchorLanguage(savedAnchorLang as Exclude<LanguageCode, 'unknown'>);
    }
    const savedTargetLang = storageGet('verbum_target_language');
    if (savedTargetLang) {
      setTargetLanguage(savedTargetLang as Exclude<LanguageCode, 'unknown'>);
    }

    const savedAppMode = storageGet('verbum_app_mode');
    if (savedAppMode === 'translation' || savedAppMode === 'collectio') {
      setAppMode(savedAppMode);
    }

    const savedGlossary = storageGet('verbum_glossary_v1');
    if (savedGlossary) {
      try {
        const parsed = JSON.parse(savedGlossary);
        if (parsed && Array.isArray(parsed.entries)) {
          setGlossaryEntries(parsed.entries);
        }
      } catch (e) {
        console.error("Glossary parse error", e);
      }
    }

    const savedGlossaryEnabled = storageGet('verbum_glossary_enabled');
    if (savedGlossaryEnabled !== null) {
      try {
        setGlossaryEnabled(JSON.parse(savedGlossaryEnabled));
      } catch {
        setGlossaryEnabled(true);
      }
    }
  }, []);

  // -- Save Persistence --
  useEffect(() => {
    const timer = setTimeout(() => {
      storageSetJson('verbum_history', history);
    }, 1000);
    return () => clearTimeout(timer);
  }, [history]);

  useEffect(() => { storageSetJson('verbum_custom_tones', customTones); }, [customTones]);
  useEffect(() => { storageSetJson('verbum_auto_enhance', autoEnhance); }, [autoEnhance]);
  useEffect(() => { storageSetJson('verbum_natural_prose', naturalProse); }, [naturalProse]);
  useEffect(() => { storageSetJson('verbum_context_enabled', contextEnabled); }, [contextEnabled]);
  useEffect(() => { storageSetJson('verbum_context_depth', contextDepth); }, [contextDepth]);
  useEffect(() => { storageSet('verbum_provider', provider); }, [provider]);
  useEffect(() => {
    storageSetJson('verbum_api_keys', apiKeys);
  }, [apiKeys]);
  useEffect(() => {
    if (!isValidModelForProvider(provider, model)) return;
    setModelByProvider(prev => {
      if (prev[provider] === model) {
        persistModelForProvider(provider, model, prev);
        return prev;
      }
      return persistModelForProvider(provider, model, prev);
    });
  }, [model, provider]);
  useEffect(() => { storageSetJson('verbum_session_stats', sessionStats); }, [sessionStats]);
  useEffect(() => { storageSet('verbum_anchor_language', anchorLanguage); }, [anchorLanguage]);
  useEffect(() => { storageSet('verbum_target_language', targetLanguage); }, [targetLanguage]);
  useEffect(() => { storageSet('verbum_app_mode', appMode); }, [appMode]);
  useEffect(() => {
    storageSetJson('verbum_glossary_v1', { entries: glossaryEntries, version: 1 });
  }, [glossaryEntries]);
  useEffect(() => {
    storageSetJson('verbum_glossary_enabled', glossaryEnabled);
  }, [glossaryEnabled]);

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

  const updateSessionStats = (usageMetadata: UsageMetadata | undefined, actualCostNano?: string) => {
    if (!usageMetadata) return;
    const inputTokens = usageMetadata.promptTokens;
    const outputTokens = usageMetadata.candidatesTokens;
    const costNano = calculateCostNano(
      model,
      inputTokens,
      outputTokens,
      usageMetadata.cachedPromptTokens ?? 0,
      usageMetadata.totalTokens
    );
    const effectiveCostNano = actualCostNano ? BigInt(actualCostNano) : costNano;
    const newTotalNano = sessionCostNanoRef.current + effectiveCostNano;
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

      const newId = uuidv4();
      const result = await translateText(input, languageConfig, instruction, contextPayload, {
        model,
        apiKey: effectiveApiKey,
        provider,
        telemetryId: newId,
        glossaryEnabled,
        naturalProse,
      });
      updateSessionStats(result.usageMetadata, result.actualCostNano);
      const newRecord: TranslationRecord = {
        id: newId,
        original: input.trim(),
        translation: result.translation,
        timestamp: Date.now(),
        sourceLang: result.detectedSourceLanguage,
        targetLang: result.targetLanguageUsed,
        glossaryCompliance: result.glossaryCompliance,
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
      const result = await refineText(currentText, instruction, {
        model,
        apiKey: effectiveApiKey,
        provider,
        naturalProse,
      });
      updateSessionStats(result.usageMetadata, result.actualCostNano);
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

  const handleAddGlossaryEntry = useCallback((entry: GlossaryEntry) => {
    setGlossaryEntries(prev => [entry, ...prev]);
  }, []);

  const handleDeleteGlossaryEntry = useCallback((id: string) => {
    setGlossaryEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleToggleGlossary = useCallback(() => {
    setGlossaryEnabled(prev => !prev);
  }, []);

  const handleProviderChange = useCallback((nextProvider: string) => {
    setProvider(nextProvider);
    setIsEnvKeyInvalid(false);
    setIsAuthorized(null);
    const storedModel = modelByProvider[nextProvider];
    const nextModel = storedModel && isValidModelForProvider(nextProvider, storedModel)
      ? storedModel
      : getFirstModelId(nextProvider);
    setModel(nextModel);
  }, [modelByProvider]);

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
  if (showLanding) {
    return <LandingPage onEnter={handleEnterApp} />;
  }

  return (
    <main className="safe-area-shell min-h-screen min-h-[100dvh] flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto selection:bg-white/20 selection:text-white">

      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed safe-area-top right-4 z-50 rounded-full border border-white/[0.08] bg-neutral-950/90 px-3 py-2 text-[11px] text-neutral-300 shadow-lg backdrop-blur-md"
        >
          Offline · saved work remains available
        </div>
      )}

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
        <Suspense fallback={null}>
          <RefineModal
            currentTone={tone}
            customTones={customTones}
            autoEnhance={autoEnhance}
            onToggleAutoEnhance={setAutoEnhance}
            naturalProse={naturalProse}
            onToggleNaturalProse={setNaturalProse}
            contextEnabled={contextEnabled}
            onToggleContext={setContextEnabled}
            contextDepth={contextDepth}
            onUpdateContextDepth={setContextDepth}
            model={model}
            provider={provider}
            apiKeys={apiKeys}
            resolvedApiKey={resolvedApiKey}
            isEnvKey={(() => {
              const saved = apiKeys[provider]?.trim() || '';
              if (saved) return false;
              return hasPublicBuildTimeApiKey(provider);
            })()}
            onProviderChange={handleProviderChange}
            onModelChange={setModel}
            onApiKeyChange={handleApiKeyChange}
            sessionStats={sessionStats}
            onResetSessionStats={resetSessionStats}
            onShowLogs={() => { setShowSettings(false); setShowLogViewer(true); }}
            anchorLanguage={anchorLanguage}
            targetLanguage={targetLanguage}
            onAnchorLanguageChange={setAnchorLanguage}
            onTargetLanguageChange={setTargetLanguage}
            onSelect={setTone}
            onAddCustomTone={handleAddCustomTone}
            onDeleteCustomTone={handleDeleteCustomTone}
            glossaryEntries={glossaryEntries}
            onAddGlossaryEntry={handleAddGlossaryEntry}
            onDeleteGlossaryEntry={handleDeleteGlossaryEntry}
            glossaryEnabled={glossaryEnabled}
            onToggleGlossary={handleToggleGlossary}
            onClose={() => { setShowSettings(false); setSettingsFocus(null); }}
            initialFocus={settingsFocus}
          />
        </Suspense>
      )}

      {/* Operation Detail Modal */}
      {selectedLogId && (
        <Suspense fallback={null}>
          <OperationDetailModal
            log={(() => {
              const log = getRequestLogById(selectedLogId);
              if (!log) {
                // Fallback: create a minimal log if not found
                return {
                  id: selectedLogId,
                  timestamp: Date.now(),
                  provider: provider,
                  model: model,
                  operation: 'translate',
                  durationMs: 0,
                  status: 'error' as const,
                  errorMessage: 'Log not found — may have been cleared or expired.',
                  inputTokens: 0,
                  outputTokens: 0,
                  totalTokens: 0,
                  estimatedCostNano: '0',
                  inputLength: 0,
                  inputPreview: '',
                  tokensPerSecond: 0,
                };
              }
              return log;
            })()}
            onClose={() => setSelectedLogId(null)}
          />
        </Suspense>
      )}

      {/* Request Log Viewer */}
      {showLogViewer && (
        <Suspense fallback={null}>
          <RequestLogViewer onClose={() => setShowLogViewer(false)} />
        </Suspense>
      )}

      {/* Mode Toggle — hidden when Settings is open */}
      <div className={`
        fixed safe-area-top left-1/2 -translate-x-1/2 z-40
        ${showSettings ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}>
        <div className="
          flex items-center gap-1 p-1
          bg-neutral-900/60 backdrop-blur-xl
          border border-white/[0.04]
          rounded-full
          shadow-[0_4px_24px_rgba(0,0,0,0.3)]
        " role="group" aria-label="Application mode">
          <button
            onClick={() => setAppMode('translation')}
            aria-pressed={appMode === 'translation'}
            className={`
              flex min-h-11 items-center gap-2 px-4 py-2 rounded-full
              text-[10px] font-medium uppercase tracking-[0.15em]
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
            aria-pressed={appMode === 'collectio'}
            className={`
              flex min-h-11 items-center gap-2 px-4 py-2 rounded-full
              text-[10px] font-medium uppercase tracking-[0.15em]
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
              naturalProse={naturalProse}
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
                    onShowInfo={setSelectedLogId}
                    isNew={item.id === newItemId}
                    glossaryCompliance={item.glossaryCompliance}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* Collectio Mode */}
      {appMode === 'collectio' && (
        <Suspense fallback={(
          <div className="w-full min-h-[240px] flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
          </div>
        )}>
          <div className="w-full mb-10 z-20">
            <IngestionDeck
              onIngest={collectio.ingest}
              disabled={!hasApiKey}
            />
          </div>

          <div className="w-full pb-56 md:pb-32">
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
        </Suspense>
      )}

    </main>
  );
};

export default App;
