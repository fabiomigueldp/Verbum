import {
  AiRuntimeConfig,
  ContextMessage,
  LanguageConfig,
  TranslationResponse,
  RefinementResponse,
  LanguageCode,
  IndexerResponse,
  ManifestResponse,
  ShardSummary,
} from '../types';
import { getProvider } from './providers';
import { parseAndValidate } from './core/validate';
import { TranslationSchema, RefinementSchema } from './core/schemas';

export type Provider = string;

const getAdapter = (config?: AiRuntimeConfig) => {
  const providerId = config?.provider || 'gemini';
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider.adapter();
};

export const translateText = async (
  text: string,
  langConfig: LanguageConfig,
  refinementInstruction?: string,
  contextHistory?: ContextMessage[],
  config?: AiRuntimeConfig
): Promise<TranslationResponse> => {
  const adapter = getAdapter(config);
  const result = await adapter.translateText(
    text,
    langConfig,
    refinementInstruction,
    contextHistory,
    config || {}
  );

  const parsed = parseAndValidate(result.text, TranslationSchema) as {
    translation: string;
    detectedSourceLanguage: string;
    targetLanguageUsed: string;
  };

  return {
    translation: parsed.translation,
    detectedSourceLanguage: (parsed.detectedSourceLanguage || 'unknown') as LanguageCode,
    targetLanguageUsed: (parsed.targetLanguageUsed || langConfig.target) as Exclude<LanguageCode, 'unknown'>,
    usageMetadata: result.usage,
  };
};

export const refineText = async (
  text: string,
  instruction: string,
  config?: AiRuntimeConfig
): Promise<RefinementResponse> => {
  const adapter = getAdapter(config);
  const result = await adapter.refineText(text, instruction, config || {});

  const parsed = parseAndValidate(result.text, RefinementSchema) as {
    refined: string;
    changes: string;
    detectedLanguage?: string;
  };

  return {
    refined: parsed.refined,
    changes: parsed.changes,
    detectedLanguage: (parsed.detectedLanguage || 'unknown') as LanguageCode,
    usageMetadata: result.usage,
  };
};

export const indexText = async (
  text: string,
  provider: Provider,
  apiKey?: string,
  existingDomains?: string[],
  model?: string
): Promise<IndexerResponse> => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const adapter = p.adapter();
  return adapter.indexText(text, existingDomains, { provider, apiKey, model });
};

export const generateCollectionManifest = async (
  provider: Provider,
  shards: ShardSummary[],
  apiKey?: string,
  model?: string
): Promise<ManifestResponse> => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const adapter = p.adapter();
  return adapter.generateManifest(shards, { provider, apiKey, model });
};

export const validateApiKey = async (
  provider: Provider,
  apiKey: string
): Promise<boolean> => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const adapter = p.adapter();
  return adapter.validateApiKey(apiKey);
};
