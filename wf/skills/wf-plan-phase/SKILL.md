---
description: Generate an executable plan for a specific WF phase - research, task decomposition, wave grouping, quality check. Only invoke explicitly via /wf-plan-phase N; requires phase number and has gate-driven revision cycles that must not auto-trigger.
disable-model-invocation: true
argument-hint: "<phase-number> [--chain] [--skip-research]"
allowed-tools: Read Write Bash Glob Grep Task AskUserQuestion
---

# /wf-plan-phase

@$HOME/.claude/wf/workflows/plan-phase.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md

阶段: $ARGUMENTS

按 workflow 端到端执行：可选研究 → 委托 wf-planner → 质量门禁（最多 3 次修订）→ 产出 PLAN*.md + 可选 THREAT-MODEL.md。

可用 flag：
- `--chain` — 完成后自动调用 `/wf-execute-phase`
- `--skip-research` — 跳过研究直接规划

完成后建议运行 `/wf-execute-phase N`。

保留所有工作流门禁（需求覆盖 ≥90%、计划质量、安全威胁、修订循环）。
