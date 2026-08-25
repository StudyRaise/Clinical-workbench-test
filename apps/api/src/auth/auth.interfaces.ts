import { UserRole } from '@repo/db';

/**
 * JWT payload 结构：sub 为 userId，facilityId 为租户/机构标识，role 为角色。
 */
export interface JwtPayload {
  /** 用户 ID */
  sub: string;
  /** 机构（租户）ID，用于多租户硬隔离 */
  facilityId: string;
  /** 用户角色 */
  role: UserRole;
}

/**
 * 认证成功后挂到 req.user 上的用户信息。
 */
export interface AuthenticatedUser {
  userId: string;
  facilityId: string;
  role: UserRole;
  email?: string;
}
