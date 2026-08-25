import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Tenant,
  User,
  Document,
  DocumentChunk,
  AuditLog,
  PreopReport,
  DischargeSummary,
  ResearchRecord,
  ResearchVariable
} from '@repo/db';

/**
 * 数据库模块：连接 MySQL，实体来自 @repo/db（packages/db）。
 * 连接参数通过环境变量读取，charset 使用 utf8mb4 以支持中文与 emoji。
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USER', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'clinical_workbench'),
        // 显式注册全部实体；autoLoadEntities 允许各业务模块通过 forFeature 动态加载
        entities: [
          Tenant,
          User,
          Document,
          DocumentChunk,
          AuditLog,
          PreopReport,
          DischargeSummary,
          ResearchRecord,
          ResearchVariable
        ],
        autoLoadEntities: true,
        charset: 'utf8mb4',
        // 生产环境应关闭，交由迁移管理
        synchronize: true,
        logging: config.get<string>('DB_LOGGING', 'false') === 'true'
      })
    })
  ]
})
export class DatabaseModule {}
