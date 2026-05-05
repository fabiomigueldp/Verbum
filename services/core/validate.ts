// ============================================================================
// CORE VALIDATE
// JSON validation and retry helpers.
// DeepSeek requires client-side validation because json_object is not strict.
// ============================================================================

import { JsonSchema } from './schemas';

export class ValidationError extends Error {
  constructor(message: string, public readonly raw: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Parse JSON text, stripping markdown code fences if present.
 */
export const safeJsonParse = (text: string): unknown => {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) throw new ValidationError('Empty JSON response', text);

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new ValidationError(`Invalid JSON: ${(e as Error).message}`, text);
  }
};

/**
 * Validate that parsed JSON has all required fields from schema.
 * This is a lightweight check — not full JSON Schema validation.
 */
export const validateSchemaFields = (parsed: unknown, schema: JsonSchema): void => {
  if (!parsed || typeof parsed !== 'object') {
    throw new ValidationError('Response is not a JSON object', parsed);
  }

  const obj = parsed as Record<string, unknown>;

  for (const key of schema.required) {
    if (!(key in obj)) {
      throw new ValidationError(`Missing required field: "${key}"`, parsed);
    }
  }

  // Type-check string fields
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.type === 'string' && key in obj && typeof obj[key] !== 'string') {
      throw new ValidationError(`Field "${key}" must be a string`, parsed);
    }
    if (prop.type === 'array' && key in obj && !Array.isArray(obj[key])) {
      throw new ValidationError(`Field "${key}" must be an array`, parsed);
    }
  }
};

/**
 * Full pipeline: parse + validate.
 * Throws ValidationError if anything fails.
 */
export const parseAndValidate = (text: string, schema: JsonSchema): unknown => {
  const parsed = safeJsonParse(text);
  validateSchemaFields(parsed, schema);
  return parsed;
};

/**
 * Retry wrapper for async operations.
 * DeepSeek may return invalid JSON occasionally.
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> => {
  const { maxRetries = 1, delayMs = 500, shouldRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const shouldTryAgain = shouldRetry ? shouldRetry(error) : true;

      if (isLastAttempt || !shouldTryAgain) {
        throw error;
      }

      await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
    }
  }

  throw new Error('Unreachable');
};

/**
 * Default retry condition for DeepSeek JSON failures.
 */
export const isJsonValidationError = (error: unknown): boolean =>
  error instanceof ValidationError;
