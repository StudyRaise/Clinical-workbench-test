import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

interface CacheEntry {
  /** 缓存的数据 */
  value: unknown;
  /** 过期时间戳（毫秒） */
  expiresAt: number;
}

/**
 * 短 TTL 进程内内存缓存服务。
 * - 仅用于明确非 PHI 的只读接口响应
 * - TTL 叠加随机抖动，防止大量 key 同时过期引发回源雪崩
 * - 进程重启即失效，可接受（重启后回源重建）
 *
 * 注意：单实例部署适用；后续多实例需替换为 Redis 等分布式缓存。
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry>();
  /** 过期清理定时器 */
  private readonly sweeper: NodeJS.Timeout;

  /** 默认清理间隔：60s 扫描一次过期 key */
  private static readonly SWEEP_INTERVAL_MS = 60_000;
  /** TTL 抖动比例：±10%，避免同一批 key 同时过期 */
  private static readonly TTL_JITTER_RATIO = 0.1;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), CacheService.SWEEP_INTERVAL_MS);
    // 不阻塞进程退出
    this.sweeper.unref();
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
    this.store.clear();
  }

  /**
   * 读取缓存。命中且未过期返回 value，否则返回 undefined。
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  /**
   * 写入缓存，TTL 自动叠加 ±10% 随机抖动。
   */
  set(key: string, value: unknown, ttlMs: number): void {
    const jitter = ttlMs * CacheService.TTL_JITTER_RATIO * (Math.random() * 2 - 1);
    const effectiveTtl = Math.max(1, ttlMs + jitter);
    this.store.set(key, { value, expiresAt: Date.now() + effectiveTtl });
  }

  /**
   * 按前缀删除缓存（用于写操作后使相关缓存失效）。
   */
  invalidateByPrefix(prefix: string): number {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  /** 清理所有过期 key */
  private sweep(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.logger.debug(`缓存过期清理: 移除 ${removed} 个 key`);
    }
  }
}
