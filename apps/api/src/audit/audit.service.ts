import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AuditLog } from '@repo/db';

/** 审计日志追加写入的载荷 */
export interface AuditEntry {
  userId: string;
  action: string;
  target: string;
  ip: string;
}

/** 审计日志保留 6 年（天） */
export const AUDIT_RETENTION_DAYS = 365 * 6;

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>
  ) {}

  /** 追加写入一条审计日志（只追加，不修改/删除既有记录） */
  async create(entry: AuditEntry): Promise<AuditLog> {
    const log = this.auditLogs.create({
      id: randomUUID(),
      userId: entry.userId,
      action: entry.action,
      target: entry.target,
      ip: entry.ip
    });
    return this.auditLogs.save(log);
  }

  /** 只读查询接口：分页查询（当前 AuditLog 实体无 tenant_id 列，由 admin 路由控制访问） */
  async findAll(page = 1, pageSize = 20) {
    const [items, total] = await this.auditLogs.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    return { items, total, page, pageSize };
  }

  /** 清理超过保留期（6 年）的过期审计日志，可交由定时任务调用 */
  async pruneExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.auditLogs
      .createQueryBuilder('log')
      .delete()
      .where('log.created_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  /** 按 ID 查询单条（只读） */
  async findOne(id: string): Promise<AuditLog> {
    const log = await this.auditLogs.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException('审计日志不存在');
    }
    return log;
  }
}
