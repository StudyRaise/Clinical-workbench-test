"""RAG 检索增强生成模块。

包含：文本分块、向量化、混合检索、Timeline 检索、Graph RAG、Schema-aware 检索。
各子模块尽量独立，外部依赖不可用时降级，不阻塞整体管线。
"""
