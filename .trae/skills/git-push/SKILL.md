---
name: git-push
description: 一键上传代码到 GitHub。触发词："上传代码""推送代码""提交到 GitHub""git push"。流程：前置检查 → 变更分析 → 增量测试门禁（只测改动模块）→ 生成 commit 备注并提交前确认 → commit + push → 汇报结果。
---

# Git 一键上传（测试门禁 + 提交前备注确认）

用户说"上传代码 / 推送代码 / 提交到 GitHub"时，严格按以下流程执行。
用户附加"全量测试"时，忽略增量映射，跑全部检查。

## Step 0 前置检查

1. `git status` 无变更 → 停止并提示"没有需要提交的变更"。
2. **敏感文件检测**：待提交文件中出现 `.env`、`*secret*`、`*token*`、`*.pem`、`*.key`、`*credentials*` 等 → 警告并从提交中排除，确认 `.gitignore` 已覆盖。
3. **保护分支提示**：当前在 `main`/`master` 上时，告知用户并确认继续（本仓库工作流即直接提交 main，确认一次即可）。

## Step 1 变更分析

```powershell
git status
git diff --stat HEAD
git log --format="%s" -15   # 学习本仓库提交风格：中文 + conventional 前缀
```

按变更文件路径推断受影响模块，决定 Step 2 跑哪些检查。

## Step 2 增量测试门禁（核心：只测改动模块，未改动功能不重复测试）

| 变更路径 | 需要跑的检查 |
|---|---|
| `apps/api/**` | `pnpm --filter api test` + `pnpm --filter api build` |
| `apps/inference/**` | `cd apps/inference; python -m pytest tests -q` |
| `apps/web/**` | `pnpm --filter web exec tsc --noEmit` + `pnpm --filter web test` |
| `packages/**` | `pnpm build`（影响面大，全量编译） |
| 仅 `docs/**`、`*.md`、`.gitignore`、`.trae/**`、`scripts/**` | 跳过全部测试（纯文档/配置变更） |
| 未变更的模块 | 不测试 |

规则：
- 任一检查失败 → **停止推送**，展示失败日志摘要，修复后从 Step 2 重跑；绝不强行推送。
- 测试运行在工作区根目录 `e:\工作空间\个人文件夹\ai-vibecoding-测试`，PowerShell 环境。

## Step 3 生成并确认备注

1. 按变更类型起草中文 conventional commit 备注：首行 `type: 摘要`（feat/fix/docs/test/chore/refactor），正文为要点列表（每条一行，聚焦"为什么"）。
2. 用 **AskUserQuestion** 把备注完整展示给用户，选项："确认提交 / 修改备注"。确认前绝不 commit。

## Step 4 提交与推送

```powershell
git check-ignore .env   # 必须先确认密钥文件已被忽略
git add -A
git commit -m "<首行>" -m "<要点1>" -m "<要点2>"   # 每条要点一个 -m
git push
```

## Step 5 汇报

向用户展示：
- 最终 commit 备注全文
- commit hash（`git log --oneline -1`）
- push 结果与远端（origin → github.com/StudyRaise/Clinical-workbench-test）
- 本次提交的文件变更统计（`git show --stat HEAD` 摘要）
