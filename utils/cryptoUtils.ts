// ============================================================================
// CRYPTO UTILITIES
// Non-blocking cryptographic operations using Web Crypto API
// ============================================================================

/**
 * Compute SHA-256 hash of a string asynchronously
 * Uses Web Crypto API for non-blocking operation on large strings
 * 
 * @param text - The text to hash (will be trimmed)
 * @returns Promise resolving to hex-encoded hash string
 */
export const computeContentHash = async (text: string): Promise<string> => {
  const trimmed = text.trim();
  
  // Encode as UTF-8
  const encoder = new TextEncoder();
  const data = encoder.encode(trimmed);
  
  // Compute SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
};

/**
 * Check if Web Crypto API is available
 */
export const isCryptoAvailable = (): boolean => {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' && 
         typeof crypto.subtle.digest === 'function';
};

/**
 * Fallback hash using simple string hashing (for environments without Web Crypto)
 * NOT cryptographically secure - only for deduplication purposes
 */
export const computeFallbackHash = (text: string): string => {
  const trimmed = text.trim();
  let hash = 0;
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Include length to reduce collisions
  return `fallback-${Math.abs(hash).toString(16)}-${trimmed.length}`;
};

/**
 * Unified hash function that uses Web Crypto when available, falls back otherwise
 */
export const computeHash = async (text: string): Promise<string> => {
  if (isCryptoAvailable()) {
    return computeContentHash(text);
  }
  return computeFallbackHash(text);
};
