import { Injectable, Logger } from '@nestjs/common';
import { createLLMClient } from '@repo/llm-clients';
import { GuardrailService } from '@repo/guardrails';
import { tokenBudgetPolicy } from '@repo/costs';
import { TenancyService } from '../tenancy/tenancy.service';
import { CompletionRequest, CompletionResponse } from './interfaces';

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);
  private readonly guardrail = new GuardrailService();

  constructor(private readonly tenancyService: TenancyService) {}

  async runCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    // 懒加载：确保调用时 NestJS 已完成 .env -> process.env 注入，
    // 否则模块加载期读取不到 LLM_PROVIDER / SENSENOVA_API_KEY
    const llmClient = createLLMClient();
    const tenant = this.tenancyService.resolveTenant(request.tenantId);
    const budget = tokenBudgetPolicy.create({
      tenantId: tenant.tenantId,
      monthlyBudgetUsd: tenant.plan === 'enterprise' ? 500 : 50
    });

    if (this.guardrail.shouldReject(request.prompt)) {
      return {
        promptHash: request.promptHash,
        outputText: '',
        rejected: true,
        reason: 'safety_filter'
      };
    }

    this.logger.log(`Routing completion for tenant=${tenant.tenantId} model=${request.model}`);

    const result = await llmClient.complete({
      model: request.model,
      prompt: request.prompt,
      metadata: {
        promptHash: request.promptHash,
        tenant: tenant.tenantId,
        budget
      }
    });

    return {
      promptHash: request.promptHash,
      outputText: result.outputText,
      usage: result.usage
    };
  }
}
