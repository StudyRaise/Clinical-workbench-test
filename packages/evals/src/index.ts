import { z } from 'zod';
import { createLLMClient } from '@repo/llm-clients';
import { demoProductPitchPrompt } from '@repo/prompts';

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

export type GoldenPrompt = z.infer<typeof GoldenPromptSchema>;

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
    const result = await client.complete({
      model: 'gpt-4.1-mini',
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
