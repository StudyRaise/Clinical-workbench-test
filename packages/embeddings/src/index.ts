import fetch from 'cross-fetch';

export interface EmbedOptions {
  model: string;
  pipelineVersion?: string;
}

export interface EmbeddingResult {
  vectors: number[][];
  model: string;
  dimensions: number;
}

export interface EmbeddingClientConfig {
  baseUrl?: string;
  apiKey?: string;
}

export interface EmbeddingClient {
  embed: (inputs: string[], options?: EmbedOptions) => Promise<EmbeddingResult>;
}

export function createEmbeddingClient(config: EmbeddingClientConfig = {}): EmbeddingClient {
  const baseUrl = config.baseUrl ?? process.env.EMBEDDING_URL ?? 'http://localhost:8001';

  return {
    async embed(inputs: string[], options: EmbedOptions = { model: 'text-embedding-3-small' }) {
      const response = await fetch(`${baseUrl}/inference/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
        },
        body: JSON.stringify({
          inputs,
          model: options.model,
          metadata: { pipelineVersion: options.pipelineVersion }
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding request failed with status ${response.status}`);
      }

      const data = (await response.json()) as EmbeddingResult;
      return data;
    }
  };
}
