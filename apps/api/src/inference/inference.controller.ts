import { Body, Controller, Post } from '@nestjs/common';
import { InferenceService } from './inference.service';
import { CompletionRequest } from './interfaces';
import { Tenant } from '../tenancy/tenant.decorator';
import { TenantContext } from '@repo/contracts';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('推理')
@ApiBearerAuth('access-token')
@Controller('inference')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Post('completions')
  @ApiOperation({ summary: '模型推理补全', description: '调用 LLM 完成推理补全，tenant 由认证上下文自动注入。' })
  async createCompletion(@Body() body: CompletionRequest, @Tenant() tenant: TenantContext) {
    return this.inferenceService.runCompletion({
      ...body,
      tenantId: tenant.tenantId
    });
  }
}
