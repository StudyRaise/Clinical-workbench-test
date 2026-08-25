import { Body, Controller, Post } from '@nestjs/common';
import { InferenceService } from './inference.service';
import { CompletionRequest } from './interfaces';
import { Tenant } from '../tenancy/tenant.decorator';
import { TenantContext } from '@repo/contracts';

@Controller('inference')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Post('completions')
  async createCompletion(@Body() body: CompletionRequest, @Tenant() tenant: TenantContext) {
    return this.inferenceService.runCompletion({
      ...body,
      tenantId: tenant.tenantId
    });
  }
}
