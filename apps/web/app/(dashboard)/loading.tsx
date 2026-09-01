import { Skeleton } from '@/components/ui/skeleton';

/**
 * Dashboard 路由组全局骨架屏。
 * 路由切换 / 刷新时立即渲染，消除整页白屏。
 * 纯展示，无数据逻辑——各页面数据仍在客户端异步拉取填充。
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* 标题区骨架 */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      {/* 内容卡片区骨架 */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-lg border p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}
