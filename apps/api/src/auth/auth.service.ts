import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Tenant, User, UserRole } from '@repo/db';
import { JwtPayload } from './auth.interfaces';

/** 注册请求体 */
export interface RegisterInput {
  email: string;
  password: string;
  /** 机构（租户）ID，多租户隔离依据 */
  facilityId?: string;
  role?: UserRole;
  name?: string;
}

/** 登录请求体 */
export interface LoginInput {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly jwtService: JwtService
  ) {}

  /** 注册：bcrypt 哈希密码后落库，默认角色 patient、默认机构 public */
  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('该邮箱已被注册');
    }

    const facilityId = input.facilityId ?? 'public';
    const role = input.role ?? UserRole.PATIENT;
    const passwordHash = await bcrypt.hash(input.password, 10);

    // 若机构（租户）不存在则自动创建，避免外键约束导致注册失败
    await this.ensureTenant(facilityId);

    const user = this.users.create({
      id: randomUUID(),
      tenantId: facilityId, // 实体列名为 tenant_id，与 facilityId 同一语义
      email,
      role,
      passwordHash
    });
    await this.users.save(user);

    const accessToken = await this.signToken(user.id, facilityId, role);
    return { access_token: accessToken, user: this.toPublicUser(user) };
  }

  /** 确保租户存在：不存在则创建，返回 true 表示新建 */
  private async ensureTenant(facilityId: string): Promise<boolean> {
    const exists = await this.tenants.findOne({ where: { id: facilityId } });
    if (exists) {
      return false;
    }
    await this.tenants.save(
      this.tenants.create({ id: facilityId, name: facilityId })
    );
    return true;
  }

  /** 登录：校验密码后签发 JWT */
  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const accessToken = await this.signToken(user.id, user.tenantId, user.role);
    return { access_token: accessToken, user: this.toPublicUser(user) };
  }

  /** 签发 JWT：payload 含 userId(sub) / facilityId / role */
  private signToken(userId: string, facilityId: string, role: UserRole) {
    const payload: JwtPayload = { sub: userId, facilityId, role };
    return this.jwtService.signAsync(payload);
  }

  /** 对外输出用户信息，避免泄露 password_hash */
  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      facilityId: user.tenantId
    };
  }
}
