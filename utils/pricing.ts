import { getModelPricing, getAllProviders } from '../services/providers';

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

const parseDecimal = (value: number): { numerator: bigint; scale: bigint } => {
  const str = value.toString();
  if (!str.includes('.')) {
    return { numerator: BigInt(str), scale: 1n };
  }

  const [integer, fraction] = str.split('.');
  const digits = `${integer}${fraction}`;
  return {
    numerator: BigInt(digits),
    scale: 10n ** BigInt(fraction.length),
  };
};

const calculateTokenCostNano = (tokens: number, usdPer1M: number): bigint => {
  if (tokens <= 0 || usdPer1M <= 0) return 0n;
  const { numerator, scale } = parseDecimal(usdPer1M);
  const denominator = scale;
  const raw = BigInt(tokens) * numerator * 1000n;
  return (raw + denominator / 2n) / denominator;
};

export interface CostInput {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  totalTokens?: number;
}

export interface CostBreakdown {
  inputNano: bigint;
  cachedInputNano: bigint;
  outputNano: bigint;
  estimatedNano: bigint;
}

/**
 * Calculate cost in nanodollars (1 USD = 1,000,000,000 nanodollars).
 * Uses exact integer arithmetic to avoid floating-point drift.
 */
export const calculateCostBreakdown = (modelId: string, input: CostInput): CostBreakdown => {
  const pricing = resolvePricing(modelId);
  const totalTokens = input.totalTokens ?? input.inputTokens + input.outputTokens;
  const useLongContext = Boolean(
    pricing.contextWindowThreshold &&
    totalTokens > pricing.contextWindowThreshold
  );

  const inputRate = useLongContext && pricing.longContextInputPer1M !== undefined
    ? pricing.longContextInputPer1M
    : pricing.inputPer1M;
  const cachedInputRate = useLongContext && pricing.longContextCachedInputPer1M !== undefined
    ? pricing.longContextCachedInputPer1M
    : pricing.cachedInputPer1M;
  const outputRate = useLongContext && pricing.longContextOutputPer1M !== undefined
    ? pricing.longContextOutputPer1M
    : pricing.outputPer1M;

  const cachedInputTokens = Math.min(input.cachedInputTokens ?? 0, input.inputTokens);
  const uncachedInputTokens = Math.max(0, input.inputTokens - cachedInputTokens);
  const inputNano = calculateTokenCostNano(uncachedInputTokens, inputRate);
  const cachedInputNano = cachedInputRate === undefined
    ? calculateTokenCostNano(cachedInputTokens, inputRate)
    : calculateTokenCostNano(cachedInputTokens, cachedInputRate);
  const outputNano = calculateTokenCostNano(input.outputTokens, outputRate);

  return {
    inputNano,
    cachedInputNano,
    outputNano,
    estimatedNano: inputNano + cachedInputNano + outputNano,
  };
};

export const calculateCostNano = (
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
  totalTokens?: number
): bigint => {
  return calculateCostBreakdown(modelId, {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    totalTokens,
  }).estimatedNano;
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
