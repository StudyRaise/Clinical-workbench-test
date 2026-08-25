import { Body, Controller, Post } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Audit } from '../audit/audit.decorator';

/**
 * 科研数据清洗：POST /api/research/clean 转发到 FastAPI /api/research/clean。
 */
@Controller('research')
export class ResearchController {
  constructor(private readonly businessService: BusinessService) {}

  @Audit('research.clean')
  @Post('clean')
  clean(@Body() body: Record<string, unknown>) {
    return this.businessService.cleanResearch(body);
  }
}
