/**
 * 跨服务共享 DTO / 类型契约
 *
 * 临床业务 DTO 与 packages/db 实体对应，字段采用 snake_case（与数据库列名一致）。
 * 同时保留旧版 SaaS 多租户契约（apps/api 正在依赖）。
 */
import { z } from 'zod';

/** 系统角色（与 packages/db 的 UserRole 枚举对应） */
export enum Role {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  RESEARCHER = 'researcher',
  PATIENT = 'patient'
}

// ---------------------------------------------------------------------------
// 多租户上下文
// ---------------------------------------------------------------------------

export const TenantContextSchema = z.object({
  // —— 旧版 SaaS 字段（apps/api 仍在使用）——
  tenantId: z.string(),
  plan: z.enum(['free', 'pro', 'enterprise']),
  seats: z.number().int().nonnegative(),
  features: z.array(z.string()),
  // —— 临床多租户扩展字段（snake_case，与 db 列名一致）——
  facility_id: z.string().optional(),
  user_id: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  created_at: z.string().optional()
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

// ---------------------------------------------------------------------------
// 临床业务 DTO（与 packages/db 实体对应，snake_case）
// ---------------------------------------------------------------------------

/** 术前谈话分析报告（对应 preop_report 实体） */
export interface PreopReport {
  id: string;
  document_id: string;
  missing_items: string[];
  risk_points: string[];
  questions: string[];
  score: number;
}

/** 出院随访总结（对应 discharge_summary 实体） */
export interface DischargeSummary {
  id: string;
  patient_id: string;
  patient_guide: string;
  doctor_plan: string;
  followup_date: string;
}

/** 科研清洗记录（对应 research_record 实体） */
export interface ResearchRecord {
  id: string;
  patient_key: string;
  variables: Record<string, unknown>;
  confidence: number;
  source_ref: string;
}
