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
import { getFirstModelId, getProvider, isValidModelForProvider } from './providers';
import { parseAndValidate } from './core/validate';
import { TranslationSchema, RefinementSchema } from './core/schemas';
import { logRequest, classifyErrorForTelemetry, preview } from './core/telemetry';
import { calculateCostNano } from '../utils/pricing';
import { NormalizedResponse } from './core/normalize';

export type Provider = string;

const resolveRuntime = (config?: AiRuntimeConfig) => {
  const providerId = config?.provider || 'gemini';
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  const requestedModel = config?.model || '';
  const model = requestedModel && isValidModelForProvider(providerId, requestedModel)
    ? requestedModel
    : getFirstModelId(providerId);
  return {
    providerId,
    model,
    adapter: provider.adapter(),
    config: {
      ...config,
      provider: providerId,
      model,
    },
  };
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
  result?: { usage?: UsageMetadata; text?: string; actualCostNano?: string },
  error?: unknown,
  id?: string
) => {
  const durationMs = performance.now() - startTime;
  const usage = result?.usage;
  const inputTokens = usage?.promptTokens ?? 0;
  const cachedInputTokens = usage?.cachedPromptTokens ?? 0;
  const outputTokens = usage?.candidatesTokens ?? 0;
  const reasoningTokens = usage?.reasoningTokens ?? 0;
  const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens + reasoningTokens;
  const estimatedCostNano = calculateCostNano(
    model,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    totalTokens
  );

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
      inputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      estimatedCostNano: usage ? estimatedCostNano.toString() : '0',
      actualCostNano: result?.actualCostNano,
      costSource: result?.actualCostNano ? 'provider_actual' : 'estimated',
      inputLength: inputText.length,
      inputPreview: preview(inputText),
    });
    return;
  }

  const hasPreview = operation === 'translate' || operation === 'refine';

  logRequest({
    id,
    provider,
    model,
    operation,
    durationMs: Math.round(durationMs * 100) / 100,
    status: 'success',
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    estimatedCostNano: estimatedCostNano.toString(),
    actualCostNano: result?.actualCostNano,
    costSource: result?.actualCostNano ? 'provider_actual' : 'estimated',
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
  const runtime = resolveRuntime(config);
  const { adapter, providerId: provider, model } = runtime;
  const start = performance.now();
  let result: NormalizedResponse | undefined;

  try {
    result = await adapter.translateText(
      text,
      langConfig,
      refinementInstruction,
      contextHistory,
      runtime.config
    );

    const parsed = parseAndValidate(result.text, TranslationSchema) as {
      translation: string;
      detectedSourceLanguage: string;
      targetLanguageUsed: string;
    };

    createLogEntry(provider, model, 'translate', text, start, result, undefined, config?.telemetryId);

    return {
      translation: parsed.translation,
      detectedSourceLanguage: (parsed.detectedSourceLanguage || 'unknown') as LanguageCode,
      targetLanguageUsed: (parsed.targetLanguageUsed || langConfig.target) as Exclude<LanguageCode, 'unknown'>,
      usageMetadata: result.usage,
      actualCostNano: result.actualCostNano,
    };
  } catch (error) {
    createLogEntry(provider, model, 'translate', text, start, result, error, config?.telemetryId);
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
  const runtime = resolveRuntime(config);
  const { adapter, providerId: provider, model } = runtime;
  const start = performance.now();
  let result: NormalizedResponse | undefined;

  try {
    result = await adapter.refineText(text, instruction, runtime.config);

    const parsed = parseAndValidate(result.text, RefinementSchema) as {
      refined: string;
      changes: string;
      detectedLanguage?: string;
    };

    createLogEntry(provider, model, 'refine', text, start, result, undefined, config?.telemetryId);

    return {
      refined: parsed.refined,
      changes: parsed.changes,
      detectedLanguage: (parsed.detectedLanguage || 'unknown') as LanguageCode,
      usageMetadata: result.usage,
      actualCostNano: result.actualCostNano,
    };
  } catch (error) {
    createLogEntry(provider, model, 'refine', text, start, result, error, config?.telemetryId);
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
  const resolvedModel = model && isValidModelForProvider(provider, model) ? model : getFirstModelId(provider);
  const start = performance.now();

  try {
    const result = await adapter.indexText(text, existingDomains, { provider, apiKey, model: resolvedModel });

    // IndexerResponse doesn't have 'text', construct a pseudo-result for logging
    createLogEntry(
      provider,
      resolvedModel,
      'index',
      text,
      start,
      { usage: result.usageMetadata, text: JSON.stringify(result.metadata), actualCostNano: result.actualCostNano },
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
  const resolvedModel = model && isValidModelForProvider(provider, model) ? model : getFirstModelId(provider);
  const inputText = `Manifest for ${shards.length} shards`;
  const start = performance.now();

  try {
    const result = await adapter.generateManifest(shards, { provider, apiKey, model: resolvedModel });

    createLogEntry(
      provider,
      resolvedModel,
      'manifest',
      inputText,
      start,
      { usage: result.usageMetadata, text: JSON.stringify(result.manifest), actualCostNano: result.actualCostNano },
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

export const validateProviderModel = async (
  provider: Provider,
  apiKey: string,
  model: string
): Promise<boolean> => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const adapter = p.adapter();
  return adapter.validateModel(apiKey, model);
};
