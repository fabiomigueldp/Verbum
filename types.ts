// ============================================================================
// LANGUAGE SYSTEM - Smart Pivot Architecture (Global Executive Suite)
// ============================================================================

/** Supported language codes - 15 languages including RTL support */
export type LanguageCode = 
  | 'pt' | 'en' | 'es' | 'fr' | 'de' | 'it' 
  | 'ja' | 'zh' | 'ru' | 'ko' | 'hi'
  | 'ar' | 'he'  // RTL Languages
  | 'el' | 'la'  // Classical Languages
  | 'unknown';

/** RTL (Right-to-Left) language codes */
export const RTL_LANGUAGES: ReadonlyArray<Exclude<LanguageCode, 'unknown'>> = ['ar', 'he'];

/** Check if a language code is RTL */
export const isRTLLanguage = (code: LanguageCode): boolean => 
  RTL_LANGUAGES.includes(code as Exclude<LanguageCode, 'unknown'>);

/** Language configuration for Anchor & Target system */
export interface LanguageConfig {
  /** User's native language (home base) */
  anchor: Exclude<LanguageCode, 'unknown'>;
  /** Active foreign language (translation target) */
  target: Exclude<LanguageCode, 'unknown'>;
}

/** Language metadata for display */
export interface LanguageMeta {
  code: Exclude<LanguageCode, 'unknown'>;
  name: string;
  nativeName: string;
  /** Text direction */
  dir: 'ltr' | 'rtl';
}

/** All supported languages with metadata - Global Executive Suite (15 languages) */
export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  // Western Languages
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr' },
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr' },
  // Asian Languages
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', dir: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr' },
  // Slavic
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr' },
  // RTL Languages
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', dir: 'rtl' },
  // Classical Languages
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', dir: 'ltr' },
  { code: 'la', name: 'Latin', nativeName: 'Latina', dir: 'ltr' },
];

// ============================================================================
// TRANSLATION RECORDS
// ============================================================================

export interface TranslationRecord {
  id: string;
  original: string;
  translation: string;
  timestamp: number;
  /** Detected source language of input */
  sourceLang: LanguageCode;
  /** Language the text was translated to */
  targetLang: Exclude<LanguageCode, 'unknown'>;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface UsageMetadata {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  cachedPromptTokens?: number;
  reasoningTokens?: number;
}

export interface TranslationResponse {
  translation: string;
  /** Detected language of the input text */
  detectedSourceLanguage: LanguageCode;
  /** The language the text was translated into */
  targetLanguageUsed: Exclude<LanguageCode, 'unknown'>;
  usageMetadata?: UsageMetadata;
  actualCostNano?: string;
}

// ============================================================================
// REFINEMENT
// ============================================================================

export type ToneOption = 'standard' | 'executive' | 'concise' | 'softer' | string;

export interface CustomTone {
  id: string;
  label: string;
  description: string;
}

export interface RefinementResponse {
  refined: string;
  changes: string;
  detectedLanguage?: LanguageCode;
  usageMetadata?: UsageMetadata;
  actualCostNano?: string;
}

// ============================================================================
// SESSION & CONTEXT
// ============================================================================

export interface UsageSession {
  totalInput: number;
  totalOutput: number;
  estimatedCost: number;
  estimatedCostNano?: string;
  requestCount: number;
}

export interface ContextMessage {
  role: 'user' | 'model';
  content: string;
}

// ============================================================================
// AI CONFIGURATION
// ============================================================================

/** Provider ID — extensible registry string. Formerly: 'gemini' | 'xai' */
export type ProviderOption = string;

export const XAI_MODEL_ID = 'grok-4-1-fast-non-reasoning' as const;

/** Extensible model option. Specific IDs are validated at runtime via the provider registry. */
export type ModelOption = string;

export interface AiRuntimeConfig {
  provider?: ProviderOption;
  model?: ModelOption;
  apiKey?: string;
  /** Optional correlation ID for telemetry logging */
  telemetryId?: string;
}

// ============================================================================
// INDEXER / COLLECTIO
// ============================================================================

export interface ShardMetadata {
  title: string;
  domain: string;
  abstract: string;
  tags: string[];
}

export interface IndexerResponse {
  metadata: ShardMetadata;
  usageMetadata?: UsageMetadata;
  actualCostNano?: string;
}

export type CollectionType = 'codebase' | 'document' | 'dataset' | 'mixed';

export interface CollectionManifest {
  title: string;
  type: CollectionType;
  description: string;
  suggestedFilename: string;
}

export interface ManifestResponse {
  manifest: CollectionManifest;
  usageMetadata?: UsageMetadata;
  actualCostNano?: string;
}

export interface ShardSummary {
  title: string;
  domain: string;
  tags: string[];
  excerpt: string;
}

// ============================================================================
// TELEMETRY / REQUEST LOGGING
// ============================================================================

export type TelemetryOperation = 'translate' | 'refine' | 'index' | 'manifest';

export type TelemetryErrorType = 'network' | 'validation' | 'api' | 'timeout' | 'unknown';

export interface RequestLog {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  operation: TelemetryOperation;
  durationMs: number;
  status: 'success' | 'error';
  errorType?: TelemetryErrorType;
  errorMessage?: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
  estimatedCostNano: string;
  actualCostNano?: string;
  costSource?: 'estimated' | 'provider_actual';
  inputLength: number;
  outputLength?: number;
  inputPreview: string;
  outputPreview?: string;
  tokensPerSecond: number;
}
