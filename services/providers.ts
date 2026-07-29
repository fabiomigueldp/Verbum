import type { ProviderAdapter } from './adapters/baseAdapter';

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
  cachedInputPer1M?: number;
  outputPer1M: number;
  /** Optional: context window threshold above which pricing changes */
  contextWindowThreshold?: number;
  /** Optional pricing above the threshold */
  longContextInputPer1M?: number;
  longContextCachedInputPer1M?: number;
  longContextOutputPer1M?: number;
}

export type ProviderApiKind = 'gemini-sdk' | 'responses' | 'chat-completions';
export type StructuredOutputKind = 'gemini_schema' | 'json_schema' | 'json_object';
export type ReasoningMode =
  | 'gemini-minimal'
  | 'openai-none'
  | 'openai-low'
  | 'xai-none'
  | 'deepseek-disabled'
  | 'model-selected'
  | 'unsupported';

export interface ModelCapabilities {
  api: ProviderApiKind;
  structuredOutput: StructuredOutputKind;
  reasoning: ReasoningMode;
  realCostField?: 'usage.cost_in_usd_ticks';
}

export type RegisteredModel = ProviderModel & {
  pricing: ModelPricing;
  capabilities: ModelCapabilities;
};

export interface ProviderConfig {
  id: string;
  name: string;
  models: RegisteredModel[];
  keyPattern: RegExp;
  keyUrl: string;
  keyPlaceholder: string;
  /** Factory function — creates a fresh adapter instance */
  adapter: () => Promise<ProviderAdapter>;
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
        id: 'gemini-3.5-flash-lite',
        label: 'Gemini 3.5 Flash-Lite',
        desc: 'Fastest current model for high-volume translation.',
        pricing: { inputPer1M: 0.30, cachedInputPer1M: 0.03, outputPer1M: 2.50 },
        capabilities: { api: 'gemini-sdk', structuredOutput: 'gemini_schema', reasoning: 'gemini-minimal' },
      },
      {
        id: 'gemini-3.6-flash',
        label: 'Gemini 3.6 Flash',
        desc: 'Latest balance of intelligence, speed, and token efficiency.',
        pricing: { inputPer1M: 1.50, cachedInputPer1M: 0.15, outputPer1M: 7.50 },
        capabilities: { api: 'gemini-sdk', structuredOutput: 'gemini_schema', reasoning: 'gemini-minimal' },
      },
      {
        id: 'gemini-3.5-flash',
        label: 'Gemini 3.5 Flash',
        desc: 'Stable frontier Flash model for demanding text tasks.',
        pricing: { inputPer1M: 1.50, cachedInputPer1M: 0.15, outputPer1M: 9.00 },
        capabilities: { api: 'gemini-sdk', structuredOutput: 'gemini_schema', reasoning: 'gemini-minimal' },
      },
    ],
    keyPattern: /^AIza[0-9A-Za-z-_]{35}$/,
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza...',
    adapter: async () => {
      const { GeminiAdapter } = await import('./adapters/geminiAdapter');
      return new GeminiAdapter();
    },
  },

  xai: {
    id: 'xai',
    name: 'xAI Grok',
    models: [
      {
        id: 'grok-4.3',
        label: 'Grok 4.3',
        desc: 'Current general-purpose Grok model.',
        pricing: { inputPer1M: 1.25, cachedInputPer1M: 0.20, outputPer1M: 2.50 },
        capabilities: {
          api: 'chat-completions',
          structuredOutput: 'json_schema',
          reasoning: 'xai-none',
          realCostField: 'usage.cost_in_usd_ticks',
        },
      },
    ],
    keyPattern: /^xai-[A-Za-z0-9_-]+$/,
    keyUrl: 'https://console.x.ai/team/default/api-keys',
    keyPlaceholder: 'xai-...',
    adapter: async () => {
      const { XAIAdapter } = await import('./adapters/xaiAdapter');
      return new XAIAdapter();
    },
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: [
      {
        id: 'gpt-5.4-nano',
        label: 'GPT-5.4 Nano',
        desc: 'Lowest cost for simple translation.',
        badge: 'Nano',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.20, cachedInputPer1M: 0.02, outputPer1M: 1.25 },
        capabilities: { api: 'responses', structuredOutput: 'json_schema', reasoning: 'openai-none' },
      },
      {
        id: 'gpt-5.4-mini',
        label: 'GPT-5.4 Mini',
        desc: 'Quality/cost balance.',
        badge: 'Mini',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.75, cachedInputPer1M: 0.075, outputPer1M: 4.50 },
        capabilities: { api: 'responses', structuredOutput: 'json_schema', reasoning: 'openai-none' },
      },
      {
        id: 'gpt-5.6-luna',
        label: 'GPT-5.6 Luna',
        desc: 'Current GPT-5.6 model for cost-sensitive workloads.',
        pricing: {
          inputPer1M: 1.00,
          cachedInputPer1M: 0.10,
          outputPer1M: 6.00,
          contextWindowThreshold: 272_000,
          longContextInputPer1M: 2.00,
          longContextCachedInputPer1M: 0.20,
          longContextOutputPer1M: 9.00,
        },
        capabilities: { api: 'responses', structuredOutput: 'json_schema', reasoning: 'openai-none' },
      },
      {
        id: 'gpt-5.6-terra',
        label: 'GPT-5.6 Terra',
        desc: 'Current GPT-5.6 balance of intelligence and cost.',
        pricing: {
          inputPer1M: 2.50,
          cachedInputPer1M: 0.25,
          outputPer1M: 15.00,
          contextWindowThreshold: 272_000,
          longContextInputPer1M: 5.00,
          longContextCachedInputPer1M: 0.50,
          longContextOutputPer1M: 22.50,
        },
        capabilities: { api: 'responses', structuredOutput: 'json_schema', reasoning: 'openai-none' },
      },
      {
        id: 'gpt-5.6-sol',
        label: 'GPT-5.6 Sol',
        desc: 'Current GPT-5.6 flagship model.',
        pricing: {
          inputPer1M: 5.00,
          cachedInputPer1M: 0.50,
          outputPer1M: 30.00,
          contextWindowThreshold: 272_000,
          longContextInputPer1M: 10.00,
          longContextCachedInputPer1M: 1.00,
          longContextOutputPer1M: 45.00,
        },
        capabilities: { api: 'responses', structuredOutput: 'json_schema', reasoning: 'openai-none' },
      },
      {
        id: 'chat-latest',
        label: 'Chat Latest (Instant)',
        desc: 'Rolling alias for the latest Instant model used in ChatGPT.',
        pricing: { inputPer1M: 5.00, cachedInputPer1M: 0.50, outputPer1M: 30.00 },
        capabilities: { api: 'responses', structuredOutput: 'json_schema', reasoning: 'unsupported' },
      },
      {
        id: 'gpt-5-nano',
        label: 'GPT-5 Nano',
        desc: 'Legacy low-cost model.',
        badge: 'Legacy',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.05, cachedInputPer1M: 0.005, outputPer1M: 0.40 },
        capabilities: { api: 'responses', structuredOutput: 'json_schema', reasoning: 'openai-low' },
      },
      {
        id: 'gpt-5.5',
        label: 'GPT-5.5',
        desc: 'Previous frontier model for complex professional work.',
        pricing: {
          inputPer1M: 5.00,
          cachedInputPer1M: 0.50,
          outputPer1M: 30.00,
          contextWindowThreshold: 272_000,
          longContextInputPer1M: 10.00,
          longContextCachedInputPer1M: 1.00,
          longContextOutputPer1M: 45.00,
        },
        capabilities: { api: 'responses', structuredOutput: 'json_schema', reasoning: 'openai-none' },
      },
    ],
    keyPattern: /^sk-[A-Za-z0-9_-]+$/, // OpenAI keys start with sk-
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    adapter: async () => {
      const { OpenAIAdapter } = await import('./adapters/openaiAdapter');
      return new OpenAIAdapter();
    },
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
        pricing: { inputPer1M: 0.14, cachedInputPer1M: 0.0028, outputPer1M: 0.28 },
        capabilities: { api: 'chat-completions', structuredOutput: 'json_object', reasoning: 'deepseek-disabled' },
      },
      {
        id: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro',
        desc: 'Higher quality for complex reasoning tasks.',
        badge: 'Pro',
        badgeStyle: 'bg-neutral-900 text-neutral-400 border-white/10',
        pricing: { inputPer1M: 0.435, cachedInputPer1M: 0.003625, outputPer1M: 0.87 },
        capabilities: { api: 'chat-completions', structuredOutput: 'json_object', reasoning: 'deepseek-disabled' },
      },
    ],
    keyPattern: /^sk-[a-f0-9]{32}$/i, // DeepSeek keys format
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyPlaceholder: 'sk-...',
    adapter: async () => {
      const { DeepSeekAdapter } = await import('./adapters/deepseekAdapter');
      return new DeepSeekAdapter();
    },
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

export const getProviderForModel = (modelId: string): ProviderConfig | undefined =>
  getAllProviders().find((provider) => provider.models.some((model) => model.id === modelId));

export const getModelConfig = (providerId: string, modelId: string): RegisteredModel | undefined => {
  const provider = getProvider(providerId);
  return provider?.models.find((model) => model.id === modelId);
};

export const isValidModelForProvider = (providerId: string, modelId: string): boolean =>
  Boolean(getModelConfig(providerId, modelId));

export const getFirstModelId = (providerId: string): string => {
  const provider = getProvider(providerId);
  return provider?.models[0]?.id || '';
};
