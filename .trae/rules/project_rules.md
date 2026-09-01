---
description: 项目级通用规范：monorepo 结构、代码风格、安全红线
alwaysApply: true
---

# 项目通用规范

## 代码风格
- 注释与文档说明统一使用中文
- TypeScript 使用 strict 模式，禁止 `any`（与外部弱类型库交互处除外）
- Python 遵循 PEP 8，FastAPI 路由统一放 `routers/`，公共依赖放 `dependencies.py`

## Monorepo 边界
- 三层职责：Web 只做展示与交互；`apps/api`（BFF）管业务/权限/合规；`apps/inference` 管 AI 与检索
- 前端不直连数据库，不直连推理服务，一律经 BFF
- 跨包共享的类型/DTO 放 `packages/contracts`，实体放 `packages/db`

## 安全红线
- PHI（患者隐私数据）发往云端 LLM 前必须经 `desensitize/` 脱敏，返回经 `restorer` 还原
- 业务查询必须走 `facility_id` 多租户过滤，不得手写 SQL 绕过 tenancy 层
- 敏感字段使用 `crypto/` 模块的 AES-256-GCM 加密存储
- 业务写操作必须留审计日志（audit 模块），审计表追加写、不更新不删除
- 密钥一律读环境变量，禁止提交到代码库

## 提交前
- `pnpm test` 与 `pnpm lint` 必须通过
