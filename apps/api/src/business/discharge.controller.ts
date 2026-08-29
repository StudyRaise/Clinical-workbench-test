import { Body, Controller, Post } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Audit } from '../audit/audit.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * 出院小结：POST /api/discharge/summarize 转发到 FastAPI /api/discharge/summarize。
 */
@ApiTags('业务-出院小结')
@ApiBearerAuth('access-token')
@Controller('discharge')
export class DischargeController {
  constructor(private readonly businessService: BusinessService) {}

  @Audit('discharge.summarize')
  @Post('summarize')
  @ApiOperation({ summary: '生成出院小结', description: '提交病历数据，转发至 FastAPI 生成出院小结。' })
  summarize(@Body() body: Record<string, unknown>) {
    return this.businessService.summarizeDischarge(body);
  }
}
