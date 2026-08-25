'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export default function PreopAnalysisPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleAnalyze = () => {
    setLoading(true);
    // TODO: 接入后端分析接口
    window.setTimeout(() => {
      setResult(
        '分析功能开发中。将在此处展示术前谈话记录的结构化分析结果，包括风险告知充分性、知情同意有效性等要点。'
      );
      setLoading(false);
    }, 800);
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
            placeholder={'例如：\n术者与患者及家属进行术前谈话……'}
            className="min-h-[240px] leading-relaxed"
          />
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
          <CardDescription>结构化分析结果将在此展示。</CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <p className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
              {result}
            </p>
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
