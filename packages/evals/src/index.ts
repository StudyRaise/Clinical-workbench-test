import { z } from 'zod';
import { createLLMClient } from '@repo/llm-clients';
import { demoProductPitchPrompt, DemoPromptInput } from '@repo/prompts';

export interface EvalRun {
  id: string;
  promptHash: string;
  passed: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}

export const GoldenPromptSchema = z.object({
  id: z.string(),
  input: demoProductPitchPrompt.schema,
  rubric: z.string()
});

/** 显式类型（z.infer 对含泛型 ZodType 的 schema 会退化成 unknown，故不用 z.infer） */
export interface GoldenPrompt {
  id: string;
  input: DemoPromptInput;
  rubric: string;
}

export interface EvaluationSummary {
  dataset: string;
  total: number;
  passed: number;
  failed: number;
  runs: EvalRun[];
}

export async function runGoldenPrompts(dataset: string, prompts: GoldenPrompt[]) {
  const client = createLLMClient();
  const runs: EvalRun[] = [];

  for (const prompt of prompts) {
    const built = demoProductPitchPrompt.build(prompt.input);
    const hash = demoProductPitchPrompt.hash(built);
    // 不传 model 覆盖，使用全局配置的默认模型（LLM_PROVIDER / LLM_MODEL，如 sensenova glm-5.2）
    const result = await client.complete({
      prompt: built,
      metadata: { dataset, promptId: prompt.id, promptHash: hash }
    });

    const passed = result.outputText.toLowerCase().includes(prompt.rubric.toLowerCase());
    runs.push({ id: prompt.id, promptHash: hash, passed, output: result.outputText });
  }

  const summary: EvaluationSummary = {
    dataset,
    total: runs.length,
    passed: runs.filter((run) => run.passed).length,
    failed: runs.filter((run) => !run.passed).length,
    runs
  };

  return summary;
}
