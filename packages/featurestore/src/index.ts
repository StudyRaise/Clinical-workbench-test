import { z } from 'zod';
import { logger } from '@repo/utils';

export const FeatureDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputs: z.array(z.string()),
  compute: z.function().args(z.any()).returns(z.promise(z.record(z.any())))
});

export type FeatureDefinition = z.infer<typeof FeatureDefinitionSchema>;

export class FeatureRegistry {
  private readonly features = new Map<string, FeatureDefinition>();

  register(definition: FeatureDefinition) {
    FeatureDefinitionSchema.parse(definition);
    this.features.set(definition.name, definition);
    logger.info('Feature registered', { feature: definition.name });
  }

  async compute(name: string, payload: unknown) {
    const feature = this.features.get(name);
    if (!feature) {
      throw new Error(`Feature ${name} not found`);
    }
    return feature.compute(payload);
  }
}

export function createDefaultRegistry() {
  const registry = new FeatureRegistry();
  registry.register({
    name: 'rag.semanticCoverage',
    description: 'Measures how many retrieved documents mention the user goal.',
    inputs: ['retrievedDocuments'],
    compute: async ({ retrievedDocuments }: { retrievedDocuments: string[] }) => {
      const coverage = retrievedDocuments.filter((doc) => /goal/i.test(doc)).length;
      return { coverageRatio: retrievedDocuments.length ? coverage / retrievedDocuments.length : 0 };
    }
  });
  return registry;
}
