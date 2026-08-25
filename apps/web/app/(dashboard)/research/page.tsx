'use client';

import { useState, useCallback } from 'react';
import { FileUp, Loader2, UploadCloud } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const cleaningOptions = [
  { id: 'missing', label: '处理缺失值', description: '按列策略填充或删除缺失记录' },
  { id: 'duplicate', label: '去除重复记录', description: '基于关键字段去重' },
  { id: 'outlier', label: '异常值检测', description: '识别并标记超出合理范围的数值' },
  { id: 'format', label: '统一格式', description: '标准化日期、单位、编码等字段格式' }
];

export default function ResearchCleaningPage() {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(['missing', 'duplicate']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleFiles = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      setFileName(file.name);
    }
  }, []);

  const toggleOption = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleClean = () => {
    setLoading(true);
    // TODO: 接入后端清洗接口
    window.setTimeout(() => {
      setResult(
        '清洗功能开发中。将在此处展示清洗结果统计（处理记录数、清理项明细）与下载链接。'
      );
      setLoading(false);
    }, 800);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">科研数据清洗</h2>
        <p className="text-muted-foreground">
          上传科研数据文件并配置清洗规则，输出结构化、可复用的干净数据。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">数据文件上传</CardTitle>
          <CardDescription>支持 CSV、Excel 等常见格式（占位，尚未接入后端存储）。</CardDescription>
        </CardHeader>
        <CardContent>
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
              支持 .csv / .xlsx 等格式，单个文件不超过 50MB
            </p>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">清洗配置</CardTitle>
          <CardDescription>勾选需要执行的清洗步骤。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {cleaningOptions.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors hover:bg-accent/50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.id)}
                  onChange={() => toggleOption(option.id)}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              已选择 {selected.length} 项清洗规则
            </span>
            <Button onClick={handleClean} disabled={loading || selected.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  清洗中…
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  开始清洗
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">清洗结果</CardTitle>
          <CardDescription>清洗统计与结果文件将在此展示。</CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
              {result}
            </div>
          ) : (
            <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              暂无清洗结果，请先上传数据文件并配置清洗规则
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
