import { ProviderAdapter } from './adapters/baseAdapter';
import { GeminiAdapter } from './adapters/geminiAdapter';
import { XAIAdapter } from './adapters/xaiAdapter';
import { OpenAIAdapter } from './adapters/openaiAdapter';
import { DeepSeekAdapter } from './adapters/deepseekAdapter';

// ============================================================================
// PROVIDER REGISTRY
// Central, extensible configuration for all AI providers.
// Adding a new provider = one entry here. Zero changes elsewhere.
// ============================================================================

export interface ProviderModel {
  id: string;
  label: string;
  desc: string;
  badge?: string;
  badgeStyle?: string;
}

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  /** Optional: context window threshold above which pricing changes */
  contextWindowThreshold?: number;
  /** Optional: multiplier applied when above threshold */
  contextWindowMultiplier?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  models: Array<ProviderModel & { pricing: ModelPricing }>;
  keyPattern: RegExp;
  keyUrl: string;
  keyPlaceholder: string;
  /** Environment variable names to check for API key fallback, in priority order */
  envKeys: string[];
  /** Factory function — creates a fresh adapter instance */
  adapter: () => ProviderAdapter;
}

// ---------------------------------------------------------------------------
// REGISTRY
// ---------------------------------------------------------------------------

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
        pricing: { inputPer1M: 0.10, outputPer1M: 0.40 },
      },
      {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        desc: 'Balanced performance.',
        badge: 'Balanced',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.30, outputPer1M: 2.50 },
      },
      {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        desc: 'Complex reasoning.',
        badge: 'Pro',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: {
          inputPer1M: 1.25,
          outputPer1M: 10.00,
          contextWindowThreshold: 200_000,
          contextWindowMultiplier: 2.5,
        },
      },
    ],
    keyPattern: /^AIza[0-9A-Za-z-_]{35}$/,
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza...',
    envKeys: ['GEMINI_API_KEY', 'API_KEY'],
    adapter: () => new GeminiAdapter(),
  },

  xai: {
    id: 'xai',
    name: 'xAI Grok',
    models: [
      {
        id: 'grok-4-1-fast-non-reasoning',
        label: 'Grok 4.1 Fast (Non-Reasoning)',
        desc: 'Fixed model for xAI.',
        badge: 'Fixed',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.20, outputPer1M: 0.50 },
      },
    ],
    keyPattern: /^xai-[A-Za-z0-9_-]+$/,
    keyUrl: 'https://console.x.ai/team/default/api-keys',
    keyPlaceholder: 'xai-...',
    envKeys: ['XAI_API_KEY'],
    adapter: () => new XAIAdapter(),
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: [
      {
        id: 'gpt-5-nano',
        label: 'GPT-5 Nano',
        desc: 'Lowest cost for simple translation.',
        badge: 'Nano',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.05, outputPer1M: 0.40 },
      },
      {
        id: 'gpt-5.4-nano',
        label: 'GPT-5.4 Nano',
        desc: 'Newest low-cost line.',
        badge: 'Nano',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.20, outputPer1M: 1.25 },
      },
      {
        id: 'gpt-5.4-mini',
        label: 'GPT-5.4 Mini',
        desc: 'Quality/cost balance.',
        badge: 'Mini',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.75, outputPer1M: 4.50 },
      },
    ],
    keyPattern: /^sk-[A-Za-z0-9_-]+$/, // OpenAI keys start with sk-
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    envKeys: ['OPENAI_API_KEY'],
    adapter: () => new OpenAIAdapter(),
  },

  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    models: [
      {
        id: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        desc: 'Extremely fast and cheap. Best for high-volume translation.',
        badge: 'Flash',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.14, outputPer1M: 0.28 },
      },
      {
        id: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro',
        desc: 'Higher quality for complex reasoning tasks.',
        badge: 'Pro',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.435, outputPer1M: 0.87 },
      },
    ],
    keyPattern: /^sk-[a-f0-9]{32}$/i, // DeepSeek keys format
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyPlaceholder: 'sk-...',
    envKeys: ['DEEPSEEK_API_KEY'],
    adapter: () => new DeepSeekAdapter(),
  },
};

// ---------------------------------------------------------------------------
// ACCESSORS
// ---------------------------------------------------------------------------

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

export const getModelPricing = (providerId: string, modelId: string): ModelPricing | undefined => {
  const provider = getProvider(providerId);
  if (!provider) return undefined;
  const model = provider.models.find((m) => m.id === modelId);
  return model?.pricing;
};

export const getFirstModelId = (providerId: string): string => {
  const provider = getProvider(providerId);
  return provider?.models[0]?.id || '';
};
