/**
 * 国产 LLM API 客户端（通义千问 / DeepSeek）
 *
 * 两个服务商均提供 OpenAI 兼容的 /chat/completions 接口，本模块基于 fetch 实现统一客户端，
 * 内置：指数退避重试（默认 3 次）、请求超时控制、Token 用量返回、Token 估算、SSE 流式响应。
 *
 * 兼容性说明：除新版 complete(messages) / stream(messages) 接口外，同时保留对旧版调用形式
 * complete({ model, prompt, metadata }) 的支持（apps/api、packages/evals 等既有调用方仍在依赖）。
 */

export type LLMProvider = 'qwen' | 'deepseek';

export interface LLMChatMessage {
  role: string; // 'system' | 'user' | 'assistant'
  content: string;
}

export interface LLMClientOptions {
  baseUrl?: string;    // 覆盖默认端点（便于内网代理 / 自定义网关）
  model?: string;      // 默认模型名
  timeoutMs?: number;  // 请求超时（毫秒），默认 30000
  maxRetries?: number; // 重试次数，默认 3
  temperature?: number; // 采样温度
  maxTokens?: number;  // 生成长度上限
}

/** 旧版兼容参数（apps/api、packages/evals 仍在调用） */
export interface LegacyCompletionParams {
  model: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

/** 旧版兼容返回 */
export interface LegacyCompletionResult {
  outputText: string;
  usage?: Record<string, unknown>;
}

export interface LLMClient {
  /** 新版：传入消息数组，返回完整生成文本 */
  complete(messages: LLMChatMessage[]): Promise<string>;
  /** 兼容旧版调用：返回 { outputText, usage } */
  complete(params: LegacyCompletionParams): Promise<LegacyCompletionResult>;
  /** 流式返回生成增量文本 */
  stream(messages: LLMChatMessage[]): AsyncIterable<string>;
}

export const LLM_PROVIDERS: Record<
  LLMProvider,
  { baseUrl: string; envKey: string; defaultModel: string }
> = {
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    envKey: 'QWEN_API_KEY',
    defaultModel: 'qwen-plus'
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    envKey: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat'
  }
};

/**
 * 粗略估算一段文本的 Token 数。
 * 中文约 1 字 ≈ 0.6 token，英文约 4 字符 ≈ 1 token（仅用于成本粗估，非精确值）。
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length;
  const otherCount = text.length - cjkCount;
  return Math.ceil(cjkCount * 0.6 + otherCount / 4);
}

/** 指数退避延时：1s、2s、4s ...（含少量抖动） */
function backoffDelay(attempt: number): number {
  const base = 1000 * Math.pow(2, attempt - 1);
  return base + Math.floor(Math.random() * 200);
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
  usage?: Record<string, unknown>;
}

export function createLLMClient(
  provider?: LLMProvider,
  apiKey?: string,
  options: LLMClientOptions = {}
): LLMClient {
  const resolvedProvider: LLMProvider =
    provider ?? ((process.env.LLM_PROVIDER as LLMProvider | undefined) ?? 'qwen');
  const providerCfg = LLM_PROVIDERS[resolvedProvider];
  const resolvedKey = apiKey ?? process.env[providerCfg.envKey] ?? '';
  const baseUrl = options.baseUrl ?? providerCfg.baseUrl;
  const defaultModel = options.model ?? providerCfg.defaultModel;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxRetries = options.maxRetries ?? 3;

  if (!resolvedKey) {
    // eslint-disable-next-line no-console
    console.warn(
      `[llm-clients] 未配置环境变量 ${providerCfg.envKey}（provider=${resolvedProvider}），调用将失败`
    );
  }

  /** 单次非流式调用，含重试 */
  async function chat(
    messages: LLMChatMessage[],
    modelOverride?: string
  ): Promise<{ content: string; usage: Record<string, unknown> | undefined }> {
    const body: Record<string, unknown> = {
      model: modelOverride ?? defaultModel,
      messages,
      stream: false
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)));
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resolvedKey}`
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`LLM API 调用失败 HTTP ${response.status}: ${errText.slice(0, 200)}`);
        }
        const data = (await response.json()) as OpenAIChatResponse;
        return {
          content: data.choices?.[0]?.message?.content ?? '',
          usage: data.usage
        };
      } catch (err) {
        // 超时（AbortError）不重试，直接抛出；其余错误指数退避重试
        if (isAbortError(err)) throw err;
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error('LLM 调用失败');
  }

  /** 流式调用：解析 SSE 的 data: 行，逐个产出增量文本 */
  async function* chatStream(messages: LLMChatMessage[]): AsyncIterable<string> {
    const body: Record<string, unknown> = {
      model: defaultModel,
      messages,
      stream: true
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resolvedKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`LLM 流式调用失败 HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }
      if (!response.body) throw new Error('LLM 流式响应体为空');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') return;
          try {
            const json = JSON.parse(payload) as OpenAIChatResponse;
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // 忽略无法解析的 SSE 行，继续读取
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** 统一入口：新接口传消息数组返回文本；旧接口传 { model, prompt, metadata } 返回 { outputText, usage } */
  async function completeImpl(
    messages: LLMChatMessage[]
  ): Promise<string>;
  async function completeImpl(
    params: LegacyCompletionParams
  ): Promise<LegacyCompletionResult>;
  async function completeImpl(
    arg: LLMChatMessage[] | LegacyCompletionParams
  ): Promise<string | LegacyCompletionResult> {
    if (Array.isArray(arg)) {
      const { content } = await chat(arg);
      return content;
    }
    // 旧版兼容：单条 user 消息，支持 model 覆盖
    const { content, usage } = await chat([{ role: 'user', content: arg.prompt }], arg.model);
    return { outputText: content, usage };
  }

  return {
    complete: completeImpl,
    stream(messages: LLMChatMessage[]): AsyncIterable<string> {
      return chatStream(messages);
    }
  };
}
