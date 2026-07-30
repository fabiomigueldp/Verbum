import { LanguageConfig, ContextMessage, AiRuntimeConfig, IndexerResponse, ManifestResponse, ShardSummary } from '../../types';
import { ProviderAdapter } from './baseAdapter';
import { TranslationSchema, RefinementSchema, IndexerSchema, ManifestSchema } from '../core/schemas';
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
import { normalizeDeepSeekResponse, toNormalizedResponse, NormalizedResponse } from '../core/normalize';
import { parseAndValidate, withRetry, isJsonValidationError } from '../core/validate';
import { getReasoningConfig } from '../core/reasoning';

// ============================================================================
// DEEPSEEK ADAPTER
// OpenAI-compatible REST BUT with json_object (not json_schema strict).
// Requires client-side validation + retry for JSON reliability.
// ============================================================================

const DEEPSEEK_API_BASE = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-flash';

const resolveApiKey = (apiKey?: string): string => {
  const key = apiKey?.trim();
  if (!key) throw new Error('Missing API key for DeepSeek.');
  return key;
};

const resolveModel = (model?: string): string => model || DEFAULT_MODEL;

const generateFallbackTitle = (text: string): string => {
  const cleaned = text.trim().replace(/\n/g, ' ').slice(0, 30);
  return cleaned.length === 30 ? `${cleaned}...` : cleaned;
};

interface DeepSeekPayload {
  model: string;
  temperature: number;
  max_tokens: number;
  response_format: { type: 'json_object' };
  messages: Array<{ role: string; content: string }>;
  thinking?: {
    type: 'disabled';
  };
}

const buildSchemaExample = (targetLanguage: string): string => {
  const example = {
    translation: 'Translated text here',
    detectedSourceLanguage: 'en',
    targetLanguageUsed: targetLanguage,
  };
  return JSON.stringify(example);
};

const callDeepSeek = async (
  apiKey: string,
  payload: DeepSeekPayload
): Promise<NormalizedResponse> => {
  const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const raw = normalizeDeepSeekResponse(data);
  return toNormalizedResponse(raw, data);
};

export class DeepSeekAdapter implements ProviderAdapter {
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

    systemInstruction += `\n\nOUTPUT FORMAT EXAMPLE (you must return valid JSON matching this exact shape):\n${buildSchemaExample(langConfig.target)}`;

    const model = resolveModel(config?.model);
    const payload: DeepSeekPayload = {
      model,
      temperature: 0,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      ...getReasoningConfig('deepseek', model),
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: buildSafetyEnvelope(text) },
      ],
    };

    return withRetry(
      async () => {
        const result = await callDeepSeek(resolveApiKey(config?.apiKey), payload);
        parseAndValidate(result.text, TranslationSchema);
        return result;
      },
      {
        maxRetries: 1,
        shouldRetry: isJsonValidationError,
      }
    );
  }

  async refineText(
    text: string,
    instruction: string,
    config?: AiRuntimeConfig
  ): Promise<NormalizedResponse> {
    const schemaExample = JSON.stringify({
      refined: 'Refined text here',
      changes: 'Made more formal',
      detectedLanguage: 'en',
    });

    const systemInstruction = `${buildRefinementSystemInstruction(config?.naturalProse)}\n\nOUTPUT FORMAT EXAMPLE:\n${schemaExample}`;

    const model = resolveModel(config?.model);
    const payload: DeepSeekPayload = {
      model,
      temperature: 0,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      ...getReasoningConfig('deepseek', model),
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: buildRefinementUserPrompt(text, instruction) },
      ],
    };

    return withRetry(
      async () => {
        const result = await callDeepSeek(resolveApiKey(config?.apiKey), payload);
        parseAndValidate(result.text, RefinementSchema);
        return result;
      },
      {
        maxRetries: 1,
        shouldRetry: isJsonValidationError,
      }
    );
  }

  async indexText(
    text: string,
    existingDomains?: string[],
    config?: AiRuntimeConfig
  ): Promise<IndexerResponse> {
    const schemaExample = JSON.stringify({
      title: 'Short Punchy Title',
      domain: 'General Category',
      abstract: 'Ten word max summary.',
      tags: ['keyword1', 'keyword2', 'keyword3'],
    });

    const systemInstruction = `${buildIndexerInstruction(existingDomains)}\n\nOUTPUT FORMAT EXAMPLE:\n${schemaExample}`;

    const model = resolveModel(config?.model);
    const payload: DeepSeekPayload = {
      model,
      temperature: 0,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      ...getReasoningConfig('deepseek', model),
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: buildIndexerUserPrompt(text) },
      ],
    };

    const result = await withRetry(
      async () => {
        const res = await callDeepSeek(resolveApiKey(config?.apiKey), payload);
        parseAndValidate(res.text, IndexerSchema);
        return res;
      },
      {
        maxRetries: 1,
        shouldRetry: isJsonValidationError,
      }
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
      actualCostNano: result.actualCostNano,
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

    const schemaExample = JSON.stringify({
      title: 'Collection Title',
      type: 'mixed',
      description: 'Single sentence description.',
      suggestedFilename: 'collection-filename',
    });

    const systemInstruction = `${MANIFEST_SYSTEM_INSTRUCTION}\n\nOUTPUT FORMAT EXAMPLE:\n${schemaExample}`;

    try {
      const model = resolveModel(config?.model);
      const payload: DeepSeekPayload = {
        model,
        temperature: 0,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        ...getReasoningConfig('deepseek', model),
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: buildManifestUserPrompt(shards) },
        ],
      };

      const result = await withRetry(
        async () => {
          const res = await callDeepSeek(resolveApiKey(config?.apiKey), payload);
          parseAndValidate(res.text, ManifestSchema);
          return res;
        },
        {
          maxRetries: 1,
          shouldRetry: isJsonValidationError,
        }
      );

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
        actualCostNano: result.actualCostNano,
      };
    } catch (error) {
      console.error('Manifest generation error:', error);
      return { manifest: fallbackManifest };
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${DEEPSEEK_API_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async validateModel(apiKey: string, model: string): Promise<boolean> {
    try {
      const response = await fetch(`${DEEPSEEK_API_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) return false;
      const data = await response.json();
      const models = Array.isArray(data?.data) ? data.data : [];
      if (models.length === 0) return true;
      return models.some((entry: any) => entry?.id === resolveModel(model));
    } catch {
      return false;
    }
  }
}
