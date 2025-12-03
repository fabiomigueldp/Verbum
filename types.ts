export type LanguageCode = 'pt' | 'en' | 'unknown';

export interface TranslationRecord {
  id: string;
  original: string;
  translation: string;
  timestamp: number;
  sourceLang: LanguageCode;
  targetLang: 'pt' | 'en';
}

export interface UsageMetadata {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface TranslationResponse {
  translation: string;
  detectedSourceLanguage: LanguageCode;
  usageMetadata?: UsageMetadata;
}

export type ToneOption = 'standard' | 'executive' | 'concise' | 'softer' | string;

export interface CustomTone {
  id: string;
  label: string;
  description: string;
}

export interface RefinementResponse {
  refined: string;
  changes: string; // Brief description of what changed
  detectedLanguage?: LanguageCode;
  usageMetadata?: UsageMetadata;
}

export interface UsageSession {
  totalInput: number;
  totalOutput: number;
  estimatedCost: number;
  requestCount: number;
}

export interface ContextMessage {
  role: 'user' | 'model';
  content: string;
}

export type ModelOption = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-2.5-pro' | string;

export interface AiRuntimeConfig {
  model?: ModelOption;
  apiKey?: string;
}
