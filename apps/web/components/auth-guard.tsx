'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { isAuthenticated } from '@/lib/api';

/**
 * 路由守卫：未登录时跳转 /login，已登录时渲染子内容。
 * 需作为 client 组件使用（读取 localStorage）。
 * 通过 mounted 标记保证服务端与客户端首次渲染一致（均为 null），避免水合错误。
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  if (!mounted || !isAuthenticated()) {
    return null;
  }
  return <>{children}</>;
}
