import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@repo/db';

export const ROLES_KEY = 'roles';

/**
 * @Roles('admin') 装饰器：标记路由所需的角色，配合 RolesGuard 使用。
 * 未标记任何角色的受保护路由仅要求登录（JWT 有效）即可访问。
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
