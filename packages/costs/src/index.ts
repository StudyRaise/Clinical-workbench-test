export interface TokenBudgetInput {
  tenantId?: string;
  monthlyBudgetUsd: number;
  softLimitRatio?: number;
  hardLimitRatio?: number;
}

export interface TokenBudgetPolicy {
  tenantId?: string;
  monthlyBudgetUsd: number;
  softLimitUsd: number;
  hardLimitUsd: number;
}

export const tokenBudgetPolicy = {
  create(input: TokenBudgetInput): TokenBudgetPolicy {
    const softRatio = input.softLimitRatio ?? 0.8;
    const hardRatio = input.hardLimitRatio ?? 1.0;
    return {
      tenantId: input.tenantId,
      monthlyBudgetUsd: input.monthlyBudgetUsd,
      softLimitUsd: parseFloat((input.monthlyBudgetUsd * softRatio).toFixed(2)),
      hardLimitUsd: parseFloat((input.monthlyBudgetUsd * hardRatio).toFixed(2))
    };
  }
};

export interface CostTrackerEntry {
  tenantId: string;
  feature: string;
  tokens: number;
  costUsd: number;
  timestamp: string;
}

export class CostTracker {
  private readonly entries: CostTrackerEntry[] = [];

  record(entry: CostTrackerEntry) {
    this.entries.push(entry);
  }

  aggregateByTenant(tenantId: string) {
    return this.entries
      .filter((entry) => entry.tenantId === tenantId)
      .reduce(
        (acc, entry) => ({
          tokens: acc.tokens + entry.tokens,
          costUsd: acc.costUsd + entry.costUsd
        }),
        { tokens: 0, costUsd: 0 }
      );
  }
}
