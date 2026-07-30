import {
  LanguageConfig,
  ContextMessage,
  AiRuntimeConfig,
  IndexerResponse,
  ManifestResponse,
  ShardSummary,
} from '../../types';
import { ProviderAdapter } from './baseAdapter';
import {
  TranslationSchema,
  RefinementSchema,
  IndexerSchema,
  ManifestSchema,
  toOpenAIJsonSchema,
} from '../core/schemas';
import {
  buildTranslationInstruction,
  buildContextBlock,
  buildToneOverride,
  buildNaturalProseInstruction,
  buildSafetyEnvelope,
  buildRefinementSystemInstruction,
  buildRefinementUserPrompt,
  buildIndexerInstruction,
  buildIndexerUserPrompt,
  buildManifestUserPrompt,
  MANIFEST_SYSTEM_INSTRUCTION,
} from '../core/prompts';
import {
  normalizeOpenAIResponse,
  toNormalizedResponse,
  NormalizedResponse,
} from '../core/normalize';
import { getReasoningConfig } from '../core/reasoning';

// ============================================================================
// CEREBRAS ADAPTER
// OpenAI-compatible Chat Completions API with strict structured outputs.
// ============================================================================

const CEREBRAS_API_BASE = 'https://api.cerebras.ai/v1';
const DEFAULT_MODEL = 'gemma-4-31b';

const resolveApiKey = (apiKey?: string): string => {
  const key = apiKey?.trim();
  if (!key) throw new Error('Missing API key for Cerebras.');
  return key;
};

const resolveModel = (model?: string): string => model || DEFAULT_MODEL;

const generateFallbackTitle = (text: string): string => {
  const cleaned = text.trim().replace(/\n/g, ' ').slice(0, 30);
  return cleaned.length === 30 ? `${cleaned}...` : cleaned;
};

const removeUnsupportedSchemaKeywords = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(removeUnsupportedSchemaKeywords);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'description')
      .map(([key, child]) => [key, removeUnsupportedSchemaKeywords(child)])
  );
};

const toCerebrasJsonSchema = (
  schema: Parameters<typeof toOpenAIJsonSchema>[0],
  name: string
): Record<string, unknown> =>
  removeUnsupportedSchemaKeywords(
    toOpenAIJsonSchema(schema, name)
  ) as Record<string, unknown>;

interface CerebrasPayload {
  model: string;
  temperature: number;
  max_completion_tokens: number;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  response_format: {
    type: 'json_schema';
    json_schema: Record<string, unknown>;
  };
  reasoning_effort?: 'none' | 'low';
}

const callCerebras = async (
  apiKey: string,
  payload: CerebrasPayload
): Promise<NormalizedResponse> => {
  const response = await fetch(`${CEREBRAS_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cerebras request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const raw = normalizeOpenAIResponse(data);
  return toNormalizedResponse(raw, data);
};

const createPayload = (
  model: string,
  systemInstruction: string,
  userPrompt: string,
  schema: Parameters<typeof toOpenAIJsonSchema>[0],
  schemaName: string
): CerebrasPayload => ({
  model,
  ...getReasoningConfig('cerebras', model),
  temperature: 0,
  max_completion_tokens: 2048,
  messages: [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: userPrompt },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: toCerebrasJsonSchema(schema, schemaName),
  },
});

export class CerebrasAdapter implements ProviderAdapter {
  async translateText(
    text: string,
    langConfig: LanguageConfig,
    refinementInstruction?: string,
    contextHistory?: ContextMessage[],
    config?: AiRuntimeConfig,
    glossaryInstruction?: string
  ): Promise<NormalizedResponse> {
    let systemInstruction = buildTranslationInstruction(langConfig);
    systemInstruction += glossaryInstruction || '';
    systemInstruction += buildContextBlock(contextHistory || []);
    if (refinementInstruction) {
      systemInstruction += buildToneOverride(refinementInstruction);
    }
    systemInstruction += buildNaturalProseInstruction(config?.naturalProse);

    const model = resolveModel(config?.model);
    return callCerebras(
      resolveApiKey(config?.apiKey),
      createPayload(
        model,
        systemInstruction,
        buildSafetyEnvelope(text),
        TranslationSchema,
        'translation_result'
      )
    );
  }

  async refineText(
    text: string,
    instruction: string,
    config?: AiRuntimeConfig
  ): Promise<NormalizedResponse> {
    const model = resolveModel(config?.model);
    return callCerebras(
      resolveApiKey(config?.apiKey),
      createPayload(
        model,
        buildRefinementSystemInstruction(config?.naturalProse),
        buildRefinementUserPrompt(text, instruction),
        RefinementSchema,
        'refinement_result'
      )
    );
  }

  async indexText(
    text: string,
    existingDomains?: string[],
    config?: AiRuntimeConfig
  ): Promise<IndexerResponse> {
    const model = resolveModel(config?.model);
    const result = await callCerebras(
      resolveApiKey(config?.apiKey),
      createPayload(
        model,
        buildIndexerInstruction(existingDomains),
        buildIndexerUserPrompt(text),
        IndexerSchema,
        'indexer_result'
      )
    );
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
      const model = resolveModel(config?.model);
      const result = await callCerebras(
        resolveApiKey(config?.apiKey),
        createPayload(
          model,
          MANIFEST_SYSTEM_INSTRUCTION,
          buildManifestUserPrompt(shards),
          ManifestSchema,
          'manifest_result'
        )
      );
      const parsed = JSON.parse(result.text);
      const validTypes = ['codebase', 'document', 'dataset', 'mixed'] as const;
      const type = validTypes.includes(parsed.type)
        ? (parsed.type as typeof validTypes[number])
        : 'mixed';

      return {
        manifest: {
          title: parsed.title || fallbackManifest.title,
          type,
          description: parsed.description || fallbackManifest.description,
          suggestedFilename:
            parsed.suggestedFilename?.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
            || fallbackManifest.suggestedFilename,
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
      const response = await fetch(`${CEREBRAS_API_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async validateModel(apiKey: string, model: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${CEREBRAS_API_BASE}/models/${encodeURIComponent(resolveModel(model))}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
