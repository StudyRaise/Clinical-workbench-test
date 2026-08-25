'use client';

import { useMemo, useState } from 'react';
import { demoProductPitchPrompt } from '@repo/prompts';
import { createLLMClient } from '@repo/llm-clients';
import { SaaSOnboardingSchema } from '@repo/contracts';

const llmClient = createLLMClient();

export default function HomePage() {
  const [prompt] = useState(() => demoProductPitchPrompt.build({
    product: 'AI-enabled SaaS',
    audience: 'founders'
  }));
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const promptHash = useMemo(() => demoProductPitchPrompt.hash(prompt), [prompt]);

  const runInference = async () => {
    setLoading(true);
    try {
      const response = await llmClient.complete({
        model: 'gpt-4.1-mini',
        prompt,
        metadata: {
          promptHash,
          template: demoProductPitchPrompt.version
        }
      });
      setResult(response.outputText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold">Ship AI products faster</h1>
        <p className="max-w-xl text-lg text-slate-300">
          This boilerplate wires a modern Next.js frontend into shared prompt libraries, evaluation
          harnesses, and inference microservices. Modify the prompt template below and run it through
          your configured provider chain.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4 rounded-xl bg-slate-900 p-6 shadow-xl shadow-slate-950/40">
          <h2 className="text-xl font-medium">Prompt template</h2>
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm text-slate-200">
            {prompt}
          </pre>
          <button
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            onClick={runInference}
            disabled={loading}
          >
            {loading ? 'Running…' : 'Run inference'}
          </button>
        </div>
        <div className="space-y-4 rounded-xl bg-slate-900 p-6 shadow-xl shadow-slate-950/40">
          <h2 className="text-xl font-medium">Latest result</h2>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Prompt hash: <span className="font-mono text-slate-300">{promptHash}</span>
          </p>
          <textarea
            className="h-64 w-full resize-none rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-100"
            value={result}
            onChange={(event) => setResult(event.target.value)}
            placeholder="Run the prompt to see the LLM output here."
          />
          <details className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
            <summary className="cursor-pointer font-semibold text-slate-200">Tenant payload</summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
              {JSON.stringify(
                SaaSOnboardingSchema.parse({
                  tenantId: 'demo',
                  plan: 'free',
                  seats: 3,
                  features: ['inference', 'analytics']
                }),
                null,
                2
              )}
            </pre>
          </details>
        </div>
      </section>
    </div>
  );
}
