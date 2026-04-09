---
name: wf:autonomous
description: 全自动执行所有剩余阶段 — 讨论→规划→执行
argument-hint: "[--from N] [--to N] [--only N] [--interactive]"
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
全自动执行所有剩余阶段。对每个阶段: 讨论 → 规划 → 执行。
只在需要用户判断时暂停。

这是 WF 系统的推荐默认入口。

产出:
- 每个阶段的完整 artifact (CONTEXT, PLAN, SUMMARY, VERIFICATION)
- `.planning/STATE.md` — 实时更新
</objective>

<execution_context>
@{{WF_ROOT}}/wf/workflows/autonomous.md
@{{WF_ROOT}}/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @{{WF_ROOT}}/wf/workflows/autonomous.md 端到端执行。
保留所有工作流门禁（阶段发现、逐阶段执行、阻塞处理）。
</process>
