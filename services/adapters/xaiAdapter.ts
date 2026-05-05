import { LanguageConfig, ContextMessage, AiRuntimeConfig, IndexerResponse, ManifestResponse, ShardSummary } from '../../types';
import { ProviderAdapter } from './baseAdapter';
import { TranslationSchema, RefinementSchema, IndexerSchema, ManifestSchema, toOpenAIJsonSchema } from '../core/schemas';
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

// ============================================================================
// XAI ADAPTER
// OpenAI-compatible REST API with json_schema strict support.
// ============================================================================

const XAI_API_BASE = 'https://api.x.ai/v1';
const DEFAULT_MODEL = 'grok-4-1-fast-non-reasoning';

const resolveApiKey = (apiKey?: string): string => {
  const key = apiKey?.trim() || process.env.XAI_API_KEY;
  if (!key) throw new Error('Missing API key for xAI.');
  return key;
};

const resolveModel = (model?: string): string => model || DEFAULT_MODEL;

const generateFallbackTitle = (text: string): string => {
  const cleaned = text.trim().replace(/\n/g, ' ').slice(0, 30);
  return cleaned.length === 30 ? `${cleaned}...` : cleaned;
};

interface XaiPayload {
  model: string;
  temperature: number;
  messages: Array<{ role: string; content: string }>;
  response_format: {
    type: 'json_schema';
    json_schema: Record<string, unknown>;
  };
}

const callXai = async (
  apiKey: string,
  payload: XaiPayload
): Promise<NormalizedResponse> => {
  const response = await fetch(`${XAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`xAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const raw = normalizeOpenAIResponse(data);
  return toNormalizedResponse(raw, data);
};

export class XAIAdapter implements ProviderAdapter {
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

    const payload: XaiPayload = {
      model: resolveModel(config?.model),
      temperature: 0,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: buildSafetyEnvelope(text) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: toOpenAIJsonSchema(TranslationSchema, 'translation_result'),
      },
    };

    return callXai(resolveApiKey(config?.apiKey), payload);
  }

  async refineText(
    text: string,
    instruction: string,
    config?: AiRuntimeConfig
  ): Promise<NormalizedResponse> {
    const payload: XaiPayload = {
      model: resolveModel(config?.model),
      temperature: 0,
      messages: [
        { role: 'system', content: REFINEMENT_SYSTEM_INSTRUCTION },
        { role: 'user', content: buildRefinementUserPrompt(text, instruction) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: toOpenAIJsonSchema(RefinementSchema, 'refinement_result'),
      },
    };

    return callXai(resolveApiKey(config?.apiKey), payload);
  }

  async indexText(
    text: string,
    existingDomains?: string[],
    config?: AiRuntimeConfig
  ): Promise<IndexerResponse> {
    const payload: XaiPayload = {
      model: resolveModel(config?.model),
      temperature: 0,
      messages: [
        { role: 'system', content: buildIndexerInstruction(existingDomains) },
        { role: 'user', content: buildIndexerUserPrompt(text) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: toOpenAIJsonSchema(IndexerSchema, 'indexer_result'),
      },
    };

    const result = await callXai(resolveApiKey(config?.apiKey), payload);
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
      const payload: XaiPayload = {
        model: resolveModel(config?.model),
        temperature: 0,
        messages: [
          { role: 'system', content: MANIFEST_SYSTEM_INSTRUCTION },
          { role: 'user', content: buildManifestUserPrompt(shards) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: toOpenAIJsonSchema(ManifestSchema, 'manifest_result'),
        },
      };

      const result = await callXai(resolveApiKey(config?.apiKey), payload);
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
      const response = await fetch(`${XAI_API_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
