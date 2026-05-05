import {
  getDefaultProviderId,
  getFirstModelId,
  isValidModelForProvider,
  isValidProvider,
} from '../providers';

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
    const raw = localStorage.getItem(key);
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

  const oldGemini = localStorage.getItem('verbum_api_key_gemini');
  const oldXai = localStorage.getItem('verbum_api_key_xai');
  const oldLegacy = localStorage.getItem('verbum_api_key');
  if (oldGemini && !apiKeys.gemini) apiKeys.gemini = oldGemini;
  if (oldXai && !apiKeys.xai) apiKeys.xai = oldXai;
  if (oldLegacy && !apiKeys.gemini) apiKeys.gemini = oldLegacy;

  const savedProvider = localStorage.getItem(PROVIDER_KEY);
  const provider = savedProvider && isValidProvider(savedProvider)
    ? savedProvider
    : getDefaultProviderId();

  const modelByProvider = readJsonObject(MODEL_BY_PROVIDER_KEY);
  const legacyModel = localStorage.getItem(MODEL_KEY);
  if (legacyModel && isValidModelForProvider(provider, legacyModel)) {
    modelByProvider[provider] = legacyModel;
  }

  const activeModel = isValidModelForProvider(provider, modelByProvider[provider] || '')
    ? modelByProvider[provider]
    : getFirstModelId(provider);
  modelByProvider[provider] = activeModel;

  try {
    localStorage.setItem(API_KEYS_KEY, JSON.stringify(apiKeys));
    localStorage.setItem(PROVIDER_KEY, provider);
    localStorage.setItem(MODEL_BY_PROVIDER_KEY, JSON.stringify(modelByProvider));
    localStorage.setItem(MODEL_KEY, activeModel);
    localStorage.setItem(SETTINGS_VERSION_KEY, '2');
  } catch {
    // Storage may be full or unavailable; return migrated in-memory state anyway.
  }

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
  try {
    localStorage.setItem(MODEL_BY_PROVIDER_KEY, JSON.stringify(next));
    localStorage.setItem(MODEL_KEY, model);
  } catch {
    // ignore
  }
  return next;
};

