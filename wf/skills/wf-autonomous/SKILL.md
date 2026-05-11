---
description: Run fully autonomous WF mode across phases (discuss → plan → execute → verify chain). Only invoke explicitly via /wf-autonomous; this runs unattended multi-hour work and must never auto-trigger.
disable-model-invocation: true
argument-hint: "[--from N] [--to N] [--only N] [--interactive]"
allowed-tools: Read Write Edit Glob Grep Bash Task AskUserQuestion
---

# /wf-autonomous

@$HOME/.claude/wf/workflows/autonomous.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md
@$HOME/.claude/wf/references/continuation-format.md

$ARGUMENTS

按 workflow 端到端执行：检查检查点恢复 → 遍历阶段 → 每阶段自动 discuss/plan/execute/verify 链 → gap closure（最多 1 次）→ 自动推进。

保留所有工作流门禁（检查点写入、预算检查、失败暂停、归档）。
