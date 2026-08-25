import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'auditAction';

/**
 * @Audit('preop.analyze') 装饰器：标记需要记录审计日志的路由。
 * AuditInterceptor 会读取该元数据，在请求成功后写入 audit_log。
 */
export const Audit = (action: string) => SetMetadata(AUDIT_KEY, action);
