import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { indexText, estimateTokens, ShardMetadata } from '../services/indexerService';
import { UsageMetadata, UsageSession } from '../types';

// ============================================================================
// COLLECTIO STATE MANAGEMENT
// Persistence layer for the Knowledge Lattice
// ============================================================================

export type ShardStatus = 'pending' | 'indexing' | 'ready' | 'error';

export interface Shard {
  id: string;
  content: string;
  tokenCount: number;
  timestamp: number;
  status: ShardStatus;
  metadata?: ShardMetadata;
  error?: string;
}

interface CollectioState {
  shards: Shard[];
  sessionStats: UsageSession;
}

const STORAGE_KEY = 'verbum_collectio';
const STATS_KEY = 'verbum_collectio_stats';

const DEFAULT_SESSION_STATS: UsageSession = {
  totalInput: 0,
  totalOutput: 0,
  estimatedCost: 0,
  requestCount: 0,
};

// Token pricing per 1M tokens for gemini-2.5-flash-lite
const FLASH_LITE_PRICING = { input: 0.075, output: 0.30 };

const calculateCost = (inputTokens: number, outputTokens: number): number => {
  const inputCost = (inputTokens / 1_000_000) * FLASH_LITE_PRICING.input;
  const outputCost = (outputTokens / 1_000_000) * FLASH_LITE_PRICING.output;
  return inputCost + outputCost;
};

export const useCollectio = (apiKey?: string) => {
  const [shards, setShards] = useState<Shard[]>([]);
  const [sessionStats, setSessionStats] = useState<UsageSession>(DEFAULT_SESSION_STATS);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const savedShards = localStorage.getItem(STORAGE_KEY);
      if (savedShards) {
        const parsed = JSON.parse(savedShards);
        // Re-hydrate any 'indexing' shards as 'pending' (they were interrupted)
        const rehydrated = parsed.map((shard: Shard) => ({
          ...shard,
          status: shard.status === 'indexing' ? 'pending' : shard.status,
        }));
        setShards(rehydrated);
      }
      
      const savedStats = localStorage.getItem(STATS_KEY);
      if (savedStats) {
        setSessionStats(JSON.parse(savedStats));
      }
    } catch (e) {
      console.error('Failed to hydrate Collectio state:', e);
    }
    setIsHydrated(true);
  }, []);

  // Persist shards (debounced)
  useEffect(() => {
    if (!isHydrated) return;
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shards));
    }, 500);
    return () => clearTimeout(timer);
  }, [shards, isHydrated]);

  // Persist stats
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STATS_KEY, JSON.stringify(sessionStats));
  }, [sessionStats, isHydrated]);

  // Update session stats with usage metadata
  const updateStats = useCallback((usageMetadata?: UsageMetadata) => {
    if (!usageMetadata) return;
    
    const cost = calculateCost(usageMetadata.promptTokens, usageMetadata.candidatesTokens);
    
    setSessionStats(prev => ({
      totalInput: prev.totalInput + usageMetadata.promptTokens,
      totalOutput: prev.totalOutput + usageMetadata.candidatesTokens,
      estimatedCost: prev.estimatedCost + cost,
      requestCount: prev.requestCount + 1,
    }));
  }, []);

  // Ingest new content
  const ingest = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const tokenCount = estimateTokens(content);
    const newShard: Shard = {
      id: uuidv4(),
      content: content.trim(),
      tokenCount,
      timestamp: Date.now(),
      status: 'pending',
    };

    // Add to state immediately
    setShards(prev => [newShard, ...prev]);

    // Start indexing
    setShards(prev => 
      prev.map(s => s.id === newShard.id ? { ...s, status: 'indexing' } : s)
    );

    try {
      const result = await indexText(content, apiKey);
      
      setShards(prev => 
        prev.map(s => s.id === newShard.id ? { 
          ...s, 
          status: 'ready',
          metadata: result.metadata,
        } : s)
      );

      updateStats(result.usageMetadata);
    } catch (error) {
      console.error('Indexing failed:', error);
      setShards(prev => 
        prev.map(s => s.id === newShard.id ? { 
          ...s, 
          status: 'error',
          error: error instanceof Error ? error.message : 'Indexing failed',
        } : s)
      );
    }
  }, [apiKey, updateStats]);

  // Delete a shard
  const deleteShard = useCallback((id: string) => {
    setShards(prev => prev.filter(s => s.id !== id));
  }, []);

  // Clear all shards
  const clearAll = useCallback(() => {
    setShards([]);
  }, []);

  // Reset session stats
  const resetStats = useCallback(() => {
    setSessionStats(DEFAULT_SESSION_STATS);
  }, []);

  // Retry indexing for a failed shard
  const retry = useCallback(async (id: string) => {
    const shard = shards.find(s => s.id === id);
    if (!shard) return;

    setShards(prev => 
      prev.map(s => s.id === id ? { ...s, status: 'indexing', error: undefined } : s)
    );

    try {
      const result = await indexText(shard.content, apiKey);
      
      setShards(prev => 
        prev.map(s => s.id === id ? { 
          ...s, 
          status: 'ready',
          metadata: result.metadata,
        } : s)
      );

      updateStats(result.usageMetadata);
    } catch (error) {
      console.error('Retry indexing failed:', error);
      setShards(prev => 
        prev.map(s => s.id === id ? { 
          ...s, 
          status: 'error',
          error: error instanceof Error ? error.message : 'Indexing failed',
        } : s)
      );
    }
  }, [shards, apiKey, updateStats]);

  // Compile all shards to markdown
  const compile = useCallback((): string => {
    const readyShards = shards.filter(s => s.status === 'ready' && s.metadata);
    if (readyShards.length === 0) return '';

    const date = new Date().toISOString().split('T')[0];
    const totalTokens = readyShards.reduce((sum, s) => sum + s.tokenCount, 0);
    
    let markdown = `# Research Compilation [${date}]\n\n`;
    markdown += `> **Total Shards:** ${readyShards.length} | **Total Tokens:** ${totalTokens.toLocaleString()}\n\n`;
    markdown += `## Table of Contents\n\n`;
    
    readyShards.forEach((shard, index) => {
      markdown += `${index + 1}. [${shard.metadata!.title}](#${index + 1}-${shard.metadata!.title.toLowerCase().replace(/\s+/g, '-')})\n`;
    });
    
    markdown += `\n---\n\n`;

    readyShards.forEach((shard, index) => {
      const { title, domain, tags } = shard.metadata!;
      const tagsFormatted = tags.map(t => `#${t}`).join(' ');
      
      markdown += `## ${index + 1}. ${title}\n\n`;
      markdown += `**Domain:** ${domain} | **Tags:** ${tagsFormatted} | **Tokens:** ${shard.tokenCount.toLocaleString()}\n\n`;
      markdown += `${shard.content}\n\n`;
      
      if (index < readyShards.length - 1) {
        markdown += `---\n\n`;
      }
    });

    return markdown;
  }, [shards]);

  // Computed values
  const totalShards = shards.length;
  const readyShards = shards.filter(s => s.status === 'ready').length;
  const pendingShards = shards.filter(s => s.status === 'pending' || s.status === 'indexing').length;
  const totalTokens = shards.reduce((sum, s) => sum + s.tokenCount, 0);

  return {
    shards,
    sessionStats,
    isHydrated,
    
    // Actions
    ingest,
    deleteShard,
    clearAll,
    resetStats,
    retry,
    compile,
    
    // Computed
    totalShards,
    readyShards,
    pendingShards,
    totalTokens,
  };
};
