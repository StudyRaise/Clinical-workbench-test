import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@repo/db';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      // 全局注册审计拦截器：仅对带 @Audit() 的路由生效
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor
    }
  ],
  exports: [AuditService]
})
export class AuditModule {}
