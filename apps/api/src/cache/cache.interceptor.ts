import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { CACHE_KEY, CacheableOptions } from './cache.decorator';
import { CacheService } from './cache.service';
import { getFacilityId } from '../tenancy/tenant.interceptor';

/**
 * 缓存拦截器：对标记了 @Cacheable({ ttlMs }) 的只读 GET 路由做短 TTL 内存缓存。
 *
 * 安全约束（红线）：
 * - 缓存 key 强制包含 facility_id，跨租户数据硬隔离，绝不串租户
 * - 仅用于明确非 PHI 的只读接口
 * - 未登录 / 无租户上下文时不缓存（降级为直接透传）
 *
 * 性能约束：
 * - 单飞（single-flight）：同一 key 的并发请求只回源一次，其余等待共享结果，
 *   防止缓存未命中时高频刷新打爆下游
 * - 手动刷新：请求头 x-cache-bust: 1 时绕过缓存强制实时拉取
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  /** 进行中的回源 Promise，用于单飞 */
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<CacheableOptions | undefined>(CACHE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    // 未标注 @Cacheable 直接放行
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    // 仅缓存 GET 请求（写操作不缓存）
    if (request.method !== 'GET') {
      return next.handle();
    }

    // 租户隔离：无法解析 facility_id 时不缓存，避免跨租户污染
    const facilityId = getFacilityId(context);
    if (!facilityId) {
      return next.handle();
    }

    const key = this.buildKey(facilityId, request, options);

    // 手动刷新绕过缓存
    const bust = request.headers?.['x-cache-bust'];
    if (!bust) {
      const cached = this.cacheService.get(key);
      if (cached !== undefined) {
        return of(cached);
      }
    }

    // 单飞：同一 key 并发只回源一次
    return from(this.singleFlight(key, () => this.resolveNext(next), options.ttlMs));
  }

  /**
   * 把 Nest 的 Observable 结果转成 Promise 并写入缓存。
   */
  private resolveNext(next: CallHandler): Promise<unknown> {
    return new Promise((resolvePromise, rejectPromise) => {
      const subscription = next.handle().subscribe({
        next: (value) => resolvePromise(value),
        error: (err) => rejectPromise(err)
      });
      // Observable 同步完成时也要能退订
      void subscription;
    });
  }

  /**
   * 单飞实现：同一 key 的并发请求共享同一个回源 Promise。
   */
  private async singleFlight(
    key: string,
    fetcher: () => Promise<unknown>,
    ttlMs: number
  ): Promise<unknown> {
    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      try {
        const value = await fetcher();
        this.cacheService.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * 构造缓存 key：facility_id + 命名空间 + 路由路径 + 序列化查询参数。
   * 租户 ID 置于最前，保证同前缀失效操作天然按租户隔离。
   */
  private buildKey(
    facilityId: string,
    request: { originalUrl?: string; url?: string; query?: Record<string, unknown> },
    options: CacheableOptions
  ): string {
    const path = request.originalUrl ?? request.url ?? '';
    const query = this.stableStringify(request.query ?? {});
    const namespace = options.namespace ?? path.split('?')[0];
    return `${facilityId}:${namespace}:${query}`;
  }

  /**
   * 稳定序列化查询参数（按 key 排序），保证同一参数集生成同一 key。
   */
  private stableStringify(obj: Record<string, unknown>): string {
    const keys = Object.keys(obj).sort();
    if (keys.length === 0) return '';
    return keys.map((k) => `${k}=${String(obj[k])}`).join('&');
  }
}
