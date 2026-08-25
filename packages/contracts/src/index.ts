import { z } from 'zod';

export const TenantContextSchema = z.object({
  tenantId: z.string(),
  plan: z.enum(['free', 'pro', 'enterprise']),
  seats: z.number().int().nonnegative(),
  features: z.array(z.string())
});

export type TenantContext = z.infer<typeof TenantContextSchema>;

export const SaaSOnboardingSchema = z.object({
  tenantId: z.string(),
  plan: z.enum(['free', 'pro', 'enterprise']),
  seats: z.number().int().positive(),
  features: z.array(z.string())
});

export const CompletionResponseSchema = z.object({
  promptHash: z.string(),
  outputText: z.string(),
  usage: z.record(z.any()).optional(),
  rejected: z.boolean().optional(),
  reason: z.string().optional()
});

export type CompletionResponse = z.infer<typeof CompletionResponseSchema>;
