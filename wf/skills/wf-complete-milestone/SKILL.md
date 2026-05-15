---
description: Archive the current WF milestone and reset for the next one. Invoke only when the user explicitly runs /wf-complete-milestone — this creates a git tag and rolls over project scope; never auto-trigger.
argument-hint: "[version]"
allowed-tools: Read Write Bash Task AskUserQuestion
---

# /wf-complete-milestone

@$HOME/.claude/wf/workflows/complete-milestone.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md
@$HOME/.claude/wf/references/git-conventions.md

$ARGUMENTS

按 workflow 端到端执行：验证所有阶段就绪 → 归档 ROADMAP/REQUIREMENTS/STATE/phases/specs/changes-archive → 重置状态 → 打 git tag → 可选链接到 new-milestone。

保留所有工作流门禁（就绪验证、追溯检查、归档完整性、tag 命名）。
