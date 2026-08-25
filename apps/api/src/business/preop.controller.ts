import { Body, Controller, Post } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Audit } from '../audit/audit.decorator';

/**
 * 术前评估：POST /api/preop/analyze 转发到 FastAPI /api/preop/analyze。
 */
@Controller('preop')
export class PreopController {
  constructor(private readonly businessService: BusinessService) {}

  @Audit('preop.analyze')
  @Post('analyze')
  analyze(@Body() body: Record<string, unknown>) {
    return this.businessService.analyzePreop(body);
  }
}
