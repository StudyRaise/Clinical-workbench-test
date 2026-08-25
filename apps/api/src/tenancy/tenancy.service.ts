import { Injectable } from '@nestjs/common';
import { SaaSOnboardingSchema, TenantContext } from '@repo/contracts';

@Injectable()
export class TenancyService {
  resolveTenant(rawTenantId?: string): TenantContext {
    const tenantId = rawTenantId ?? 'public';
    return {
      tenantId,
      plan: tenantId === 'public' ? 'free' : 'enterprise',
      seats: tenantId === 'public' ? 1 : 50,
      features: ['inference', 'rag', 'analytics']
    };
  }

  /**
   * 从 JWT 用户上下文（req.user.facilityId）解析租户。
   * facilityId 与实体中的 tenantId 为同一语义。
   */
  resolveFromRequest(facilityId?: string): TenantContext {
    return this.resolveTenant(facilityId);
  }

  validateOnboarding(payload: unknown) {
    return SaaSOnboardingSchema.parse(payload);
  }
}
