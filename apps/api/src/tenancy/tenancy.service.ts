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

  validateOnboarding(payload: unknown) {
    return SaaSOnboardingSchema.parse(payload);
  }
}
