import { runGoldenPrompts, GoldenPromptSchema } from '..';

async function main() {
  const dataset = [
    {
      id: 'demo-pitch',
      input: { product: 'AI SaaS', audience: 'growth leaders' },
      rubric: 'return on investment'
    }
  ].map((item) => GoldenPromptSchema.parse(item));

  const summary = await runGoldenPrompts('demo-dataset', dataset);
  console.log(JSON.stringify(summary, null, 2));
}

void main();
