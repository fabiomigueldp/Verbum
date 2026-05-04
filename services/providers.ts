import {
  translateText as geminiTranslate,
  refineText as geminiRefine,
  validateApiKey as geminiValidate,
  indexText as geminiIndex,
  generateCollectionManifest as geminiManifest,
} from './geminiService';
import * as xaiService from './xaiService';
import { XAI_MODEL_ID } from '../types';

// ============================================================================
// PROVIDER REGISTRY
// Central, extensible configuration for all AI providers.
// Adding a new provider = one entry here. Zero component changes.
// ============================================================================

export interface ProviderModel {
  id: string;
  label: string;
  desc: string;
  badge?: string;
  badgeStyle?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  models: ProviderModel[];
  keyPattern: RegExp;
  keyUrl: string;
  keyPlaceholder: string;
  services: {
    translateText: typeof geminiTranslate;
    refineText: typeof geminiRefine;
    validateApiKey: typeof geminiValidate;
    indexText: typeof geminiIndex;
    generateCollectionManifest: typeof geminiManifest;
  };
}

const PROVIDERS: Record<string, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    models: [
      {
        id: 'gemini-2.5-flash-lite',
        label: 'Gemini 2.5 Flash Lite',
        desc: 'Maximum speed. Instant latency.',
        badge: 'Fastest',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
      },
      {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        desc: 'Balanced performance.',
        badge: 'Balanced',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
      },
      {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        desc: 'Complex reasoning.',
        badge: 'Pro',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
      },
      {
        id: 'gemini-2.5-flash-lite-preview-09-2025',
        label: 'Gemini 2.5 Flash Lite Preview',
        desc: 'Experimental speed build.',
        badge: 'Preview',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
      },
      {
        id: 'gemini-2.0-flash-lite',
        label: 'Gemini 2.0 Flash Lite',
        desc: 'Stable low-latency option.',
        badge: 'Lite',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
      },
      {
        id: 'gemini-3-flash-preview',
        label: 'Gemini 3 Flash Preview',
        desc: 'Next-gen speed preview.',
        badge: 'Preview',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
      },
    ],
    keyPattern: /^AIza[0-9A-Za-z-_]{35}$/,
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza...',
    services: {
      translateText: geminiTranslate,
      refineText: geminiRefine,
      validateApiKey: geminiValidate,
      indexText: geminiIndex,
      generateCollectionManifest: geminiManifest,
    },
  },
  xai: {
    id: 'xai',
    name: 'xAI Grok',
    models: [
      {
        id: XAI_MODEL_ID,
        label: 'Grok 4.1 Fast (Non-Reasoning)',
        desc: 'Fixed model for xAI.',
        badge: 'Fixed',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
      },
    ],
    keyPattern: /^xai-[A-Za-z0-9_-]+$/, // permissive, xAI keys vary
    keyUrl: 'https://console.x.ai/team/default/api-keys',
    keyPlaceholder: 'xai-...',
    services: {
      translateText: xaiService.translateText,
      refineText: xaiService.refineText,
      validateApiKey: xaiService.validateApiKey,
      indexText: xaiService.indexText,
      generateCollectionManifest: xaiService.generateCollectionManifest,
    },
  },
};

export const getProvider = (id: string): ProviderConfig | undefined => PROVIDERS[id];

export const getAllProviders = (): ProviderConfig[] => Object.values(PROVIDERS);

export const getDefaultProviderId = (): string => 'gemini';

export const isValidProvider = (id: string): boolean => id in PROVIDERS;

export const getModelLabel = (providerId: string, modelId: string): string => {
  const provider = getProvider(providerId);
  if (!provider) return modelId;
  const model = provider.models.find((m) => m.id === modelId);
  return model?.label || modelId;
};
