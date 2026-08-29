'use client';

import { useState } from 'react';
import { FileUp, Loader2, UploadCloud } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cleanResearch, type CleanResult } from '@/lib/api';

const MAX_RECORDS = 20;

/** 把文件文本切分为待清洗记录（按空行分段，限制条数） */
function splitTexts(content: string): string[] {
  const blocks = content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  const lines = blocks.length > 0 ? blocks : content.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, MAX_RECORDS);
}

export default function ResearchCleaningPage() {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CleanResult | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const fullContent = await file.text();
      setContent(fullContent);
      setRecordCount(splitTexts(fullContent).length);
    } catch {
      setContent('');
      setRecordCount(0);
    }
  };

  const handleClean = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await cleanResearch(splitTexts(content));
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '清洗失败，请稍后重试');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const tableColumns = result?.schema_fields ?? [];
  const allFields = result?.records.flatMap((r) => r.fields) ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">科研数据清洗</h2>
        <p className="text-muted-foreground">
          上传科研数据文件（TXT/CSV），AI 自动抽取结构化字段并给出置信度。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">数据文件上传</CardTitle>
          <CardDescription>支持 .txt / .csv 文本格式，按空行分段作为独立记录，最多 {MAX_RECORDS} 条。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
              accept=".txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">
              {fileName ? (
                <>
                  已选择文件：<span className="text-primary">{fileName}</span>
                </>
              ) : (
                '点击选择或拖拽文件到此处'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              支持 .txt / .csv 格式，单个文件不超过 50MB
            </p>
          </label>

          {content ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">文件预览</span>
                <span className="text-xs font-medium text-primary">{recordCount} 条记录</span>
              </div>
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                {content.slice(0, 500)}
              </pre>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end">
            <Button onClick={handleClean} disabled={loading || recordCount === 0}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  清洗中…
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  开始清洗（{recordCount} 条）
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">清洗结果</CardTitle>
          <CardDescription>结构化字段抽取结果，含置信度评分。</CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {tableColumns.map((field) => (
                  <span
                    key={field}
                    className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {field}
                  </span>
                ))}
                {tableColumns.length === 0 ? (
                  <span className="text-sm text-muted-foreground">未识别到标准字段字典</span>
                ) : null}
              </div>

              {result.records.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 font-medium">记录</th>
                        {tableColumns.map((field) => (
                          <th key={field} className="px-3 py-2 font-medium">
                            {field}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.records.map((record) => {
                        const fieldMap = new Map(record.fields.map((f) => [f.field, f]));
                        return (
                          <tr key={record.source_index} className="border-t">
                            <td className="px-3 py-2 text-muted-foreground">
                              #{record.source_index + 1}
                            </td>
                            {tableColumns.map((field) => {
                              const item = fieldMap.get(field);
                              return (
                                <td key={field} className="px-3 py-2">
                                  {item && item.value ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span>{item.value}</span>
                                      <span className="text-xs text-muted-foreground">
                                        置信度 {(item.confidence * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  {recordCount > 0
                    ? '未抽取到字段（可能无可用 LLM 服务）'
                    : '暂无清洗结果，请先上传数据文件'}
                </div>
              )}

              {allFields.length > 0 ? (
                <div className="text-xs text-muted-foreground">
                  共抽取 {allFields.length} 个字段值
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              暂无清洗结果，请先上传数据文件
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
