import { XAI_MODEL_ID } from '../types';

const DEFAULT_MODEL_ID = 'gemini-2.5-flash';

// Pricing per 1M tokens (USD) for standard text usage
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-2.5-flash-lite-preview-09-2025': { input: 0.10, output: 0.40 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  [XAI_MODEL_ID]: { input: 0.20, output: 0.50 },
};

// Nanodollars per token (exact integer), derived from USD per 1M tokens
const MODEL_PRICING_NANO: Record<string, { input: bigint; output: bigint }> = {
  'gemini-2.5-pro': { input: 1250n, output: 10000n },
  'gemini-2.5-flash': { input: 300n, output: 2500n },
  'gemini-2.5-flash-lite': { input: 100n, output: 400n },
  'gemini-2.5-flash-lite-preview-09-2025': { input: 100n, output: 400n },
  'gemini-2.0-flash-lite': { input: 75n, output: 300n },
  'gemini-3-flash-preview': { input: 500n, output: 3000n },
  [XAI_MODEL_ID]: { input: 200n, output: 500n },
};

const PRO_HIGH_PRICING_NANO = { input: 2500n, output: 15000n };

const resolveModelId = (modelId: string): string => {
  return MODEL_PRICING_NANO[modelId] ? modelId : DEFAULT_MODEL_ID;
};

const resolvePricingNano = (modelId: string, inputTokens: number) => {
  const resolved = resolveModelId(modelId);
  if (resolved === 'gemini-2.5-pro' && inputTokens > 200_000) {
    return PRO_HIGH_PRICING_NANO;
  }
  return MODEL_PRICING_NANO[resolved];
};

export const calculateCostNano = (modelId: string, inputTokens: number, outputTokens: number): bigint => {
  const pricing = resolvePricingNano(modelId, inputTokens);
  const inputCost = BigInt(inputTokens) * pricing.input;
  const outputCost = BigInt(outputTokens) * pricing.output;
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

export const getPricingTable = () => MODEL_PRICING;
