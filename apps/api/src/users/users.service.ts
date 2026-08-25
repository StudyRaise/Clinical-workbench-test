import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@repo/db';
import { tenantAwareWhere } from '../tenancy/tenant.interceptor';

/**
 * 用户服务：所有查询均限定在当前机构（facilityId=tenantId）内，
 * 实现多租户硬隔离，且只返回安全字段。
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>
  ) {}

  /** 查询当前机构下的用户列表（分页） */
  async findAll(facilityId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.users.findAndCount({
      where: tenantAwareWhere<User>(facilityId),
      order: { email: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    return { items: items.map((u) => this.toPublicUser(u)), total, page, pageSize };
  }

  /** 查询当前登录用户信息（自带机构过滤） */
  async findMe(userId: string, facilityId: string) {
    const user = await this.users.findOne({
      where: { id: userId, ...tenantAwareWhere<User>(facilityId) }
    });
    return user ? this.toPublicUser(user) : null;
  }

  /** 对外输出，隐藏 password_hash */
  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      facilityId: user.tenantId
    };
  }
}
