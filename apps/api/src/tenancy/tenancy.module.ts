import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenancyService } from './tenancy.service';
import { TenantGuard } from './tenant.guard';

@Module({
  providers: [
    TenancyService,
    {
      provide: APP_GUARD,
      useClass: TenantGuard
    }
  ],
  exports: [TenancyService]
})
export class TenancyModule {}
