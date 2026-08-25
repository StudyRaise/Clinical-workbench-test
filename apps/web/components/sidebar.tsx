'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Mic,
  FileText,
  Database,
  Library,
  Users,
  Activity,
  type LucideIcon
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { title: '工作台首页', href: '/', icon: LayoutDashboard },
  { title: '术前谈话分析', href: '/preop', icon: Mic },
  { title: '出院随访总结', href: '/discharge', icon: FileText },
  { title: '科研数据清洗', href: '/research', icon: Database },
  { title: '知识库管理', href: '/knowledge', icon: Library },
  { title: '用户管理', href: '/users', icon: Users }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="h-4 w-4" />
        </div>
        <span className="text-lg font-semibold tracking-tight">临床AI工作台</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="p-3">
        <Separator className="mb-3" />
        <div className="px-3 py-2 text-xs text-muted-foreground">
          临床科研智能工作台
        </div>
      </div>
    </aside>
  );
}
