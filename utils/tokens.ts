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
