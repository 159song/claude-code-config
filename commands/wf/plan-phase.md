---
name: wf:plan-phase
description: 为指定阶段生成可执行计划
argument-hint: "<phase-number> [--chain] [--skip-research]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
为阶段生成执行计划：研究 → 规划 → 质量检查（最多 3 次修订）。

产出:
- `.planning/phase-{N}/PLAN.md` — 执行计划
- `.planning/phase-{N}/RESEARCH.md` — 实现研究（可选）

完成后运行 `/wf-execute-phase N`。
</objective>

<execution_context>
@{{WF_ROOT}}/wf/workflows/plan-phase.md
@{{WF_ROOT}}/wf/references/ui-brand.md
@{{WF_ROOT}}/wf/references/gates.md
</execution_context>

<context>
阶段: $ARGUMENTS
</context>

<process>
按照 @{{WF_ROOT}}/wf/workflows/plan-phase.md 端到端执行。
保留所有工作流门禁（质量检查、安全门禁、修订循环）。
</process>
