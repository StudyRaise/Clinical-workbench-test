import { z } from 'zod';

const policySchema = z.object({
  blockList: z.array(z.string()).default(['hack', 'password leak']),
  allowList: z.array(z.string()).default([])
});

export class GuardrailService {
  private readonly policy = policySchema.parse({});

  shouldReject(text: string): boolean {
    const lowered = text.toLowerCase();
    if (this.policy.allowList.some((term) => lowered.includes(term.toLowerCase()))) {
      return false;
    }
    return this.policy.blockList.some((term) => lowered.includes(term.toLowerCase()));
  }
}

export function createGuardrailService() {
  return new GuardrailService();
}
