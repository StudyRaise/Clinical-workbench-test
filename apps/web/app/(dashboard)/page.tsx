import Link from 'next/link';
import { Mic, FileText, Database, ArrowRight } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ModuleCard {
  title: string;
  description: string;
  href: string;
  icon: typeof Mic;
  action: string;
}

const modules: ModuleCard[] = [
  {
    title: '术前谈话分析',
    description: '上传术前谈话记录，智能提取关键信息，分析风险告知是否充分、知情同意是否到位。',
    href: '/preop',
    icon: Mic,
    action: '进入分析'
  },
  {
    title: '出院随访总结',
    description: '基于出院小结与随访记录，自动生成结构化随访总结与后续建议。',
    href: '/discharge',
    icon: FileText,
    action: '进入生成'
  },
  {
    title: '科研数据清洗',
    description: '对临床科研数据进行缺失值、异常值、重复记录等清洗处理，输出可复用的结构化数据。',
    href: '/research',
    icon: Database,
    action: '进入清洗'
  }
];

export default function DashboardHomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-semibold tracking-tight">欢迎回来</h2>
        <p className="text-muted-foreground">
          选择下方功能模块，开始您的临床科研工作。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.href} className="flex flex-col transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <module.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{module.title}</CardTitle>
              <CardDescription className="leading-relaxed">
                {module.description}
              </CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <Button asChild className="w-full" variant="outline">
                <Link href={module.href} className="flex items-center justify-center gap-2">
                  {module.action}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
