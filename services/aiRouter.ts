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
  UsageMetadata,
} from '../types';
import { getProvider } from './providers';
import { parseAndValidate } from './core/validate';
import { TranslationSchema, RefinementSchema } from './core/schemas';
import { logRequest, classifyErrorForTelemetry, preview } from './core/telemetry';
import { calculateCostNano } from '../utils/pricing';

export type Provider = string;

const getAdapter = (config?: AiRuntimeConfig) => {
  const providerId = config?.provider || 'gemini';
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider.adapter();
};

// ---------------------------------------------------------------------------
// TELEMETRY HELPERS
// ---------------------------------------------------------------------------

const createLogEntry = (
  provider: string,
  model: string,
  operation: 'translate' | 'refine' | 'index' | 'manifest',
  inputText: string,
  startTime: number,
  result?: { usage?: UsageMetadata; text?: string; costUsd?: number },
  error?: unknown,
  id?: string
) => {
  const durationMs = performance.now() - startTime;

  if (error) {
    const { type, message } = classifyErrorForTelemetry(error);
    logRequest({
      id,
      provider,
      model,
      operation,
      durationMs: Math.round(durationMs * 100) / 100,
      status: 'error',
      errorType: type,
      errorMessage: message,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostNano: '0',
      inputLength: inputText.length,
      inputPreview: preview(inputText),
    });
    return;
  }

  const usage = result?.usage;
  const inputTokens = usage?.promptTokens ?? 0;
  const outputTokens = usage?.candidatesTokens ?? 0;
  const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens;
  const estimatedCostNano = calculateCostNano(model, inputTokens, outputTokens);
  const actualCostNano = result?.costUsd
    ? BigInt(Math.round(result.costUsd * 1_000_000_000)).toString()
    : undefined;

  const hasPreview = operation === 'translate' || operation === 'refine';

  logRequest({
    id,
    provider,
    model,
    operation,
    durationMs: Math.round(durationMs * 100) / 100,
    status: 'success',
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostNano: estimatedCostNano.toString(),
    actualCostNano,
    inputLength: inputText.length,
    outputLength: result?.text?.length ?? 0,
    inputPreview: hasPreview ? preview(inputText) : '',
    outputPreview: hasPreview && result?.text ? preview(result.text) : undefined,
  });
};

// ---------------------------------------------------------------------------
// TRANSLATE
// ---------------------------------------------------------------------------

export const translateText = async (
  text: string,
  langConfig: LanguageConfig,
  refinementInstruction?: string,
  contextHistory?: ContextMessage[],
  config?: AiRuntimeConfig
): Promise<TranslationResponse> => {
  const adapter = getAdapter(config);
  const provider = config?.provider || 'gemini';
  const model = config?.model || '';
  const start = performance.now();

  try {
    const result = await adapter.translateText(
      text,
      langConfig,
      refinementInstruction,
      contextHistory,
      config || {}
    );

    createLogEntry(provider, model, 'translate', text, start, result, undefined, config?.telemetryId);

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
  } catch (error) {
    createLogEntry(provider, model, 'translate', text, start, undefined, error, config?.telemetryId);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// REFINE
// ---------------------------------------------------------------------------

export const refineText = async (
  text: string,
  instruction: string,
  config?: AiRuntimeConfig
): Promise<RefinementResponse> => {
  const adapter = getAdapter(config);
  const provider = config?.provider || 'gemini';
  const model = config?.model || '';
  const start = performance.now();

  try {
    const result = await adapter.refineText(text, instruction, config || {});

    createLogEntry(provider, model, 'refine', text, start, result, undefined, config?.telemetryId);

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
  } catch (error) {
    createLogEntry(provider, model, 'refine', text, start, undefined, error, config?.telemetryId);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// INDEX
// ---------------------------------------------------------------------------

export const indexText = async (
  text: string,
  provider: Provider,
  apiKey?: string,
  existingDomains?: string[],
  model?: string,
  telemetryId?: string
): Promise<IndexerResponse> => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const adapter = p.adapter();
  const resolvedModel = model || '';
  const start = performance.now();

  try {
    const result = await adapter.indexText(text, existingDomains, { provider, apiKey, model });

    // IndexerResponse doesn't have 'text', construct a pseudo-result for logging
    createLogEntry(
      provider,
      resolvedModel,
      'index',
      text,
      start,
      { usage: result.usageMetadata, text: JSON.stringify(result.metadata) },
      undefined,
      telemetryId
    );

    return result;
  } catch (error) {
    createLogEntry(provider, resolvedModel, 'index', text, start, undefined, error, telemetryId);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// MANIFEST
// ---------------------------------------------------------------------------

export const generateCollectionManifest = async (
  provider: Provider,
  shards: ShardSummary[],
  apiKey?: string,
  model?: string,
  telemetryId?: string
): Promise<ManifestResponse> => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const adapter = p.adapter();
  const resolvedModel = model || '';
  const inputText = `Manifest for ${shards.length} shards`;
  const start = performance.now();

  try {
    const result = await adapter.generateManifest(shards, { provider, apiKey, model });

    createLogEntry(
      provider,
      resolvedModel,
      'manifest',
      inputText,
      start,
      { usage: result.usageMetadata, text: JSON.stringify(result.manifest) },
      undefined,
      telemetryId
    );

    return result;
  } catch (error) {
    createLogEntry(provider, resolvedModel, 'manifest', inputText, start, undefined, error, telemetryId);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// VALIDATE API KEY
// ---------------------------------------------------------------------------

export const validateApiKey = async (
  provider: Provider,
  apiKey: string
): Promise<boolean> => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const adapter = p.adapter();
  return adapter.validateApiKey(apiKey);
};
