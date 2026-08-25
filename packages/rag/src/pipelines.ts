import { logger } from '@repo/utils';

export interface IngestionPipeline {
  version: string;
  persist: (chunks: Array<Record<string, unknown>>) => Promise<void>;
}

export function buildIngestionPipeline(): IngestionPipeline {
  return {
    version: 'pipeline-v1',
    async persist(chunks) {
      logger.info('Persisting chunks to vector store', {
        count: chunks.length,
        exampleChunk: chunks[0]
      });
    }
  };
}
