import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, LoginInput, RegisterInput } from './auth.service';
import { Public } from '../tenancy/public.decorator';

/**
 * 认证控制器：注册 / 登录均标记 @Public()，由全局 RolesGuard 放行。
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /api/auth/register 注册新用户 */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: RegisterInput) {
    return this.authService.register(body);
  }

  /** POST /api/auth/login 登录，返回 access_token + 用户信息 */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }
}
