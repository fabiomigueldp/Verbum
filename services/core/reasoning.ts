// ============================================================================
// CORE REASONING
// Unified reasoning disable configuration for all adapters.
// Verbum's default: reasoning is ALWAYS disabled for translation, refinement,
// indexing, and manifest generation. These tasks require deterministic,
// fast output — reasoning adds latency, cost, and unpredictability.
// ============================================================================

import { getModelConfig, ReasoningMode } from '../providers';

type ReasoningConfig = Record<string, unknown>;

const REASONING_CONFIGS: Record<ReasoningMode, ReasoningConfig | undefined> = {
  'gemini-disabled': {
    thinkingConfig: {
      thinkingBudget: 0,
    },
  },
  'gemini-minimal': {
    thinkingConfig: {
      thinkingLevel: 'MINIMAL',
    },
  },
  'openai-none': {
    reasoning: {
      effort: 'none' as const,
    },
  },
  'openai-low': {
    reasoning: {
      effort: 'low' as const,
    },
  },
  'xai-none': {
    reasoning_effort: 'none' as const,
  },
  'deepseek-disabled': {
    thinking: {
      type: 'disabled' as const,
    },
  },
  'model-selected': undefined,
  unsupported: undefined,
};

export const getReasoningConfig = (providerId: string, modelId: string): ReasoningConfig => {
  const model = getModelConfig(providerId, modelId);
  if (!model) return {};
  return REASONING_CONFIGS[model.capabilities.reasoning] || {};
};
