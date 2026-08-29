'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { analyzePreop, type PreopReport } from '@/lib/api';

export default function PreopAnalysisPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PreopReport | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await analyzePreop(text);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败，请稍后重试');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">术前谈话记录分析</h2>
        <p className="text-muted-foreground">
          粘贴术前谈话记录，AI 将自动提取关键信息并评估风险告知与知情同意的充分性。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">谈话记录输入</CardTitle>
          <CardDescription>请粘贴或输入术前谈话的原始记录文本。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'例如：\n术者与患者及家属进行术前谈话，告知拟行腹腔镜胆囊切除术……'}
            className="min-h-[240px] leading-relaxed"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={loading || text.trim().length === 0}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分析中…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  开始分析
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">分析结果</CardTitle>
          <CardDescription>结构化分析结果：手术方案、风险告知、知情同意与完整性评分。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {result ? (
            <>
              {result.degraded ? (
                <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-800">
                  本次未生成 AI 分析结果：{result.reason || 'AI 服务暂不可用'}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">拟实施手术</span>
                  <Badge variant="secondary" className="text-sm">
                    {result.surgery || '未识别'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">完整度评分</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      result.score >= 80
                        ? 'bg-emerald-100 text-emerald-700'
                        : result.score >= 60
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {result.score.toFixed(0)} / 100
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border p-4">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    手术风险
                  </h4>
                  {result.risks.length > 0 ? (
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {result.risks.map((risk, i) => (
                        <li key={i}>{risk}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">未识别到明确风险项</p>
                  )}
                </div>

                <div className="rounded-md border p-4">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                    <CheckCircle2 className="h-4 w-4" />
                    替代方案
                  </h4>
                  {result.alternatives.length > 0 ? (
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {result.alternatives.map((alt, i) => (
                        <li key={i}>{alt}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">未识别到替代方案</p>
                  )}
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h4 className="mb-2 text-sm font-semibold">知情同意要点</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {result.consent || '未识别到知情同意要点'}
                </p>
              </div>

              <div className="rounded-md border border-red-200 bg-red-50/50 p-4">
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  缺失 / 需补充项
                </h4>
                {result.missing_items.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
                    {result.missing_items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-emerald-700">未发现明显缺失项</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              暂无分析结果，请先输入谈话记录
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
