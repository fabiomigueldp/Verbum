import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Eraser, Command, Mic, Sparkles, Sliders, Eye, RotateCcw, GitCompareArrows, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { GlassCard } from './components/GlassCard';
import { TranslationItem } from './components/TranslationItem';
import { LiquidSkeleton } from './components/LiquidSkeleton';
import { RefineModal } from './components/RefineModal';
import { DiffViewer } from './components/DiffViewer';
import { ApiKeyGate, API_KEY_REGEX } from './components/ApiKeyGate';
import { AudioVisualizer } from './components/AudioVisualizer';
import { DictationInput } from './components/DictationInput';
import { useVoiceInput } from './hooks/useVoiceInput';
import { translateText, refineText, validateApiKey } from './services/geminiService';
import { TranslationRecord, ToneOption, CustomTone, ContextMessage, UsageSession, UsageMetadata } from './types';

const STANDARD_TONES_MAP: Record<string, string> = {
  'standard': 'Correct grammar, spelling, and flow. Minimal stylistic changes.',
  'executive': 'Professional, authoritative, sophisticated vocabulary. Impressive but clear.',
  'concise': 'Short, direct, remove fluff and redundancy. High information density.',
  'softer': 'Diplomatic, empathetic, polite. Good for delivering feedback or bad news.'
};

// Token pricing per 1M tokens (Input / Output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
};

const DEFAULT_SESSION_STATS: UsageSession = {
  totalInput: 0,
  totalOutput: 0,
  estimatedCost: 0,
  requestCount: 0,
};

const calculateCost = (modelId: string, inputTokens: number, outputTokens: number): number => {
  const pricing = MODEL_PRICING[modelId] || MODEL_PRICING['gemini-2.5-flash'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
};

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [history, setHistory] = useState<TranslationRecord[]>([]);
  const [newItemId, setNewItemId] = useState<string | null>(null);

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
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState<string>('');
  const [sessionStats, setSessionStats] = useState<UsageSession>(DEFAULT_SESSION_STATS);

  // "See Original/Diff" State Logic
  const [originalInput, setOriginalInput] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // Estimated length for adaptive skeleton
  const [estimatedLength, setEstimatedLength] = useState<number>(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Kept for logic if needed, but not rendered if diff not showing

  // Voice Input Hook
  const [voiceState, voiceActions] = useVoiceInput();
  const { isListening, transcript, interimTranscript, volume, isSupported: isSpeechSupported } = voiceState;
  const { startListening, stopListening, resetTranscript } = voiceActions;

  // Interaction Refs for Hold-to-Talk
  const holdStartTimeRef = useRef<number>(0);
  const startedListeningOnPressRef = useRef<boolean>(false);

  // Skeleton delay threshold (ms) - don't show skeleton for fast responses
  const SKELETON_DELAY = 180;
  const skeletonTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleGateSuccess = (key: string) => {
    setApiKey(key);
    setIsAuthorized(true);
    setIsEnvKeyInvalid(false); // Clear error if user manually enters valid key
  };
  // Check authorization on mount
  useEffect(() => {
    const checkAuth = async () => {
      const savedApiKey = localStorage.getItem('verbum_api_key');
      const envApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      // 1. Check Local Storage first (User override)
      if (savedApiKey && API_KEY_REGEX.test(savedApiKey)) {
        const isValid = await validateApiKey(savedApiKey);
        if (isValid) {
          setApiKey(savedApiKey);
          setIsAuthorized(true);
          return;
        } else {
          // Stored key is invalid, clear it
          localStorage.removeItem('verbum_api_key');
        }
      }

      // 2. Check Environment Variable
      if (envApiKey && API_KEY_REGEX.test(envApiKey)) {
        const isValid = await validateApiKey(envApiKey);
        if (isValid) {
          setIsAuthorized(true);
        } else {
          setIsEnvKeyInvalid(true);
          setIsAuthorized(false);
        }
      } else {
        setIsAuthorized(false);
      }
    };

    checkAuth();
  }, []);
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
    const savedModel = localStorage.getItem('verbum_model');
    const allowedModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
    if (savedModel && allowedModels.includes(savedModel)) {
      setModel(savedModel);
    }
    const savedApiKey = localStorage.getItem('verbum_api_key');
    if (savedApiKey !== null) {
      setApiKey(savedApiKey);
    }
    const savedSessionStats = localStorage.getItem('verbum_session_stats');
    if (savedSessionStats) {
      try { setSessionStats(JSON.parse(savedSessionStats)); } catch (e) { console.error("Session stats parse error", e); }
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
  useEffect(() => { localStorage.setItem('verbum_model', model); }, [model]);
  useEffect(() => { localStorage.setItem('verbum_api_key', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('verbum_session_stats', JSON.stringify(sessionStats)); }, [sessionStats]);

  // Sync Voice Transcript to Input
  useEffect(() => {
    if (transcript) {
      setInput(prev => {
        const prefix = prev && !prev.endsWith(' ') ? ' ' : '';
        return prev + prefix + transcript;
      });
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

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
    return (apiKey?.trim() || process.env.GEMINI_API_KEY || process.env.API_KEY || '');
  };

  const resolvedApiKey = resolveApiKey();
  const hasApiKey = Boolean(resolvedApiKey);

  const updateSessionStats = (usageMetadata: UsageMetadata | undefined) => {
    if (!usageMetadata) return;

    const cost = calculateCost(model, usageMetadata.promptTokens, usageMetadata.candidatesTokens);

    setSessionStats(prev => ({
      totalInput: prev.totalInput + usageMetadata.promptTokens,
      totalOutput: prev.totalOutput + usageMetadata.candidatesTokens,
      estimatedCost: prev.estimatedCost + cost,
      requestCount: prev.requestCount + 1,
    }));
  };

  const resetSessionStats = () => {
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

      const result = await translateText(input, instruction, contextPayload, { model, apiKey: effectiveApiKey });

      // Update session stats with usage metadata
      updateSessionStats(result.usageMetadata);

      const newId = uuidv4();
      const newRecord: TranslationRecord = {
        id: newId,
        original: input.trim(),
        translation: result.translation,
        timestamp: Date.now(),
        sourceLang: result.detectedSourceLanguage as 'pt' | 'en' | 'unknown',
        targetLang: result.detectedSourceLanguage === 'pt' ? 'en' : 'pt',
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
      setInput('');
      if (scrollRef.current) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      console.error("Translation failed", error);
    } finally {
      // Clear skeleton timer on completion
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }
      setLoading(false);
      setShowSkeleton(false);
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
      const result = await refineText(currentText, instruction, { model, apiKey: effectiveApiKey });

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
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleTextChange = (newText: string) => {
    setInput(newText);
    // If user starts editing, we assume they accept the changes so far,
    // Clear diff state if they edit manually to avoid sync issues.
    if (showDiff) setShowDiff(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTranslate();
    }
  };

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

  // --- Voice Input Handlers ---
  const handleMicPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!isSpeechSupported || showDiff) return;

    if (isListening) {
      // If listening, this press implies a stop toggle
      stopListening();
      startedListeningOnPressRef.current = false;
    } else {
      startListening();
      holdStartTimeRef.current = Date.now();
      startedListeningOnPressRef.current = true;
    }
  };

  const handleMicPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!startedListeningOnPressRef.current) return;

    const duration = Date.now() - holdStartTimeRef.current;
    // If held for more than 400ms, treat as "Hold-to-Talk" -> Stop on release
    if (duration > 400) {
      stopListening();
    }
    // If < 400ms, treat as "Click-to-Toggle" -> Keep listening

    startedListeningOnPressRef.current = false;
  };

  const handleMicPointerLeave = (e: React.PointerEvent) => {
    // Optional: if needed to cancel on drag out, but keeping it simple for now
  };

  const showLiquidSkeleton = showSkeleton && loading;
  const hasHistory = history.length > 0;

  return (
    <div className="min-h-screen flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto selection:bg-white/20 selection:text-white">

      {/* Ignition Gate - API Key Authorization */}
      {isAuthorized === false && (
        <ApiKeyGate
          onSuccess={handleGateSuccess}
          isEnvKeyInvalid={isEnvKeyInvalid}
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
          apiKey={apiKey}
          resolvedApiKey={resolvedApiKey}
          isEnvKey={Boolean(!apiKey && (process.env.GEMINI_API_KEY || process.env.API_KEY))}
          onModelChange={setModel}
          onApiKeyChange={setApiKey}
          sessionStats={sessionStats}
          onResetSessionStats={resetSessionStats}
          onSelect={setTone}
          onAddCustomTone={handleAddCustomTone}
          onDeleteCustomTone={handleDeleteCustomTone}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Input Section */}
      <div className="w-full mb-12 z-20 animate-slide-up">
        {/* Added dynamic shadow/border when listening */}
        <GlassCard
          className={`p-1 transition-all duration-500 ${isListening ? 'shadow-[0_0_30px_rgba(255,255,255,0.1)] border-white/20' : ''}`}
          hoverEffect={false}
        >
          {/* Flex Column Container to prevent overlap */}
          <div className="flex flex-col h-[420px] p-8">

            {/* AREA PRINCIPAL: Condicional entre Textarea e DiffViewer */}
            <div className="flex-1 relative min-h-0">
              {showDiff && originalInput ? (
                <DiffViewer
                  oldText={originalInput}
                  newText={input}
                />
              ) : (
                <DictationInput
                  text={input}
                  setText={handleTextChange}
                  interimTranscript={interimTranscript}
                  disabled={loading || isRefining}
                  placeholder="Enter text or use dictation..."
                  className={`
                    w-full h-full bg-transparent text-2xl font-light text-white placeholder-neutral-800 
                    resize-none focus:outline-none focus:ring-0 leading-relaxed transition-all duration-700
                    ${isRefining ? 'animate-pulse text-neutral-500 blur-[1px]' : ''}
                    custom-scrollbar
                    [mask-image:linear-gradient(to_bottom,transparent_0px,black_20px,black_calc(100%-20px),transparent_100%)]
                    py-6
                  `}
                />
              )}
            </div>

            {/* Controls Toolbar - Fixed height at bottom, no overlap possible */}
            <div className="shrink-0 pt-6 flex items-center justify-between border-t border-white/5 mt-2">

              {/* Left Side: Refinement Tools */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(true)}
                  className={`
                    p-3 rounded-full transition-colors group relative
                    ${(autoEnhance || contextEnabled) ? 'text-white bg-white/10 hover:bg-white/20' : 'text-neutral-600 hover:bg-white/5 hover:text-white'}
                  `}
                  title={`Settings`}
                >
                  <Sliders size={18} />
                </button>

                {!hasApiKey && (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 text-[10px] tracking-[0.15em] uppercase text-neutral-400 hover:text-white hover:border-white/30 transition-colors"
                    title="Add a Gemini API Key (aistudio.google.com/api-keys)"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                    <span>API Key</span>
                  </button>
                )}

                <div className="h-6 w-[1px] bg-neutral-800 mx-1"></div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRefine}
                    disabled={!input.trim() || loading || isRefining || showDiff}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-500
                      ${isRefining
                        ? 'bg-white/10 text-white cursor-wait'
                        : 'hover:bg-white/5 text-neutral-500 hover:text-white'}
                      disabled:opacity-30 disabled:cursor-not-allowed
                    `}
                    title={showDiff ? "Exit diff mode to enhance again" : `Refine Text`}
                  >
                    <Sparkles size={18} className={isRefining ? 'animate-spin-slow' : ''} />
                    <span className="text-xs tracking-widest uppercase font-medium hidden sm:block">
                      {isRefining ? 'Improving...' : 'Enhance'}
                    </span>
                  </button>

                  {/* MAGIC DIFF TOGGLE */}
                  {originalInput && !isRefining && (
                    <div className="flex items-center gap-1 animate-fade-in bg-white/5 rounded-full p-1">
                      {/* Preview/Diff Toggle */}
                      <button
                        onClick={toggleDiffView}
                        className={`
                            flex items-center gap-2 py-1.5 px-3 rounded-full transition-all duration-300
                            ${showDiff
                            ? 'bg-white/10 text-white'
                            : 'text-neutral-500 hover:text-white hover:bg-white/10'}
                          `}
                        title={showDiff ? "Edit Text" : "View Changes"}
                      >
                        {showDiff ? (
                          <>
                            <GitCompareArrows size={14} />
                            <span className="text-[10px] uppercase tracking-wider font-bold">Diff</span>
                          </>
                        ) : (
                          <>
                            <Eye size={14} />
                            <span className="text-[10px] uppercase tracking-wider font-bold">Preview</span>
                          </>
                        )}
                      </button>

                      <div className="w-[1px] h-3 bg-white/10"></div>

                      {/* Revert Button */}
                      <button
                        onClick={handleRevert}
                        className="p-1.5 rounded-full hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
                        title="Revert to Original"
                      >
                        <RotateCcw size={14} />
                      </button>

                      <div className="w-[1px] h-3 bg-white/10"></div>

                      {/* Apply Button */}
                      <button
                        onClick={handleApplyEnhancement}
                        className="
                            flex items-center gap-1.5 py-1.5 px-3 rounded-full 
                            bg-white text-black font-medium
                            hover:bg-neutral-200 
                            shadow-[0_0_12px_rgba(255,255,255,0.15)]
                            transition-all duration-300
                          "
                        title="Apply Enhancement"
                      >
                        <Check size={14} strokeWidth={2.5} />
                        <span className="text-[10px] uppercase tracking-wider font-bold">Apply</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Action Tools */}
              <div className="flex items-center gap-4">
                {/* Microphone Button with Liquid Interface */}
                {isSpeechSupported && (
                  <div className="flex items-center gap-2">
                    {/* Visualizer Display */}
                    <div className="w-16 flex justify-center">
                       <AudioVisualizer isListening={isListening} volume={volume} />
                    </div>

                    <button
                      onPointerDown={handleMicPointerDown}
                      onPointerUp={handleMicPointerUp}
                      onPointerLeave={handleMicPointerLeave}
                      disabled={showDiff}
                      className={`
                        p-3 rounded-full transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed
                        ${isListening
                          ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                          : 'bg-transparent text-neutral-600 hover:text-white hover:bg-white/5'}
                      `}
                      title="Hold to dictate, Click to toggle"
                    >
                      <Mic size={20} className={isListening ? "animate-pulse" : ""} />
                    </button>
                  </div>
                )}

                <div className="h-6 w-[1px] bg-neutral-800 hidden sm:block"></div>

                <button
                  onClick={handleTranslate}
                  disabled={!input.trim() || loading || isRefining}
                  className={`
                    flex items-center justify-center
                    w-12 h-12 rounded-xl
                    bg-white text-black
                    hover:bg-neutral-200 hover:scale-105
                    disabled:opacity-20 disabled:scale-100 disabled:cursor-not-allowed
                    shadow-[0_0_40px_rgba(255,255,255,0.1)]
                    transition-all duration-300
                    group
                  `}
                  title="Translate (CMD+ENTER)"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin opacity-50" />
                  ) : (
                    <Send size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </GlassCard>
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
        {(hasHistory || showLiquidSkeleton) ? (
          <div className="space-y-6">
            {showLiquidSkeleton && (
              <div className="animate-fade-in">
                <LiquidSkeleton estimatedLength={estimatedLength} />
              </div>
            )}
            {history.map((item) => (
              <TranslationItem
                key={item.id}
                item={item}
                onDelete={deleteItem}
                isNew={item.id === newItemId}
              />
            ))}
          </div>
        ) : null}
      </div>

    </div>
  );
};

export default App;
