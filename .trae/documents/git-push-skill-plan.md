# 计划：Git 一键上传 Skill（增量测试门禁 + 提交前备注确认）

## 概要

创建一个项目级 Skill（`.trae/skills/git-push/SKILL.md`），以后用户只需说"上传代码/推送代码"即可触发完整流程：

1. **增量测试门禁**：只测试本次变更涉及的模块，未改动的功能不重复测试，减少资源浪费。
2. **提交前确认**：分析变更生成 commit 备注，先给用户过目，确认后再 commit + push。
3. **完成后汇报**：展示最终提交备注、commit hash、推送结果。

Skill 设计参考了网上优秀实践（dev-git-workflow、claude-git-skills、creating-commit）：frontmatter 元信息、敏感文件检测、保护分支警告、提交风格自学习、预览后执行。

同时为项目补齐基础单元测试，让"测试门禁"真正有内容可跑。

## 现状分析（探索结论）

- 根 [package.json](file:///e:/工作空间/个人文件夹/ai-vibecoding-测试/package.json)：`test: turbo run test`。
- [apps/api/package.json](file:///e:/工作空间/个人文件夹/ai-vibecoding-测试/apps/api/package.json)：`test: jest`，但**无任何 .spec.ts 文件**。
- [apps/inference/pyproject.toml](file:///e:/工作空间/个人文件夹/ai-vibecoding-测试/apps/inference/pyproject.toml)：dev 依赖含 pytest，但**无 tests 目录**。
- web 无测试脚本；以 `pnpm --filter web exec tsc --noEmit` 作为类型检查门槛（已验证通过）。
- 仓库已关联远端 `origin = https://github.com/StudyRaise/Clinical-workbench-test.git`，分支 `main`，`.env` 已被 .gitignore 排除。
- 项目中尚无 `.trae/` 目录，skill 为新建。

## 用户已确认的决策

- 测试门槛：**补基础单测 + 现有编译检查**。
- commit 备注：**提交前确认**（生成后给用户看，确认/修改后才提交推送）。
- **增量测试**：提交没问题且未修改过的功能不重复测试。
- Skill 参考网上优秀实践定制。

## 变更内容

### 1. 新建 Skill：`.trae/skills/git-push/SKILL.md`

含 YAML frontmatter（`name: git-push`、`description` 说明功能与触发词），正文定义以下标准流程：

**Step 0 前置检查**（参考 creating-commit / claude-git-skills）
- 无变更 → 停止并提示。
- 敏感文件检测（`.env`、`*secret*`、`*token*`、`*.pem/*.key` 等）→ 警告并排除。
- 保护分支提示（在 main 上提交需用户确认）。

**Step 1 变更分析**
- `git status` / `git diff --stat` / `git log --format="%s" -15`（学习本仓库提交风格：中文 + conventional 前缀）。
- 按变更路径推断受影响模块。

**Step 2 增量测试门禁**（核心：只测改动模块）

| 变更路径 | 需要跑的检查 |
|---|---|
| `apps/api/**` | `pnpm --filter api test` + `pnpm --filter api build` |
| `apps/inference/**` | `cd apps/inference; python -m pytest tests -q` |
| `apps/web/**` | `pnpm --filter web exec tsc --noEmit` + `pnpm --filter web test` |
| `packages/**` | `pnpm build`（影响面大，全量编译） |
| 仅 `docs/**`、`*.md`、`.gitignore`、`scripts/**` | 跳过全部测试（纯文档/配置变更） |
| 未变更的模块 | 不测试 |

- 任一检查失败：停止推送，展示失败日志，修复后重跑；绝不强行推送。

**Step 3 生成并确认备注**
- 按变更类型起草中文 conventional commit 备注（feat/fix/docs/test/chore + 要点列表）。
- 用 AskUserQuestion 展示备注让用户确认或修改。

**Step 4 提交与推送**
- `git add -A`（先 `git check-ignore .env` 确认密钥文件不会被加入）。
- `git commit` → `git push`。
- 汇报：最终备注、commit hash、push 结果、变更统计。

### 2. 补基础单元测试

**api（jest）** — 新建 `apps/api/src/knowledge/knowledge.service.spec.ts`：
- `decodeFilename()`：latin1 → UTF-8 中文文件名还原（乱码修复的回归测试）。
- `getInferenceBaseUrl()`：默认值与末尾斜杠处理。
- 先读 `apps/api/package.json` 确认 jest 配置（Nest 模板一般内置）。

**inference（pytest）** — 新建 `apps/inference/tests/test_sensecore_rag_client.py`：
- `_hmac_auth_headers()`：含 `X-Date`（GMT 格式）与 `Authorization`（hmac accesskey/algorithm/signature 齐全）。
- `SenseCoreRagClient._auth_headers()`：bearer 优先、AKSK 次之、都缺时抛 `SenseCoreConfigError`。
- 纯函数/配置分支测试，不发起真实网络请求。

**web（jest，只测纯逻辑）** — 新增 `jest + ts-jest` dev 依赖与 `test: jest` 脚本（vitest 因沙箱无法写 pnpm store 改用 jest）：
- `components/markdown.test.tsx`：用 `react-dom/server` 渲染 `Markdown` 组件断言 HTML（标题/列表/代码块/链接/加粗等），node 环境即可，无需 jsdom。
- `lib/api-sse.test.ts`：把 `askKnowledgeStream` 中的 SSE 事件解析抽为可导出的纯函数（`lib/api.ts` 内导出 `createKnowledgeStreamParser`），测试 buffer 切分、delta/reasoning 累积、message 覆盖、sources 提取。
- 门禁仍为 `tsc --noEmit` + `pnpm --filter web test`。

### 3. 验证方式

1. `pnpm --filter api test` 全绿。
2. `python -m pytest apps/inference/tests -q` 全绿。
3. `pnpm --filter web exec tsc --noEmit` 与 `pnpm --filter api build` 通过。
4. 通读 SKILL.md，确认增量映射表与命令在 Windows/PowerShell 可用。
5. 本次不执行实际 push；交付后用户说"上传代码"即可按 skill 走一遍完整验证。

## 假设

- Skill 采用项目级 `.trae/skills/<name>/SKILL.md`（YAML frontmatter + Markdown，业界通用约定），无额外依赖。
- 不引入新 npm 依赖（jest 已在 api 依赖中；pytest 已在 inference dev 依赖中）。
- commit 备注沿用中文 + conventional 前缀，与现有提交历史一致。
- 增量判断以"变更文件路径 → 模块"映射为准；用户也可在说"上传代码"时附加"全量测试"覆盖默认行为。

## 参考实践

- dev-git-workflow（GitHub: vasilyu1983/AI-Agents-public）：质量门禁、conventional commits、安全默认值。
- claude-git-skills（GitHub: CarpeWu）：敏感文件检测、提交风格自学习、分析→预览→执行三步。
- creating-commit（skillmd.ai）：前置检查、按文件类型决定是否跳过检查、预览确认后提交。
