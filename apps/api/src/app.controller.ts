import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './tenancy/public.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('系统')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: '健康检查', description: '无需认证，返回服务运行状态。' })
  getHealth() {
    return this.appService.getHealth();
  }
}
