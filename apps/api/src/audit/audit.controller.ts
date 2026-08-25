import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@repo/db';

/**
 * 审计日志查询接口：仅 admin 可访问，分页查询。
 * 路径前缀 /api + 全局前缀：GET /api/audit-logs
 */
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number
  ) {
    const safePage = page > 0 ? page : 1;
    const safeSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;
    return this.auditService.findAll(safePage, safeSize);
  }
}
