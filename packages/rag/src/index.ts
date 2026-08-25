import crypto from 'node:crypto';
import { createEmbeddingClient } from '@repo/embeddings';
import { logger } from '@repo/utils';
import type { IngestionPipeline } from './pipelines';
export { buildIngestionPipeline } from './pipelines';

export interface Chunk {
  id: string;
  content: string;
  tokens: number;
  metadata: Record<string, unknown>;
}

export interface ChunkParams {
  docId: string;
  text: string;
  size: number;
  overlap: number;
  metadata?: Record<string, unknown>;
}

export function chunkDocument({ docId, text, size, overlap, metadata }: ChunkParams): Chunk[] {
  const words = text.split(/\s+/);
  const chunks: Chunk[] = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    const slice = words.slice(i, i + size);
    if (slice.length === 0) continue;
    const content = slice.join(' ');
    const id = crypto.createHash('sha1').update(`${docId}:${i}`).digest('hex');
    chunks.push({
      id,
      content,
      tokens: slice.length,
      metadata: {
        docId,
        chunkIndex: chunks.length,
        ...metadata
      }
    });
  }
  return chunks;
}

export async function embedChunks(chunks: Chunk[], pipelineVersion: string) {
  const client = createEmbeddingClient();
  const embeddings = await client.embed(
    chunks.map((chunk) => chunk.content),
    {
      model: 'text-embedding-3-small',
      pipelineVersion
    }
  );

  return chunks.map((chunk, index) => ({
    ...chunk,
    vector: embeddings.vectors[index],
    embedModel: embeddings.model,
    embedDimensions: embeddings.dimensions
  }));
}

export function createSemanticCacheKey(prompt: string, contextIds: string[]): string {
  return crypto.createHash('sha256').update(`${prompt}:${contextIds.sort().join('|')}`).digest('hex');
}

export async function ingestDocument(
  pipeline: IngestionPipeline,
  document: { id: string; text: string; metadata?: Record<string, unknown> }
) {
  const chunks = chunkDocument({ docId: document.id, text: document.text, size: 200, overlap: 40 });
  const enriched = await embedChunks(chunks, pipeline.version);
  logger.info('Ingested document', { docId: document.id, chunkCount: enriched.length });
  await pipeline.persist(enriched);
}
