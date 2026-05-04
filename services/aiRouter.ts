import {
  AiRuntimeConfig,
  ContextMessage,
  LanguageConfig,
  TranslationResponse,
  RefinementResponse,
  ProviderOption,
} from "../types";
import { getProvider } from "./providers";

export type Provider = ProviderOption;

const resolveProvider = (config?: AiRuntimeConfig): Provider => {
  return config?.provider || 'gemini';
};

const getService = (config?: AiRuntimeConfig) => {
  const providerId = resolveProvider(config);
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider.services;
};

export const translateText = async (
  text: string,
  langConfig: LanguageConfig,
  refinementInstruction?: string,
  contextHistory?: ContextMessage[],
  config?: AiRuntimeConfig
): Promise<TranslationResponse> => {
  return getService(config).translateText(text, langConfig, refinementInstruction, contextHistory, config);
};

export const refineText = async (
  text: string,
  instruction: string,
  config?: AiRuntimeConfig
): Promise<RefinementResponse> => {
  return getService(config).refineText(text, instruction, config);
};

export const indexText = async (
  text: string,
  provider: Provider,
  apiKey?: string,
  existingDomains?: string[]
) => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  return p.services.indexText(text, apiKey, existingDomains);
};

export const generateCollectionManifest = async (
  provider: Provider,
  shards: { title: string; domain: string; tags: string[]; excerpt: string }[],
  apiKey?: string
) => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  return p.services.generateCollectionManifest(shards, apiKey);
};

export const validateApiKey = async (
  provider: Provider,
  apiKey: string
): Promise<boolean> => {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  return p.services.validateApiKey(apiKey);
};
