import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './cache.interceptor';

/**
 * 短 TTL 内存缓存模块（全局）。
 * 提供 @Cacheable() 装饰器 + CacheInterceptor，供只读非 PHI 接口使用。
 */
@Global()
@Module({
  providers: [
    CacheService,
    {
      // 全局注册缓存拦截器：仅对带 @Cacheable() 的路由生效
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor
    }
  ],
  exports: [CacheService]
})
export class CacheModule {}
