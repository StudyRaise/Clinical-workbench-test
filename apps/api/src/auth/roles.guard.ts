import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@repo/db';
import { IS_PUBLIC_KEY } from '../tenancy/public.decorator';
import { ROLES_KEY } from './roles.decorator';

/**
 * 全局 RBAC 守卫：继承 Passport JWT 认证守卫。
 * - 带 @Public() 的路由直接放行（不执行 JWT 认证）。
 * - 其余路由先执行 JWT 认证填充 req.user，再按 @Roles() 元数据做角色校验。
 * 支持 5 个角色：admin / doctor / nurse / researcher / patient。
 */
@Injectable()
export class RolesGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }

    // 执行 Passport JWT 策略，认证通过后 req.user 会被填充
    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      return false;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    // 未声明 @Roles() 时：仅要求已登录
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: UserRole } | undefined;
    if (!user || !user.role || !requiredRoles.includes(user.role)) {
      throw new UnauthorizedException('权限不足：当前角色无权访问该资源');
    }
    return true;
  }
}
