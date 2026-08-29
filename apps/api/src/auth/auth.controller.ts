import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, LoginInput, RegisterInput } from './auth.service';
import { Public } from '../tenancy/public.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

/**
 * 认证控制器：注册 / 登录均标记 @Public()，由全局 RolesGuard 放行。
 */
@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /api/auth/register 注册新用户 */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '注册新用户', description: '注册成功后直接返回 access_token 与用户信息。' })
  register(@Body() body: RegisterInput) {
    return this.authService.register(body);
  }

  /** POST /api/auth/login 登录，返回 access_token + 用户信息 */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录', description: '使用邮箱密码登录，返回 access_token 与用户信息。' })
  login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }
}
