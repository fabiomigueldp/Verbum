// ============================================================================
// CORE REASONING
// Unified lowest-reasoning configuration for all adapters.
// Verbum requests no reasoning where supported and the lowest available level
// otherwise. Gemini 3.x "minimal" may still emit thought tokens, but it is the
// lowest level supported by the current stable models.
// ============================================================================

import { getModelConfig, ReasoningMode } from '../providers';

type ReasoningConfig = Record<string, unknown>;

const REASONING_CONFIGS: Record<ReasoningMode, ReasoningConfig | undefined> = {
  'gemini-minimal': {
    generation_config: {
      thinking_level: 'minimal',
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
