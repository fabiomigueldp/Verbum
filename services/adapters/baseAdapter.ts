// ============================================================================
// ADAPTER INTERFACE
// Contract that every provider adapter must implement.
// ============================================================================

import {
  TranslationResponse,
  RefinementResponse,
  LanguageConfig,
  ContextMessage,
  AiRuntimeConfig,
  IndexerResponse,
  ManifestResponse,
  ShardSummary,
} from '../../types';
import { NormalizedResponse } from '../core/normalize';

export interface ProviderAdapter {
  translateText(
    text: string,
    langConfig: LanguageConfig,
    refinementInstruction: string | undefined,
    contextHistory: ContextMessage[] | undefined,
    config: AiRuntimeConfig
  ): Promise<NormalizedResponse>;

  refineText(
    text: string,
    instruction: string,
    config: AiRuntimeConfig
  ): Promise<NormalizedResponse>;

  indexText(
    text: string,
    existingDomains: string[] | undefined,
    config: AiRuntimeConfig
  ): Promise<IndexerResponse>;

  generateManifest(
    shards: ShardSummary[],
    config: AiRuntimeConfig
  ): Promise<ManifestResponse>;

  validateApiKey(apiKey: string): Promise<boolean>;

  validateModel(apiKey: string, model: string): Promise<boolean>;
}
