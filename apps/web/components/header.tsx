'use client';

import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { getUser, clearSession } from '@/lib/api';

const titleMap: Record<string, string> = {
  '/': '工作台首页',
  '/preop': '术前谈话记录分析',
  '/discharge': '出院随访总结',
  '/research': '科研数据清洗',
  '/knowledge': '知识库管理',
  '/users': '用户管理',
  '/audit-logs': '审计日志'
};

const roleMap: Record<string, string> = {
  admin: '管理员',
  doctor: '医生',
  nurse: '护士',
  researcher: '科研人员',
  patient: '患者'
};

function getPageTitle(pathname: string): string {
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

function displayName(user: { email: string } | null): string {
  if (!user) return '未登录';
  return user.email.split('@')[0] || user.email;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname);
  const user = getUser();

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {user ? displayName(user).slice(0, 1).toUpperCase() : '医'}
            </span>
            <span className="hidden text-sm font-medium sm:inline">
              {user ? `${displayName(user)}（${roleMap[user.role] ?? user.role}）` : '未登录'}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">{user ? displayName(user) : '未登录'}</p>
            <p className="text-xs font-normal text-muted-foreground">
              {user ? user.email : '-'}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            个人资料
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
