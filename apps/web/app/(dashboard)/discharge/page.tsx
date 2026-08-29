'use client';

import { useState } from 'react';
import { CalendarDays, FileText, Loader2, Stethoscope, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { summarizeDischarge, type DischargeSummary } from '@/lib/api';

export default function DischargeSummaryPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DischargeSummary | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await summarizeDischarge(text);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后重试');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">出院随访总结</h2>
        <p className="text-muted-foreground">
          输入出院小结与随访记录，自动生成患者版出院指导与医生版随访计划。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">随访资料输入</CardTitle>
          <CardDescription>请粘贴出院小结或随访记录文本。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'例如：\n患者于 2026-08-20 出院，诊断为胆囊结石，行腹腔镜胆囊切除术……'}
            className="min-h-[240px] leading-relaxed"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={loading || text.trim().length === 0}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中…
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  生成随访总结
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">随访总结结果</CardTitle>
          <CardDescription>分患者版与医生版双视图展示，并给出建议复诊时间。</CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <CalendarDays className="mr-1 h-3 w-3" />
                  建议复诊：{result.followup_date || '未指定'}
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-4">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                    <UserRound className="h-4 w-4" />
                    患者版出院指导
                  </h4>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {result.patient_guide || '暂无内容'}
                  </p>
                </div>

                <div className="rounded-md border border-blue-200 bg-blue-50/40 p-4">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                    <Stethoscope className="h-4 w-4" />
                    医生版随访计划
                  </h4>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {result.doctor_plan || '暂无内容'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              暂无生成结果，请先输入随访资料
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
