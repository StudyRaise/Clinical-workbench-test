import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { AuditModule } from './audit/audit.module';
import { CryptoModule } from './crypto/crypto.module';
import { UsersModule } from './users/users.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { BusinessModule } from './business/business.module';
import { InferenceModule } from './inference/inference.module';
import { TenancyModule } from './tenancy/tenancy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 120
      }
    ]),
    DatabaseModule,
    AuthModule,
    AuditModule,
    CryptoModule,
    UsersModule,
    KnowledgeModule,
    BusinessModule,
    TenancyModule,
    InferenceModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // 全局 RBAC 守卫：JWT 认证 + @Roles() 角色校验，@Public() 放行
      provide: APP_GUARD,
      useClass: RolesGuard
    }
  ]
})
export class AppModule {}
