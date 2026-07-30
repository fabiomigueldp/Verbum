// ============================================================================
// CORE ENV
// Browser-safe public build-time configuration.
// Never expose private provider keys through Vite env variables.
// ============================================================================

const PUBLIC_KEY_ENV: Record<string, string[]> = {
  gemini: ['VITE_VERBUM_GEMINI_API_KEY_DEV_ONLY'],
  xai: ['VITE_VERBUM_XAI_API_KEY_DEV_ONLY'],
  openai: ['VITE_VERBUM_OPENAI_API_KEY_DEV_ONLY'],
  cerebras: ['VITE_VERBUM_CEREBRAS_API_KEY_DEV_ONLY'],
  deepseek: ['VITE_VERBUM_DEEPSEEK_API_KEY_DEV_ONLY'],
};

const readImportMetaEnv = (): Record<string, string | undefined> => {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };
  return meta.env || {};
};

export const getPublicBuildTimeApiKey = (providerId: string): string => {
  const env = readImportMetaEnv();
  const names = PUBLIC_KEY_ENV[providerId] || [];
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return '';
};

export const hasPublicBuildTimeApiKey = (providerId: string): boolean =>
  Boolean(getPublicBuildTimeApiKey(providerId));
