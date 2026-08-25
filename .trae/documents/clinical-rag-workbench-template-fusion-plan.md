# 临床 AI 工作台 - 模板融合实施计划

## Summary

基于已确认的三套模板，通过 clone eyeamkd/init 内核 Monorepo 骨架，融合 next-shadcn-admin-dashboard 前端 UI 模式与 rag-engine 的 RAG 管线模式，快速搭建临床 AI 工作台项目。本计划覆盖从模板获取、适配改造到可运行骨架的全过程。

## Current State Analysis

- 工作区仅有 `.trae/specs/` 规范文档和 PRD docx，无任何代码
- 三份模板已确认：
  - **内核**: [eyeamkd/init](https://github.com/eyeamkd/init) — Next.js 14 + NestJS + FastAPI Monorepo
  - **前端**: [next-shadcn-admin-dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard) — Next.js + Tailwind + shadcn/ui
  - **RAG**: [int2t05/rag-engine](https://github.com/int2t05/rag-engine) — FastAPI + LangChain + MySQL + MinIO

## 模板对比与适配要点

### eyeamkd/init 现有结构
```
repo/
├── apps/
│   ├── web/           # Next.js 14 (App Router) — 已有骨架
│   ├── mobile/        # Expo/React Native — 不需要，删除
│   ├── api/           # NestJS BFF — 已有多租户逻辑入口
│   ├── inference/     # FastAPI (LLM, embeddings, rerankers) — 已有骨架
│   └── batch/         # 定时任务 (indexing, evals) — 保留用于 Celery
├── packages/
│   ├── prompts/       # 版本化 Prompt 模板 — 保留
│   ├── llm-clients/   # LLM 客户端抽象 (retries/fallbacks) — 适配国产 API
│   ├── rag/           # 分块管线 + 检索工具 — 适配 Hybrid/Graph/Schema-aware
│   ├── embeddings/    # Embedding 客户端 — 适配通义千问
│   ├── evals/         # 持续评估 — 保留
│   ├── datasets/      # 数据加载 + 合成数据 — 适配 Synthea/MIMIC-IV
│   ├── featurestore/  # 特征构建 (hybrid RAG) — 保留
│   ├── guardrails/    # 安全/越狱/合规过滤 — 保留，加强 PHI 脱敏
│   ├── costs/         # Token 计费/预算告警 — 保留
│   ├── utils/         # 共享工具 — 保留
│   ├── contracts/     # 跨服务 DTO — 适配临床数据结构
│   └── db/            # Prisma client + migrations — 替换为 TypeORM + MySQL
├── infra/
│   ├── compose/       # Docker Compose — 加 MySQL/Milvus/MinIO
│   ├── docker/        # Dockerfiles (CPU/GPU) — 保留
│   └── terraform/     # IAC — 暂不使用
```

### 需要适配的关键差异

| 维度 | eyeamkd/init 现状 | 目标方案 | 适配方式 |
|------|------------------|---------|---------|
| ORM | Prisma | TypeORM + MySQL | 替换 packages/db，改用 TypeORM 实体定义 |
| 向量库 | 未指定 | Milvus | packages/rag 中 Milvus 客户端集成 |
| 对象存储 | 未指定 | MinIO | 参考 rag-engine 的 MinIO 集成模式 |
| 前端 UI | 基础骨架 | shadcn/ui Dashboard | 从 next-shadcn-admin-dashboard 拷贝 UI 组件 |
| RAG 检索 | 基础语义检索 | Hybrid + Timeline + Graph + Schema-aware | 参考 rag-engine 的混合检索实现 |
| 认证 | AuthModule 占位 | NextAuth.js + JWT + RBAC (5 角色) | 在 apps/api 中实现 NextAuth 适配器 |
| 数据库配置 | Prisma 默认 PostgreSQL | MySQL 8 | infra/compose 中加 MySQL 容器 |
| LLM | OpenAI 占位 | 国产 API (通义千问/DeepSeek) | packages/llm-clients 中适配 |

## Proposed Changes

### Step 1: Clone 内核模板并清理

**操作**: Clone eyeamkd/init 到工作区根目录，删除不需要的部分。

```
git clone https://github.com/eyeamkd/init.git .
```

**删除项**:
- `apps/mobile/` — 不需要移动端
- `infra/terraform/` — 暂不使用 Terraform
- `packages/datasets/` 中的合成数据工具 — 后续按需重写（适配 Synthea/MIMIC-IV）

**保留项**:
- `apps/web/` — Next.js 14 前端骨架
- `apps/api/` — NestJS BFF 骨架
- `apps/inference/` — FastAPI 推理服务骨架
- `apps/batch/` — 定时任务（改为 Celery 异步队列）
- `packages/` 全部保留（后续适配）
- `infra/compose/` — Docker Compose 配置

### Step 2: 适配 Docker Compose 基础设施

**文件**: `infra/compose/compose.dev.yml`

在现有 Docker Compose 中添加/修改以下服务：

```yaml
services:
  mysql:          # 替换原有 PostgreSQL（如有）
    image: mysql:8.0
    ports: ["3306:3306"]
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: clinical_workbench
    volumes: ["mysql_data:/var/lib/mysql"]

  milvus:         # 新增向量数据库
    image: milvusdb/milvus:v2.4.0
    ports: ["19530:19530"]
    depends_on: [etcd, minio]
    # ... Milvus 标准配置

  minio:          # 新增对象存储
    image: minio/minio:latest
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"

  redis:          # Celery 消息队列
    image: redis:7-alpine
    ports: ["6379:6379"]
```

### Step 3: 替换 Prisma 为 TypeORM + MySQL

**操作范围**: `packages/db/`

1. 删除 `packages/db/prisma/` 目录
2. 安装 TypeORM 依赖：`pnpm add typeorm mysql2` (在 packages/db)
3. 创建 TypeORM 实体定义，对应 spec 中的数据模型：

**实体文件** (`packages/db/src/entities/`):
- `tenant.entity.ts` — id, name, created_at
- `user.entity.ts` — id, tenant_id, role, email, password_hash
- `document.entity.ts` — id, tenant_id, owner_id, type, file_url, status
- `document_chunk.entity.ts` — id, document_id, content, embedding_id
- `audit_log.entity.ts` — id, user_id, action, target, ip, ts
- `preop_report.entity.ts` — document_id, missing_items[], risk_points[], questions[], score
- `discharge_summary.entity.ts` — patient_id, patient_guide, doctor_plan, followup_date
- `research_record.entity.ts` — record_id, patient_key, variables(JSON), confidence
- `research_variable.entity.ts` — variable_id, name, type, standard_code

4. 创建 TypeORM DataSource 配置，支持 facility_id 全局过滤
5. 更新 `packages/db/src/index.ts` 导出 DataSource 和实体

### Step 4: 融合 next-shadcn-admin-dashboard 前端 UI

**操作**: 从 next-shadcn-admin-dashboard 拷贝 UI 组件和布局到 `apps/web/`

1. Clone next-shadcn-admin-dashboard 为临时参考：
   ```
   git clone https://github.com/arhamkhnz/next-shadcn-admin-dashboard.git /tmp/shadcn-admin
   ```

2. 拷贝以下内容到 `apps/web/`:
   - `components/ui/` — shadcn/ui 组件库（Button, Card, Dialog, Table 等）
   - `components/layout/` — 侧边栏、顶栏、布局容器
   - `components/dashboard/` — 仪表盘卡片组件
   - `lib/` — 工具函数（cn, 格式化等）
   - `styles/` — Tailwind 主题配置
   - `app/(auth)/` — 登录页布局参考
   - `app/(dashboard)/` — Dashboard 路由布局参考

3. 在 `apps/web/app/` 下创建三模块路由：
   - `app/(dashboard)/preop/` — 术前谈话分析
   - `app/(dashboard)/discharge/` — 出院随访总结
   - `app/(dashboard)/research/` — 科研数据清洗

4. 适配 Tailwind 配置和 shadcn/ui components.json

### Step 5: 适配 NestJS BFF (apps/api)

**操作**: 在 eyeamkd/init 现有 NestJS 骨架基础上增加业务模块

1. **认证模块** (`apps/api/src/modules/auth/`):
   - 安装 `next-auth` 和 `@auth/nestjs`
   - 实现 NextAuth.js 适配器，连接 MySQL user 表
   - JWT 签发与校验，返回 facility_id
   - 5 种角色 RBAC Guard 实现

2. **多租户中间件** (`apps/api/src/middleware/tenant/`):
   - TypeORM 全局拦截器，自动注入 facility_id WHERE 条件
   - 跨租户查询返回空集

3. **审计日志模块** (`apps/api/src/modules/audit/`):
   - 审计日志拦截器，记录 PHI 访问
   - 追加写入模式，不可修改/删除

4. **加密模块** (`apps/api/src/modules/crypto/`):
   - AES-256-GCM 字段级加密工具
   - PHI 字段自动加密/解密

5. **业务路由** — 转发到 FastAPI 推理服务:
   - `/api/preop/*` → FastAPI inference
   - `/api/discharge/*` → FastAPI inference
   - `/api/research/*` → FastAPI inference

### Step 6: 融合 rag-engine 模式到 FastAPI 推理服务

**操作**: 参考 rag-engine 的实现模式，在 `apps/inference/` 中实现 RAG 管线

1. **依赖安装** (`apps/inference/requirements.txt`):
   - fastapi, uvicorn
   - langchain, langchain-community
   - pymilvus (Milvus 客户端)
   - minio (Python SDK)
   - sqlalchemy, pymysql (MySQL 连接，用于读取业务数据)
   - celery, redis (异步队列)
   - httpx (调用国产 LLM API)
   - pypdf, python-docx, pytesseract (文档解析 + OCR)

2. **目录结构** (`apps/inference/app/`):
   ```
   app/
   ├── main.py              # FastAPI 入口
   ├── config.py            # 环境配置
   ├── routers/             # API 路由
   │   ├── preop.py         # 术前谈话分析
   │   ├── discharge.py     # 出院随访总结
   │   └── research.py      # 科研数据清洗
   ├── services/            # 业务逻辑
   │   ├── llm_client.py    # 国产 LLM API 封装（通义千问/DeepSeek）
   ├── rag/                 # RAG 核心管线
   │   ├── chunking.py      # 文档分块
   │   ├── embedding.py     # 通义千问 Embedding
   │   ├── retrieval.py     # 混合检索（向量+BM25）
   │   ├── timeline.py      # Timeline 感知检索
   │   ├── graph_rag.py     # Graph RAG
   │   └── schema_aware.py  # Schema-aware Retrieval
   ├── desensitize/         # PHI 脱敏中间件
   │   ├── recognizer.py    # PHI 识别器
   │   ├── masker.py         # 脱敏替换 + 映射表
   │   └── restorer.py      # 结果还原
   ├── guardrails/          # 合规护栏
   │   └── filters.py       # 越狱/敏感词过滤
   ├── terminology/         # 术语标准化
   │   ├── icd10.py          # ICD-10 编码
   │   ├── snomed.py        # SNOMED 映射
   │   └── rxnorm.py        # 药品名标准化
   ├── tasks/               # Celery 异步任务
   │   ├── ingest.py         # 文档摄取
   │   └── clean.py          # 批量数据清洗
   └── utils/
       ├── milvus_client.py # Milvus 连接
       └── minio_client.py  # MinIO 连接
   ```

3. **关键实现参考**（从 rag-engine 提取模式）:
   - MySQL + SQLAlchemy 连接模式 → 参考 rag-engine backend
   - MinIO 文件上传/下载 → 参考 rag-engine 的存储层
   - 混合检索 (向量 + BM25) → 参考 rag-engine 的检索实现
   - SSE 流式响应 → 参考 rag-engine 的流式对话

### Step 7: 适配 packages/ 共享包

1. **packages/llm-clients/**:
   - 替换 OpenAI 客户端为国产 API 客户端（通义千问/DeepSeek）
   - 支持流式输出、重试、fallback
   - Token 计费接口

2. **packages/embeddings/**:
   - 适配通义千问 text-embedding-v2
   - 维度校验（确保与 Milvus Collection 维度一致）

3. **packages/rag/**:
   - 保留分块管线
   - 添加 Hybrid Search (向量 + BM25)
   - 添加 Timeline 检索工具
   - 添加 Graph RAG 构建
   - 添加 Schema-aware Retrieval

4. **packages/guardrails/**:
   - 保留越狱/敏感词过滤
   - 增强 PHI 脱敏中间件集成

5. **packages/costs/**:
   - 保留 Token 计费
   - 添加预算告警

6. **packages/prompts/**:
   - 添加三模块 Prompt 模板（术前谈话、出院随访、科研清洗）

### Step 8: 环境变量与配置

**文件**: `.env.example`

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=clinical_workbench

# Milvus
MILVUS_HOST=localhost
MILVUS_PORT=19530

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Redis
REDIS_URL=redis://localhost:6379

# LLM API (国产)
LLM_PROVIDER=qwen  # qwen | deepseek
QWEN_API_KEY=
DEEPSEEK_API_KEY=

# Embedding
EMBEDDING_API_KEY=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Encryption
FIELD_ENCRYPTION_KEY=  # AES-256-GCM key
```

## Assumptions & Decisions

1. **Prisma → TypeORM**: spec 明确使用 MySQL + TypeORM，eyeamkd/init 默认用 Prisma，需完全替换 packages/db
2. **Next.js 14 vs 15/16**: eyeamkd/init 使用 Next.js 14，spec 也指定 14，保持一致；next-shadcn-admin-dashboard 有 Next 14 分支（archive/next14-tailwindv3）
3. **shadcn/ui 版本**: 使用 next-shadcn-admin-dashboard 的 archive/next14-tailwindv3 分支，确保与 Next.js 14 + Tailwind v3 兼容
4. **Mobile app 删除**: eyeamkd/init 含 Expo 移动端，临床场景暂不需要，删除以简化
5. **Terraform 删除**: 混合部署模式用 Docker Compose 即可，暂不需要 IaC
6. **rag-engine 仅为参考**: 不直接合并 rag-engine 代码，而是提取其 MySQL+MinIO+混合检索的实现模式，融入 apps/inference
7. **国产 LLM 适配**: packages/llm-clients 原为 OpenAI 抽象，需改写为国产 API（通义千问/DeepSeek）的 HTTP 客户端

## Verification Steps

1. **Docker Compose 启动**: `docker compose -f infra/compose/compose.dev.yml up` 能成功启动 MySQL、Milvus、MinIO、Redis
2. **前端启动**: `pnpm dev:web` 能在 localhost:3000 启动 Next.js，显示 shadcn/ui Dashboard 布局
3. **BFF 启动**: `pnpm dev:api` 能在 localhost:3001 启动 NestJS，健康检查接口可用
4. **推理服务启动**: `uvicorn apps.inference.app.main:app --reload` 能在 localhost:8000 启动 FastAPI
5. **数据库连接**: NestJS 能通过 TypeORM 连接 MySQL，迁移脚本能创建表
6. **Milvus 连接**: FastAPI 能连接 Milvus，能创建 Collection
7. **MinIO 连接**: FastAPI 能连接 MinIO，能创建存储桶
8. **LLM 调用**: 配置国产 API Key 后，能成功调用通义千问/DeepSeek 并获得流式响应
