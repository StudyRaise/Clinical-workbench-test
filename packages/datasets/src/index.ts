import { z } from 'zod';

export const DocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  source: z.string(),
  metadata: z.record(z.any()).optional()
});

export type DocumentRecord = z.infer<typeof DocumentSchema>;

export interface DatasetLoader {
  load: () => AsyncIterable<DocumentRecord>;
}

export class StaticDataset implements DatasetLoader {
  constructor(private readonly documents: DocumentRecord[]) {}

  async *load(): AsyncIterable<DocumentRecord> {
    for (const document of this.documents) {
      yield DocumentSchema.parse(document);
    }
  }
}

export function createDemoDataset(): DatasetLoader {
  return new StaticDataset([
    {
      id: 'doc-1',
      title: 'AI SaaS onboarding',
      body: 'Teach customers how to use retrieval augmented generation in onboarding flows.',
      source: 'knowledge-base'
    }
  ]);
}
