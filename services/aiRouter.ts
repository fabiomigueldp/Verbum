import {
  AiRuntimeConfig,
  ContextMessage,
  LanguageConfig,
  TranslationResponse,
  RefinementResponse,
  ProviderOption,
} from "../types";
import { translateText as geminiTranslateText, refineText as geminiRefineText, validateApiKey as geminiValidateApiKey } from "./geminiService";
import { indexText as geminiIndexText, generateCollectionManifest as geminiGenerateCollectionManifest } from "./indexerService";
import * as xaiService from "./xaiService";

export type Provider = ProviderOption;

const resolveProvider = (config?: AiRuntimeConfig): Provider => {
  return (config?.provider || 'gemini') as Provider;
};

export const translateText = async (
  text: string,
  langConfig: LanguageConfig,
  refinementInstruction?: string,
  contextHistory?: ContextMessage[],
  config?: AiRuntimeConfig
): Promise<TranslationResponse> => {
  const provider = resolveProvider(config);
  if (provider === 'xai') {
    return xaiService.translateText(text, langConfig, refinementInstruction, contextHistory, config);
  }
  return geminiTranslateText(text, langConfig, refinementInstruction, contextHistory, config);
};

export const refineText = async (
  text: string,
  instruction: string,
  config?: AiRuntimeConfig
): Promise<RefinementResponse> => {
  const provider = resolveProvider(config);
  if (provider === 'xai') {
    return xaiService.refineText(text, instruction, config);
  }
  return geminiRefineText(text, instruction, config);
};

export const indexText = async (
  text: string,
  provider: Provider,
  apiKey?: string,
  existingDomains?: string[]
) => {
  if (provider === 'xai') {
    return xaiService.indexText(text, apiKey, existingDomains);
  }
  return geminiIndexText(text, apiKey, existingDomains);
};

export const generateCollectionManifest = async (
  provider: Provider,
  shards: { title: string; domain: string; tags: string[]; excerpt: string }[],
  apiKey?: string
) => {
  if (provider === 'xai') {
    return xaiService.generateCollectionManifest(shards, apiKey);
  }
  return geminiGenerateCollectionManifest(shards, apiKey);
};

export const validateApiKey = async (
  provider: Provider,
  apiKey: string
): Promise<boolean> => {
  if (provider === 'xai') {
    return xaiService.validateApiKey(apiKey);
  }
  return geminiValidateApiKey(apiKey);
};
