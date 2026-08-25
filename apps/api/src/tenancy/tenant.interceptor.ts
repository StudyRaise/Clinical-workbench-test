import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FindOptionsWhere } from 'typeorm';

/**
 * 多租户工具：把请求上下文中的 facilityId 解析出来。
 * 优先级：JWT 中的 facilityId（req.user.facilityId）> x-tenant-id 请求头 > undefined。
 */
export function getFacilityId(context: ExecutionContext): string | undefined {
  const request = context.switchToHttp().getRequest();
  if (request.user?.facilityId) {
    return request.user.facilityId as string;
  }
  const header = request.headers?.['x-tenant-id'] as string | undefined;
  return header ?? undefined;
}

/**
 * TenantAware 辅助函数：生成带机构过滤条件的 TypeORM where 子句。
 * 说明：packages/db 实体中租户列名为 tenant_id（属性 tenantId），
 * 与 JWT/路由中的 facilityId 是同一语义。因此这里统一将 facilityId
 * 映射为 { tenantId: facilityId }，即可让所有 TypeORM 查询自动带
 * facility_id 过滤，实现多租户硬隔离。业务查询示例：
 *
 *   const where = tenantAwareWhere<User>(facilityId, { role: UserRole.DOCTOR });
 *   return this.users.find({ where });
 */
export function tenantAwareWhere<T extends object>(
  facilityId: string,
  extra: Partial<T> = {}
): FindOptionsWhere<T> {
  return { tenantId: facilityId, ...extra } as unknown as FindOptionsWhere<T>;
}

/**
 * 全局多租户拦截器：在每个请求进入时，从 req.user.facilityId（或 x-tenant-id）
 * 解析出机构 ID 并附加到 request.facilityId，供后续服务/拦截器使用。
 * 配合 tenantAwareWhere 即可保证所有业务查询均被限定在当前机构内。
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const facilityId = getFacilityId(context);
    if (facilityId) {
      request.facilityId = facilityId;
    }
    return next.handle();
  }
}
