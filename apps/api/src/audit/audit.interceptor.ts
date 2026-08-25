import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AUDIT_KEY } from './audit.decorator';
import { AuthenticatedUser } from '../auth/auth.interfaces';

/**
 * 审计拦截器：对标记了 @Audit('action') 的路由自动写入审计日志。
 * 记录 userId / action / target(路由路径) / ip，仅在请求成功返回后写入。
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const ip = (request.ip as string) ?? 'unknown';

    return next.handle().pipe(
      map((result) => {
        // 请求成功后异步写入审计日志；失败不阻塞业务返回
        void this.auditService
          .create({
            userId: user?.userId ?? 'anonymous',
            action,
            target: request.originalUrl ?? request.url ?? '',
            ip
          })
          .catch((err: Error) => this.logger.warn(`审计日志写入失败: ${err.message}`));
        return result;
      })
    );
  }
}
