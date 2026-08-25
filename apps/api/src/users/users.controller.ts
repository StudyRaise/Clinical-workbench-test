import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@repo/db';
import { AuthenticatedUser } from '../auth/auth.interfaces';

/**
 * 用户接口：
 * - GET /api/users        仅 admin，返回当前机构下所有用户
 * - GET /api/users/me     返回当前登录用户信息
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number
  ) {
    return this.usersService.findAll(
      req.user.facilityId,
      page > 0 ? page : 1,
      pageSize > 0 && pageSize <= 100 ? pageSize : 20
    );
  }

  @Get('me')
  findMe(@Req() req: { user: AuthenticatedUser }) {
    return this.usersService.findMe(req.user.userId, req.user.facilityId);
  }
}
