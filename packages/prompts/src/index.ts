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
