import { getModelPricing, getProvider, getAllProviders } from '../services/providers';

const DEFAULT_MODEL_ID = 'gemini-2.5-flash-lite';

/**
 * Resolve pricing for a model from the provider registry.
 * Falls back to default model if not found.
 */
const resolvePricing = (modelId: string) => {
  // Find pricing across all providers
  const providers = ['gemini', 'xai', 'openai', 'deepseek'];
  for (const providerId of providers) {
    const pricing = getModelPricing(providerId, modelId);
    if (pricing) return pricing;
  }
  // Fallback to default
  for (const providerId of providers) {
    const pricing = getModelPricing(providerId, DEFAULT_MODEL_ID);
    if (pricing) return pricing;
  }
  // Ultimate fallback
  return { inputPer1M: 0.10, outputPer1M: 0.40 };
};

/**
 * Calculate cost in nanodollars (1 USD = 1,000,000,000 nanodollars).
 * Uses exact integer arithmetic to avoid floating-point drift.
 */
export const calculateCostNano = (modelId: string, inputTokens: number, outputTokens: number): bigint => {
  const pricing = resolvePricing(modelId);

  // Convert USD per 1M tokens to nanodollars per token
  // inputPer1M USD / 1M tokens = inputPer1M * 1_000_000_000 / 1_000_000 = inputPer1M * 1000 nanodollars per token
  const inputNanoPerToken = BigInt(Math.round(pricing.inputPer1M * 1000));
  const outputNanoPerToken = BigInt(Math.round(pricing.outputPer1M * 1000));

  const inputCost = BigInt(inputTokens) * inputNanoPerToken;
  const outputCost = BigInt(outputTokens) * outputNanoPerToken;

  return inputCost + outputCost;
};

export const calculateCost = (modelId: string, inputTokens: number, outputTokens: number): number => {
  const nano = calculateCostNano(modelId, inputTokens, outputTokens);
  return Number(nano) / 1_000_000_000;
};

export const formatNanoDollars = (nano: bigint, decimals = 9, locale = 'en-US'): string => {
  const negative = nano < 0n;
  const abs = negative ? -nano : nano;
  const base = 10n ** BigInt(decimals);
  const integerPart = abs / base;
  const fractionPart = abs % base;

  let integerStr: string;
  if (integerPart <= BigInt(Number.MAX_SAFE_INTEGER)) {
    integerStr = Number(integerPart).toLocaleString(locale);
  } else {
    integerStr = integerPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const fractionStr = fractionPart.toString().padStart(decimals, '0');
  return `${negative ? '-' : ''}${integerStr}.${fractionStr}`;
};

export const getPricingTable = () => {
  const table: Record<string, { input: number; output: number }> = {};
  const allProviders = getAllProviders();
  for (const provider of allProviders) {
    for (const model of provider.models) {
      table[model.id] = { input: model.pricing.inputPer1M, output: model.pricing.outputPer1M };
    }
  }
  return table;
};
