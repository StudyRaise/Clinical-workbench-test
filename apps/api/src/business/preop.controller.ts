import { Body, Controller, Post } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Audit } from '../audit/audit.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * 术前评估：POST /api/preop/analyze 转发到 FastAPI /api/preop/analyze。
 */
@ApiTags('业务-术前评估')
@ApiBearerAuth('access-token')
@Controller('preop')
export class PreopController {
  constructor(private readonly businessService: BusinessService) {}

  @Audit('preop.analyze')
  @Post('analyze')
  @ApiOperation({ summary: '术前评估分析', description: '提交术前评估数据，转发至 FastAPI 分析。' })
  analyze(@Body() body: Record<string, unknown>) {
    return this.businessService.analyzePreop(body);
  }
}
