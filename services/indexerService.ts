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

const INDEXER_SYSTEM_INSTRUCTION = `
You are a precision data indexer. Your task is to analyze text fragments and extract structured metadata.

CRITICAL RULES:
1. You are NOT a chatbot. You are a classification engine.
2. Do NOT summarize the content in detail. Extract LABELS only.
3. All output fields must be in English regardless of input language.
4. Be authoritative and punchy with titles.

OUTPUT REQUIREMENTS:
- "title": A short, punchy English title (max 6 words). Authoritative and descriptive.
- "domain": A general category (e.g., "Neuroscience", "Market Data", "Software Engineering", "Philosophy", "Legal", "Medical")
- "abstract": A 10-word maximum summary of the core concept.
- "tags": An array of exactly 3 lowercase keywords relevant to the content.

FORMAT: Output must be strictly JSON.
`;

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
 */
export const indexText = async (
  text: string,
  apiKey?: string
): Promise<IndexerResponse> => {
  try {
    const response = await getClient(apiKey).models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `Analyze and classify this text fragment:\n\n"""${text}"""`,
      config: {
        systemInstruction: INDEXER_SYSTEM_INSTRUCTION,
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
