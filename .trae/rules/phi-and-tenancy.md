---
description: 涉及 PHI 处理、脱敏、租户隔离、审计时的详细规范（红线细则）
alwaysApply: false
---

# PHI 与租户隔离细则

## 脱敏的代码形态（照这个模式写）
脱敏是**调用方责任**，不是 client 层强制。每个发往 LLM 的入口必须显式：

```python
from ..desensitize import desensitize, restore

masked, mapping = desensitize(text)   # 进 LLM 前
result = restore(llm_output, mapping) # 出 LLM 后
```

参照 `routers/preop.py`、`routers/discharge.py`、`routers/research.py`。
新增 router 或 task 调 LLM 时漏掉这两步不会报错，审查时逐行核对。

**已知例外**：`routes/completions.py`（`/v1/completions` 直通端点）当前不脱敏，约定由调用方（BFF）保证不传 PHI。改动该端点前先问用户。

## 日志规范
- 禁止 log 病历原文、患者姓名/身份证/手机号
- 报错堆栈中含文本 payload 的，只记录脱敏后内容或长度/hash

## AI 输出非终稿的落地形态
- BFF 业务响应中 AI 生成内容带 `status: "pending_review"` 语义字段
- 前端对应页面展示「待医生确认」标识
- 新增 AI 生成类功能时沿用同一形态，不要发明新的标记方式

## 审计
- 业务写操作经 BFF `audit` 模块留痕（who/when/what/from where）
- 审计表只追加，不提供更新/删除路径
