// ============================================================================
// CORE REASONING
// Unified reasoning disable configuration for all adapters.
// Verbum's default: reasoning is ALWAYS disabled for translation, refinement,
// indexing, and manifest generation. These tasks require deterministic,
// fast output — reasoning adds latency, cost, and unpredictability.
// ============================================================================

/**
 * Gemini native reasoning config.
 * thinkingBudget: 0 explicitly disables thinking tokens.
 * -1 would mean "automatic" (model decides).
 */
export const GEMINI_REASONING_DISABLED = {
  thinkingConfig: {
    thinkingBudget: 0,
  },
};

/**
 * OpenAI Responses API reasoning config.
 * effort: 'none' disables reasoning entirely.
 */
export const OPENAI_REASONING_DISABLED = {
  reasoning: {
    effort: 'none' as const,
  },
};

/**
 * DeepSeek reasoning config.
 * thinking.type: 'disabled' prevents the model from generating CoT.
 */
export const DEEPSEEK_REASONING_DISABLED = {
  thinking: {
    type: 'disabled' as const,
  },
};

/**
 * xAI does not expose reasoning control via the Chat Completions API.
 * Reasoning vs non-reasoning is determined by model selection only.
 * We use grok-4-1-fast-non-reasoning which has no reasoning capability.
 */
export const XAI_REASONING_DISABLED = undefined;
