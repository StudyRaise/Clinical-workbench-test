# AI SaaS Monorepo Boilerplate

This repository provides a batteries-included starting point for building a multi-tenant, AI-enabled SaaS using a monorepo layout. It contains production-minded service boundaries, shared packages for prompts and retrieval-augmented generation (RAG), infrastructure manifests, and guardrails that make it easy to plug in foundation models while staying compliant, observable, and cost-aware.

## Getting started

1. **Install prerequisites**
   - [pnpm](https://pnpm.io/) \(>=8.15\)
   - Node.js 18 LTS or newer
   - Python 3.11+
   - Docker (for local services)
2. **Install JavaScript/TypeScript dependencies**
   ```bash
   pnpm install
   ```
3. **Bootstrap Python environments**
   ```bash
   cd apps/inference && uv venv && source .venv/bin/activate && uv pip install -r requirements.txt
   # or use: uv sync
   cd ../../apps/batch && uv venv && source .venv/bin/activate && uv pip install -r requirements.txt
   ```
4. **Start backing services**
   ```bash
   docker compose -f infra/compose/compose.dev.yml up --build
   ```
5. **Run the apps**
   ```bash
   pnpm dev:web
   pnpm dev:api
   pnpm --filter mobile start
   uvicorn apps/inference.app.main:app --reload
   python apps/batch/jobs/nightly_eval.py
   ```

## Repository layout

```
repo/
├── apps/
│   ├── web/          # Next.js 14 (App Router) frontend
│   ├── mobile/       # Expo/React Native mobile client
│   ├── api/          # NestJS BFF, multi-tenant product logic
│   ├── inference/    # FastAPI service for LLM, embeddings, rerankers
│   └── batch/        # Scheduled jobs: indexing, evals, training hooks
├── packages/
│   ├── prompts/      # Versioned prompt templates and builders
│   ├── llm-clients/  # Provider abstractions with retries/fallbacks
│   ├── rag/          # Chunking pipelines and retriever utilities
│   ├── embeddings/   # Embedding client with dimensionality guards
│   ├── evals/        # Continuous evaluation harness
│   ├── datasets/     # Dataset loaders and synthetic data tools
│   ├── featurestore/ # Feature builders for ML + hybrid RAG
│   ├── guardrails/   # Safety, jailbreak, and compliance filters
│   ├── costs/        # Token accounting, budget alerts
│   ├── utils/        # Shared helpers
│   ├── contracts/    # DTO schemas shared across services
│   └── db/           # Prisma client and migrations
└── infra/
    ├── compose/      # Docker Compose stacks (dev + GPU)
    ├── docker/       # Dockerfiles for CPU/GPU inference
    └── terraform/    # IAC scaffolding for cloud deployment
```

## Development workflows

- **Quality gates**: `pnpm lint`, `pnpm test`, and `pnpm build` leverage Turborepo so only affected workspaces run.
- **Continuous evaluation**: `pnpm --filter @repo/evals test` executes golden prompts, RAG recall checks, and safety guard tests. Wire this into CI after your unit tests.
- **Database**: `packages/db/prisma/schema.prisma` defines shared models. Run `pnpm --filter @repo/db prisma migrate dev` to evolve the schema.
- **Prompts**: create typed templates in `packages/prompts/src`. Consumers import builders rather than hardcoding strings.
- **RAG**: `packages/rag` ships chunkers, retrievers, and pipeline definitions. Use the semantic cache helpers in `packages/costs` + Redis to skip repeated calls.

## Next steps

- Connect real model keys in `apps/inference/app/dependencies.py` and configure routing rules in `packages/llm-clients`.
- Flesh out CI pipelines (GitHub Actions examples coming soon) to run lint/build/test + `pnpm --filter @repo/evals test` for continuous evaluation.
- Hook up telemetry sinks (OpenTelemetry/OTLP, Prometheus, ClickHouse) by extending `packages/utils` logging wrappers.
- Integrate production-ready auth (Clerk/Auth0/Cognito) inside `apps/api`'s `AuthModule`, and wire rate limiting with `@nestjs/throttler`.

This boilerplate favors clarity over completeness—replace the placeholder logic with your product-specific flows and models.
