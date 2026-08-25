import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TenancyService } from './tenancy.service';
import { TenantGuard } from './tenant.guard';
import { TenantInterceptor } from './tenant.interceptor';

@Module({
  providers: [
    TenancyService,
    {
      provide: APP_GUARD,
      useClass: TenantGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor
    }
  ],
  exports: [TenancyService]
})
export class TenancyModule {}
