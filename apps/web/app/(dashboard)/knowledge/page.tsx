'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Library,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  Zap
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Markdown } from '@/components/markdown';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  askKnowledgeStream,
  fetchKnowledgeDatasets,
  createKnowledgeDataset,
  deleteKnowledgeDataset,
  uploadKnowledgeDatasetDocument,
  fetchKnowledgeDatasetDocuments,
  deleteKnowledgeDatasetDocument,
  type KnowledgeChatSource,
  type KnowledgeDataset,
  type KnowledgeDocument
} from '@/lib/api';

export default function KnowledgePage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [targetDatasetId, setTargetDatasetId] = useState('');
  const [uploadResult, setUploadResult] = useState<{
    filename: string;
    job_id: string;
    status: string;
    message?: string;
  } | null>(null);

  // 知识问答（SenseCore RAG）
  interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    text: string;
    sources?: KnowledgeChatSource[];
    reasoning?: string;
    degraded?: boolean;
  }
  const [chatInput, setChatInput] = useState('');
  const [chatConversationId, setChatConversationId] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [msgSeq, setMsgSeq] = useState(0);
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState('');

  // 线上知识库（SenseCore 数据集）
  const [datasets, setDatasets] = useState<KnowledgeDataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsError, setDatasetsError] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  // 知识库文档列表（按 dataset_id 展开）
  const [expandedId, setExpandedId] = useState('');
  const [docsMap, setDocsMap] = useState<Record<string, KnowledgeDocument[]>>({});
  const [docsLoading, setDocsLoading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState('');

  // 删除确认弹窗
  type ConfirmTarget =
    | { kind: 'dataset'; id: string; name: string }
    | { kind: 'doc'; datasetId: string; doc: KnowledgeDocument };
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  // 聊天窗口自动滚动到底部
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  const loadDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    setDatasetsError('');
    try {
      const res = await fetchKnowledgeDatasets();
      setDatasets(res.datasets ?? []);
      setTargetDatasetId((prev) =>
        prev && (res.datasets ?? []).some((d) => d.dataset_id === prev)
          ? prev
          : (res.datasets ?? [])[0]?.dataset_id ?? ''
      );
      if (res.degraded && res.reason) setDatasetsError(res.reason);
    } catch (err) {
      setDatasetsError(err instanceof Error ? err.message : '加载线上知识库失败');
    } finally {
      setDatasetsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  const handleCreateDataset = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setDatasetsError('');
    try {
      const res = await createKnowledgeDataset(name, newDesc.trim());
      if (res.degraded) {
        setDatasetsError(res.reason || '创建线上知识库失败');
      } else {
        setNewName('');
        setNewDesc('');
        await loadDatasets();
      }
    } catch (err) {
      setDatasetsError(err instanceof Error ? err.message : '创建线上知识库失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDataset = async (id: string) => {
    setDeletingId(id);
    setDatasetsError('');
    try {
      const res = await deleteKnowledgeDataset(id);
      if (res.degraded) setDatasetsError(res.reason || '删除线上知识库失败');
      setConfirmTarget(null);
      await loadDatasets();
    } catch (err) {
      setDatasetsError(err instanceof Error ? err.message : '删除线上知识库失败');
    } finally {
      setDeletingId('');
    }
  };

  const loadDocs = useCallback(async (datasetId: string) => {
    setDocsLoading(true);
    try {
      const res = await fetchKnowledgeDatasetDocuments(datasetId);
      setDocsMap((m) => ({ ...m, [datasetId]: res.documents ?? [] }));
    } catch {
      setDocsMap((m) => ({ ...m, [datasetId]: [] }));
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const toggleDocs = (datasetId: string) => {
    if (expandedId === datasetId) {
      setExpandedId('');
      return;
    }
    setExpandedId(datasetId);
    void loadDocs(datasetId);
  };

  const handleDeleteDoc = async (datasetId: string, doc: KnowledgeDocument) => {
    setDeletingDocId(doc.document_id);
    setDatasetsError('');
    try {
      const res = await deleteKnowledgeDatasetDocument(datasetId, doc.document_id);
      if (res.degraded) setDatasetsError(res.reason || '删除文档失败');
      setConfirmTarget(null);
      await Promise.all([loadDocs(datasetId), loadDatasets()]);
    } catch (err) {
      setDatasetsError(err instanceof Error ? err.message : '删除文档失败');
    } finally {
      setDeletingDocId('');
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === 'dataset') {
      void handleDeleteDataset(confirmTarget.id);
    } else {
      void handleDeleteDoc(confirmTarget.datasetId, confirmTarget.doc);
    }
  };

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) {
      setFile(f);
      setError('');
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !targetDatasetId) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadKnowledgeDatasetDocument(targetDatasetId, file);
      if (res.status !== 'ok') {
        setError(res.message || '上传失败');
        setUploadResult(null);
      } else {
        setUploadResult(res);
        setFile(null);
        // 云端解析完成后刷新知识库统计与文档列表
        setTimeout(() => {
          void loadDatasets();
          if (expandedId === targetDatasetId) void loadDocs(targetDatasetId);
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
      setUploadResult(null);
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async () => {
    const content = chatInput.trim();
    if (!content || asking) return;
    setAsking(true);
    setChatError('');
    const userMsg: ChatMessage = { id: msgSeq, role: 'user', text: content };
    const assistantMsg: ChatMessage = {
      id: msgSeq + 1,
      role: 'assistant',
      text: '',
      sources: []
    };
    setMsgSeq((n) => n + 2);
    setChatInput('');
    setChatMessages((m) => [...m, userMsg, assistantMsg]);

    try {
      await askKnowledgeStream(
        content,
        chatConversationId,
        (partial, reasoning) => {
          setChatMessages((m) =>
            m.map((msg) =>
              msg.id === assistantMsg.id ? { ...msg, text: partial, reasoning } : msg
            )
          );
        },
        (final) => {
          setChatConversationId(final.conversationId);
          setChatMessages((m) =>
            m.map((msg) =>
              msg.id === assistantMsg.id
                ? {
                    ...msg,
                    text: final.answer || '（无返回内容）',
                    sources: final.sources ?? []
                  }
                : msg
            )
          );
        }
      );
    } catch (err) {
      setChatError(err instanceof Error ? err.message : '问答失败');
      setChatMessages((m) =>
        m.map((msg) =>
          msg.id === assistantMsg.id ? { ...msg, text: '（知识库服务暂不可用）' } : msg
        )
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">知识库管理</h2>
        <p className="text-muted-foreground">
          上传文档到 SenseCore 线上知识库，云端自动解析分段，支持知识库问答与来源下载。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Library className="h-5 w-5" />
            文档上传（导入线上知识库）
          </CardTitle>
          <CardDescription>
            支持 .pdf / .docx / .txt / .md 格式，文件将直传到 SenseCore 云端知识库，自动完成解析、分段与向量化。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted-foreground">目标知识库</span>
            <select
              value={targetDatasetId}
              onChange={(e) => setTargetDatasetId(e.target.value)}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="" disabled>
                {datasets.length === 0 ? '暂无线上知识库，请先在下方创建' : '请选择知识库'}
              </option>
              {datasets.map((d) => (
                <option key={d.dataset_id} value={d.dataset_id}>
                  {d.display_name || d.dataset_id}
                </option>
              ))}
            </select>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-10 text-center transition-colors hover:bg-accent/50',
              dragging && 'border-primary bg-accent/50'
            )}
          >
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">
              {file ? (
                <>
                  已选择文件：<span className="text-primary">{file.name}</span>
                </>
              ) : (
                '点击选择或拖拽文件到此处'
              )}
            </div>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={uploading || !file || !targetDatasetId}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              上传到线上知识库
            </Button>
          </div>

          {uploadResult ? (
            <div className="flex flex-col gap-2 rounded-md border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">文档</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{uploadResult.filename}</code>
                <Badge variant={uploadResult.status === 'ok' ? 'default' : 'secondary'}>
                  {uploadResult.status === 'ok' ? '已导入' : '失败'}
                </Badge>
                <span className="text-xs text-muted-foreground">任务 {uploadResult.job_id}</span>
              </div>
              {uploadResult.message ? (
                <p className="text-xs text-muted-foreground">{uploadResult.message}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Library className="h-5 w-5" />
            线上知识库
          </CardTitle>
          <CardDescription>管理 SenseCore 云端的知识库（数据集），可创建 / 删除。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="知识库名称（必填）"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="描述（可选）"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <Button onClick={handleCreateDataset} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              创建
            </Button>
            <Button variant="outline" size="icon" onClick={loadDatasets} disabled={datasetsLoading} title="刷新">
              <RefreshCw className={cn('h-4 w-4', datasetsLoading && 'animate-spin')} />
            </Button>
          </div>

          {datasetsError ? (
            <p className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-700">
              {datasetsError}
            </p>
          ) : null}

          {datasetsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : datasets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {datasetsError ? '暂无可用线上知识库' : '还没有线上知识库，请先创建。'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {datasets.map((d) => (
                <li
                  key={d.dataset_id}
                  className="flex flex-col gap-2 rounded-md border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.display_name || '未命名'}</span>
                        <Badge variant={d.state === 2 ? 'default' : 'secondary'}>
                          {d.state === 2 ? '可用' : d.state === 1 ? '创建中' : '不可用'}
                        </Badge>
                        {d.is_empty ? (
                          <Badge variant="outline">空</Badge>
                        ) : (
                          <Badge variant="secondary">{d.document_count} 篇文档</Badge>
                        )}
                      </div>
                      {d.desc ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.desc}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {d.segment_count} 段 · {d.token_count} tokens
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleDocs(d.dataset_id)}
                    >
                      <FileText className="mr-1 h-3.5 w-3.5" />
                      文档
                      <ChevronDown
                        className={cn(
                          'ml-1 h-3.5 w-3.5 transition-transform',
                          expandedId === d.dataset_id && 'rotate-180'
                        )}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        setConfirmTarget({
                          kind: 'dataset',
                          id: d.dataset_id,
                          name: d.display_name || d.dataset_id
                        })
                      }
                      disabled={deletingId === d.dataset_id}
                    >
                      {deletingId === d.dataset_id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                      )}
                      删除
                    </Button>
                  </div>

                  {expandedId === d.dataset_id ? (
                    <div className="rounded-md border bg-muted/30 p-2">
                      {docsLoading ? (
                        <div className="flex items-center gap-2 p-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          加载文档…
                        </div>
                      ) : (docsMap[d.dataset_id] ?? []).length === 0 ? (
                        <p className="p-1 text-xs text-muted-foreground">该知识库暂无文档。</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {(docsMap[d.dataset_id] ?? []).map((doc) => (
                            <li
                              key={doc.document_id}
                              className="flex flex-wrap items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/50"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {doc.display_name || doc.document_id}
                              </span>
                              <span className="shrink-0 text-muted-foreground">
                                {doc.segment_count} 段 · {(doc.document_size / 1024).toFixed(1)} KB
                              </span>
                              {doc.uri ? (
                                <a
                                  href={doc.uri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                                  title="下载原文"
                                >
                                  <Download className="h-3 w-3" />
                                  下载
                                </a>
                              ) : null}
                              <button
                                type="button"
                                className="inline-flex shrink-0 items-center gap-1 text-destructive hover:underline disabled:opacity-50"
                                onClick={() =>
                                  setConfirmTarget({ kind: 'doc', datasetId: d.dataset_id, doc })
                                }
                                disabled={deletingDocId === doc.document_id}
                              >
                                {deletingDocId === doc.document_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                                删除
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            知识问答
          </CardTitle>
          <CardDescription>基于 SenseCore RAG 发布应用进行知识库问答。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div
            ref={chatScrollRef}
            className="flex max-h-96 min-h-40 flex-col gap-3 overflow-y-auto rounded-md border p-3 text-sm"
          >
            {chatMessages.length === 0 ? (
              <p className="text-muted-foreground">输入问题开始问答，例如“介绍心脏搭桥手术的术前注意事项”。</p>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-1.5">
                  <div
                    className={cn(
                      'max-w-[92%] rounded-lg px-3 py-2',
                      msg.role === 'user'
                        ? 'self-end whitespace-pre-wrap bg-primary text-primary-foreground'
                        : 'self-start bg-muted'
                    )}
                  >
                    {msg.role === 'user' ? (
                      msg.text
                    ) : (
                      <div className="flex flex-col gap-1">
                        {msg.text ? (
                          <Markdown
                            content={msg.text}
                            className={msg.degraded ? 'text-amber-700' : undefined}
                          />
                        ) : msg.reasoning ? (
                          <span className="text-xs text-muted-foreground">正在思考…</span>
                        ) : null}
                        {msg.reasoning ? (
                          <details className="group">
                            <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
                              思考过程
                              <ChevronDown className="ml-1 inline h-3 w-3 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground/80">
                              {msg.reasoning}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 ? (
                    <details className="group w-[92%] self-start rounded-lg border border-muted-foreground/15 bg-card">
                      <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <BookOpen className="h-3.5 w-3.5" />
                        引用来源（{msg.sources.length}）
                        <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="flex flex-col gap-2 border-t border-muted-foreground/10 px-3 py-2">
                        {msg.sources.map((s, j) => (
                          <div key={j} className="rounded-md bg-muted/60 p-2 text-xs">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant="secondary" className="max-w-[60%] truncate">
                                {s.document_name || '未知文档'}
                              </Badge>
                              <span className="ml-auto shrink-0 text-muted-foreground">
                                置信度 {(s.score * 100).toFixed(0)}%
                              </span>
                              {s.uri ? (
                                <a
                                  href={s.uri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                                  title="下载原文"
                                >
                                  <Download className="h-3 w-3" />
                                  下载
                                </a>
                              ) : null}
                            </div>
                            {s.page_content ? (
                              <p className="line-clamp-3 text-muted-foreground">{s.page_content}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {chatError ? <p className="text-sm text-destructive">{chatError}</p> : null}

          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAsk();
              }}
              placeholder="输入问题…"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <Button onClick={handleAsk} disabled={asking || !chatInput.trim()}>
              {asking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              提问
            </Button>
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmTarget !== null}
        title={
          confirmTarget?.kind === 'dataset'
            ? `删除知识库「${confirmTarget.name}」`
            : `删除文档「${confirmTarget?.doc.display_name ?? ''}」`
        }
        description={
          confirmTarget?.kind === 'dataset'
            ? '将删除该线上知识库及其中全部文档，此操作不可恢复。'
            : '将从线上知识库中删除该文档，此操作不可恢复。'
        }
        loading={deletingId !== '' || deletingDocId !== ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
