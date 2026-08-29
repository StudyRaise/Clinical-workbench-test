---
name: chinese-comments
description: 代码注释与文档说明统一使用中文。触发词："注释用中文""中文注释"。适用于本仓库所有新增/修改代码（TypeScript、Python、Shell、批处理、配置注释等）。
---

# 中文注释规范

本仓库所有代码注释、文档字符串、提交说明一律使用**中文**。

## 规则

1. **新增代码**：所有注释（单行 `//`、`#`，块注释 `/* */`，文档注释 `/** */`、`"""docstring"""`）必须用中文书写。
2. **修改已有代码**：改动到的注释同步改为中文；未触碰的旧注释不必专程重写。
3. **例外**（保持英文或原文）：
   - 代码标识符本身（变量名、函数名、类名）；
   - 第三方协议要求的固定字段（如 HTTP 头名、API 字段名、错误码）；
   - 引用官方文档的专有名词（可中英并置，如"HMAC 鉴权（HMAC-SHA256）"）；
   - 日志中需要与外部系统对账的技术短语。
4. **文档文件**：README、`.trae/documents/` 下的计划/设计文档、skill 文件正文均用中文。
5. **commit 备注**：遵循仓库现有风格——中文 + conventional 前缀（`feat:`、`fix:`、`docs:`、`test:`、`chore:`、`refactor:`）。

## 示例

```python
# 好：商汤 glm-5.2 处于思考模式，内容在 reasoning_content 字段
delta = chunk.get("reasoning_content") or chunk.get("delta")
```

```typescript
/** multer 按 latin1 解码文件名，中文需转回 UTF-8 */
export function decodeUploadFilename(name: string): string { ... }
```
