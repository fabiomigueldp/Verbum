// ============================================================================
// CORE NORMALIZE
// Convert raw provider responses to unified internal format.
// Each adapter returns raw response; this layer extracts normalized data.
// ============================================================================

import { UsageMetadata } from '../../types';

export interface RawAdapterResponse {
  text: string;
  usage?: {
    input: number;
    output: number;
    total: number;
    cachedInput?: number;
    reasoning?: number;
    costUsd?: number;
  };
}

export interface NormalizedResponse {
  text: string;
  usage: UsageMetadata | undefined;
  costUsd?: number;
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------
export const normalizeGeminiResponse = (raw: any): RawAdapterResponse => {
  const usage = raw?.usageMetadata;
  return {
    text: raw?.text || '',
    usage: usage ? {
      input: usage.promptTokenCount ?? 0,
      output: usage.candidatesTokenCount ?? 0,
      total: usage.totalTokenCount ?? 0,
      cachedInput: usage.cachedContentTokenCount,
      reasoning: usage.thoughtsTokenCount,
    } : undefined,
  };
};

// ---------------------------------------------------------------------------
// OpenAI / xAI (OpenAI-compatible)
// ---------------------------------------------------------------------------
export const normalizeOpenAIResponse = (raw: any): RawAdapterResponse => {
  const usage = raw?.usage;
  return {
    text: extractOpenAIContent(raw),
    usage: usage ? {
      input: usage.prompt_tokens ?? usage.input_tokens ?? 0,
      output: usage.completion_tokens ?? usage.output_tokens ?? 0,
      total: usage.total_tokens ?? 0,
      cachedInput: usage.prompt_tokens_details?.cached_tokens ?? usage.input_tokens_details?.cached_tokens,
      reasoning: usage.completion_tokens_details?.reasoning_tokens ?? usage.output_tokens_details?.reasoning_tokens,
      costUsd: usage.cost_in_usd_ticks ? usage.cost_in_usd_ticks / 10_000_000_000 : undefined,
    } : undefined,
  };
};

const extractOpenAIContent = (raw: any): string => {
  // Responses API
  if (typeof raw?.output_text === 'string') return raw.output_text;

  const chunks = raw?.output
    ?.flatMap((item: any) => item?.content ?? [])
    ?.filter((c: any) => c?.type === 'output_text' || c?.type === 'text')
    ?.map((c: any) => c?.text)
    ?.join('') ?? '';

  if (chunks) return chunks;

  // Chat Completions API fallback
  return raw?.choices?.[0]?.message?.content || '';
};

// ---------------------------------------------------------------------------
// DeepSeek (OpenAI-compatible but with weaker guarantees)
// ---------------------------------------------------------------------------
export const normalizeDeepSeekResponse = (raw: any): RawAdapterResponse => {
  const usage = raw?.usage;
  return {
    text: raw?.choices?.[0]?.message?.content || '',
    usage: usage ? {
      input: usage.prompt_tokens ?? 0,
      output: usage.completion_tokens ?? 0,
      total: usage.total_tokens ?? 0,
    } : undefined,
  };
};

// ---------------------------------------------------------------------------
// Final normalization → internal types
// ---------------------------------------------------------------------------
export const toNormalizedResponse = (
  raw: RawAdapterResponse,
  originalRaw: unknown
): NormalizedResponse => ({
  text: raw.text,
  usage: raw.usage ? {
    promptTokens: raw.usage.input,
    candidatesTokens: raw.usage.output,
    totalTokens: raw.usage.total,
  } : undefined,
  costUsd: raw.usage?.costUsd,
  raw: originalRaw,
});
