import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@repo/db';
import { AuthenticatedUser } from '../auth/auth.interfaces';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

/**
 * 用户接口：
 * - GET /api/users        仅 admin，返回当前机构下所有用户
 * - GET /api/users/me     返回当前登录用户信息
 */
@ApiTags('用户')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: '用户列表', description: '仅 admin 可访问，返回当前机构下的用户列表。' })
  @ApiQuery({ name: 'page', required: false, description: '页码，默认 1' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量，默认 20，最大 100' })
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
  @ApiOperation({ summary: '当前登录用户', description: '返回当前登录用户的详细信息。' })
  findMe(@Req() req: { user: AuthenticatedUser }) {
    return this.usersService.findMe(req.user.userId, req.user.facilityId);
  }
}
