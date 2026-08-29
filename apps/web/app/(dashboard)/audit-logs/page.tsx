'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ScrollText, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchAuditLogs, getUser, type AuditLogItem } from '@/lib/api';

const PAGE_SIZE = 20;

function formatTime(value?: string): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return value;
  }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const me = getUser();
  const isAdmin = me?.role === 'admin';

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAuditLogs(p, PAGE_SIZE);
      setLogs((data.items ?? data.data ?? []) as AuditLogItem[]);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载审计日志失败');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      load(page);
    } else {
      setLoading(false);
    }
  }, [isAdmin, page, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-3 py-24 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">无访问权限</h2>
        <p className="text-sm text-muted-foreground">审计日志仅对管理员（admin）角色开放。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">审计日志</h2>
        <p className="text-muted-foreground">系统关键操作的追加式审计记录（保留 6 年），仅管理员可见。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5" />
            操作日志
          </CardTitle>
          <CardDescription>共 {total} 条记录</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[160px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : logs.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 font-medium">时间</th>
                      <th className="px-3 py-2 font-medium">操作</th>
                      <th className="px-3 py-2 font-medium">对象</th>
                      <th className="px-3 py-2 font-medium">用户</th>
                      <th className="px-3 py-2 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-t">
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {formatTime(log.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{log.action}</Badge>
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2" title={log.target}>
                          {log.target || '-'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{log.userId?.slice(0, 8)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{log.ip || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  第 {page} / {totalPages} 页
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    上一页
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    下一页
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              暂无审计日志
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
