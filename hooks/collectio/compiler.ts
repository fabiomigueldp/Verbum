import { CollectionManifest } from '../../types';
import type { Shard } from '../useCollectio';

export const buildFallbackManifest = (): CollectionManifest => ({
  title: `Verbum Collection [${new Date().toISOString().split('T')[0]}]`,
  type: 'mixed',
  description: 'A curated collection of content fragments.',
  suggestedFilename: `verbum-collection-${Date.now()}`,
});

const detectCodeLanguage = (domain: string, tags: string[]): string => {
  const allText = `${domain} ${tags.join(' ')}`.toLowerCase();

  if (allText.includes('typescript') || allText.includes('tsx')) return 'typescript';
  if (allText.includes('javascript') || allText.includes('jsx') || allText.includes('react')) return 'javascript';
  if (allText.includes('python')) return 'python';
  if (allText.includes('rust')) return 'rust';
  if (allText.includes('go') || allText.includes('golang')) return 'go';
  if (allText.includes('java')) return 'java';
  if (allText.includes('c++') || allText.includes('cpp')) return 'cpp';
  if (allText.includes('sql') || allText.includes('database')) return 'sql';
  if (allText.includes('bash') || allText.includes('shell')) return 'bash';
  if (allText.includes('css') || allText.includes('style')) return 'css';
  if (allText.includes('html')) return 'html';
  if (allText.includes('json')) return 'json';
  if (allText.includes('yaml') || allText.includes('yml')) return 'yaml';

  return '';
};

export const buildCollectionMarkdown = (
  shards: Shard[],
  manifest: CollectionManifest,
  totalTokens: number
): string => {
  let markdown = `# ${manifest.title}\n\n`;
  markdown += `> ${manifest.description}\n\n`;
  markdown += `**Type:** ${manifest.type} | **Shards:** ${shards.length} | **Tokens:** ${totalTokens.toLocaleString()}\n\n`;
  markdown += `## Table of Contents\n\n`;

  shards.forEach((shard, index) => {
    markdown += `${index + 1}. [${shard.metadata!.title}](#${index + 1}-${shard.metadata!.title.toLowerCase().replace(/\s+/g, '-')})\n`;
  });

  markdown += `\n---\n\n`;

  shards.forEach((shard, index) => {
    const { title, domain, tags } = shard.metadata!;
    const tagsFormatted = tags.map(t => `#${t}`).join(' ');

    markdown += `## ${index + 1}. ${title}\n\n`;
    markdown += `**Domain:** ${domain} | **Tags:** ${tagsFormatted} | **Tokens:** ${shard.tokenCount.toLocaleString()}\n\n`;

    if (manifest.type === 'codebase') {
      const langHint = detectCodeLanguage(domain, tags);
      markdown += `\`\`\`${langHint}\n${shard.content}\n\`\`\`\n\n`;
    } else {
      markdown += `${shard.content}\n\n`;
    }

    if (index < shards.length - 1) {
      markdown += `---\n\n`;
    }
  });

  return markdown;
};

