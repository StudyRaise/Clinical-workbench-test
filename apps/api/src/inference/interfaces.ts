export interface CompletionRequest {
  tenantId?: string;
  model: string;
  prompt: string;
  promptHash: string;
}

export interface CompletionResponse {
  promptHash: string;
  outputText: string;
  usage?: Record<string, unknown>;
  rejected?: boolean;
  reason?: string;
}
