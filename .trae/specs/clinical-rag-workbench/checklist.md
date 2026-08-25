# Checklist

## 基础架构
- [ ] Monorepo 结构创建完成（/apps/web、/apps/api、/packages/rag）
- [ ] Next.js 14 (App Router) + TypeScript + Tailwind 前端骨架创建完成
- [ ] NestJS BFF 骨架创建完成，模块化结构与配置管理就绪
- [ ] FastAPI 推理服务骨架创建完成，LangChain 集成就绪
- [ ] Docker Compose 配置可成功启动 MySQL、Milvus、MinIO、Redis
- [ ] ESLint/Prettier/Tsconfig 配置完成，代码规范统一

## 用户认证与多租户
- [ ] MySQL 表结构设计完成（tenant、user，5 种角色 admin/doctor/nurse/researcher/patient）
- [ ] NextAuth.js + JWT 认证模块实现，登录/注册接口可用
- [ ] RBAC 权限守卫实现，按角色控制接口访问
- [ ] 多租户硬隔离实现：ORM 层自动注入 facility_id 过滤，跨租户查询返回空集
- [ ] 前端登录页与路由权限控制实现

## 安全合规底座
- [ ] 字段级加密（AES-256-GCM）实现，PHI 字段在应用层加密存储
- [ ] 审计日志模块实现（who/when/what/from where，追加写入，保留 6 年）
- [ ] 合规护栏实现（越狱提示拦截、敏感词过滤）
- [ ] 全站 TLS 1.2+ 传输加密配置完成
- [ ] Synthea / MIMIC-IV-Note 合成数据集准备完成，可用于管线验证

## 数据模型与存储
- [ ] 完整 MySQL 表结构设计完成（tenant、user、document、document_chunk、audit_log、preop_report、discharge_summary、research_record、research_variable）
- [ ] TypeORM 实体定义与迁移脚本编写完成
- [ ] Milvus Collection 初始化完成，维度匹配 Embedding 模型，含 HNSW 索引
- [ ] MinIO 存储桶配置完成（文档、音频文件）

## 数据脱敏中间件
- [ ] PHI 识别器实现，可识别姓名、身份证、电话、地址、病历号等
- [ ] 脱敏替换与本地映射表（AES-256-GCM 加密）存储实现
- [ ] 结果还原器实现，占位符可还原为原始数据
- [ ] 脱敏中间件单元测试通过

## RAG 核心引擎
- [ ] 国产 LLM API 客户端封装完成，支持流式输出
- [ ] Embedding API 集成完成，向量存入 Milvus
- [ ] 文档摄取管线实现（PDF/Word/TXT/OCR 解析 -> 分块 -> 向量化 -> 存储）
- [ ] 脱敏中间件集成到 LLM 调用链（调用前脱敏、返回后还原）
- [ ] Prompt 模板管理实现（按功能模块区分）
- [ ] Celery/RQ 异步队列配置完成，批量文档摄取不阻塞主流程
- [ ] Token 成本追踪与预算告警实现
- [ ] Hybrid Search 实现（向量语义 + BM25 关键词，合并排序）
- [ ] Timeline 感知检索实现（按时间顺序拉取患者住院事件）
- [ ] Graph RAG 实现（诊疗路径与实体关系图构建）
- [ ] Schema-aware Retrieval 实现（变量字典检索 + few-shot 标注样例）
- [ ] 知识库管理接口实现（文档上传、列表、删除，经 FastAPI）

## 术前谈话记录分析
- [ ] 分析服务实现（脱敏->Hybrid Search->LLM 抽取->规则引擎校验）
- [ ] preop_report 输出结构定义完成（document_id, missing_items[], risk_points[], questions[], score）
- [ ] 规则引擎实现（对照"必须包含要素清单"校验手术风险、替代方案、患者疑问）
- [ ] 分析历史存储与查询接口实现（facility 范围内）
- [ ] 前端 /preop 页面实现（输入区、流式结果展示、完整性检查报告缺失项高亮）

## 出院随访总结
- [ ] 总结服务实现（脱敏->Timeline 检索->Graph RAG->随访指南检索->LLM 生成）
- [ ] discharge_summary 输出结构定义完成（patient_id, patient_guide, doctor_plan, followup_date）
- [ ] 患者版出院指导生成实现（简化语言、避免术语）
- [ ] 医生版随访计划生成实现（下次复查项目、预警指标）
- [ ] 随访报告 PDF/Word 导出接口实现
- [ ] 前端 /discharge 页面实现（输入区、双视图展示、导出按钮）

## 科研数据清洗
- [ ] 批量 PDF/Word/OCR 文档异步解析与字段识别实现
- [ ] 去标识化（PHI 字段检测与脱敏）实现
- [ ] Schema-aware Retrieval 实现（变量字典匹配 + few-shot 提示）
- [ ] 术语标准化实现（SNOMED/ICD-10/RxNorm/LOINC 语义检索 + 确定性校验）
- [ ] 结构化表格输出实现（每行一个患者，每列一个变量，附置信度与来源引用）
- [ ] 清洗结果导出实现（CSV/Excel + 清洗报告）
- [ ] 前端 /research 页面实现（批量上传、字段预览、清洗配置、结果导出）

## 前端集成与部署
- [ ] 工作台主布局实现（侧边导航 + 顶栏用户信息，响应式适配移动查房）
- [ ] 知识库管理前端页面实现（上传、列表、删除）
- [ ] 用户管理页面（admin）与审计日志查看页面（admin）实现
- [ ] 统一任务历史中心实现（跨模块查看历史）
- [ ] 流式输出通用组件实现（SSE/WebSocket 展示 LLM 生成过程）
- [ ] 核心模块集成测试编写完成（脱敏->RAG 多策略检索->LLM 全链路）
- [ ] 多租户隔离测试编写完成（跨 facility 查询返回空集验证）
- [ ] 审计日志完整性测试编写完成
- [ ] Docker Compose 生产配置编写完成（前端 + BFF + FastAPI + 中间件）
- [ ] 部署文档与环境变量说明编写完成
