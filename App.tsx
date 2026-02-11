import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eraser, Command, Languages, Database } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { TranslationItem } from './components/TranslationItem';
import { LiquidSkeleton } from './components/LiquidSkeleton';
import { RefineModal } from './components/RefineModal';
import { ApiKeyGate, API_KEY_REGEX } from './components/ApiKeyGate';
import { Composer, ComposerRef } from './components/Composer';
import { LandingPage } from './components/LandingPage';
import { IngestionDeck, KnowledgeLattice, CompilerHUD } from './components/collectio';
import { useCollectio } from './hooks/useCollectio';
import { translateText, refineText, validateApiKey } from './services/aiRouter';
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

// App Mode - Translation vs Collectio
type AppMode = 'translation' | 'collectio';

// Add type for webkitSpeechRecognition
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
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isSkeletonExiting, setIsSkeletonExiting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<TranslationRecord[]>([]);
  const [newItemId, setNewItemId] = useState<string | null>(null);

  // App Mode State - Translation vs Collectio
  const [appMode, setAppMode] = useState<AppMode>('translation');

  // Landing Page State
  const [showLanding, setShowLanding] = useState<boolean | null>(null);

  // Authorization State - Gate control
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null); // null = checking, false = show gate, true = authorized
  const [isEnvKeyInvalid, setIsEnvKeyInvalid] = useState(false);

  // Refinement & Context States
  const [tone, setTone] = useState<ToneOption>('standard');
  const [customTones, setCustomTones] = useState<CustomTone[]>([]);
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(false);
  const [contextDepth, setContextDepth] = useState(64); // Default to 64
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<ProviderOption>('gemini');
  const [model, setModel] = useState<string>('gemini-2.5-flash-lite');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [xaiApiKey, setXaiApiKey] = useState<string>('');
  const [sessionStats, setSessionStats] = useState<UsageSession>(DEFAULT_SESSION_STATS);
  const sessionCostNanoRef = useRef<bigint>(0n);

  // Language Configuration - Smart Pivot System
  const [anchorLanguage, setAnchorLanguage] = useState<Exclude<LanguageCode, 'unknown'>>('pt');
  const [targetLanguage, setTargetLanguage] = useState<Exclude<LanguageCode, 'unknown'>>('en');

  // "See Original/Diff" State Logic
  const [originalInput, setOriginalInput] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // Browser Capability State
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // Estimated length for adaptive skeleton
  const [estimatedLength, setEstimatedLength] = useState<number>(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerRef>(null);
  const recognitionRef = useRef<any>(null);

  // Skeleton delay threshold (ms) - don't show skeleton for fast responses
  const SKELETON_DELAY = 180;
  const baseTextRef = useRef<string>('');
  const skeletonTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve API key for Collectio hook
  const resolvedApiKeyForHook = provider === 'xai'
    ? (xaiApiKey?.trim() || process.env.XAI_API_KEY || '')
    : (geminiApiKey?.trim() || process.env.GEMINI_API_KEY || process.env.API_KEY || '');
  
  // Collectio Hook - Knowledge Lattice State
  const collectio = useCollectio(resolvedApiKeyForHook, provider, provider === 'xai' ? XAI_MODEL_ID : model);

  const handleGateSuccess = (key: string) => {
    if (provider === 'xai') {
      setXaiApiKey(key);
    } else {
      setGeminiApiKey(key);
    }
    setIsAuthorized(true);
    setIsEnvKeyInvalid(false); // Clear error if user manually enters valid key
  };

  // Check if user has seen landing page before
  useEffect(() => {
    const hasSeenLanding = localStorage.getItem('verbum_has_launched');
    setShowLanding(hasSeenLanding !== 'true');
  }, []);

  // Handle entering the app from landing page
  const handleEnterApp = useCallback(() => {
    localStorage.setItem('verbum_has_launched', 'true');
    setShowLanding(false);
  }, []);

  // Check authorization on mount
  useEffect(() => {
    const checkAuth = async () => {
      const savedGeminiKey = localStorage.getItem('verbum_api_key_gemini');
      const savedXaiKey = localStorage.getItem('verbum_api_key_xai');
      const legacyKey = localStorage.getItem('verbum_api_key');
      const envGeminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const envXaiKey = process.env.XAI_API_KEY;

      // 1. Check Local Storage first (User override)
      if (legacyKey && API_KEY_REGEX.test(legacyKey)) {
        localStorage.setItem('verbum_api_key_gemini', legacyKey);
        localStorage.removeItem('verbum_api_key');
      }

      if (provider === 'xai') {
        if (savedXaiKey && savedXaiKey.trim().length > 0) {
          const isValid = await validateApiKey('xai', savedXaiKey);
          if (isValid) {
            setXaiApiKey(savedXaiKey);
            setIsAuthorized(true);
            return;
          }
          localStorage.removeItem('verbum_api_key_xai');
        }

        if (envXaiKey && envXaiKey.trim().length > 0) {
          const isValid = await validateApiKey('xai', envXaiKey);
          if (isValid) {
            setIsAuthorized(true);
          } else {
            setIsEnvKeyInvalid(true);
            setIsAuthorized(false);
          }
        } else {
          setIsAuthorized(false);
        }
      } else {
        const activeGeminiKey = savedGeminiKey || (legacyKey || '');
        if (activeGeminiKey && API_KEY_REGEX.test(activeGeminiKey)) {
          const isValid = await validateApiKey('gemini', activeGeminiKey);
          if (isValid) {
            setGeminiApiKey(activeGeminiKey);
            setIsAuthorized(true);
            return;
          }
          localStorage.removeItem('verbum_api_key_gemini');
        }

        if (envGeminiKey && API_KEY_REGEX.test(envGeminiKey)) {
          const isValid = await validateApiKey('gemini', envGeminiKey);
          if (isValid) {
            setIsAuthorized(true);
          } else {
            setIsEnvKeyInvalid(true);
            setIsAuthorized(false);
          }
        } else {
          setIsAuthorized(false);
        }
      }
    };

    checkAuth();
  }, [provider]);
  // Load persistence
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
    const savedProvider = localStorage.getItem('verbum_provider');
    if (savedProvider === 'gemini' || savedProvider === 'xai') {
      setProvider(savedProvider);
    }

    const savedModel = localStorage.getItem('verbum_model');
    const allowedModels = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite-preview-09-2025',
      'gemini-2.0-flash-lite',
      'gemini-3-flash-preview',
    ];
    if (savedModel && allowedModels.includes(savedModel)) {
      setModel(savedModel);
    } else {
      setModel('gemini-2.5-flash-lite');
    }

    const savedGeminiKey = localStorage.getItem('verbum_api_key_gemini');
    if (savedGeminiKey !== null) {
      setGeminiApiKey(savedGeminiKey);
    }
    const savedXaiKey = localStorage.getItem('verbum_api_key_xai');
    if (savedXaiKey !== null) {
      setXaiApiKey(savedXaiKey);
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
    // Language settings
    const savedAnchorLang = localStorage.getItem('verbum_anchor_language');
    if (savedAnchorLang) {
      setAnchorLanguage(savedAnchorLang as Exclude<LanguageCode, 'unknown'>);
    }
    const savedTargetLang = localStorage.getItem('verbum_target_language');
    if (savedTargetLang) {
      setTargetLanguage(savedTargetLang as Exclude<LanguageCode, 'unknown'>);
    }
    // App Mode persistence
    const savedAppMode = localStorage.getItem('verbum_app_mode');
    if (savedAppMode === 'translation' || savedAppMode === 'collectio') {
      setAppMode(savedAppMode);
    }
  }, []);

  // Save persistence - DEBOUNCED for heavy items
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
    if (provider === 'xai') {
      setModel(XAI_MODEL_ID);
      localStorage.setItem('verbum_model', XAI_MODEL_ID);
      return;
    }
    localStorage.setItem('verbum_model', model);
  }, [model, provider]);
  useEffect(() => { localStorage.setItem('verbum_api_key_gemini', geminiApiKey); }, [geminiApiKey]);
  useEffect(() => { localStorage.setItem('verbum_api_key_xai', xaiApiKey); }, [xaiApiKey]);
  useEffect(() => { localStorage.setItem('verbum_session_stats', JSON.stringify(sessionStats)); }, [sessionStats]);
  useEffect(() => { localStorage.setItem('verbum_anchor_language', anchorLanguage); }, [anchorLanguage]);
  useEffect(() => { localStorage.setItem('verbum_target_language', targetLanguage); }, [targetLanguage]);
  useEffect(() => { localStorage.setItem('verbum_app_mode', appMode); }, [appMode]);

  // Language config for API calls
  const languageConfig: LanguageConfig = {
    anchor: anchorLanguage,
    target: targetLanguage,
  };

  const getRefinementInstruction = () => {
    let instruction = STANDARD_TONES_MAP[tone as string];
    if (!instruction) {
      const custom = customTones.find(t => t.id === tone);
      if (custom) instruction = custom.description;
      else instruction = STANDARD_TONES_MAP['standard']; // Fallback
    }
    return instruction;
  };

  const resolveApiKey = () => {
    if (provider === 'xai') {
      return (xaiApiKey?.trim() || process.env.XAI_API_KEY || '');
    }
    return (geminiApiKey?.trim() || process.env.GEMINI_API_KEY || process.env.API_KEY || '');
  };

  const resolvedApiKey = resolveApiKey();
  const hasApiKey = Boolean(resolvedApiKey);

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

  const handleTranslate = async () => {
    if (!input.trim() || loading || isRefining) return;

    const effectiveApiKey = resolveApiKey();
    if (!effectiveApiKey) {
      setShowSettings(true);
      return;
    }

    // Store estimated length for adaptive skeleton before clearing input
    setEstimatedLength(input.trim().length);

    setLoading(true);
    // Reset refinement states on new translation
    setOriginalInput(null);
    setShowDiff(false);
    setIsSkeletonExiting(false);

    // Delayed skeleton display - avoid flicker for fast responses
    skeletonTimerRef.current = setTimeout(() => {
      setShowSkeleton(true);
    }, SKELETON_DELAY);

    try {
      // 1. Refinement Instruction
      let instruction = undefined;
      if (autoEnhance) {
        instruction = getRefinementInstruction();
      }

      // 2. Context Preparation
      let contextPayload: ContextMessage[] = [];
      if (contextEnabled && history.length > 0) {
        // Retrieve last N messages (history is newest first, so we slice from 0)
        // Then REVERSE them so AI reads chronologically: [oldest, ..., newest]
        const relevantHistory = history.slice(0, contextDepth).reverse();

        relevantHistory.forEach(record => {
          // Add user's original input
          contextPayload.push({ role: 'user', content: record.original });
          // Add AI's translation
          contextPayload.push({ role: 'model', content: record.translation });
        });
      }

      const result = await translateText(input, languageConfig, instruction, contextPayload, { model, apiKey: effectiveApiKey, provider });

      // Update session stats with usage metadata
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

      // Clear skeleton timer if response came before delay
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }

      // Mark new item for arrival animation
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
      // Clear skeleton timer on completion
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
      setShowSettings(true);
      return;
    }

    setIsRefining(true);

    const instruction = getRefinementInstruction();

    // Save state before refinement
    const currentText = input;

    try {
      const result = await refineText(currentText, instruction, { model, apiKey: effectiveApiKey, provider });

      // Update session stats with usage metadata
      updateSessionStats(result.usageMetadata);

      // Set State for Diff View
      setOriginalInput(currentText);
      setInput(result.refined);
      setShowDiff(true); // Automatically show diff after refinement for "Wow" factor

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
    // Simply clear the diff state, keeping the enhanced text
    setOriginalInput(null);
    setShowDiff(false);
    // Focus textarea for continued editing
    composerRef.current?.focus();
  };

  const handleTextChange = useCallback((newValue: string) => {
    setInput(newValue);
    // If user starts editing, we assume they accept the changes so far,
    // Clear diff state if they edit manually to avoid sync issues.
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
    setTone(newTone.id); // Select the new tone
  };

  const handleDeleteCustomTone = (id: string) => {
    setCustomTones(prev => prev.filter(t => t.id !== id));
    if (tone === id) setTone('standard');
  };

  const toggleListening = useCallback(() => {
    // Clear diff if active before starting
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

  const hasHistory = history.length > 0;
  const shouldRenderSkeleton = showSkeleton || isSkeletonExiting;

  // Show landing page state - null means checking, true means show landing
  if (showLanding === null) {
    // Brief loading state while checking localStorage
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

      {/* Ignition Gate - API Key Authorization */}
      {isAuthorized === false && (
        <ApiKeyGate
          onSuccess={handleGateSuccess}
          provider={provider}
          isEnvKeyInvalid={isEnvKeyInvalid}
        />
      )}

      {/* Mode Toggle - HUD Header Style */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
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
          geminiApiKey={geminiApiKey}
          xaiApiKey={xaiApiKey}
          resolvedApiKey={resolvedApiKey}
          isEnvKey={provider === 'xai'
            ? Boolean(!xaiApiKey && process.env.XAI_API_KEY)
            : Boolean(!geminiApiKey && (process.env.GEMINI_API_KEY || process.env.API_KEY))}
          onProviderChange={(nextProvider) => {
            setProvider(nextProvider);
            setIsEnvKeyInvalid(false);
            setIsAuthorized(null);
          }}
          onModelChange={setModel}
          onGeminiApiKeyChange={setGeminiApiKey}
          onXaiApiKeyChange={setXaiApiKey}
          sessionStats={sessionStats}
          onResetSessionStats={resetSessionStats}
          anchorLanguage={anchorLanguage}
          targetLanguage={targetLanguage}
          onAnchorLanguageChange={setAnchorLanguage}
          onTargetLanguageChange={setTargetLanguage}
          onSelect={setTone}
          onAddCustomTone={handleAddCustomTone}
          onDeleteCustomTone={handleDeleteCustomTone}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ============================================================== */}
      {/* TRANSLATION MODE */}
      {/* ============================================================== */}
      {appMode === 'translation' && (
        <>
          {/* Input Section - Premium Composer */}
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

          {/* History Controls */}
          {hasHistory && (
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

          {/* History List */}
          <div className="w-full relative z-10 pb-20" ref={scrollRef}>
            {(hasHistory || shouldRenderSkeleton) ? (
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

      {/* ============================================================== */}
      {/* COLLECTIO MODE - Knowledge Lattice */}
      {/* ============================================================== */}
      {appMode === 'collectio' && (
        <>
          {/* Ingestion Deck */}
          <div className="w-full mb-10 z-20">
            <IngestionDeck 
              onIngest={collectio.ingest}
              disabled={!hasApiKey}
            />
          </div>

          {/* Knowledge Lattice */}
          <div className="w-full pb-32">
            <KnowledgeLattice
              shards={collectio.shards}
              onDelete={collectio.deleteShard}
              onRetry={collectio.retry}
              selectedIds={collectio.selectedIds}
              onToggleSelection={collectio.toggleSelection}
            />
          </div>

          {/* Compiler HUD */}
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
