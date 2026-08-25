/**
 * 通义千问 text-embedding-v2 Embedding 客户端
 *
 * 基于 DashScope OpenAI 兼容的 /embeddings 端点（fetch 实现），提供：
 *  - embed(texts) / embedOne(text) 批量/单个文本向量化
 *  - 向量维度校验（默认 1024，text-embedding-v2 输出维度，可用 embeddingDim 覆盖）
 *  - 调用失败时降级返回随机伪向量并 console.warn，保证下游检索管线不中断
 */

export interface EmbeddingClientOptions {
  baseUrl?: string;    // 覆盖默认 DashScope 兼容端点
  model?: string;      // 默认 text-embedding-v2
  embeddingDim?: number; // 期望向量维度，默认 1024
  timeoutMs?: number;  // 请求超时（毫秒），默认 30000
}

export interface EmbeddingClient {
  embed(texts: string[]): Promise<number[][]>;
  embedOne(text: string): Promise<number[]>;
}

export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-v2';
export const DEFAULT_EMBEDDING_DIM = 1024;

/** DashScope OpenAI 兼容的 embeddings 端点 */
const DASHSCOPE_EMBEDDING_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings';

interface OpenAIContentEmbeddingResponse {
  data?: Array<{ embedding?: number[]; index?: number }>;
  error?: { message?: string };
}

/** 简易确定性伪随机数生成器（mulberry32），保证同 seed 结果稳定，便于测试 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** 生成维度为 dim 的随机单位向量（降级用伪向量） */
function randomPseudoVector(dim: number, seed: number): number[] {
  const rand = seededRandom(seed + 1);
  const vec: number[] = [];
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    const v = rand() * 2 - 1;
    vec.push(v);
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

/** 维度校验与规整：超出截断、不足补零，并打印警告 */
function normalizeVector(vec: number[], expectedDim: number): number[] {
  if (vec.length === expectedDim) return vec;
  if (vec.length > expectedDim) {
    // eslint-disable-next-line no-console
    console.warn(
      `[embeddings] 向量维度 ${vec.length} 超出预期 ${expectedDim}，已截断（请核对 Milvus Collection 维度）`
    );
    return vec.slice(0, expectedDim);
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[embeddings] 向量维度 ${vec.length} 小于预期 ${expectedDim}，已补零（请核对 Milvus Collection 维度）`
  );
  return [...vec, ...new Array(expectedDim - vec.length).fill(0)];
}

export function createEmbeddingClient(
  apiKey?: string,
  options: EmbeddingClientOptions = {}
): EmbeddingClient {
  const baseUrl = options.baseUrl ?? DASHSCOPE_EMBEDDING_URL;
  const model = options.model ?? DEFAULT_EMBEDDING_MODEL;
  const embeddingDim = options.embeddingDim ?? DEFAULT_EMBEDDING_DIM;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const resolvedKey = apiKey ?? process.env.EMBEDDING_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? '';

  if (!resolvedKey) {
    // eslint-disable-next-line no-console
    console.warn('[embeddings] 未配置 EMBEDDING_API_KEY / DASHSCOPE_API_KEY，调用将失败并降级');
  }

  async function requestEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resolvedKey}`
          },
          body: JSON.stringify({ model, input: texts }),
          signal: controller.signal
        });
        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`Embedding 调用失败 HTTP ${response.status}: ${errText.slice(0, 200)}`);
        }
        const data = (await response.json()) as OpenAIContentEmbeddingResponse;
        if (!data.data || data.data.length === 0) {
          throw new Error(data.error?.message ?? 'Embedding 返回空结果');
        }
        return data.data.map((item, index) =>
          normalizeVector(item.embedding ?? randomPseudoVector(embeddingDim, index), embeddingDim)
        );
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      // 失败降级：返回随机伪向量，保证检索管线不中断（代价是语义质量下降）
      // eslint-disable-next-line no-console
      console.warn('[embeddings] 调用失败，降级为随机伪向量：', (err as Error).message ?? err);
      return texts.map((_, index) => randomPseudoVector(embeddingDim, index));
    }
  }

  return {
    async embed(texts: string[]): Promise<number[][]> {
      return requestEmbeddings(texts);
    },
    async embedOne(text: string): Promise<number[]> {
      const [vector] = await requestEmbeddings([text]);
      return vector;
    }
  };
}
