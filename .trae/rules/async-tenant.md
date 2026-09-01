---
description: 编写或修改 Celery 异步任务（apps/inference/app/tasks、apps/batch）时的租户与脱敏规范
alwaysApply: false
globs:
  - "apps/inference/app/tasks/**"
  - "apps/batch/**"
---

# 异步任务规范

## 租户上下文
- Worker 进程**没有请求上下文**，tenancy interceptor 在异步链路不存在
- 任务 payload **必须显式携带 `facility_id` 参数**，任务内所有 DB 查询、Milvus 检索、MinIO 读写都以它为过滤条件
- 禁止从全局变量、环境变量读取"当前租户"

## 脱敏
- 异步任务发往 LLM 的文本同样必须 `from ..desensitize import desensitize`，不因"是后台任务"豁免
- 参考现有模式：`app/tasks/clean.py`

## 投递侧
- BFF（NestJS）投递任务时负责把当前请求的 `facility_id` 放进 payload
- 投递代码修改后需验证 worker 日志中无 PHI 原文
