// ============================================================================
// CORE SCHEMAS
// Universal JSON Schema definitions (RFC Draft 7 subset)
// Each provider adapter converts these to its native format.
// ============================================================================

export interface JsonSchemaProperty {
  type: string;
  description?: string;
  items?: JsonSchemaProperty;
}

export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  additionalProperties: boolean;
}

export const TranslationSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    translation: {
      type: 'string',
      description: 'The translated text.',
    },
    detectedSourceLanguage: {
      type: 'string',
      description: 'The ISO language code of the input text (lowercase: pt, en, es, fr, de, it, ja, zh, ru, ko, hi, ar, he, el, la, or unknown).',
    },
    targetLanguageUsed: {
      type: 'string',
      description: 'The ISO language code of the language translated INTO (lowercase).',
    },
  },
  required: ['translation', 'detectedSourceLanguage', 'targetLanguageUsed'],
};

export const RefinementSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    refined: {
      type: 'string',
      description: 'The refined text version.',
    },
    changes: {
      type: 'string',
      description: 'A very brief, 3-4 word summary of what changed (e.g. "Corrected grammar", "Made more formal").',
    },
    detectedLanguage: {
      type: 'string',
      description: 'ISO language code of the refined text (any supported language code, or unknown).',
    },
  },
  required: ['refined', 'changes', 'detectedLanguage'],
};

export const IndexerSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      description: 'Short, punchy English title (max 6 words). Authoritative and descriptive.',
    },
    domain: {
      type: 'string',
      description: 'General category of the content. MUST be Title Case.',
    },
    abstract: {
      type: 'string',
      description: '10-word maximum summary of the core concept.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of exactly 3 lowercase keywords relevant to the content.',
    },
  },
  required: ['title', 'domain', 'abstract', 'tags'],
};

export const ManifestSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      description: 'Descriptive, professional title for this collection.',
    },
    type: {
      type: 'string',
      description: 'One of: codebase, document, dataset, mixed.',
    },
    description: {
      type: 'string',
      description: 'A single sentence (max 20 words) describing what this collection represents.',
    },
    suggestedFilename: {
      type: 'string',
      description: 'A kebab-case filename without extension (e.g., "react-auth-context").',
    },
  },
  required: ['title', 'type', 'description', 'suggestedFilename'],
};

/**
 * Convert universal schema to OpenAI-compatible JSON Schema format.
 * Used by xAI, OpenAI, and DeepSeek adapters.
 */
export const toOpenAIJsonSchema = (schema: JsonSchema, name: string): Record<string, unknown> => ({
  name,
  strict: true,
  schema: {
    type: schema.type,
    properties: schema.properties,
    required: schema.required,
    additionalProperties: schema.additionalProperties,
  },
});
