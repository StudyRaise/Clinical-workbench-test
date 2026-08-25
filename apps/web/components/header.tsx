'use client';

import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const titleMap: Record<string, string> = {
  '/': '工作台首页',
  '/preop': '术前谈话记录分析',
  '/discharge': '出院随访总结',
  '/research': '科研数据清洗',
  '/knowledge': '知识库管理',
  '/users': '用户管理'
};

function getPageTitle(pathname: string): string {
  // 精确匹配优先，其次取最长前缀匹配
  if (titleMap[pathname]) {
    return titleMap[pathname];
  }
  const keys = Object.keys(titleMap)
    .filter((key) => key !== '/' && pathname.startsWith(key))
    .sort((a, b) => b.length - a.length);
  if (keys.length > 0) {
    return titleMap[keys[0]];
  }
  return '工作台';
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              医
            </span>
            <span className="hidden text-sm font-medium sm:inline">临床医生</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">临床医生</p>
            <p className="text-xs font-normal text-muted-foreground">doctor@example.com</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            个人资料
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            账户设置
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
