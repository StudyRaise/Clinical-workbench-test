/**
 * Token 成本追踪与预算估算（国产 LLM：通义千问 / DeepSeek）
 *
 * 提供：
 *  - COST_PER_1K：两个服务商每 1K Token 的输入/输出近似单价（美元，可按签约价调整）
 *  - trackUsage：记录一次调用的 Token 用量并计算成本
 *  - estimateBudget：汇总记录并对比月度预算，判断是否超支
 *  - 兼容旧版 tokenBudgetPolicy（软/硬预算比例）与 CostTracker（按租户聚合）
 */

export type CostProvider = 'qwen' | 'deepseek';

/** 每 1K Token 成本（美元，近似值，可按实际签约价格调整） */
export const COST_PER_1K: Record<CostProvider, { input: number; output: number }> = {
  qwen: { input: 0.0008, output: 0.002 }, // 通义千问 qwen-plus 近似价
  deepseek: { input: 0.00027, output: 0.0011 } // DeepSeek deepseek-chat 近似价
};

export interface UsageRecord {
  provider: CostProvider;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number; // 美元
  timestamp?: string;
}

/** 记录一次调用产生的 Token 用量与成本（cost = input/1k·rate_in + output/1k·rate_out） */
export function trackUsage(
  provider: CostProvider,
  inputTokens: number,
  outputTokens: number
): UsageRecord {
  const rate = COST_PER_1K[provider];
  const cost = (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
  return {
    provider,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost: roundCost(cost),
    timestamp: new Date().toISOString()
  };
}

export interface BudgetEstimate {
  totalCost: number;   // 累计成本（美元）
  remaining: number;   // 剩余预算（美元，可为负）
  exceeded: boolean;   // 是否已超支
}

/** 汇总成本记录并对比月度预算，判断是否超支 */
export function estimateBudget(records: UsageRecord[], monthlyBudget: number): BudgetEstimate {
  const totalCost = roundCost(records.reduce((sum, record) => sum + record.cost, 0));
  const remaining = roundCost(monthlyBudget - totalCost);
  return { totalCost, remaining, exceeded: totalCost > monthlyBudget };
}

/** 保留 6 位小数，避免浮点误差累积 */
function roundCost(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

// ---------------------------------------------------------------------------
// 以下为旧版能力（apps/api 仍在依赖），保持导出不变
// ---------------------------------------------------------------------------

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
