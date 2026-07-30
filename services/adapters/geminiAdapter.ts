import { GoogleGenAI } from '@google/genai';
import { LanguageConfig, ContextMessage, AiRuntimeConfig, IndexerResponse, ManifestResponse, ShardSummary } from '../../types';
import { ProviderAdapter } from './baseAdapter';
import { TranslationSchema, RefinementSchema, IndexerSchema, ManifestSchema, JsonSchema } from '../core/schemas';
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
import { normalizeGeminiInteractionResponse, toNormalizedResponse, NormalizedResponse } from '../core/normalize';
import { getReasoningConfig } from '../core/reasoning';

// ============================================================================
// GEMINI ADAPTER
// Native SDK using the stateless Interactions API with JSON Schema output.
// ============================================================================

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

const resolveApiKey = (apiKey?: string): string => {
  const key = apiKey?.trim();
  if (!key) throw new Error('Missing API key for Google Gemini.');
  return key;
};

const resolveModel = (model?: string): string => model || DEFAULT_MODEL;

const generateFallbackTitle = (text: string): string => {
  const cleaned = text.trim().replace(/\n/g, ' ').slice(0, 30);
  return cleaned.length === 30 ? `${cleaned}...` : cleaned;
};

const generate = async (
  apiKey: string,
  model: string,
  systemInstruction: string,
  userContent: string,
  schema: JsonSchema
): Promise<NormalizedResponse> => {
  const client = new GoogleGenAI({ apiKey });

  const response = await client.interactions.create({
    model,
    input: userContent,
    system_instruction: systemInstruction,
    store: false,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema,
    },
    ...getReasoningConfig('gemini', model),
  });

  const raw = normalizeGeminiInteractionResponse(response);
  return toNormalizedResponse(raw, response);
};

export class GeminiAdapter implements ProviderAdapter {
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

    const userContent = buildSafetyEnvelope(text);

    return generate(
      resolveApiKey(config?.apiKey),
      resolveModel(config?.model),
      systemInstruction,
      userContent,
      TranslationSchema
    );
  }

  async refineText(
    text: string,
    instruction: string,
    config?: AiRuntimeConfig
  ): Promise<NormalizedResponse> {
    return generate(
      resolveApiKey(config?.apiKey),
      resolveModel(config?.model),
      buildRefinementSystemInstruction(config?.naturalProse),
      buildRefinementUserPrompt(text, instruction),
      RefinementSchema
    );
  }

  async indexText(
    text: string,
    existingDomains?: string[],
    config?: AiRuntimeConfig
  ): Promise<IndexerResponse> {
    const result = await generate(
      resolveApiKey(config?.apiKey),
      resolveModel(config?.model),
      buildIndexerInstruction(existingDomains),
      buildIndexerUserPrompt(text),
      IndexerSchema
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

    try {
      const result = await generate(
        resolveApiKey(config?.apiKey),
        resolveModel(config?.model),
        MANIFEST_SYSTEM_INSTRUCTION,
        buildManifestUserPrompt(shards),
        ManifestSchema
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
    return this.validateModel(apiKey, DEFAULT_MODEL);
  }

  async validateModel(apiKey: string, model: string): Promise<boolean> {
    try {
      const client = new GoogleGenAI({ apiKey });
      const resolvedModel = resolveModel(model);
      await client.interactions.create({
        model: resolvedModel,
        input: 'Reply with OK.',
        store: false,
        response_format: {
          type: 'text',
          mime_type: 'text/plain',
        },
        ...getReasoningConfig('gemini', resolvedModel),
      });
      return true;
    } catch {
      return false;
    }
  }
}
