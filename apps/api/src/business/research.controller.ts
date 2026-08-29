import { Body, Controller, Post } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Audit } from '../audit/audit.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * 科研数据清洗：POST /api/research/clean 转发到 FastAPI /api/research/clean。
 */
@ApiTags('业务-科研数据')
@ApiBearerAuth('access-token')
@Controller('research')
export class ResearchController {
  constructor(private readonly businessService: BusinessService) {}

  @Audit('research.clean')
  @Post('clean')
  @ApiOperation({ summary: '科研数据清洗', description: '提交科研数据，转发至 FastAPI 执行清洗。' })
  clean(@Body() body: Record<string, unknown>) {
    return this.businessService.cleanResearch(body);
  }
}
