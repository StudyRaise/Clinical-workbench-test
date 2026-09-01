---
description: 涉及推理服务（apps/inference，FastAPI/RAG）时生效的规范
alwaysApply: false
globs:
  - "apps/inference/**"
  - "apps/batch/**"
---

# 推理服务规范

- FastAPI 入口 `app/main.py`，配置集中在 `app/config.py`，新配置加环境变量并在 `.env.example` 同步声明
- LLM/Embedding 调用统一走 `services/llm_client.py` 与 `services/clients.py`，不在路由里直接 new client
- 发往云端 LLM 的文本必须经 `desensitize/` 的 masker，响应经 restorer 还原
- 检索策略放 `rag/`（chunking/embedding/retrieval/timeline/graph_rag/schema_aware），路由只做编排
- 耗时操作（批量摄取、清洗）走 `tasks/` Celery 异步队列，不阻塞请求
- 术语标准化（ICD-10/SNOMED/RxNorm）逻辑放 `terminology/`
- 向量库访问走 `utils/milvus_client.py`，对象存储走 `utils/minio_client.py`
