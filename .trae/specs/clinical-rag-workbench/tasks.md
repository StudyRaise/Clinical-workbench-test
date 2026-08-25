# Tasks

## Phase 1: 基础架构与安全底座

- [ ] Task 1: 项目初始化与三层架构搭建
  - [ ] SubTask 1.1: 创建 Monorepo 结构（/apps/web Next.js、/apps/api NestJS、/packages/rag FastAPI）
  - [ ] SubTask 1.2: 创建 Next.js 14 (App Router) + TypeScript + Tailwind 前端骨架
  - [ ] SubTask 1.3: 创建 NestJS BFF 骨架（模块化结构、配置管理、环境变量）
  - [ ] SubTask 1.4: 创建 FastAPI 推理服务骨架（LangChain 集成、RAG 编排入口）
  - [ ] SubTask 1.5: 编写 Docker Compose 配置（MySQL、Milvus、MinIO、Redis for Celery）
  - [ ] SubTask 1.6: 配置 ESLint/Prettier/Tsconfig，统一代码规范

- [ ] Task 2: 用户认证与多租户隔离
  - [ ] SubTask 2.1: 设计 MySQL 表结构（tenant、user，role ∈ {admin, doctor, nurse, researcher, patient}）
  - [ ] SubTask 2.2: 集成 NextAuth.js + JWT 认证模块（登录/注册/Token 签发与校验）
  - [ ] SubTask 2.3: 实现 RBAC 权限守卫（Guard），按角色控制接口访问
  - [ ] SubTask 2.4: 实现多租户硬隔离：ORM 层自动注入 facility_id 过滤，跨租户查询返回空集
  - [ ] SubTask 2.5: 实现前端登录页与路由权限控制

- [ ] Task 3: 安全合规底座
  - [ ] SubTask 3.1: 实现字段级加密（AES-256-GCM），对 PHI 字段在应用层加密存储
  - [ ] SubTask 3.2: 实现审计日志模块（who/when/what/from where，追加写入，保留 6 年）
  - [ ] SubTask 3.3: 实现合规护栏（guardrails）：越狱提示拦截、敏感词过滤
  - [ ] SubTask 3.4: 实现全站 TLS 1.2+ 传输加密配置
  - [ ] SubTask 3.5: 准备 Synthea / MIMIC-IV-Note 合成数据集，用于管线验证

## Phase 2: RAG 核心引擎

- [ ] Task 4: 数据模型与存储层
  - [ ] SubTask 4.1: 设计完整 MySQL 表结构（tenant、user、document、document_chunk、audit_log、preop_report、discharge_summary、research_record、research_variable）
  - [ ] SubTask 4.2: 编写 TypeORM 实体定义与迁移脚本
  - [ ] SubTask 4.3: 初始化 Milvus Collection（维度匹配 Embedding 模型，含 HNSW 索引）
  - [ ] SubTask 4.4: 配置 MinIO 存储桶（文档、音频文件）

- [ ] Task 5: 数据脱敏中间件
  - [ ] SubTask 5.1: 实现 PHI 识别器（正则匹配姓名、身份证、电话、地址、病历号等）
  - [ ] SubTask 5.2: 实现脱敏替换与本地映射表（AES-256-GCM 加密存储）
  - [ ] SubTask 5.3: 实现结果还原器（占位符->原始数据）
  - [ ] SubTask 5.4: 编写脱敏中间件单元测试

- [ ] Task 6: FastAPI 推理服务与 RAG 管道
  - [ ] SubTask 6.1: 封装国产 LLM API 客户端（通义千问/DeepSeek），支持流式输出
  - [ ] SubTask 6.2: 集成 Embedding API（通义千问 text-embedding-v2），生成向量存入 Milvus
  - [ ] SubTask 6.3: 实现文档摄取管线（PDF/Word/TXT/OCR 解析 -> 分块 -> 向量化 -> 存储）
  - [ ] SubTask 6.4: 集成脱敏中间件到 LLM 调用链（调用前脱敏、返回后还原）
  - [ ] SubTask 6.5: 实现 Prompt 模板管理（按功能模块区分）
  - [ ] SubTask 6.6: 配置 Celery/RQ 异步队列（批量文档摄取任务）
  - [ ] SubTask 6.7: 实现 Token 成本追踪与预算告警

- [ ] Task 7: 多策略检索引擎
  - [ ] SubTask 7.1: 实现 Hybrid Search（向量语义检索 + BM25 关键词检索，合并排序）
  - [ ] SubTask 7.2: 实现 Timeline 感知检索（按时间顺序拉取患者住院关键事件）
  - [ ] SubTask 7.3: 实现 Graph RAG（诊疗路径与实体关系图构建）
  - [ ] SubTask 7.4: 实现 Schema-aware Retrieval（变量字典检索 + few-shot 标注样例）
  - [ ] SubTask 7.5: 实现知识库管理接口（文档上传、列表、删除，经 FastAPI）

## Phase 3: 三大业务功能

- [ ] Task 8: 术前谈话记录分析
  - [ ] SubTask 8.1: 实现分析服务（脱敏->Hybrid Search 检索历史案例与质控指南->LLM 抽取关键信息->规则引擎校验）
  - [ ] SubTask 8.2: 定义 preop_report 输出结构（document_id, missing_items[], risk_points[], questions[], score）
  - [ ] SubTask 8.3: 实现规则引擎（对照"必须包含要素清单"校验手术风险、替代方案、患者疑问等）
  - [ ] SubTask 8.4: 实现分析历史存储与查询接口（facility 范围内）
  - [ ] SubTask 8.5: 实现前端 /preop 页面（输入区、流式结果展示、完整性检查报告缺失项高亮）

- [ ] Task 9: 出院随访总结
  - [ ] SubTask 9.1: 实现总结服务（脱敏->Timeline 检索->Graph RAG->检索随访指南->LLM 生成）
  - [ ] SubTask 9.2: 定义 discharge_summary 输出结构（patient_id, patient_guide, doctor_plan, followup_date）
  - [ ] SubTask 9.3: 实现患者版出院指导生成（简化语言、避免术语）
  - [ ] SubTask 9.4: 实现医生版随访计划生成（下次复查项目、预警指标）
  - [ ] SubTask 9.5: 实现随访报告 PDF/Word 导出接口
  - [ ] SubTask 9.6: 实现前端 /discharge 页面（输入区、双视图展示、导出按钮）

- [ ] Task 10: 科研数据清洗
  - [ ] SubTask 10.1: 实现批量 PDF/Word/OCR 文档异步解析与字段识别
  - [ ] SubTask 10.2: 实现去标识化（PHI 字段检测与脱敏）
  - [ ] SubTask 10.3: 实现 Schema-aware Retrieval（变量字典匹配 + few-shot 提示）
  - [ ] SubTask 10.4: 实现术语标准化（SNOMED/ICD-10/RxNorm/LOINC 语义检索 + 确定性校验）
  - [ ] SubTask 10.5: 实现结构化表格输出（每行一个患者，每列一个变量，附置信度与来源引用）
  - [ ] SubTask 10.6: 实现清洗结果导出（CSV/Excel + 清洗报告）
  - [ ] SubTask 10.7: 实现前端 /research 页面（批量上传、字段预览、清洗配置、结果导出）

## Phase 4: 前端集成与部署

- [ ] Task 11: 前端工作台集成
  - [ ] SubTask 11.1: 实现工作台主布局（侧边导航 + 顶栏用户信息，响应式适配移动查房）
  - [ ] SubTask 11.2: 实现知识库管理前端页面（上传、列表、删除）
  - [ ] SubTask 11.3: 实现用户管理页面（admin）与审计日志查看页面（admin）
  - [ ] SubTask 11.4: 实现统一任务历史中心（跨模块查看分析/随访/清洗历史）
  - [ ] SubTask 11.5: 实现流式输出通用组件（SSE/WebSocket 展示 LLM 生成过程）

- [ ] Task 12: 集成测试与部署
  - [ ] SubTask 12.1: 编写核心模块集成测试（脱敏->RAG 多策略检索->LLM 全链路）
  - [ ] SubTask 12.2: 编写多租户隔离测试（跨 facility 查询返回空集验证）
  - [ ] SubTask 12.3: 编写审计日志完整性测试
  - [ ] SubTask 12.4: 编写 Docker Compose 生产配置（前端 + BFF + FastAPI + 中间件）
  - [ ] SubTask 12.5: 编写部署文档与环境变量说明

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 3] (字段加密)
- [Task 6] depends on [Task 4, Task 5]
- [Task 7] depends on [Task 6]
- [Task 8] depends on [Task 7] (Hybrid Search)
- [Task 9] depends on [Task 7] (Timeline + Graph RAG)
- [Task 10] depends on [Task 7] (Schema-aware)
- [Task 11] depends on [Task 8, Task 9, Task 10]
- [Task 12] depends on [Task 11]
