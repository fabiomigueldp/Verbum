// ============================================================================
// GLOSSARY CORE
// Personal terminology control for consistent translations across providers.
// Full glossary injection to the LLM + post-translation compliance validation.
// ============================================================================

import { Glossary, GlossaryEntry, GlossaryCompliance, LanguageCode, SUPPORTED_LANGUAGES } from '../../types';

const STORAGE_KEY = 'verbum_glossary_v1';
const MAX_ENTRIES = 500;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export const loadGlossary = (): Glossary => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [], version: 1 };
    const parsed = JSON.parse(raw) as Glossary;
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [], version: 1 };
    return { entries: parsed.entries.slice(0, MAX_ENTRIES), version: parsed.version || 1 };
  } catch {
    return { entries: [], version: 1 };
  }
};

export const saveGlossary = (glossary: Glossary): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(glossary));
  } catch (e) {
    console.warn('Glossary: failed to persist', e);
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getLanguageName = (code: string): string => {
  const lang = SUPPORTED_LANGUAGES.find((l: typeof SUPPORTED_LANGUAGES[0]) => l.code === code);
  return lang?.name || code.toUpperCase();
};

/**
 * Normalize a language pair to ordered form (alphabetical) for consistent lookup.
 */
const normalizePair = (
  a: Exclude<LanguageCode, 'unknown'>,
  b: Exclude<LanguageCode, 'unknown'>
): [Exclude<LanguageCode, 'unknown'>, Exclude<LanguageCode, 'unknown'>] => {
  return a < b ? [a, b] : [b, a];
};

/**
 * Check if an entry covers a given language pair (bidirectional).
 */
const entryCoversPair = (
  entry: GlossaryEntry,
  langA: Exclude<LanguageCode, 'unknown'>,
  langB: Exclude<LanguageCode, 'unknown'>
): boolean => {
  const [a, b] = normalizePair(langA, langB);
  return entry.pair[0] === a && entry.pair[1] === b;
};

/**
 * Resolve all glossary entries applicable to a language pair.
 */
export const resolveEntriesForPair = (
  glossary: Glossary,
  langA: Exclude<LanguageCode, 'unknown'>,
  langB: Exclude<LanguageCode, 'unknown'>
): GlossaryEntry[] => {
  return glossary.entries.filter((e: GlossaryEntry) => entryCoversPair(e, langA, langB));
};

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

export const buildGlossaryInstruction = (entries: GlossaryEntry[]): string => {
  if (entries.length === 0) return '';

  const langA = entries[0].pair[0];
  const langB = entries[0].pair[1];
  const nameA = getLanguageName(langA);
  const nameB = getLanguageName(langB);

  const lines: string[] = [
    '',
    '--- MANDATORY TERMINOLOGY ---',
    'You MUST apply the following term mappings when translating.',
    'These override all default corpus knowledge.',
    '',
    `${nameA} \u2194 ${nameB}:`,
  ];

  for (const entry of entries) {
    const noteStr = entry.note ? `  [${entry.note}]` : '';
    lines.push(`  "${entry.termA}" \u2194 "${entry.termB}"${noteStr}`);
  }

  lines.push(
    '',
    'Apply these mappings to the source term AND its semantic equivalents,',
    'morphological variants, and closely related phrases.',
    'Do not paraphrase or substitute outside these mappings.',
    '--- END TERMINOLOGY ---',
    ''
  );

  return lines.join('\n');
};

// ---------------------------------------------------------------------------
// Compliance Validation (post-translation)
// ---------------------------------------------------------------------------

export const validateGlossaryCompliance = (
  inputText: string,
  outputText: string,
  detectedSourceLang: LanguageCode,
  entries: GlossaryEntry[]
): GlossaryCompliance => {
  const inputLower = inputText.toLowerCase();
  const outputLower = outputText.toLowerCase();

  let applicable = 0;
  let matched = 0;
  let suspectedViolations = 0;

  for (const entry of entries) {
    // Determine which term is source and which is target based on detected direction
    const isForward = entry.pair[0] === detectedSourceLang;
    const sourceTerm = isForward ? entry.termA : entry.termB;
    const targetTerm = isForward ? entry.termB : entry.termA;

    if (!sourceTerm || !targetTerm) continue;

    const sourceLower = sourceTerm.toLowerCase();
    const targetLower = targetTerm.toLowerCase();

    // Source term (or root) present in input?
    const sourceRoot = sourceLower.slice(0, Math.max(3, sourceLower.length - 2));
    const sourcePresent = inputLower.includes(sourceLower) || inputLower.includes(sourceRoot);

    if (!sourcePresent) continue;
    applicable++;

    // Target term present in output?
    const targetPresent = outputLower.includes(targetLower);

    if (targetPresent) {
      matched++;
    } else {
      suspectedViolations++;
    }
  }

  return {
    totalEntries: entries.length,
    applicable,
    matched,
    suspectedViolations,
  };
};
