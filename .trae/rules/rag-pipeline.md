---
description: 修改 RAG 管线、Milvus 检索、文档摄取（apps/inference/app/rag、utils）时的规范
alwaysApply: false
globs:
  - "apps/inference/app/rag/**"
  - "apps/inference/app/utils/**"
---

# RAG 管线规范

## 租户过滤（目标态）
- Milvus 检索表达式**必须**带租户过滤条件。漏过滤不会报错，只会静默返回其他租户数据
- ⚠️ **现状声明**：当前 inference 侧 schema 尚未落地 `facility_id` 字段。改到相关代码时先问用户是"本次落地"还是"按现状绕过"，不要自行重构 schema

## metadata 边界
- Milvus metadata 只存：文档 ID、chunk 序号、脱敏后摘要
- 禁止存病历原文、患者姓名、手机号等任何 PHI

## 检索策略
- 新增检索策略放 `rag/` 目录（参照 chunking/retrieval/timeline/graph_rag/schema_aware 的既有分层）
- 路由（`routers/`）只做编排，不写检索逻辑
- Embedding 一律走 `services/` 客户端，不在 rag/ 内直接实例化
