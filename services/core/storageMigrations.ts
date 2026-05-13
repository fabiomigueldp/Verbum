import {
  getDefaultProviderId,
  getFirstModelId,
  isValidModelForProvider,
  isValidProvider,
} from '../providers';
import { storageGet, storageSet, storageSetJson } from './storage';

const SETTINGS_VERSION_KEY = 'verbum_settings_schema_version';
const API_KEYS_KEY = 'verbum_api_keys';
const PROVIDER_KEY = 'verbum_provider';
const MODEL_KEY = 'verbum_model';
const MODEL_BY_PROVIDER_KEY = 'verbum_model_by_provider';

export interface MigratedSettings {
  apiKeys: Record<string, string>;
  provider: string;
  modelByProvider: Record<string, string>;
  activeModel: string;
}

const readJsonObject = (key: string): Record<string, string> => {
  try {
    const raw = storageGet(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  } catch {
    return {};
  }
};

export const migrateSettingsStorage = (): MigratedSettings => {
  const apiKeys = readJsonObject(API_KEYS_KEY);

  const oldGemini = storageGet('verbum_api_key_gemini');
  const oldXai = storageGet('verbum_api_key_xai');
  const oldLegacy = storageGet('verbum_api_key');
  if (oldGemini && !apiKeys.gemini) apiKeys.gemini = oldGemini;
  if (oldXai && !apiKeys.xai) apiKeys.xai = oldXai;
  if (oldLegacy && !apiKeys.gemini) apiKeys.gemini = oldLegacy;

  const savedProvider = storageGet(PROVIDER_KEY);
  const provider = savedProvider && isValidProvider(savedProvider)
    ? savedProvider
    : getDefaultProviderId();

  const modelByProvider = readJsonObject(MODEL_BY_PROVIDER_KEY);
  const legacyModel = storageGet(MODEL_KEY);
  if (legacyModel && isValidModelForProvider(provider, legacyModel)) {
    modelByProvider[provider] = legacyModel;
  }

  const activeModel = isValidModelForProvider(provider, modelByProvider[provider] || '')
    ? modelByProvider[provider]
    : getFirstModelId(provider);
  modelByProvider[provider] = activeModel;

  storageSetJson(API_KEYS_KEY, apiKeys);
  storageSet(PROVIDER_KEY, provider);
  storageSetJson(MODEL_BY_PROVIDER_KEY, modelByProvider);
  storageSet(MODEL_KEY, activeModel);
  storageSet(SETTINGS_VERSION_KEY, '2');

  return {
    apiKeys,
    provider,
    modelByProvider,
    activeModel,
  };
};

export const persistModelForProvider = (
  provider: string,
  model: string,
  current: Record<string, string> = readJsonObject(MODEL_BY_PROVIDER_KEY)
): Record<string, string> => {
  const next = { ...current, [provider]: model };
  storageSetJson(MODEL_BY_PROVIDER_KEY, next);
  storageSet(MODEL_KEY, model);
  return next;
};
