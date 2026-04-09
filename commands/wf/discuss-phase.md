---
name: wf:discuss-phase
description: 讨论指定阶段的设计决策和灰色地带
argument-hint: "<phase-number> [--auto] [--chain] [--batch]"
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
讨论指定阶段的灰色地带，产出决策文档。

产出:
- `.planning/phase-{N}/CONTEXT.md` — 阶段上下文和决策
- `.planning/phase-{N}/DISCUSSION-LOG.md` — 讨论过程

完成后运行 `/wf-plan-phase N`。
</objective>

<execution_context>
@{{WF_ROOT}}/wf/workflows/discuss-phase.md
@{{WF_ROOT}}/wf/references/ui-brand.md
</execution_context>

<context>
阶段: $ARGUMENTS
</context>

<process>
按照 @{{WF_ROOT}}/wf/workflows/discuss-phase.md 端到端执行。
保留所有工作流门禁。
</process>
