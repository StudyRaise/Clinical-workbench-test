# AI SaaS Monorepo 脚手架

本仓库是一个开箱即用的 Monorepo 起点，用于构建多租户、AI 驱动的 SaaS 应用。它提供了面向生产的服务边界、用于提示词与检索增强生成（RAG）的共享包、基础设施清单，以及便于接入基础大模型的护栏机制，同时保证合规、可观测与成本可控。

## 快速开始

1. **安装前置依赖**
   - [pnpm](https://pnpm.io/)（>= 8.15）
   - Node.js 18 LTS 或更高版本
   - Python 3.11+
   - Docker（用于本地服务）
2. **安装 JavaScript/TypeScript 依赖**
   ```bash
   pnpm install
   ```
3. **初始化 Python 环境**
   ```bash
   cd apps/inference && uv venv && source .venv/bin/activate && uv pip install -r requirements.txt
   # 或者使用：uv sync
   cd ../../apps/batch && uv venv && source .venv/bin/activate && uv pip install -r requirements.txt
   ```
4. **启动基础服务**
   ```bash
   docker compose -f infra/compose/compose.dev.yml up --build
   ```
5. **运行各应用**
   ```bash
   pnpm dev:web
   pnpm dev:api
   pnpm --filter mobile start
   uvicorn apps/inference.app.main:app --reload
   python apps/batch/jobs/nightly_eval.py
   ```

> Windows 环境也可以直接使用 `scripts/start.bat`（或 `start.ps1`）一键启动。

## 仓库结构

```
repo/
├── apps/
│   ├── web/          # Next.js 14（App Router）前端
│   ├── mobile/       # Expo/React Native 移动端
│   ├── api/          # NestJS BFF，多租户产品逻辑
│   ├── inference/    # FastAPI 推理服务（LLM、向量、重排序）
│   └── batch/        # 定时任务：索引构建、评测、训练钩子
├── packages/
│   ├── prompts/      # 带版本管理的提示词模板与构建器
│   ├── llm-clients/  # 模型提供方抽象（重试/降级）
│   ├── rag/          # 文档切分流水线与检索工具
│   ├── embeddings/   # 向量客户端（带维度校验）
│   ├── evals/        # 持续评测框架
│   ├── datasets/     # 数据集加载器与合成数据工具
│   ├── featurestore/ # 机器学习 + 混合 RAG 的特征构建
│   ├── guardrails/   # 安全、越权与合规过滤
│   ├── costs/        # Token 计费与预算告警
│   ├── utils/        # 通用工具
│   ├── contracts/    # 跨服务共享的 DTO 契约
│   └── db/           # Prisma 客户端与数据库迁移
└── infra/
    ├── compose/      # Docker Compose 编排（开发 + GPU）
    ├── docker/       # CPU/GPU 推理的 Dockerfile
    └── terraform/    # 云部署的 IaC 脚手架
```

## 开发工作流

- **质量门禁**：`pnpm lint`、`pnpm test`、`pnpm build` 基于 Turborepo，只运行受影响的 workspace。
- **持续评测**：`pnpm --filter @repo/evals test` 执行黄金提示词、RAG 召回检查与安全护栏测试，可在 CI 中接在单元测试之后。
- **数据库**：共享模型定义在 `packages/db/prisma/schema.prisma`，通过 `pnpm --filter @repo/db prisma migrate dev` 演进 schema。
- **提示词**：在 `packages/prompts/src` 中创建带类型的模板，使用方应导入构建器而非硬编码字符串。
- **RAG**：`packages/rag` 提供切分器、检索器与流水线定义；可配合 `packages/costs` + Redis 的语义缓存跳过重复调用。
- **一键提交代码**：对 AI 助手说"上传代码"即可触发 `.trae/skills/git-push` 定义的流程（增量测试门禁 → 提交前确认备注 → 推送）。

## 后续计划

- 在 `apps/inference/app/dependencies.py` 中接入真实模型密钥，并在 `packages/llm-clients` 中配置路由规则。
- 完善 CI 流水线（GitHub Actions 示例即将提供）：运行 lint/build/test 以及 `pnpm --filter @repo/evals test` 持续评测。
- 扩展 `packages/utils` 的日志封装，接入遥测（OpenTelemetry/OTLP、Prometheus、ClickHouse）。
- 在 `apps/api` 的 `AuthModule` 中集成生产级认证（Clerk/Auth0/Cognito），并用 `@nestjs/throttler` 配置限流。

本脚手架重清晰而非面面俱到——请用你自己的业务流程与模型替换其中的占位逻辑。
