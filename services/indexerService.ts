import { GoogleGenAI, Type } from "@google/genai";
import { UsageMetadata } from "../types";

// ============================================================================
// NEURAL INDEXER SERVICE
// High-speed text classification using Gemini 2.5 Flash Lite
// Extracts structured metadata from raw text fragments
// ============================================================================

export interface ShardMetadata {
  title: string;
  domain: string;
  abstract: string;
  tags: string[];
}

export interface IndexerResponse {
  metadata: ShardMetadata;
  usageMetadata?: UsageMetadata;
}

/**
 * Generate the system instruction for the indexer
 * Dynamically injects existing domains for taxonomic consistency
 */
const buildIndexerSystemInstruction = (existingDomains?: string[]): string => {
  const domainContext = existingDomains && existingDomains.length > 0
    ? `
EXISTING DOMAINS IN COLLECTION:
${existingDomains.map(d => `- "${d}"`).join('\n')}

DOMAIN ASSIGNMENT RULES:
1. PREFER assigning an existing domain from the list above if it fits semantically.
2. Use semantic similarity - "Software Engineering" covers "Code", "Coding", "Programming", "Dev".
3. Only create a NEW domain if the content is strictly unrelated to ALL existing domains.
4. All domains must be in Title Case (e.g., "Software Engineering", not "software engineering").
`
    : `
DOMAIN GUIDELINES:
- Use general, broad categories (e.g., "Software Engineering" not "React Code").
- All domains must be in Title Case (e.g., "Neuroscience", "Market Data").
`;

  return `
You are a precision data indexer. Your task is to analyze text fragments and extract structured metadata.

CRITICAL RULES:
1. You are NOT a chatbot. You are a classification engine.
2. Do NOT summarize the content in detail. Extract LABELS only.
3. All output fields must be in English regardless of input language.
4. Be authoritative and punchy with titles.
${domainContext}
OUTPUT REQUIREMENTS:
- "title": A short, punchy English title (max 6 words). Authoritative and descriptive.
- "domain": A general category. MUST be Title Case.
- "abstract": A 10-word maximum summary of the core concept.
- "tags": An array of exactly 3 lowercase keywords relevant to the content.

FORMAT: Output must be strictly JSON.
`;
};

const resolveApiKey = (apiKey?: string) => {
  return apiKey?.trim() || process.env.GEMINI_API_KEY || process.env.API_KEY;
};

const getClient = (apiKey?: string) => {
  const resolved = resolveApiKey(apiKey);
  if (!resolved) throw new Error("Missing API key for Google Generative AI.");
  return new GoogleGenAI({ apiKey: resolved });
};

/**
 * Generate a fallback title from text (first 30 chars)
 */
const generateFallbackTitle = (text: string): string => {
  const cleaned = text.trim().replace(/\n/g, ' ').slice(0, 30);
  return cleaned.length === 30 ? `${cleaned}...` : cleaned;
};

/**
 * Index a text fragment and extract structured metadata
 * Uses Gemini 2.5 Flash Lite for speed and cost efficiency
 * @param text - The text content to index
 * @param apiKey - Optional API key override
 * @param existingDomains - Optional list of existing domains for taxonomic consistency
 */
export const indexText = async (
  text: string,
  apiKey?: string,
  existingDomains?: string[]
): Promise<IndexerResponse> => {
  try {
    const systemInstruction = buildIndexerSystemInstruction(existingDomains);
    
    const response = await getClient(apiKey).models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `Analyze and classify this text fragment:\n\n"""${text}"""`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Short, punchy English title (max 6 words).",
            },
            domain: {
              type: Type.STRING,
              description: "General category of the content.",
            },
            abstract: {
              type: Type.STRING,
              description: "10-word maximum summary.",
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of exactly 3 lowercase keywords.",
            },
          },
          required: ["title", "domain", "abstract", "tags"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    const parsed = JSON.parse(jsonText);

    // Extract usage metadata from response
    const usageMetadata: UsageMetadata | undefined = response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount ?? 0,
      candidatesTokens: response.usageMetadata.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata.totalTokenCount ?? 0,
    } : undefined;

    return {
      metadata: {
        title: parsed.title || generateFallbackTitle(text),
        domain: parsed.domain || "Uncategorized",
        abstract: parsed.abstract || "Content pending classification.",
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      },
      usageMetadata,
    };
  } catch (error) {
    console.error("Indexer error:", error);
    
    // Fallback response on failure
    return {
      metadata: {
        title: generateFallbackTitle(text),
        domain: "Uncategorized",
        abstract: "Classification failed. Original content preserved.",
        tags: ["unprocessed"],
      },
    };
  }
};

/**
 * Estimate token count for a text string
 * Rough approximation: ~4 characters per token for English
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  // More accurate estimation considering whitespace and punctuation
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  // Hybrid approach: average of word-based and char-based estimates
  return Math.ceil((words * 1.3 + chars / 4) / 2);
};

/**
 * Calculate estimated read time in minutes
 * Average reading speed: 200-250 words per minute
 */
export const estimateReadTime = (tokenCount: number): number => {
  // Tokens roughly correlate to words (1 token ≈ 0.75 words)
  const words = tokenCount * 0.75;
  const minutes = words / 225; // Using 225 WPM average
  return Math.max(1, Math.ceil(minutes));
};

// ============================================================================
// COLLECTION MANIFEST GENERATOR
// Analyzes aggregate shard metadata to determine collection identity
// ============================================================================

export type CollectionType = 'codebase' | 'document' | 'dataset' | 'mixed';

export interface CollectionManifest {
  title: string;
  type: CollectionType;
  description: string;
  suggestedFilename: string;
}

export interface ManifestResponse {
  manifest: CollectionManifest;
  usageMetadata?: UsageMetadata;
}

interface ShardSummary {
  title: string;
  domain: string;
  tags: string[];
  excerpt: string;
}

const MANIFEST_SYSTEM_INSTRUCTION = `
You are a Data Librarian and Collection Analyst. Your task is to analyze a set of metadata items from collected content fragments and determine the collective identity of this collection.

CLASSIFICATION RULES:
1. If items are predominantly code snippets, functions, or technical implementations → type: "codebase"
2. If items are text documents, articles, notes, or prose → type: "document"  
3. If items are structured data, lists, records, or tabular information → type: "dataset"
4. If items span multiple categories with no clear majority → type: "mixed"

OUTPUT REQUIREMENTS:
- "title": A descriptive, professional title for this collection (e.g., "React Authentication Module", "Mediterranean Recipe Collection", "Q3 Sales Analysis")
- "type": One of: "codebase", "document", "dataset", "mixed"
- "description": A single sentence (max 20 words) describing what this collection represents. This will be used as context for downstream AI systems.
- "suggestedFilename": A kebab-case filename without extension (e.g., "react-auth-context", "recipe-collection")

FORMAT: Output must be strictly JSON.
`;

/**
 * Generate a collection manifest by analyzing aggregate shard metadata
 * Uses Gemini 2.5 Flash Lite for speed and cost efficiency
 */
export const generateCollectionManifest = async (
  shards: ShardSummary[],
  apiKey?: string
): Promise<ManifestResponse> => {
  // Fallback manifest for error cases
  const fallbackManifest: CollectionManifest = {
    title: `Verbum Collection [${new Date().toISOString().split('T')[0]}]`,
    type: 'mixed',
    description: 'A curated collection of content fragments.',
    suggestedFilename: `verbum-collection-${Date.now()}`,
  };

  if (shards.length === 0) {
    return { manifest: fallbackManifest };
  }

  try {
    // Build a compact representation for the LLM
    const itemsSummary = shards.map((s, i) => 
      `[${i + 1}] Title: "${s.title}" | Domain: ${s.domain} | Tags: ${s.tags.join(', ')} | Excerpt: "${s.excerpt}"`
    ).join('\n');

    const prompt = `Analyze this collection of ${shards.length} items and determine its collective identity:\n\n${itemsSummary}`;

    const response = await getClient(apiKey).models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: MANIFEST_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Descriptive title for the collection.",
            },
            type: {
              type: Type.STRING,
              description: "Collection type: codebase, document, dataset, or mixed.",
            },
            description: {
              type: Type.STRING,
              description: "Single sentence describing the collection (max 20 words).",
            },
            suggestedFilename: {
              type: Type.STRING,
              description: "Kebab-case filename without extension.",
            },
          },
          required: ["title", "type", "description", "suggestedFilename"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    const parsed = JSON.parse(jsonText);

    // Extract usage metadata
    const usageMetadata: UsageMetadata | undefined = response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount ?? 0,
      candidatesTokens: response.usageMetadata.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata.totalTokenCount ?? 0,
    } : undefined;

    // Validate and sanitize the response
    const validTypes: CollectionType[] = ['codebase', 'document', 'dataset', 'mixed'];
    const type = validTypes.includes(parsed.type) ? parsed.type : 'mixed';

    return {
      manifest: {
        title: parsed.title || fallbackManifest.title,
        type,
        description: parsed.description || fallbackManifest.description,
        suggestedFilename: parsed.suggestedFilename?.replace(/[^a-z0-9-]/gi, '-').toLowerCase() || fallbackManifest.suggestedFilename,
      },
      usageMetadata,
    };
  } catch (error) {
    console.error("Manifest generation error:", error);
    return { manifest: fallbackManifest };
  }
};
