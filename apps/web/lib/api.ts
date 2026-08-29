/**
 * 前端 API 客户端
 *
 * - JWT token 与当前用户信息存于 localStorage
 * - 所有业务请求自动附带 Authorization: Bearer <token>
 * - 提供 auth / business / knowledge / users / audit 五组方法
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001/api';
const TOKEN_KEY = 'clinical_workbench_token';
const USER_KEY = 'clinical_workbench_user';

// ---------- Token / 用户管理 ----------

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  facilityId: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

// ---------- 核心请求封装 ----------

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; formData?: FormData } = {}
): Promise<T> {
  const { method = 'GET', body, formData } = options;
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload
  });

  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = Array.isArray(data.message) ? data.message.join('; ') : data.message;
    } catch {
      // 忽略非 JSON 错误体
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    // 401 未认证时清空会话，由页面引导重新登录
    if (res.status === 401 && !path.startsWith('/auth/')) {
      clearSession();
    }
    throw err;
  }
  return (await res.json()) as T;
}

// ---------- Auth ----------

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  setSession(data.access_token, data.user);
  return data;
}

export async function register(input: {
  email: string;
  password: string;
  name?: string;
  facilityId?: string;
  role?: string;
}): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: input
  });
  setSession(data.access_token, data.user);
  return data;
}

// ---------- 业务：术前谈话分析 ----------

export interface PreopReport {
  surgery: string;
  risks: string[];
  alternatives: string[];
  consent: string;
  missing_items: string[];
  score: number;
  degraded?: boolean;
  reason?: string;
}

export async function analyzePreop(text: string): Promise<PreopReport> {
  return request<PreopReport>('/preop/analyze', { method: 'POST', body: { text } });
}

// ---------- 业务：出院随访总结 ----------

export interface DischargeSummary {
  patient_guide: string;
  doctor_plan: string;
  followup_date: string;
}

export async function summarizeDischarge(text: string): Promise<DischargeSummary> {
  return request<DischargeSummary>('/discharge/summarize', {
    method: 'POST',
    body: { text }
  });
}

// ---------- 业务：科研数据清洗 ----------

export interface ExtractedField {
  field: string;
  value: string;
  confidence: number;
}

export interface CleanRecord {
  source_index: number;
  fields: ExtractedField[];
}

export interface CleanResult {
  schema_fields: string[];
  records: CleanRecord[];
}

export async function cleanResearch(texts: string[]): Promise<CleanResult> {
  return request<CleanResult>('/research/clean', {
    method: 'POST',
    body: { texts }
  });
}

// ---------- 知识库 ----------

export interface KnowledgeUploadResult {
  object_name: string;
  status: 'ok' | 'degraded';
  message?: string;
}

export interface KnowledgeIngestResult {
  task_id?: string;
  status: 'submitted' | 'degraded';
  message?: string;
}

export async function uploadKnowledge(file: File): Promise<KnowledgeUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  return request<KnowledgeUploadResult>('/knowledge/documents', {
    method: 'POST',
    formData
  });
}

export async function ingestKnowledge(objectName: string): Promise<KnowledgeIngestResult> {
  return request<KnowledgeIngestResult>('/knowledge/documents/ingest', {
    method: 'POST',
    body: { object_name: objectName }
  });
}

export interface KnowledgeChatSource {
  page_content: string;
  document_name: string;
  score: number;
  /** 参考文档的预签名下载地址（OSS URI） */
  uri?: string;
}

export interface KnowledgeChatResult {
  answer: string;
  conversation_id: string;
  sources: KnowledgeChatSource[];
  degraded: boolean;
  reason: string;
}

export async function askKnowledge(
  content: string,
  conversationId = ''
): Promise<KnowledgeChatResult> {
  return request<KnowledgeChatResult>('/knowledge/chat', {
    method: 'POST',
    body: { content, conversation_id: conversationId }
  });
}

export interface KnowledgeStreamResult {
  answer: string;
  conversationId: string;
  sources: KnowledgeChatSource[];
}

/**
 * SSE 流式问答事件解析器（纯逻辑，可单测）：
 * push() 解析单个 SSE 事件文本并累积 answer/reasoning/sources；
 * result() 返回最终结果。
 */
export function createKnowledgeStreamParser(
  conversationId: string,
  onDelta: (answer: string, reasoning: string) => void
) {
  let answer = '';
  let reasoning = '';
  let convId = conversationId;
  let sources: KnowledgeChatSource[] = [];

  const push = (event: string) => {
    const dataLines: string[] = [];
    for (const line of event.split('\n')) {
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
    } catch {
      return;
    }
    if (typeof parsed.delta === 'string' && parsed.delta) {
      answer += parsed.delta;
    }
    if (typeof parsed.reasoning_content === 'string' && parsed.reasoning_content) {
      reasoning += parsed.reasoning_content;
    }
    if (typeof parsed.message === 'string' && parsed.message) {
      answer = parsed.message; // 最终完整回答
    }
    if (typeof parsed.conversation_id === 'string') convId = parsed.conversation_id;
    if (Array.isArray(parsed.knowledge_base_results)) {
      sources = (parsed.knowledge_base_results as Record<string, unknown>[]).map((item) => {
        const doc = (item.document ?? {}) as Record<string, unknown>;
        return {
          page_content: typeof item.page_content === 'string' ? item.page_content : '',
          document_name: typeof doc.display_name === 'string' ? doc.display_name : '',
          score: typeof item.confidence === 'number' ? item.confidence : 0,
          uri: (typeof doc.uri === 'string' ? doc.uri : '') || (typeof item.uri === 'string' ? item.uri : '')
        };
      });
    }
    onDelta(answer, reasoning);
  };

  const result = (): KnowledgeStreamResult => ({ answer, conversationId: convId, sources });
  return { push, result };
}

/** SSE 流式知识库问答：onDelta 每次收到增量（answer=最终回答、reasoning=思考过程）回调；结束回调 onDone。 */
export async function askKnowledgeStream(
  content: string,
  conversationId: string,
  onDelta: (answer: string, reasoning: string) => void,
  onDone: (final: KnowledgeStreamResult) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/knowledge/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    },
    body: JSON.stringify({ content, conversation_id: conversationId })
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`流式问答失败 (${res.status})${text ? `: ${text.slice(0, 120)}` : ''}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parser = createKnowledgeStreamParser(conversationId, onDelta);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      parser.push(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
    }
  }
  if (buffer.trim()) parser.push(buffer.trim());
  onDone(parser.result());
}

// ---------- 线上知识库（数据集） ----------

export interface KnowledgeDataset {
  dataset_id: string;
  display_name: string;
  desc: string;
  state: number;
  is_empty: boolean;
  document_count: number;
  document_size: number;
  segment_count: number;
  token_count: number;
}

export interface KnowledgeDatasetListResult {
  datasets: KnowledgeDataset[];
  degraded: boolean;
  reason: string;
}

export interface KnowledgeDatasetActionResult {
  dataset_id?: string;
  display_name?: string;
  deleted?: boolean;
  degraded: boolean;
  reason: string;
}

export async function fetchKnowledgeDatasets(): Promise<KnowledgeDatasetListResult> {
  return request<KnowledgeDatasetListResult>('/knowledge/datasets');
}

export async function createKnowledgeDataset(
  displayName: string,
  desc = ''
): Promise<KnowledgeDatasetActionResult> {
  return request<KnowledgeDatasetActionResult>('/knowledge/datasets', {
    method: 'POST',
    body: { display_name: displayName, desc }
  });
}

export async function deleteKnowledgeDataset(
  datasetId: string
): Promise<KnowledgeDatasetActionResult> {
  return request<KnowledgeDatasetActionResult>(`/knowledge/datasets/${datasetId}`, {
    method: 'DELETE'
  });
}

export interface KnowledgeDatasetUploadResult {
  job_id: string;
  dataset_id: string;
  filename: string;
  status: string;
  message: string;
}

/** 上传文档到线上知识库（SenseCore：创建导入任务 -> 预签名直传 -> 启动任务） */
export async function uploadKnowledgeDatasetDocument(
  datasetId: string,
  file: File
): Promise<KnowledgeDatasetUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  return request<KnowledgeDatasetUploadResult>(
    `/knowledge/datasets/${encodeURIComponent(datasetId)}/documents`,
    { method: 'POST', formData }
  );
}

export interface KnowledgeDocument {
  document_id: string;
  display_name: string;
  type: number;
  document_size: number;
  token_count: number;
  segment_count: number;
  uri: string;
  create_time: string;
}

export interface KnowledgeDocumentListResult {
  documents: KnowledgeDocument[];
  degraded: boolean;
  reason: string;
}

/** 列出线上知识库中的文档 */
export async function fetchKnowledgeDatasetDocuments(
  datasetId: string
): Promise<KnowledgeDocumentListResult> {
  return request<KnowledgeDocumentListResult>(
    `/knowledge/datasets/${encodeURIComponent(datasetId)}/documents`
  );
}

/** 删除线上知识库中的文档 */
export async function deleteKnowledgeDatasetDocument(
  datasetId: string,
  documentId: string
): Promise<KnowledgeDatasetActionResult> {
  return request<KnowledgeDatasetActionResult>(
    `/knowledge/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' }
  );
}

// ---------- 用户 ----------

export interface UserListItem {
  id: string;
  email: string;
  role: string;
  facilityId?: string;
}

export interface PageResult<T> {
  items?: T[];
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export async function fetchUsers(): Promise<UserListItem[]> {
  const data = await request<PageResult<UserListItem>>('/users');
  return (data.items ?? data.data ?? []) as UserListItem[];
}

export async function fetchMe(): Promise<AuthUser> {
  return request<AuthUser>('/users/me');
}

// ---------- 审计日志 ----------

export interface AuditLogItem {
  id: string;
  userId: string;
  action: string;
  target: string;
  ip: string;
  createdAt: string;
}

export async function fetchAuditLogs(page = 1, pageSize = 20): Promise<PageResult<AuditLogItem>> {
  return request<PageResult<AuditLogItem>>(`/audit-logs?page=${page}&pageSize=${pageSize}`);
}

// ---------- 业务错误降级识别 ----------

export function isDegraded(res: unknown): boolean {
  return Boolean(
    res &&
      typeof res === 'object' &&
      'degraded' in (res as Record<string, unknown>) &&
      (res as Record<string, unknown>).degraded === true
  );
}

export function degradedReason(res: unknown): string {
  if (isDegraded(res)) {
    return ((res as Record<string, unknown>).reason as string) ?? '服务暂不可用';
  }
  return '';
}
