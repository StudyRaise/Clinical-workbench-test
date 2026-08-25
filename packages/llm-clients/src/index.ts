import fetch from 'cross-fetch';

export interface CompletionParams {
  model: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

export interface CompletionResult {
  outputText: string;
  usage?: Record<string, unknown>;
}

export interface LLMClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface LLMClient {
  complete: (params: CompletionParams) => Promise<CompletionResult>;
}

export function createLLMClient(config: LLMClientConfig = {}): LLMClient {
  const baseUrl = config.baseUrl ?? process.env.NEXT_PUBLIC_INFERENCE_URL ?? 'http://localhost:8001';
  const timeoutMs = config.timeoutMs ?? 30_000;

  return {
    async complete({ model, prompt, metadata }: CompletionParams): Promise<CompletionResult> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseUrl}/inference/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': (metadata?.tenant as string) ?? 'public',
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
          },
          body: JSON.stringify({
            model,
            prompt,
            promptHash: metadata?.promptHash ?? `${model}:${prompt.length}`,
            tenantId: metadata?.tenant,
            metadata
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Inference call failed with status ${response.status}`);
        }

        const data = (await response.json()) as { outputText?: string; usage?: Record<string, unknown> };
        return {
          outputText: data.outputText ?? '',
          usage: data.usage
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
