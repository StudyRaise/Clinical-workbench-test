import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cacheable';

export interface CacheableOptions {
  /** 缓存过期时间（毫秒），实际生效会叠加随机抖动防雪崩 */
  ttlMs: number;
  /** 缓存命名空间，用于区分不同业务接口，默认取路由路径 */
  namespace?: string;
}

/**
 * @Cacheable({ ttlMs }) 装饰器：标记需要短 TTL 内存缓存的只读 GET 路由。
 * CacheInterceptor 会读取该元数据，按「facility_id + 路由 + 查询参数」做租户隔离缓存。
 * 仅用于明确非 PHI 的只读接口，禁止标注含患者数据的接口。
 */
export const Cacheable = (options: CacheableOptions) => SetMetadata(CACHE_KEY, options);
