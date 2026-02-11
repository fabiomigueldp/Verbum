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
}

export interface TranslationResponse {
  translation: string;
  /** Detected language of the input text */
  detectedSourceLanguage: LanguageCode;
  /** The language the text was translated into */
  targetLanguageUsed: Exclude<LanguageCode, 'unknown'>;
  usageMetadata?: UsageMetadata;
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

export type ProviderOption = 'gemini' | 'xai';

export const XAI_MODEL_ID = 'grok-4-1-fast-non-reasoning' as const;

export type ModelOption =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash-lite-preview-09-2025'
  | 'gemini-2.0-flash-lite'
  | 'gemini-3-flash-preview'
  | typeof XAI_MODEL_ID
  | string;

export interface AiRuntimeConfig {
  provider?: ProviderOption;
  model?: ModelOption;
  apiKey?: string;
}
