# P0 提案：Skill 冲突收敛 + flag 心智统一

- **Change ID**: `P0-skill-consolidation`
- **Status**: Draft（待审）
- **Author**: WF 工作流诊断（`/Users/zxs/.claude/plans/wf-spicy-pudding.md`）
- **日期**: 2026-05-11
- **预计影响**: skill 数 26 → 22，常驻 context ~2.6K → ~2.2K tokens，自动触发冲突面从 4 组降到 0 组
- **不含**：任何代码/workflow/CLI 改动（纯 skill metadata + 1 份文档新增）

## Why

WF 诊断报告识别出自动触发区（12 个 skill）有 4 组语义冲突，用户的同一句话会命中多个 skill；12 个 flag 散落在 9 个 workflow 里缺乏统一心智。这是**新用户易用性从 5/10 升到 7/10 的最小改动路径**——不动架构、不动代码、只动 skill frontmatter 和一份新文档。

冲突的具体表现：

| 用户输入 | 当前命中 | 期望 |
|---|---|---|
| "下一步做什么？" | `wf-next` + `wf-progress` 都可能命中 | 1 个命中 |
| "帮我改一下 X" | `wf-quick` / `wf-propose` / `wf-apply-change` 三者争抢 | 1 个命中 |
| "验证这个阶段" | `wf-verify-work` / `wf-4-level-verification` / `wf-code-review` 三者争抢 | 1 个命中（其他降为后台知识） |
| 任意 git commit | `wf-git-conventions` 在非 WF 仓库也会触发 | 仅 WF 仓库触发 |

## What Changes

### 1. 合并 `wf-next + wf-progress` → `wf-status`

**现状**：两者 description 都回答"现在在哪 + 下一步去哪"。

**方案**：保留 `wf-progress` skill 目录但改名为 `wf-status`，description 统一表述为 "query current WF state and suggest next step"；**删除** `wf-next` skill 目录。`wf/workflows/next.md` 和 `wf/workflows/progress.md` 合并为一个 `wf/workflows/status.md`（或 progress.md 保留，next.md 删除，status skill 引用 progress.md）。

**对外兼容**：保留 `/wf-progress` 和 `/wf-next` 作为 alias（通过 skill name 的 `aliases` 字段，如果 Claude Code 支持；否则让 `wf-do` 的路由表把这两个旧意图映射到 `wf-status`）。

**Frontmatter diff**：
```yaml
# BEFORE: wf-next/SKILL.md
description: Route to the next WF step based on current state. Use when the user asks "what's next", "continue", "下一步", or when they've finished one WF step and need guidance on which workflow to run next.

# BEFORE: wf-progress/SKILL.md
description: Show WF project progress. Use when the user asks about project status, what's done, what's remaining, current phase progress, percentage complete, or "how far along are we".

# AFTER: wf-status/SKILL.md（单一 skill）
description: Show WF project state and recommend next step. Use when the user asks about current phase, progress, what's done, what's next, or "继续/下一步/现在怎么样". Replaces wf-next and wf-progress.
```

### 2. `wf-4-level-verification` 降级为后台知识

**现状**：`user-invocable: true`，与 `wf-verify-work` / `wf-code-review` 的自动触发争抢。

**方案**：frontmatter 改为 `user-invocable: false`（参照 `wf-gates` 模式）。内容不变，保留 reference 价值；`wf-verify-work` 和 `wf-execute-phase` 已经在文档里引用它，改成后台引用即可。

**Frontmatter diff**：
```yaml
# BEFORE
description: Verify implementation against phase or feature goals using WF's 4-level model...
user-invocable: true

# AFTER
description: WF 4-level verification model (EXISTS / SUBSTANTIVE / WIRED / DATA-FLOWING). Claude references this when evaluating phase completion or feature readiness during verify-work / execute-phase.
user-invocable: false
```

### 3. `wf-anti-patterns` 降级为后台知识

**现状**：`user-invocable: true`，但本质是"事前危险动作警告清单"，不是用户主动调用的工作流。

**方案**：`user-invocable: false`。让 Claude 在执行敏感操作（直接改 STATE.md、嵌套 Task() 等）时自动参考。

**Frontmatter diff**：
```yaml
# BEFORE
description: WF workflow anti-patterns. Use when about to manually edit STATE.md, nest Task() calls...
user-invocable: true

# AFTER
description: WF workflow anti-patterns reference (manual STATE.md edits, nested Task(), skipping verification, ignoring context budget). Claude references this before executing sensitive actions in a WF project.
user-invocable: false
```

### 4. `wf-git-conventions` 加 negative trigger + 收紧触发条件

**现状**：description 只说 "in a WF project"，但 Claude 在任何仓库敲 commit 都会触发。

**方案**：两种选一：
- **方案 A（推荐）**：保留 `user-invocable: true`，但 description 显式加 "SKIP when no `.planning/` directory exists"。Claude 在触发前会读环境，有 `.planning/` 才激活。
- **方案 B**：降为 `user-invocable: false`，让 `wf-execute-phase` / `wf-apply-change` / `wf-complete-milestone` 主动引用。

**推荐方案 A 的 frontmatter diff**：
```yaml
# BEFORE
description: Apply WF git conventions - commit message scope (phase-N / change-id / milestone), branch naming...

# AFTER
description: Apply WF git commit scope (phase-N / change-id / milestone), branch naming, worktree merge strategy. Use ONLY in WF projects (has .planning/ directory). SKIP when committing in non-WF repos — fall back to project-local conventions.
```

### 5. 新增 `docs/wf-flags-cheatsheet.md`

把 12 个 flag 整理成一张表，放在 `docs/` 里，并在 `ARCHITECTURE.md` 链接。内容结构：

```markdown
# WF Flag Cheatsheet

| Flag | 归属 workflow | 解决什么问题 | 可组合 | 典型用法 |
|---|---|---|---|---|
| --auto | new-project, discuss-phase | 无人值守默认选项 | 与 --chain | /wf-new-project --auto |
| --chain | discuss/plan/execute | 自动进入下一 step | 与 --auto | /wf-plan-phase 2 --chain |
| --smoke | verify-work | 跳过对话式 UAT | 不可与 --full | 内部 autonomous 调用 |
| --skip-research | plan-phase | 跳过实现调研 | 与 --chain | 已有类似 PLAN 时 |
| --from N / --to N / --only N | autonomous | 限定阶段范围 | 互斥 | /wf-autonomous --from 2 --to 4 |
| --interactive | autonomous | 每 step 暂停确认 | 与 --from/--to | 半自动模式 |
| --full | quick | 小任务走研究+规划+执行 | 与 --spec 互斥 | 复杂 bug |
| --validate | quick | 跑验证 | 独立 | 改完想立即确认 |
| --discuss / --research | quick | 轻量讨论/调研 | 独立 | 决策前 |
| --spec | quick | 走 propose → validate → apply → archive 短链 | 与 --full 互斥 | 有 spec 的变更 |
```

## Capabilities

### New Capabilities

- `wf-status`: 合并 wf-next + wf-progress 的单一状态查询 + 下一步推荐入口

### Modified Capabilities

- `wf-4-level-verification`: user-invocable → false（降为 reference）
- `wf-anti-patterns`: user-invocable → false（降为 reference）
- `wf-git-conventions`: description 加 negative trigger（仅 WF 仓库触发）

### Removed Capabilities

- `wf-next`: 合并入 `wf-status`（功能保留，入口合一）

## Impact

**文件改动（全部只改 skill frontmatter 或文档，不动代码）**：

| 文件 | 动作 | 说明 |
|---|---|---|
| `wf/skills/wf-next/` | 删除目录 | 功能合入 wf-status |
| `wf/skills/wf-progress/` | 重命名为 `wf-status/` | 更新 SKILL.md description |
| `wf/workflows/next.md` | 删除或合并 | 保留 progress.md 即可 |
| `wf/skills/wf-4-level-verification/SKILL.md` | frontmatter 改 | `user-invocable: false` |
| `wf/skills/wf-anti-patterns/SKILL.md` | frontmatter 改 | `user-invocable: false` |
| `wf/skills/wf-git-conventions/SKILL.md` | frontmatter 改 | description 加 negative trigger |
| `docs/wf-flags-cheatsheet.md` | 新增 | flag 对照表 |
| `wf/workflows/do.md` | 路由表更新 | wf-next → wf-status |
| `ARCHITECTURE.md` | 文档同步 | skill 清单数量 26 → 25，触发策略表更新 |
| `README.md` | 文档同步 | skill 数量、触发策略 |
| `docs/workflow-diagram.md` | 文档同步 | skill 列表 |
| `docs/wf-architecture.md` | 文档同步 | skill 清单 |
| `hooks/wf-statusline.js` | **审查**（可能无需改） | 若引用 wf-next/wf-progress 名称则更新 |
| `hooks/wf-statusline.test.cjs` | **审查** | 若测了旧名则更新 |

注：本次不改 `settings.json`（不涉及 hook 绑定）、不改 CLI（不涉及 wf-tools 子命令）、不改 agent 文件。

## 风险与回滚

- **风险 1**：Claude Code 对 skill 重命名的兼容性未知。缓解：先在 `wf-status/` 下保留旧 `wf-progress` 的完整内容，仅新增；跑通后再删 `wf-next/`。
- **风险 2**：`wf-4-level-verification` 降级后，用户若输入 "用 4-level 验证这个阶段"会失效。缓解：`wf-verify-work` 的 description 加一句"内部使用 4-level 模型"。
- **风险 3**：`wf-git-conventions` 的 negative trigger 依赖 Claude 正确理解"SKIP when..."指令。这是 description 层的约束，不是硬门。若不够强，退回方案 B（降为后台知识）。
- **回滚路径**：全部改动都是 frontmatter 或文档层面，git revert 一次提交即可恢复。

## 验证

按 `wf-spicy-pudding.md` 验证章节：

1. `ls wf/skills/ | wc -l` 应从 26 降到 25（删 wf-next，合并至 wf-status）
2. `grep -l "user-invocable: false" wf/skills/*/SKILL.md | wc -l` 应从 2 增到 4（+4-level, +anti-patterns）
3. 人工场景测试：
   - 输入"下一步做什么" → 只命中 `wf-status`
   - 输入"验证阶段 2" → 只命中 `wf-verify-work`
   - 输入"我要加一个功能" → 只命中 `wf-quick` 或 `wf-propose`（依据 `config.spec.enabled`）
   - 在非 WF 仓库 `git commit` → `wf-git-conventions` 不触发

## 执行顺序（建议 commit 粒度）

1. `feat(change-P0): add wf-status skill (merge wf-next + wf-progress)` — 先新增 wf-status，保持旧入口存活
2. `feat(change-P0): downgrade wf-4-level-verification to reference` — frontmatter 改 user-invocable
3. `feat(change-P0): downgrade wf-anti-patterns to reference` — frontmatter 改 user-invocable
4. `feat(change-P0): tighten wf-git-conventions trigger scope` — description 加 negative trigger
5. `docs(wf): add flag cheatsheet` — 新增 docs/wf-flags-cheatsheet.md
6. `refactor(skills): remove wf-next (merged into wf-status)` — 清理旧 skill
7. `docs: sync ARCHITECTURE.md / README.md / docs/ for P0 skill consolidation` — 文档同步

每步独立 commit，任一步失败可单独 revert。
