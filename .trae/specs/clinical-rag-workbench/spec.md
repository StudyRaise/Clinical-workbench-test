# 临床 AI 工作台（RAG）Spec

## Why
临床工作中存在大量高价值但重复性强的文书与数据处理工作：术前谈话记录需人工核对合规要素、出院随访需手动归纳总结、科研数据需逐条清洗脱敏。基于 RAG（检索增强生成）的 AI 工作台可结合医疗知识库自动完成信息抽取、合规校验与数据清洗，将三类典型需求统一在一个产品内，显著提升效率并降低错误率。

## What Changes
- 新建临床 AI 工作台全栈应用，包含三大核心功能模块（术前谈话分析 / 出院随访总结 / 科研数据清洗）
- 搭建三层架构：Next.js 前端 + NestJS 业务后端（BFF）+ FastAPI 推理服务
- 实现 RAG 引擎：文档摄取 -> 向量存储 -> 检索 -> 生成，支持 Hybrid Search、Timeline 检索、Graph RAG、Schema-aware Retrieval
- 实现多租户硬隔离：ORM/数据库层强制 facility_id 过滤，跨院区数据物理不可见
- 实现审计日志：每次 PHI 访问记录 who/when/what/from where，防篡改，保留 6 年
- 实现数据脱敏中间件与合规护栏（guardrails），支撑混合部署模式下 PHI 数据保护
- 实现基于 NextAuth.js + JWT 的认证与 RBAC 权限控制（admin/doctor/nurse/researcher/patient）
- 集成国产 LLM API（通义千问/DeepSeek 等）作为推理后端，支持流式响应与 Token 成本追踪
- 字段级加密（AES-256-GCM），不只依赖数据库级加密

### 三大功能模块
1. **术前谈话记录分析**：输入谈话录音（ASR 转写）/文本/知情同意书草稿，Hybrid Search 检索历史案例与质控指南，规则引擎校验法定告知要素完整性
2. **出院随访总结**：输入出院小结/病程记录/医嘱/检验结果，Timeline 检索 + Graph RAG 理清诊疗路径，生成患者版通俗指导与医生版随访计划
3. **科研数据清洗**：上传批量 PDF/Word 报告（含 OCR 扫描件），Schema-aware Retrieval + 术语标准化（SNOMED/ICD-10/RxNorm/LOINC），输出结构化表格附置信度与来源引用

### 技术选型
| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 (App Router) + TypeScript + Tailwind | 三模块共用前端外壳 |
| 业务后端（BFF） | NestJS + TypeScript | 多租户业务逻辑、RBAC、审计中间件 |
| 推理服务 | FastAPI (Python) | 文档摄取、嵌入、重排、LLM 调用、RAG 编排 |
| RAG 框架 | LangChain (Python) | Hybrid Search、Graph RAG、Schema-aware Retrieval |
| LLM | 国产 API（通义千问 / DeepSeek） | 经脱敏中间件调用，支持流式响应 |
| Embedding | 国产 Embedding API（通义千问 text-embedding-v2） | |
| 向量数据库 | Milvus | 医疗知识库向量存储与检索 |
| 关系数据库 | MySQL | 业务数据（租户、用户、文档、审计日志） |
| 对象存储 | MinIO | 文档、音频文件 |
| 认证 | NextAuth.js + JWT | 双重认证隔离 |
| 异步队列 | Celery / RQ (Python) | 批量文档摄取与科研清洗不阻塞主流程 |
| 部署 | Docker Compose（本地核心）+ 云端 LLM API | 混合部署模式 |

## Impact
- 新建项目，无既有代码受影响
- 依赖外部服务：Milvus、MySQL、MinIO、国产 LLM API
- 涉及医疗数据隐私，需严格执行 PHI 脱敏与合规审查流程
- 使用合成数据（Synthea / MIMIC-IV-Note）起步，真实 PHI 数据接入需合规审查

## ADDED Requirements

### Requirement: 多租户硬隔离
系统 SHALL 在 ORM 与数据库查询层强制 facility_id 过滤，确保跨院区数据物理不可见，不只依赖 UI 隐藏。

#### Scenario: 租户数据隔离
- **WHEN** 任何用户发起数据查询
- **THEN** 系统在 ORM 层自动注入用户所属 facility_id 过滤条件
- **AND** 跨租户数据查询返回空结果集
- **AND** 服务端 API 层与数据库层双重强制，绕过 UI 无法越权访问

### Requirement: 审计日志
系统 SHALL 对每次 PHI 访问记录审计日志，包含 who/when/what/from where，防篡改，保留 6 年。

#### Scenario: PHI 访问审计
- **WHEN** 任何用户访问包含 PHI 的数据
- **THEN** 系统自动记录审计日志（用户 ID、操作时间、操作内容、目标对象、来源 IP）
- **AND** 日志写入后不可修改、不可删除（追加写入模式）
- **AND** 日志保留期不少于 6 年

### Requirement: 安全与合规护栏
系统 SHALL 实现字段级加密、传输加密、合规护栏与合成数据起步机制，满足医疗数据安全要求。

#### Scenario: 字段级加密
- **WHEN** 系统 存储 PHI 字段（姓名、身份证号、电话等）
- **THEN** 系统使用 AES-256-GCM 对敏感字段加密存储
- **AND** 加密在应用层执行，不只依赖数据库级加密

#### Scenario: 合规护栏
- **WHEN** 用户输入或 LLM 输出包含敏感内容（越狱提示、敏感词）
- **THEN** 护栏拦截并记录告警
- **AND** 拒绝处理或返回安全提示

#### Scenario: 合成数据起步
- **WHEN** 系统处于开发与验证阶段
- **THEN** 使用 Synthea 或 MIMIC-IV-Note 合成数据验证管线
- **AND** 真实 PHI 绝不输入公开 AI 工具，接入真实 EMR 前需合规审查与签署 BAA

### Requirement: RAG 核心引擎
系统 SHALL 提供医疗知识库管理能力，支持文档摄取、分块、向量化存储与多种检索策略（Hybrid Search、Timeline、Graph RAG、Schema-aware），为三大业务模块提供检索增强生成基础。

#### Scenario: 文档摄取与向量化
- **WHEN** 管理员上传医疗文档（PDF/Word/TXT/扫描件 OCR）
- **THEN** 系统异步分块（chunk），调用 Embedding API 生成向量
- **AND** 将向量与元数据存入 Milvus，文档原文存入 MinIO
- **AND** 返回知识库条目 ID 与处理状态

#### Scenario: Hybrid Search（术前谈话模块）
- **WHEN** 术前谈话模块提交检索查询
- **THEN** 系统同时执行向量语义检索与 BM25 关键词检索
- **AND** 合并结果并按相关性分数排序返回 Top-K 文档块

#### Scenario: Timeline 感知检索（出院随访模块）
- **WHEN** 出院随访模块提交患者住院期间检索
- **THEN** 系统按时间顺序拉取患者住院关键事件
- **AND** 结合 Graph RAG 理清诊疗路径与实体关系

#### Scenario: Schema-aware Retrieval（科研清洗模块）
- **WHEN** 科研清洗模块提交字段抽取检索
- **THEN** 系统从预定义变量字典（ICD 编码、药物名称、分期标准）中检索匹配规则
- **AND** 检索相似病例标注样例作为 few-shot 提示

### Requirement: 数据脱敏中间件
系统 SHALL 在调用云端 LLM API 前对所有输入文本执行 PHI 脱敏，确保患者隐私数据不出院。

#### Scenario: 脱敏处理
- **WHEN** 系统准备将文本发送至云端 LLM API
- **THEN** 中间件识别并替换 PHI（姓名->[姓名]、身份证号->[身份证]、电话->[电话]、地址->[地址]等）
- **AND** 保留脱敏映射表于本地（AES-256-GCM 加密存储），用于结果还原
- **AND** 仅将脱敏后文本发送至 API

#### Scenario: 结果还原
- **WHEN** LLM 返回处理结果
- **THEN** 系统根据本地映射表将占位符还原为原始 PHI 数据
- **AND** 将还原后的结果返回给用户

### Requirement: 用户认证与权限管理
系统 SHALL 提供基于 NextAuth.js + JWT 的用户认证和 RBAC 权限控制，支持 admin、doctor、nurse、researcher、patient 五种角色。

#### Scenario: 用户登录
- **WHEN** 用户提交凭据
- **THEN** 系统通过 NextAuth.js 验证并签发 JWT Token
- **AND** 返回 Token、用户角色与所属 facility_id

#### Scenario: 权限校验
- **WHEN** 用户访问受限资源
- **THEN** 系统校验 JWT 并检查角色权限
- **AND** 按角色控制功能访问（admin 管理租户/用户/知识库，doctor 使用分析与随访，nurse 查看随访，researcher 使用数据清洗，patient 查看出院指导）

### Requirement: 术前谈话记录分析
系统 SHALL 提供术前谈话记录分析功能，基于 Hybrid Search 检索历史同类手术谈话记录、并发症统计数据与质控指南，结合规则引擎校验谈话合规性与完整性。

#### Scenario: 谈话记录分析
- **WHEN** 医务科/质控办输入谈话录音（ASR 转写）、谈话记录文本或知情同意书草稿
- **THEN** 系统执行 PHI 脱敏后，Hybrid Search 检索历史案例与质控指南
- **AND** 调用 LLM 抽取关键信息：手术名称、风险告知、替代方案、患者同意意愿、并发症说明
- **AND** 规则引擎对照"必须包含要素清单"校验是否覆盖手术风险、替代方案、患者疑问等
- **AND** 生成谈话完整性检查报告（缺失项高亮）、风险点摘要、患者疑问清单

#### Scenario: 分析历史查询
- **WHEN** 用户查看历史分析记录
- **THEN** 系统返回该 facility 范围内的分析历史列表，支持按时间/手术名称筛选

### Requirement: 出院随访总结
系统 SHALL 提供出院随访总结功能，基于 Timeline 感知检索与 Graph RAG 理清诊疗路径，检索疾病标准随访指南，生成患者版通俗指导与医生版随访计划。

#### Scenario: 随访记录总结
- **WHEN** 临床医生输入出院小结草稿、病程记录、用药记录、实验室结果、出院医嘱
- **THEN** 系统执行 PHI 脱敏后，Timeline 检索按时间顺序拉取患者住院关键事件
- **AND** Graph RAG 理清诊疗路径与实体关系
- **AND** 检索该疾病标准随访指南（复查时间、药物调整规则）
- **AND** 调用 LLM 生成两份输出：
  - 患者版出院指导：简化语言、避免术语
  - 医生版随访计划：下次复查项目、预警指标

#### Scenario: 随访报告导出
- **WHEN** 医生请求导出随访报告
- **THEN** 系统生成 PDF/Word 格式的结构化随访报告（含患者指导与医生计划）

### Requirement: 科研数据清洗
系统 SHALL 提供科研数据清洗功能，从非结构化临床文本中抽取结构化字段，结合术语标准化库（SNOMED/ICD-10/RxNorm/LOINC）做语义检索与确定性校验双保险，输出附置信度与来源引用的结构化表格。

#### Scenario: 数据上传与清洗
- **WHEN** 科研团队/CRC 上传批量 PDF/Word 报告（含 OCR 扫描件）
- **THEN** 系统异步解析文档，识别 PHI 字段并执行去标识化
- **AND** Schema-aware Retrieval 从变量字典中检索匹配规则
- **AND** 检索相似病例标注样例作为 few-shot 提示
- **AND** 术语标准化：结合 SNOMED/ICD-10/RxNorm/LOINC 做语义检索 + 确定性校验
- **AND** 生成结构化表格（每行一个患者，每列一个变量），附带置信度与来源引用

#### Scenario: 清洗结果导出
- **WHEN** 研究员确认清洗结果
- **THEN** 系统导出结构化表格（CSV/Excel）及清洗报告（清洗项数、去标识字段、标准化映射、置信度分布）

### Requirement: 前端工作台界面
系统 SHALL 提供基于 Next.js 14 的统一 Web 工作台，集成三大功能模块（/preop、/discharge、/research）、知识库管理、用户管理与审计日志查看，支持流式响应与响应式布局。

#### Scenario: 工作台导航
- **WHEN** 用户登录后进入工作台
- **THEN** 显示功能导航：术前谈话分析、出院随访总结、科研数据清洗、知识库管理（admin）、用户管理（admin）、审计日志（admin）
- **AND** 根据角色权限显示/隐藏对应入口
- **AND** 布局响应式，适配医生工作站与移动查房场景

#### Scenario: 功能页面交互
- **WHEN** 用户进入任一功能模块
- **THEN** 显示输入区域（文本框/文件上传）、分析按钮、结果展示区
- **AND** LLM 生成采用流式响应（SSE/WebSocket），实时展示生成过程

### Requirement: 性能与可用性
系统 SHALL 支持异步队列处理批量文档、流式 LLM 响应、重试/超时/降级策略与 Token 成本实时追踪。

#### Scenario: 异步文档摄取
- **WHEN** 大批量科研清洗文档上传
- **THEN** 系统将摄取与向量化任务加入异步队列（Celery/RQ）
- **AND** 不阻塞主流程，用户可继续其他操作
- **AND** 任务完成后通知用户

#### Scenario: Token 成本追踪
- **WHEN** LLM API 调用产生 Token 消耗
- **THEN** 系统实时记录 Token 用量与成本
- **AND** 达到预算阈值时触发告警
