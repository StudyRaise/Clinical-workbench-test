/**
 * Prompt 模板管理
 *
 * 包含三大业务模块的 Prompt 模板（术前谈话分析 / 出院随访总结 / 科研数据清洗），
 * 占位符统一采用 {{var}} 形式，用 buildPrompt(template, variables) 填充；
 * 同时保留旧版 createPromptTemplate 通用模板工厂与 demoProductPitchPrompt（evals 依赖）。
 */
import crypto from 'node:crypto';
import { z } from 'zod';

export interface PromptTemplate<TInput> {
  version: string;
  schema: z.ZodType<TInput>;
  build: (input: TInput) => string;
  hash: (prompt: string) => string;
}

function createPromptTemplate<TInput>(
  version: string,
  schema: z.ZodType<TInput>,
  render: (input: TInput) => string
): PromptTemplate<TInput> {
  return {
    version,
    schema,
    build(input) {
      const parsed = schema.parse(input);
      return render(parsed);
    },
    hash(prompt: string) {
      return crypto.createHash('sha256').update(`${version}:${prompt}`).digest('hex');
    }
  };
}

const demoPromptSchema = z.object({
  product: z.string(),
  audience: z.string()
});

export const demoProductPitchPrompt = createPromptTemplate(
  'v1',
  demoPromptSchema,
  ({ product, audience }) => `You are the product marketing lead for ${product}.

Draft a concise elevator pitch tailored for ${audience}. Highlight practical ROI and how the
platform leverages retrieval-augmented generation.`
);

export type DemoPromptInput = z.infer<typeof demoPromptSchema>;

export { createPromptTemplate };

// ---------------------------------------------------------------------------
// 三模块业务 Prompt 模板（占位符 {{var}}）
// ---------------------------------------------------------------------------

/**
 * 术前谈话记录分析模板
 *
 * 占位符：
 *  - {{transcript}}：术前谈话记录（ASR 转写或知情同意书草稿）
 *
 * 输出 JSON：surgery_name / risk_disclosure / alternatives / consent_intent /
 *           patient_questions / missing_items / score
 */
export const PREOP_ANALYSIS_PROMPT = `你是资深医疗质控专员，负责术前谈话记录的合规性审查。

请阅读以下术前谈话记录（可能为 ASR 转写或知情同意书草稿）：

"""{{transcript}}"""

请抽取关键信息并以 JSON 输出（不要输出其他任何内容）：
{
  "surgery_name": "手术名称",
  "risk_disclosure": ["已告知的风险项"],
  "alternatives": ["替代方案"],
  "consent_intent": "患者/家属同意意愿描述",
  "patient_questions": ["患者提出的疑问"],
  "missing_items": ["必须告知但缺失的要素"],
  "score": 0
}

要求：
1. score 为 0-100 的合规完整性评分，缺失项越少越高；
2. 至少覆盖：手术风险、替代方案、患者疑问、同意意愿；
3. missing_items 中列出未覆盖的法定告知要素。`;

/**
 * 出院随访总结模板
 *
 * 占位符：
 *  - {{records}}：出院小结/病程记录/医嘱/检验结果等住院资料
 *
 * 输出 JSON：patient_guide / doctor_plan / followup_date
 */
export const DISCHARGE_SUMMARY_PROMPT = `你是临床医生与健康宣教专员，请基于以下住院资料（出院小结/病程记录/医嘱/检验结果）生成出院随访总结：

"""{{records}}"""

以 JSON 输出两个版本（不要输出其他任何内容）：
{
  "patient_guide": "患者版出院指导：通俗语言、避免医学术语，说明用药、饮食、活动、注意事项",
  "doctor_plan": "医生版随访计划：下次复查项目、预警指标、药物调整规则",
  "followup_date": "建议复查日期（YYYY-MM-DD）"
}`;

/**
 * 科研数据清洗模板
 *
 * 占位符：
 *  - {{record_text}}：待清洗的非结构化临床文本
 *  - {{variable_dict}}：目标变量字典（每项：变量名, 类型, 标准编码）
 *
 * 输出 JSON：variables[]（含 name/value/confidence/source_ref）与 unmatched[]
 */
export const RESEARCH_CLEAN_PROMPT = `你是科研数据清洗助手，负责从非结构化临床文本中抽取结构化科研变量。

输入文本：
"""{{record_text}}"""

目标变量字典（每项：变量名, 类型, 标准编码）：
"""{{variable_dict}}"""

请为每个目标变量抽取取值并以 JSON 输出（不要输出其他任何内容）：
{
  "variables": [
    { "name": "变量名", "value": "抽取值", "confidence": 0.0, "source_ref": "原文出处片段" }
  ],
  "unmatched": ["未能抽取的变量名"]
}

要求：
1. confidence 为 0-1 的置信度；
2. source_ref 给出原文中的来源引用（简短片段）；
3. 仅做客观抽取，不得编造文本中不存在的信息。`;

/**
 * 用 {{var}} 占位符替换生成最终 Prompt。
 * 未在 variables 中提供的变量会保留原占位符，便于排查缺失参数。
 */
export function buildPrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key: string) => {
    const name = key.trim();
    return name in variables ? variables[name] : match;
  });
}
