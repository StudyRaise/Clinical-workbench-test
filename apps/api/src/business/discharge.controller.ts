import { Body, Controller, Post } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Audit } from '../audit/audit.decorator';

/**
 * 出院小结：POST /api/discharge/summarize 转发到 FastAPI /api/discharge/summarize。
 */
@Controller('discharge')
export class DischargeController {
  constructor(private readonly businessService: BusinessService) {}

  @Audit('discharge.summarize')
  @Post('summarize')
  summarize(@Body() body: Record<string, unknown>) {
    return this.businessService.summarizeDischarge(body);
  }
}
