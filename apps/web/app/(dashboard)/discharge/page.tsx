'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export default function DischargeSummaryPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleGenerate = () => {
    setLoading(true);
    // TODO: 接入后端生成接口
    window.setTimeout(() => {
      setResult(
        '生成功能开发中。将在此处展示基于出院小结与随访记录自动生成的结构化随访总结。'
      );
      setLoading(false);
    }, 800);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">出院随访总结</h2>
        <p className="text-muted-foreground">
          输入出院小结与随访记录，自动生成结构化随访总结与后续建议。
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
            placeholder={'例如：\n患者于 2026-08-20 出院，诊断为……'}
            className="min-h-[240px] leading-relaxed"
          />
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
          <CardDescription>生成的随访总结将在此展示。</CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
              {result}
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
