import { LanguageConfig, ContextMessage, AiRuntimeConfig, IndexerResponse, ManifestResponse, ShardSummary } from '../../types';
import { ProviderAdapter } from './baseAdapter';
import { TranslationSchema, RefinementSchema, IndexerSchema, ManifestSchema } from '../core/schemas';
import {
  buildTranslationInstruction,
  buildContextBlock,
  buildToneOverride,
  buildSafetyEnvelope,
  REFINEMENT_SYSTEM_INSTRUCTION,
  buildRefinementUserPrompt,
  buildIndexerInstruction,
  buildIndexerUserPrompt,
  buildManifestUserPrompt,
  MANIFEST_SYSTEM_INSTRUCTION,
} from '../core/prompts';
import { normalizeOpenAIResponse, toNormalizedResponse, NormalizedResponse } from '../core/normalize';
import { OPENAI_REASONING_DISABLED } from '../core/reasoning';

// ============================================================================
// OPENAI ADAPTER
// Responses API via fetch (not SDK) — future-proof, minimal bundle.
// ============================================================================

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-5-nano';

const resolveApiKey = (apiKey?: string): string => {
  const key = apiKey?.trim() || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing API key for OpenAI.');
  return key;
};

const resolveModel = (model?: string): string => model || DEFAULT_MODEL;

const generateFallbackTitle = (text: string): string => {
  const cleaned = text.trim().replace(/\n/g, ' ').slice(0, 30);
  return cleaned.length === 30 ? `${cleaned}...` : cleaned;
};

interface OpenAIPayload {
  model: string;
  input: Array<{ role: string; content: string }>;
  text: {
    format: {
      type: 'json_schema';
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
  max_output_tokens?: number;
}

const callOpenAI = async (
  apiKey: string,
  payload: OpenAIPayload
): Promise<NormalizedResponse> => {
  const response = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const raw = normalizeOpenAIResponse(data);
  return toNormalizedResponse(raw, data);
};

export class OpenAIAdapter implements ProviderAdapter {
  async translateText(
    text: string,
    langConfig: LanguageConfig,
    refinementInstruction?: string,
    contextHistory?: ContextMessage[],
    config?: AiRuntimeConfig
  ): Promise<NormalizedResponse> {
    let systemInstruction = buildTranslationInstruction(langConfig);
    systemInstruction += buildContextBlock(contextHistory || []);
    if (refinementInstruction) {
      systemInstruction += buildToneOverride(refinementInstruction);
    }

    const payload: OpenAIPayload = {
      model: resolveModel(config?.model),
      input: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: buildSafetyEnvelope(text) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'translation_result',
          strict: true,
          schema: {
            type: 'object',
            properties: TranslationSchema.properties,
            required: TranslationSchema.required,
            additionalProperties: TranslationSchema.additionalProperties,
          },
        },
      },
      ...OPENAI_REASONING_DISABLED,
      max_output_tokens: 2048,
    };

    return callOpenAI(resolveApiKey(config?.apiKey), payload);
  }

  async refineText(
    text: string,
    instruction: string,
    config?: AiRuntimeConfig
  ): Promise<NormalizedResponse> {
    const payload: OpenAIPayload = {
      model: resolveModel(config?.model),
      input: [
        { role: 'system', content: REFINEMENT_SYSTEM_INSTRUCTION },
        { role: 'user', content: buildRefinementUserPrompt(text, instruction) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'refinement_result',
          strict: true,
          schema: {
            type: 'object',
            properties: RefinementSchema.properties,
            required: RefinementSchema.required,
            additionalProperties: RefinementSchema.additionalProperties,
          },
        },
      },
      ...OPENAI_REASONING_DISABLED,
      max_output_tokens: 2048,
    };

    return callOpenAI(resolveApiKey(config?.apiKey), payload);
  }

  async indexText(
    text: string,
    existingDomains?: string[],
    config?: AiRuntimeConfig
  ): Promise<IndexerResponse> {
    const payload: OpenAIPayload = {
      model: resolveModel(config?.model),
      input: [
        { role: 'system', content: buildIndexerInstruction(existingDomains) },
        { role: 'user', content: buildIndexerUserPrompt(text) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'indexer_result',
          strict: true,
          schema: {
            type: 'object',
            properties: IndexerSchema.properties,
            required: IndexerSchema.required,
            additionalProperties: IndexerSchema.additionalProperties,
          },
        },
      },
      ...OPENAI_REASONING_DISABLED,
      max_output_tokens: 2048,
    };

    const result = await callOpenAI(resolveApiKey(config?.apiKey), payload);
    const parsed = JSON.parse(result.text);
    return {
      metadata: {
        title: parsed.title || generateFallbackTitle(text),
        domain: parsed.domain || 'Uncategorized',
        abstract: parsed.abstract || 'Content pending classification.',
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      },
      usageMetadata: result.usage,
    };
  }

  async generateManifest(
    shards: ShardSummary[],
    config?: AiRuntimeConfig
  ): Promise<ManifestResponse> {
    const fallbackManifest = {
      title: `Verbum Collection [${new Date().toISOString().split('T')[0]}]`,
      type: 'mixed' as const,
      description: 'A curated collection of content fragments.',
      suggestedFilename: `verbum-collection-${Date.now()}`,
    };

    if (shards.length === 0) {
      return { manifest: fallbackManifest };
    }

    try {
      const payload: OpenAIPayload = {
        model: resolveModel(config?.model),
        input: [
          { role: 'system', content: MANIFEST_SYSTEM_INSTRUCTION },
          { role: 'user', content: buildManifestUserPrompt(shards) },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'manifest_result',
            strict: true,
            schema: {
              type: 'object',
              properties: ManifestSchema.properties,
              required: ManifestSchema.required,
              additionalProperties: ManifestSchema.additionalProperties,
            },
          },
        },
        ...OPENAI_REASONING_DISABLED,
        max_output_tokens: 2048,
      };

      const result = await callOpenAI(resolveApiKey(config?.apiKey), payload);
      const parsed = JSON.parse(result.text);
      const validTypes = ['codebase', 'document', 'dataset', 'mixed'] as const;
      const type = validTypes.includes(parsed.type) ? (parsed.type as typeof validTypes[number]) : 'mixed';

      return {
        manifest: {
          title: parsed.title || fallbackManifest.title,
          type,
          description: parsed.description || fallbackManifest.description,
          suggestedFilename: parsed.suggestedFilename?.replace(/[^a-z0-9-]/gi, '-').toLowerCase() || fallbackManifest.suggestedFilename,
        },
        usageMetadata: result.usage,
      };
    } catch (error) {
      console.error('Manifest generation error:', error);
      return { manifest: fallbackManifest };
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${OPENAI_API_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
