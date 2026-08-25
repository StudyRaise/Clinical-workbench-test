/**
 * RAG 检索工具函数（纯 TypeScript，无外部运行时依赖）
 *
 * 提供临床 RAG 场景所需的基础检索能力：
 *  - chunkText：递归字符分块（段落 → 行 → 句子 → 兜底硬切），相邻块保留 overlap 重叠
 *  - bm25Score：简化 BM25 关键词打分（中英文分词）
 *  - hybridRank：向量分 + 关键词分加权合并排序（Hybrid Search）
 *  - filterByTimeRange：Timeline 时间范围过滤并按时间升序
 *
 * 保留原 pipelines.ts 的文档摄取管线导出（buildIngestionPipeline）。
 */
export { buildIngestionPipeline } from './pipelines';
export type { IngestionPipeline } from './pipelines';

// ---------------------------------------------------------------------------
// 文本分块（递归字符分块）
// ---------------------------------------------------------------------------

export interface ChunkTextOptions {
  chunkSize?: number; // 每块目标字符数，默认 500
  overlap?: number;   // 相邻块重叠字符数，默认 50
}

/** 递归分块时依次尝试的分隔符：由粗到细 */
const SPLIT_SEPARATORS = ['\n\n', '\n', '。', '！', '？', '；', '，', ' ', ''];

/**
 * 递归字符分块：优先按段落（\n\n）切，其次按行/句子标点，最后按 chunkSize 硬切兜底；
 * 相邻块之间保留 overlap 字符重叠，缓解上下文断裂。
 */
export function chunkText(text: string, options: ChunkTextOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? 500;
  const overlap = options.overlap ?? 50;
  const normalized = (text ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const base = recursiveSplit(normalized, chunkSize);
  if (overlap <= 0) return base;

  // 注入重叠：把前一块末尾 overlap 个字符拼到下一块开头（原文中该片段会重复出现）
  return base.map((chunk, index) => {
    const prevTail =
      index > 0 && base[index - 1].length > overlap ? base[index - 1].slice(-overlap) : '';
    return prevTail + chunk;
  });
}

function recursiveSplit(text: string, chunkSize: number): string[] {
  if (text.length <= chunkSize) return [text];

  for (const sep of SPLIT_SEPARATORS) {
    const parts = text.split(sep).filter((p) => p.trim().length > 0);
    if (parts.length < 2) continue; // 当前分隔符切不开，尝试更细粒度

    const result: string[] = [];
    let current = '';
    const flush = () => {
      if (current) {
        result.push(...recursiveSplit(current, chunkSize));
        current = '';
      }
    };

    for (const part of parts) {
      if (current && current.length + sep.length + part.length > chunkSize) flush();
      current = current ? current + sep + part : part;
    }
    flush();

    if (result.length >= 2) return result;
  }

  // 兜底：按 chunkSize 硬切（尽量在空格/标点处断行，简单起见直接切片）
  const result: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    result.push(text.slice(i, i + chunkSize));
  }
  return result;
}

// ---------------------------------------------------------------------------
// BM25 关键词打分
// ---------------------------------------------------------------------------

const BM25_K1 = 1.5;
const BM25_B = 0.75;

/** 简易中英文分词：英文/数字按非字母数字切分并小写；中文拆成单字 + 相邻二元组 */
function tokenize(text: string): string[] {
  const lower = (text ?? '').toLowerCase();
  const tokens: string[] = [];
  for (const word of lower.split(/[^a-z0-9]+/)) {
    if (word) tokens.push(word);
  }
  for (const seg of lower.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (let i = 0; i < seg.length; i++) tokens.push(seg[i]);
    for (let i = 0; i < seg.length - 1; i++) tokens.push(seg.slice(i, i + 2));
  }
  return tokens;
}

/**
 * 简化 BM25 关键词打分（单文档场景）：
 * score = Σ_{t∈query} tf(t)·(k1+1) / (tf(t) + k1·(1 - b + b·dl/avgdl))
 * 单文档时 avgdl ≈ dl，退化为词频加权；结果单调随关键词覆盖度/词频增长，
 * 适合与向量语义分做 Hybrid 合并。无语料库时不含真实 IDF，故称“简化”。
 */
export function bm25Score(query: string, document: string): number {
  const queryTerms = tokenize(query);
  const docTerms = tokenize(document);
  if (queryTerms.length === 0 || docTerms.length === 0) return 0;

  const docLength = docTerms.length;
  const avgDocLength = docLength; // 单文档简化

  const termFrequency = new Map<string, number>();
  for (const term of docTerms) {
    termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
  }

  let score = 0;
  for (const term of queryTerms) {
    const freq = termFrequency.get(term) ?? 0;
    if (freq === 0) continue;
    const denominator = freq + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
    score += (freq * (BM25_K1 + 1)) / denominator;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Hybrid Search（向量分 + 关键词分加权合并）
// ---------------------------------------------------------------------------

export interface ScoredItem {
  id: string;
  score: number;
  doc?: Record<string, unknown>;
}

export interface HybridRankOptions {
  vectorWeight?: number; // 向量分数权重（0~1），默认 0.7；关键词权重 = 1 - vectorWeight
}

export interface RankedResult {
  id: string;
  score: number;         // 合并后的分数（0~1，越高越相关）
  vectorScore?: number;  // 归一化后的向量分
  keywordScore?: number; // 归一化后的关键词分
  doc?: Record<string, unknown>;
}

/** 加权合并两个检索来源并按合并分降序排序（两来源内先归一化到 [0,1]） */
export function hybridRank(
  vectorScores: ScoredItem[],
  keywordScores: ScoredItem[],
  options: HybridRankOptions = {}
): RankedResult[] {
  const vectorWeight = options.vectorWeight ?? 0.7;
  const keywordWeight = 1 - vectorWeight;

  const vectorMap = new Map<string, ScoredItem>();
  const keywordMap = new Map<string, ScoredItem>();
  for (const item of vectorScores) vectorMap.set(item.id, item);
  for (const item of keywordScores) keywordMap.set(item.id, item);

  /** 组内归一化：除以最大值到 [0,1] */
  const normalize = (list: ScoredItem[]) => {
    const max = Math.max(0, ...list.map((i) => i.score));
    if (max <= 0) return new Map<string, number>();
    return new Map(list.map((i) => [i.id, i.score / max]));
  };
  const normVector = normalize(vectorScores);
  const normKeyword = normalize(keywordScores);

  const ids = new Set<string>([...vectorMap.keys(), ...keywordMap.keys()]);
  const results: RankedResult[] = [];
  for (const id of ids) {
    const vectorScore = normVector.get(id) ?? 0;
    const keywordScore = normKeyword.get(id) ?? 0;
    results.push({
      id,
      score: vectorWeight * vectorScore + keywordWeight * keywordScore,
      vectorScore: vectorMap.has(id) ? vectorScore : undefined,
      keywordScore: keywordMap.has(id) ? keywordScore : undefined,
      doc: vectorMap.get(id)?.doc ?? keywordMap.get(id)?.doc
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Timeline 时间范围过滤
// ---------------------------------------------------------------------------

export type TimeInput = string | Date;

/** 支持携带时间戳的文档（timestamp 或 date 字段） */
export interface TimeStampedDoc {
  timestamp?: string;
  date?: string;
  [key: string]: unknown;
}

/**
 * Timeline 过滤：按时间范围筛选文档并按时间升序返回。
 * 文档需含 timestamp 或 date 字段（ISO 或 'YYYY-MM-DD'）；无法解析时间的文档会被排除。
 */
export function filterByTimeRange<T extends TimeStampedDoc>(
  docs: T[],
  start?: TimeInput,
  end?: TimeInput
): T[] {
  const startTime = start ? new Date(start).getTime() : Number.NEGATIVE_INFINITY;
  const endTime = end ? new Date(end).getTime() : Number.POSITIVE_INFINITY;

  const parsed = docs
    .map((doc) => {
      const raw = doc.timestamp ?? doc.date;
      if (!raw) return null;
      const time = new Date(raw).getTime();
      if (Number.isNaN(time)) return null;
      return { doc, time };
    })
    .filter(
      (entry): entry is { doc: T; time: number } =>
        entry !== null && entry.time >= startTime && entry.time <= endTime
    );

  return parsed.sort((a, b) => a.time - b.time).map((entry) => entry.doc);
}
