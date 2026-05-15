---
description: Execute a WF phase with wave-based parallel sub-agents (file writes, commits, worktrees). Invoke only when the user explicitly runs /wf-execute-phase N or when the WF dispatcher (wf-do / wf-autonomous) routes here with an explicit phase number — never auto-trigger; side effects are real.
argument-hint: "<phase-number> [--wave N] [--interactive] [--chain]"
allowed-tools: Read Write Edit Glob Grep Bash Task AskUserQuestion
---

# /wf-execute-phase

@$HOME/.claude/wf/workflows/execute-phase.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md
@$HOME/.claude/wf/references/git-conventions.md

阶段: $ARGUMENTS

可用 flag：
- `--wave N` — 只执行指定 wave
- `--interactive` — 逐任务内联执行
- `--chain` — 完成后自动验证

按 workflow 端到端执行：加载计划 → 文件冲突预检 → 按 wave 分组 → worktree 隔离并行 executor → 收集结果 → 阶段验证。

保留所有工作流门禁（wave 执行、检查点、验证、状态更新）。
