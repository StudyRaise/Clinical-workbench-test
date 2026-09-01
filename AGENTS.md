# 项目：临床 AI 工作台（Clinical AI Workbench）

一句话定位：面向医院/科研机构的多租户 AI SaaS 平台，用 RAG 统一术前谈话分析、出院随访总结、科研数据清洗三类临床文书工作。
技术栈：Next.js 14 · NestJS 10 · FastAPI · TypeORM/MySQL · Milvus · MinIO · Celery/Redis · pnpm + Turborepo monorepo

> 本文件是唯一总纲。仓库中不存在其他 AGENTS*.md；若发现同名副本，以本文件为准并提醒我删除。

## 常用命令
- 安装依赖：`pnpm install`
- 本地启动：`bash scripts/start.sh dev`（Windows 用 `scripts/start.bat`，会弹三个服务窗口，AI 无法管理其生命周期，启动后改为逐服务 curl 验证）
- 测试：**TS 侧** `pnpm test`；**Python 侧** `cd apps/inference && .venv/Scripts/pytest`（venv 不存在时先 `python -m venv .venv` 并 `pip install -r requirements.txt`，报 ModuleNotFoundError 一律先查 venv 而不是改代码）
- Lint：`pnpm lint`；构建：`pnpm build`
- 健康检查：Web `localhost:3000` · BFF `localhost:3001/api/health` · 推理 `localhost:8000/health`
- Node 18 下 `localhost` 会解析到 IPv6，连不通时改用 `127.0.0.1`

## 验证矩阵（改了哪层跑哪层，pnpm test 不覆盖 Python）
| 改动位置 | 必须验证 |
|---|---|
| apps/web、apps/api、packages/* | `pnpm test` + `pnpm lint` + 对应健康检查 |
| apps/inference | pytest + `curl localhost:8000/health` |
| apps/inference/app/tasks | 同上 + 确认 worker 日志无 PHI |
| packages/*/src | 先 `pnpm build` 再测——**编译产物已提交进库，不改 build 下游引用的仍是旧产物** |

## 双后端职责（不要随机选一边写业务逻辑）
| 层 | 职责 |
|---|---|
| **NestJS 10** | HTTP API、鉴权、租户上下文注入、业务编排、Celery 任务投递 |
| **FastAPI** | 模型推理、向量检索、文档解析、脱敏/还原 |
| **共同** | 两侧都不得绕过 tenancy 层直接查库 |

## 文档索引（按需读取，不要一次性全读）
| 我要做什么 | 读这个 |
|---|---|
| 理解整体架构/部署/FAQ | `docs/序曲-项目结构与功能部署.md` |
| 改某个业务模块 | `docs/features/<module>.md`（存在才读） |
| 改 clinical-rag-workbench 相关 | 同时看 `.trae/specs/clinical-rag-workbench/`（存量规格，**两套文档都需同步**，以 features 为准） |
| 想知道为什么这么设计 | `docs/adr/`（已接受的决策，直接采信，不做"对照代码验证"） |
| 写异步任务 / Celery | `.trae/rules/async-tenant.md` |
| 动 RAG 管线 / Milvus | `.trae/rules/rag-pipeline.md` |
| 碰 PHI / 脱敏 / 审计 | `.trae/rules/phi-and-tenancy.md` |

## 三条不可协商的红线

### 红线 1 · PHI 保护 —— 六个出口，全部要堵
| 出口 | 要求 |
|---|---|
| LLM 调用 | 调用方显式 `desensitize()` 进、`restore()` 出，代码形态见 `.trae/rules/phi-and-tenancy.md`（`/v1/completions` 是已知例外，由 BFF 保证不传 PHI） |
| 日志 / 报错堆栈 | 禁止输出病历原文、患者身份信息 |
| Celery 任务 | 同样走脱敏，不因"是异步任务"而豁免 |
| Milvus metadata | 禁止存病历原文，只存文档 ID + 脱敏后摘要 |
| MinIO | 按 `facility_id` 分路径 + 服务端加密 |
| MySQL | PHI 字段加密存储 |

**Never**：把真实患者数据、真实病历样本、生产库导出的任何内容贴进 AI 对话框（调试报错也先脱敏）。

### 红线 2 · 多租户硬隔离 —— 四种通道都要覆盖
| 通道 | 隔离方式 |
|---|---|
| MySQL 查询 | 走 tenancy 层自动注入 `facility_id`，不得绕过 |
| Celery 异步任务 | payload 显式携带 `facility_id`，见 `.trae/rules/async-tenant.md` |
| Milvus 检索 | 检索表达式带租户过滤，见 `.trae/rules/rag-pipeline.md` |
| MinIO 对象 | key 必须含 `facility_id/` 前缀 |

> ⚠️ 向量检索漏过滤**不会报错**，是静默泄漏。
> ⚠️ **现状声明**：inference 侧 `facility_id` 尚未在 schema 落地，属目标态。改到相关代码先问，不要自行重构。

### 红线 3 · AI 输出非终稿 —— 临床合规
- AI 生成的临床文书统一带 `pending_review` 语义状态 + 前端「待医生确认」标识（落地形态见 `.trae/rules/phi-and-tenancy.md`，不要发明新标记方式）
- 不得自动写入正式病历；不得生成自动诊断、自动下医嘱类功能；诊疗建议必须保留人工审核环节

## 铁律
1. **修改任何模块前，先读该模块的 feature 文档**（若存在）。
2. **功能完成后，回写更新对应文档**（`docs/features/<module>.md`，用 `/spec-sync`）。文档没更新 = 功能没做完。
3. 不确定的地方先问，不要猜。
4. 文档写"意图和约束"，不写"实现细节"——代码是唯一真相源。

## 读取文档的协议
1. 先看 frontmatter 的 `status` 和 `updated`（**仅适用于 `docs/features/`**）
   - `status: deprecated` → 不读，直接问我
   - `updated` 超过 30 天 → 先对照代码验证核心契约，再采信
2. **文档与代码冲突时**：以代码为当前事实，**立即告诉我冲突在哪**。不要自行按文档改代码，也不要默默改文档。
3. **两份文档对同一件事描述不一致时**：停下来问我，不要自行选一个。
4. 模块没有 feature 文档时：先探索代码，并建议我补一份。
5. `docs/adr/` 与 `docs/序曲-*` 不受第 1 条约束，直接采信。

## 边界
- **Always**：按上方验证矩阵跑测试；代码注释用中文
- **Ask First**：修改数据库实体（`packages/db`）、改动公共 API 签名、新增依赖、新增 LLM provider、改动 prompt 模板、改 `routes/completions.py`
- **Never**：直接改 `docs/adr/` 下已有决策（要改就新建一条 ADR 说明废弃原因）；绕过脱敏中间件直连外部模型；把 PHI 写进日志
