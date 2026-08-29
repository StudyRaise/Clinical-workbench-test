import { runGoldenPrompts, GoldenPrompt } from '..';

async function main() {
  const dataset: GoldenPrompt[] = [
    {
      id: 'demo-pitch',
      input: { product: 'AI SaaS', audience: 'growth leaders' },
      rubric: 'return on investment'
    }
  ];

  const summary = await runGoldenPrompts('demo-dataset', dataset);
  console.log(JSON.stringify(summary, null, 2));
}

void main();
